import { breakdownTensors, layerIndex, type GgufFile, type GgufTensor } from "./gguf";
import { ggmlTypeName } from "./ggml";
import {
  computeBufferBytes,
  kvCacheBytes,
  type ArchInfo,
  type KvType,
} from "./memory";
import { formatCtx } from "./format";

export const VRAM_PRESETS = [8, 12, 16, 24, 32, 48, 80] as const;

export type PlanInput = {
  gguf: GgufFile;
  arch: ArchInfo | null;
  fileName: string;
  vramGb: number;
  appleUnified: boolean;
  nCtx: number;
  kvType: KvType;
};

export type Plan = {
  available: number;
  weightsGpu: number;
  kvGpu: number;
  buffer: number;
  used: number;
  free: number;
  nLayer: number;
  ngl: number;
  fullyFits: boolean;
  /** Last `ngl` repeating layers live on GPU (llama.cpp counts from the end). */
  gpuLayers: number[];
  layerBytes: number[];
  otherBytes: number;
  totalWeightBytes: number;
  kvTotal: number;
  kvPerToken: number;
  kvPerTokenF16: number;
  command: string;
  ollamaEnv: string;
  verdict: string;
  byType: { type: number; name: string; count: number; bytes: number }[];
  byLayer: { layer: number; bytes: number; count: number }[];
};

function gib(n: number): number {
  return n * 1024 ** 3;
}

function layerBytesList(tensors: GgufTensor[], nLayer: number): { layers: number[]; other: number } {
  const layers = Array.from({ length: nLayer }, () => 0);
  let other = 0;
  let maxSeen = -1;
  for (const t of tensors) {
    const i = layerIndex(t.name);
    if (i == null) other += t.nbytes;
    else {
      if (i >= layers.length) {
        while (layers.length <= i) layers.push(0);
      }
      layers[i] += t.nbytes;
      if (i > maxSeen) maxSeen = i;
    }
  }
  return { layers, other };
}

function gpuLayerIndices(nLayer: number, ngl: number): number[] {
  const n = Math.max(0, Math.min(ngl, nLayer));
  const start = nLayer - n;
  const out: number[] = [];
  for (let i = start; i < nLayer; i++) out.push(i);
  return out;
}

export function planOffload(input: PlanInput): Plan {
  const { gguf, arch, fileName, vramGb, appleUnified, nCtx, kvType } = input;
  const nLayer = arch?.nLayer ?? inferLayerCount(gguf);
  const { layers: layerBytes, other: otherBytes } = layerBytesList(gguf.tensors, nLayer);
  const totalWeightBytes = gguf.tensorBytes || layerBytes.reduce((a, b) => a + b, 0) + otherBytes;

  const available = gib(vramGb) * (appleUnified ? 0.75 : 1);
  const kv = arch
    ? kvCacheBytes(arch, nCtx, kvType)
    : { perLayer: layerBytes.map(() => 0), total: 0, perToken: 0, perTokenF16: 0 };
  const bufferAll = arch ? computeBufferBytes(arch) : 64 * 1024 * 1024;

  let bestNgl = 0;
  for (let ngl = 0; ngl <= nLayer; ngl++) {
    const mem = gpuMem(ngl, nLayer, layerBytes, otherBytes, kv.perLayer, bufferAll);
    if (mem.used <= available) bestNgl = ngl;
  }
  const fullyFits = bestNgl === nLayer && gpuMem(nLayer, nLayer, layerBytes, otherBytes, kv.perLayer, bufferAll).used <= available;
  const ngl = bestNgl;
  const mem = gpuMem(ngl, nLayer, layerBytes, otherBytes, kv.perLayer, bufferAll);
  const gpuLayers = gpuLayerIndices(nLayer, ngl);

  const cmdNgl = fullyFits ? 99 : ngl;
  const kvFlags = kvType === "f16" ? "" : ` -ctk ${kvType} -ctv ${kvType}`;
  const command = `llama-server -m ${shellFile(fileName)} -ngl ${cmdNgl} -c ${nCtx} -fa on${kvFlags}`;

  const ollamaKv = kvType === "f16" ? "f16" : kvType;
  const ollamaEnv = [
    `OLLAMA_FLASH_ATTENTION=1`,
    `OLLAMA_CONTEXT_LENGTH=${nCtx}`,
    `OLLAMA_KV_CACHE_TYPE=${ollamaKv}`,
    ``,
    `# Modelfile`,
    `FROM ./${fileName}`,
    `PARAMETER num_ctx ${nCtx}`,
    `PARAMETER num_gpu ${fullyFits ? 99 : ngl}`,
  ].join("\n");

  let verdict: string;
  if (nLayer === 0) {
    verdict = `Weights ${totalWeightBytes} bytes`;
  } else if (fullyFits) {
    verdict = verdictFitsFully(vramGb, nCtx, appleUnified);
  } else if (ngl === 0) {
    verdict = `Does not fit in ${vramGb} GB — run on CPU (ngl 0)`;
  } else {
    verdict = `Offload ${ngl} of ${nLayer} layers`;
  }

  const bd = breakdownTensors(gguf.tensors, ggmlTypeName);

  return {
    available,
    weightsGpu: mem.weights,
    kvGpu: mem.kv,
    buffer: mem.buffer,
    used: mem.used,
    free: Math.max(0, available - mem.used),
    nLayer,
    ngl,
    fullyFits,
    gpuLayers,
    layerBytes,
    otherBytes,
    totalWeightBytes,
    kvTotal: kv.total,
    kvPerToken: kv.perToken,
    kvPerTokenF16: kv.perTokenF16,
    command,
    ollamaEnv,
    verdict,
    byType: bd.byType,
    byLayer: bd.byLayer,
  };
}

function gpuMem(
  ngl: number,
  nLayer: number,
  layerBytes: number[],
  otherBytes: number,
  kvPerLayer: number[],
  bufferAll: number,
): { weights: number; kv: number; buffer: number; used: number } {
  if (ngl <= 0) return { weights: 0, kv: 0, buffer: 0, used: 0 };
  const idxs = gpuLayerIndices(nLayer, Math.min(ngl, nLayer));
  let weights = 0;
  let kv = 0;
  for (const i of idxs) {
    weights += layerBytes[i] ?? 0;
    kv += kvPerLayer[i] ?? 0;
  }
  if (ngl >= nLayer) weights += otherBytes;
  const buffer = bufferAll;
  return { weights, kv, buffer, used: weights + kv + buffer };
}

function inferLayerCount(gguf: GgufFile): number {
  let max = -1;
  for (const t of gguf.tensors) {
    const i = layerIndex(t.name);
    if (i != null && i > max) max = i;
  }
  return max + 1;
}

function shellFile(name: string): string {
  if (/^[A-Za-z0-9._+/-]+$/.test(name)) return name;
  return `'${name.replace(/'/g, `'\\''`)}'`;
}

export function verdictFitsFully(vramGb: number, nCtx: number, appleUnified: boolean): string {
  const ctxLabel = formatCtx(nCtx);
  if (appleUnified) return `Fits fully on ${vramGb} GB unified with ${ctxLabel} context`;
  return `Fits fully on ${vramGb} GB with ${ctxLabel} context`;
}
