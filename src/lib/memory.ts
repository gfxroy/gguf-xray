import { GGML_TYPE, bytesPerElement, tensorByteSize } from "./ggml";
import { metaNumber, metaNumbers, metaString, type GgufFile, type GgufValue } from "./gguf";

export type KvType = "f16" | "q8_0" | "q4_0";

export const KV_TYPE_GGML: Record<KvType, number> = {
  f16: GGML_TYPE.F16,
  q8_0: GGML_TYPE.Q8_0,
  q4_0: GGML_TYPE.Q4_0,
};

export type ArchInfo = {
  architecture: string;
  name: string;
  nLayer: number;
  nCtxTrain: number;
  nEmbd: number;
  nHead: number | number[];
  nHeadKv: number | number[];
  /** Key head dim. Falls back to nEmbd / nHead. */
  nKey: number;
  nVal: number;
  nFf: number;
  slidingWindow?: number;
  /** If set, every Nth layer (index % N === N-1) is full-context; others use the window. */
  slidingWindowPattern?: number;
  expertCount?: number;
  expertUsed?: number;
  expertFf?: number;
  /** Multi-Latent Attention (deepseek2): compressed KV rank. */
  kvLoraRank?: number;
  keyLengthMla?: number;
  valueLengthMla?: number;
  ropeDim?: number;
};

function at(arch: string, key: string): string {
  return `${arch}.${key}`;
}

function num(meta: Record<string, GgufValue>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = metaNumber(meta[k]);
    if (v != null) return v;
  }
  return undefined;
}

function nums(meta: Record<string, GgufValue>, ...keys: string[]): number | number[] | undefined {
  for (const k of keys) {
    const v = metaNumbers(meta[k]);
    if (v != null) return v;
  }
  return undefined;
}

function first(n: number | number[] | undefined): number | undefined {
  if (n == null) return undefined;
  return typeof n === "number" ? n : n[0];
}

export function archFromMetadata(meta: Record<string, GgufValue>): ArchInfo | null {
  const architecture = metaString(meta["general.architecture"]) ?? "";
  if (!architecture) return null;
  const a = architecture;
  const nLayer = num(meta, at(a, "block_count"), at(a, "decoder_block_count"));
  const nCtxTrain = num(meta, at(a, "context_length"));
  const nEmbd = num(meta, at(a, "embedding_length"));
  if (nLayer == null || nEmbd == null) return null;

  const nHead = nums(meta, at(a, "attention.head_count")) ?? 0;
  const nHeadKv = nums(meta, at(a, "attention.head_count_kv")) ?? nHead;
  const head0 = first(nHead) || 1;
  const nKey = num(meta, at(a, "attention.key_length")) ?? Math.round(nEmbd / head0);
  const nVal = num(meta, at(a, "attention.value_length")) ?? nKey;
  const nFf =
    num(meta, at(a, "feed_forward_length"), at(a, "expert_feed_forward_length")) ?? nEmbd * 4;

  const slidingWindow = num(meta, at(a, "attention.sliding_window"));
  const slidingWindowPattern = num(meta, at(a, "attention.sliding_window_pattern"));
  const expertCount = num(meta, at(a, "expert_count"));
  const expertUsed = num(meta, at(a, "expert_used_count"));
  const expertFf = num(meta, at(a, "expert_feed_forward_length"));
  const kvLoraRank = num(meta, at(a, "attention.kv_lora_rank"));
  const keyLengthMla = num(meta, at(a, "attention.key_length_mla"));
  const valueLengthMla = num(meta, at(a, "attention.value_length_mla"));
  const ropeDim = num(meta, at(a, "rope.dimension_count"), at(a, "rope.dimension_sections"));

  return {
    architecture,
    name: metaString(meta["general.name"]) ?? architecture,
    nLayer,
    nCtxTrain: nCtxTrain ?? 4096,
    nEmbd,
    nHead,
    nHeadKv,
    nKey,
    nVal,
    nFf,
    slidingWindow,
    slidingWindowPattern,
    expertCount,
    expertUsed,
    expertFf,
    kvLoraRank,
    keyLengthMla,
    valueLengthMla,
    ropeDim,
  };
}

function layerScalar(v: number | number[], i: number): number {
  return typeof v === "number" ? v : (v[i] ?? v[0] ?? 0);
}

function isLocalLayer(il: number, pattern: number | undefined, hasWindow: boolean): boolean {
  if (!hasWindow) return false;
  const p = pattern ?? 2;
  if (p <= 1) return true;
  // Gemma-style: every p-th layer is global (full context). Layer 0 is local.
  return il % p !== p - 1;
}

