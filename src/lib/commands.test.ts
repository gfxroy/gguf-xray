import { describe, expect, it } from "vitest";
import { buildCommands } from "./commands";

describe("commands", () => {
  it("formats llama-server with ngl 99 when fully fits", () => {
    const bundle = buildCommands({
      fileName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
      repoId: "bartowski/Llama-3.2-1B-Instruct-GGUF",
      ngl: 16,
      nLayer: 16,
      fullyFits: true,
      nCtx: 8192,
      kvType: "f16",
    });

    expect(bundle.llamaServer).toContain("-ngl 99");
    expect(bundle.llamaServer).toContain("-c 8192");
    expect(bundle.ollamaRun).toBe("ollama run llama3.2:1b");
    expect(bundle.lmStudioPreset).toContain("Max (all layers on GPU)");
  });

  it("includes KV quant flags when not f16", () => {
    const bundle = buildCommands({
      fileName: "model.gguf",
      ngl: 12,
      nLayer: 32,
      fullyFits: false,
      nCtx: 4096,
      kvType: "q4_0",
    });

    expect(bundle.llamaServer).toContain("-ctk q4_0 -ctv q4_0");
    expect(bundle.llamaServer).toContain("-ngl 12");
    expect(bundle.lmStudioPreset).toContain("12 of 32 layers");
  });
});
