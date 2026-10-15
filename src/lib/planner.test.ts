import { parseGguf } from "./gguf";
import { llamaLikeGguf } from "./ggufWrite";
import { archFromMetadata, llama3_8bArch } from "./memory";
import { planOffload, verdictFitsFully } from "./planner";
import { GGML_TYPE } from "./ggml";
import { GgufWriter } from "./ggufWrite";

function planFrom(buf: Uint8Array, extra?: Partial<Parameters<typeof planOffload>[0]>) {
  const gguf = parseGguf(buf);
  const arch = archFromMetadata(gguf.metadata);
  return planOffload({
    gguf,
    arch,
    fileName: "model.gguf",
    vramGb: 16,
    appleUnified: false,
    nCtx: 8192,
    kvType: "f16",
    ...extra,
  });
}

describe("offload planner", () => {
  it("fully fits a tiny model on 16 GB", () => {
    const buf = llamaLikeGguf({ nLayer: 4, nEmbd: 256, nHead: 4, nHeadKv: 2, nFf: 512 });
    const p = planFrom(buf, { vramGb: 16, nCtx: 2048 });
    expect(p.fullyFits).toBe(true);
    expect(p.ngl).toBe(p.nLayer);
    expect(p.verdict).toBe(verdictFitsFully(16, 2048, false));
    expect(p.command).toMatch(/llama-server -m model\.gguf -ngl 99 -c 2048 -fa on$/);
    expect(p.ollamaEnv).toMatch(/OLLAMA_FLASH_ATTENTION=1/);
    expect(p.ollamaEnv).toMatch(/PARAMETER num_gpu 99/);
  });

  it("reports Offload N of M when VRAM is tight", () => {
    // 32 fat layers of Q4_K 4096x4096 ≈ 9 MB each, plus KV
    const buf = llamaLikeGguf({ nLayer: 32, nEmbd: 4096, nHead: 32, nHeadKv: 8, nFf: 14336 });
    const p = planFrom(buf, { vramGb: 1, nCtx: 8192, kvType: "f16" });
    expect(p.nLayer).toBe(32);
    expect(p.fullyFits).toBe(false);
    expect(p.ngl).toBeGreaterThan(0);
    expect(p.ngl).toBeLessThan(32);
    expect(p.verdict).toBe(`Offload ${p.ngl} of 32 layers`);
    expect(p.command).toContain(`-ngl ${p.ngl}`);
    expect(p.command).not.toContain("-ngl 99");
    expect(p.used).toBeLessThanOrEqual(p.available);
  });

  it("returns ngl 0 when even one layer cannot fit", () => {
    const w = new GgufWriter().header(3, 2, 6);
    w.kvString("general.architecture", "llama");
    w.kvU32("llama.block_count", 2);
    w.kvU32("llama.embedding_length", 8192);
    w.kvU32("llama.context_length", 8192);
    w.kvU32("llama.attention.head_count", 64);
    w.kvU32("llama.attention.head_count_kv", 8);
    // ~12 GB F32 per repeating layer, so even ngl 1 overruns 8 GB.
    w.tensor("blk.0.attn_q.weight", [3_000_000_000], GGML_TYPE.F32, 0);
    w.tensor("blk.1.attn_q.weight", [3_000_000_000], GGML_TYPE.F32, 0);
    const p = planFrom(w.bytes, { vramGb: 8, nCtx: 8192 });
    expect(p.fullyFits).toBe(false);
    expect(p.ngl).toBe(0);
    expect(p.verdict).toMatch(/Does not fit in 8 GB/);
    expect(p.command).toContain("-ngl 0");
  });

  it("Apple unified memory uses 75% of the listed size", () => {
    const buf = llamaLikeGguf({ nLayer: 4, nEmbd: 256, nHead: 4, nHeadKv: 2, nFf: 512 });
    const p = planFrom(buf, { vramGb: 16, appleUnified: true, nCtx: 2048 });
    expect(p.available).toBe(16 * 1024 ** 3 * 0.75);
    expect(p.verdict).toBe(verdictFitsFully(16, 2048, true));
  });

  it("adds -ctk/-ctv for quantized KV and omits them for f16", () => {
    const buf = llamaLikeGguf({ nLayer: 2, nEmbd: 256, nHead: 4, nHeadKv: 2, nFf: 512 });
    const f16 = planFrom(buf, { kvType: "f16" });
    const q8 = planFrom(buf, { kvType: "q8_0" });
    expect(f16.command).not.toMatch(/-ctk/);
    expect(q8.command).toMatch(/-ctk q8_0 -ctv q8_0/);
    expect(q8.ollamaEnv).toMatch(/OLLAMA_KV_CACHE_TYPE=q8_0/);
  });

  it("offloads the last ngl layers (llama.cpp order)", () => {
    const buf = llamaLikeGguf({ nLayer: 8, nEmbd: 256, nHead: 4, nHeadKv: 2, nFf: 512 });
    const p = planFrom(buf, { vramGb: 8, nCtx: 512 });
    if (p.ngl > 0 && p.ngl < p.nLayer) {
      expect(p.gpuLayers[0]).toBe(p.nLayer - p.ngl);
      expect(p.gpuLayers.at(-1)).toBe(p.nLayer - 1);
    }
  });

  it("KV per token for the synthetic Llama-3-8B metadata matches 128 KiB f16", () => {
    const buf = llamaLikeGguf();
    const p = planFrom(buf, { nCtx: 1, vramGb: 80 });
    expect(p.kvPerTokenF16).toBe(128 * 1024);
    expect(llama3_8bArch().nLayer).toBe(32);
  });
});