/**
 * KV elements (K + V) stored for one token in one layer.
 * MLA (kv_lora_rank): compressed latent, not n_head_kv * head_dim.
 */
export function kvElementsPerTokenLayer(arch: ArchInfo, layer: number): number {
  if (arch.kvLoraRank && arch.kvLoraRank > 0) {
    const rope =
      arch.ropeDim ??
      (arch.keyLengthMla != null ? Math.max(0, arch.keyLengthMla - (arch.nKey || 0)) : 0) ??
      0;
    // DeepSeek MLA: K = kv_lora_rank + qk_rope_head_dim, V = kv_lora_rank.
    const k = arch.kvLoraRank + (rope || 0);
    const v = arch.kvLoraRank;
    return k + v;
  }
  const nKv = layerScalar(arch.nHeadKv, layer) || layerScalar(arch.nHead, layer) || 1;
  return nKv * (arch.nKey + arch.nVal);
}

export function kvBytesForElements(nElements: number, kvType: KvType): number {
  const ggml = KV_TYPE_GGML[kvType];
  if (nElements === 0) return 0;
  // Pack as a 1-D tensor so quantized types use their real block size.
  return tensorByteSize(ggml, [nElements]);
}

export type KvEstimate = {
  perLayer: number[];
  total: number;
  /** Unquantized f16 bytes per token across all layers (useful for tests). */
  perTokenF16: number;
  perToken: number;
};

export function kvCacheBytes(arch: ArchInfo, nCtx: number, kvType: KvType): KvEstimate {
  const ctx = Math.max(1, Math.min(nCtx, Math.max(arch.nCtxTrain, nCtx)));
  const perLayer: number[] = [];
  let total = 0;
  let perTokenElems = 0;
  for (let i = 0; i < arch.nLayer; i++) {
    const elems = kvElementsPerTokenLayer(arch, i);
    perTokenElems += elems;
    const local = isLocalLayer(i, arch.slidingWindowPattern, arch.slidingWindow != null);
    const tokens = local && arch.slidingWindow ? Math.min(ctx, arch.slidingWindow) : ctx;
    const bytes = kvBytesForElements(elems * tokens, kvType);
    perLayer.push(bytes);
    total += bytes;
  }
  const perTokenF16 = perTokenElems * 2;
  const perToken = kvBytesForElements(perTokenElems, kvType);
  return { perLayer, total, perTokenF16, perToken };
}

/**
 * Compute-buffer estimate with flash attention (`-fa on`).
 *
 * llama.cpp sizes the ggml graph allocator to the largest intermediate.
 * With FA, that is the FFN scratch (gate / up / silu / down), not an n_ctx²
 * attention matrix:
 *
 *   64 MiB graph overhead
 * + 4 × n_ff × n_ubatch × 4 bytes
 *
 * n_ubatch defaults to 512 (llama-server). For MoE, n_ff is
 * expert_feed_forward_length × expert_used_count (active experts this step).
 *
 * Real backends vary ±30%. This is an estimate, not a measurement.
 */
export const COMPUTE_GRAPH_OVERHEAD = 64 * 1024 * 1024;
export const COMPUTE_UBATCH = 512;

export function computeBufferBytes(arch: ArchInfo, nUbatch = COMPUTE_UBATCH): number {
  let nFf = arch.nFf;
  if (arch.expertCount && arch.expertUsed && arch.expertFf) {
    nFf = arch.expertFf * arch.expertUsed;
  } else if (arch.expertCount && arch.expertUsed) {
    nFf = arch.nFf * arch.expertUsed;
  }
  const scratch = 4 * nFf * nUbatch * 4;
  return COMPUTE_GRAPH_OVERHEAD + scratch;
}

export function kvTypeBytesPerElem(kvType: KvType): number {
  return bytesPerElement(KV_TYPE_GGML[kvType]);
}

/** Llama-3-8B hand check: 32 layers, 8 kv heads, 128 dim → 128 KiB / token f16. */
export function llama3_8bArch(): ArchInfo {
  return {
    architecture: "llama",
    name: "Llama 3 8B",
    nLayer: 32,
    nCtxTrain: 8192,
    nEmbd: 4096,
    nHead: 32,
    nHeadKv: 8,
    nKey: 128,
    nVal: 128,
    nFf: 14336,
  };
}

export function inferArchFromTensors(gguf: GgufFile): ArchInfo | null {
  const fromMeta = archFromMetadata(gguf.metadata);
  if (fromMeta) return fromMeta;
  return null;
}
