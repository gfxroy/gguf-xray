import { archFromMetadata, computeBufferBytes, kvCacheBytes, llama3_8bArch, kvElementsPerTokenLayer } from "./memory";
import { parseGguf } from "./gguf";
import { llamaLikeGguf } from "./ggufWrite";
import { GgufWriter } from "./ggufWrite";
import { GGUF_TYPE } from "./gguf";

describe("KV cache", () => {
  it("Llama-3-8B is 128 KiB per token in f16", () => {
    const arch = llama3_8bArch();
    // 32 layers * 8 kv heads * 128 dim * 2 (K+V) * 2 bytes = 131072 = 128 KiB
    const hand = 32 * 8 * 128 * 2 * 2;
    expect(hand).toBe(128 * 1024);
    const kv = kvCacheBytes(arch, 1, "f16");
    expect(kv.perTokenF16).toBe(128 * 1024);
    expect(kv.total).toBe(128 * 1024);
    expect(kvElementsPerTokenLayer(arch, 0)).toBe(8 * 128 * 2);
  });

  it("scales linearly with context for f16", () => {
    const arch = llama3_8bArch();
    const kv = kvCacheBytes(arch, 8192, "f16");
    expect(kv.total).toBe(128 * 1024 * 8192);
  });

  it("q8_0 and q4_0 pack with their block sizes", () => {
    const arch = llama3_8bArch();
    const elems = 32 * 8 * 128 * 2; // per token
    const q8 = kvCacheBytes(arch, 1, "q8_0");
    const q4 = kvCacheBytes(arch, 1, "q4_0");
    expect(q8.total).toBe((elems / 32) * 34);
    expect(q4.total).toBe((elems / 32) * 18);
  });

  it("reads architecture from GGUF metadata", () => {
    const buf = llamaLikeGguf();
    const g = parseGguf(buf);
    const arch = archFromMetadata(g.metadata);
    expect(arch).toMatchObject({
      architecture: "llama",
      nLayer: 32,
      nEmbd: 4096,
      nHead: 32,
      nHeadKv: 8,
      nKey: 128,
      nVal: 128,
    });
    const kv = kvCacheBytes(arch!, 1, "f16");
    expect(kv.perTokenF16).toBe(128 * 1024);
  });

  it("uses per-layer head_count_kv arrays", () => {
    const w = new GgufWriter().header(3, 0, 6);
    w.kvString("general.architecture", "llama");
    w.kvU32("llama.block_count", 4);
    w.kvU32("llama.embedding_length", 256);
    w.kvU32("llama.context_length", 1024);
    w.kvU32("llama.attention.head_count", 8);
    w.kvArray("llama.attention.head_count_kv", GGUF_TYPE.UINT32, [1, 2, 4, 8]);
    const arch = archFromMetadata(parseGguf(w.bytes).metadata)!;
    expect(kvElementsPerTokenLayer(arch, 0)).toBe(1 * (32 + 32));
    expect(kvElementsPerTokenLayer(arch, 3)).toBe(8 * (32 + 32));
    const kv = kvCacheBytes(arch, 1, "f16");
    expect(kv.perTokenF16).toBe((1 + 2 + 4 + 8) * 64 * 2);
  });

  it("applies sliding_window on local layers", () => {
    const arch = llama3_8bArch();
    arch.nLayer = 4;
    arch.slidingWindow = 1024;
    arch.slidingWindowPattern = 2;
    const kv = kvCacheBytes(arch, 8192, "f16");
    // layers 0,2 local (1024), layers 1,3 global (8192) with pattern=2
    const per = kvElementsPerTokenLayer(arch, 0) * 2; // bytes f16
    expect(kv.perLayer[0]).toBe(per * 1024);
    expect(kv.perLayer[1]).toBe(per * 8192);
    expect(kv.perLayer[2]).toBe(per * 1024);
    expect(kv.perLayer[3]).toBe(per * 8192);
  });

  it("MLA kv_lora_rank stores compressed K/V, not n_head * dim", () => {
    const w = new GgufWriter().header(3, 0, 10);
    w.kvString("general.architecture", "deepseek2");
    w.kvU32("deepseek2.block_count", 60);
    w.kvU32("deepseek2.embedding_length", 5120);
    w.kvU32("deepseek2.context_length", 16384);
    w.kvU32("deepseek2.attention.head_count", 128);
    w.kvU32("deepseek2.attention.head_count_kv", 128);
    w.kvU32("deepseek2.attention.key_length", 192);
    w.kvU32("deepseek2.attention.value_length", 128);
    w.kvU32("deepseek2.attention.kv_lora_rank", 512);
    w.kvU32("deepseek2.rope.dimension_count", 64);
    const arch = archFromMetadata(parseGguf(w.bytes).metadata)!;
    expect(arch.kvLoraRank).toBe(512);
    // K = 512+64, V = 512 → 1088 elements / token / layer
    expect(kvElementsPerTokenLayer(arch, 0)).toBe(512 + 64 + 512);
    const kv = kvCacheBytes(arch, 1, "f16");
    expect(kv.perTokenF16).toBe(60 * 1088 * 2);
  });

  it("compute buffer uses the documented FA formula", () => {
    const arch = llama3_8bArch();
    const bytes = computeBufferBytes(arch);
    // 64 MiB + 4 * 14336 * 512 * 4
    expect(bytes).toBe(64 * 1024 * 1024 + 4 * 14336 * 512 * 4);
  });
});
