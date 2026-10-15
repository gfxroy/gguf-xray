import { describe, expect, it } from "vitest";
import { buildQuantComparison } from "./quants";
import { POPULAR_DEVICES } from "./devices";

describe("quants", () => {
  const rtx4090 = POPULAR_DEVICES.find((d) => d.id === "rtx-4090")!;
  const rtx2060 = POPULAR_DEVICES.find((d) => d.id === "rtx-2060-6gb")!;

  it("generates fallback standard quants when files list is empty", () => {
    const comparison = buildQuantComparison({
      device: rtx4090,
      currentFileName: "model-Q4_K_M.gguf",
      currentSizeBytes: 4.5 * 1024 ** 3,
      nLayer: 32,
      vramGb: 24,
      appleUnified: false,
      kvGpuBytes: 256 * 1024 * 1024,
      bufferBytes: 100 * 1024 * 1024,
    });

    expect(comparison.length).toBeGreaterThanOrEqual(5);
    const q4 = comparison.find((c) => c.quant === "Q4_K_M");
    expect(q4).toBeDefined();
    expect(q4?.fitsStatus).toBe("Full VRAM");
    expect(q4?.fitsBadgeClass).toBe("great");
    expect(q4?.isCurrent).toBe(true);
  });

  it("marks larger quants as Partial or Won't Fit on low VRAM GPU", () => {
    const comparison = buildQuantComparison({
      device: rtx2060, // 6 GB VRAM, 16 GB RAM
      currentFileName: "model-Q4_K_M.gguf",
      currentSizeBytes: 5 * 1024 ** 3,
      nLayer: 32,
      vramGb: 6,
      appleUnified: false,
      kvGpuBytes: 256 * 1024 * 1024,
      bufferBytes: 100 * 1024 * 1024,
    });

    const q8 = comparison.find((c) => c.quant === "Q8_0");
    expect(q8).toBeDefined();
    expect(q8?.fitsStatus).not.toBe("Full VRAM");
  });

  it("uses real files when provided", () => {
    const files = [
      { path: "Llama-3.2-1B-Instruct-Q4_K_M.gguf", size: 800 * 1024 * 1024 },
      { path: "Llama-3.2-1B-Instruct-Q8_0.gguf", size: 1300 * 1024 * 1024 },
    ];

    const comparison = buildQuantComparison({
      device: rtx4090,
      files,
      currentFileName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
      currentSizeBytes: 800 * 1024 * 1024,
      nLayer: 16,
      vramGb: 24,
      appleUnified: false,
      kvGpuBytes: 50 * 1024 * 1024,
      bufferBytes: 50 * 1024 * 1024,
    });

    expect(comparison.length).toBe(2);
    expect(comparison[0].sizeBytes).toBe(800 * 1024 * 1024);
    expect(comparison[0].filePath).toBe("Llama-3.2-1B-Instruct-Q4_K_M.gguf");
  });
});
