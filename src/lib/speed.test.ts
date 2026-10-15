import { describe, expect, it } from "vitest";
import { estimateSpeed, calculateMaxContext, recommendBestQuant, evaluateDeviceFit } from "./speed";
import { POPULAR_DEVICES } from "./devices";
import { llama3_8bArch } from "./memory";
import type { GgufFile } from "./gguf";

describe("speed", () => {
  const rtx4090 = POPULAR_DEVICES.find((d) => d.id === "rtx-4090")!;
  const rtx4060 = POPULAR_DEVICES.find((d) => d.id === "rtx-4060")!;
  const cpuDdr5 = POPULAR_DEVICES.find((d) => d.id === "cpu-ddr5-32gb")!;

  it("calculates high tok/s for full offload on high bandwidth GPU", () => {
    // 4.5 GB weights on RTX 4090 (1008 GB/s)
    const weightsGpu = 4.5 * 1024 ** 3;
    const kv = 256 * 1024 * 1024;
    const res = estimateSpeed({
      device: rtx4090,
      weightsGpu,
      weightsCpu: 0,
      kvTotalBytes: kv,
      nLayer: 32,
      ngl: 32,
    });

    expect(res.tokPerSec).toBeGreaterThan(50);
    expect(res.offloadFraction).toBe(1);
    expect(res.formulaDescription).toContain("1008 GB/s");
  });

  it("calculates lower tok/s with PCIe penalty for partial offload", () => {
    // 16 layers GPU, 16 layers CPU
    const res = estimateSpeed({
      device: rtx4060,
      weightsGpu: 3 * 1024 ** 3,
      weightsCpu: 3 * 1024 ** 3,
      kvTotalBytes: 512 * 1024 * 1024,
      nLayer: 32,
      ngl: 16,
    });

    expect(res.tokPerSec).toBeLessThan(35);
    expect(res.offloadFraction).toBe(0.5);
    expect(res.formulaDescription).toContain("Partial offload");
  });

  it("calculates pure CPU tok/s correctly", () => {
    const res = estimateSpeed({
      device: cpuDdr5,
      weightsGpu: 0,
      weightsCpu: 4.5 * 1024 ** 3,
      kvTotalBytes: 256 * 1024 * 1024,
      nLayer: 32,
      ngl: 0,
    });

    expect(res.tokPerSec).toBeLessThan(15);
    expect(res.offloadFraction).toBe(0);
    expect(res.formulaDescription).toContain("Pure CPU");
  });

  it("calculates max context correctly", () => {
    const maxCtx = calculateMaxContext({
      vramAvailableBytes: 24 * 1024 ** 3,
      weightsBytes: 5 * 1024 ** 3,
      computeBufferBytes: 500 * 1024 * 1024,
      kvBytesPerToken: 128 * 1024, // 128 KiB
      nCtxTrain: 131072,
    });

    expect(maxCtx).toBeGreaterThan(10000);
  });

  it("recommends sensible quants", () => {
    // Ample VRAM
    const q1 = recommendBestQuant(4 * 1024 ** 3, 24 * 1024 ** 3);
    expect(q1).toContain("Q8_0");

    // Balanced
    const q2 = recommendBestQuant(10 * 1024 ** 3, 11 * 1024 ** 3);
    expect(q2).toContain("Q4_K_M");

    // Tight
    const q3 = recommendBestQuant(12 * 1024 ** 3, 6 * 1024 ** 3);
    expect(q3).toContain("Q2_K");
  });

  it("produces 'Runs great' verdict when fully offloaded", () => {
    const dummyGguf: GgufFile = {
      version: 3,
      tensorCount: 100,
      kvCount: 10,
      kv: [],
      metadata: {},
      tensors: [],
      alignment: 32,
      infoEnd: 1000,
      dataStart: 1024,
      tensorBytes: 4 * 1024 ** 3,
    };
    const arch = llama3_8bArch();

    const evalRes = evaluateDeviceFit({
      device: rtx4090,
      gguf: dummyGguf,
      arch,
      vramGb: 24,
      appleUnified: false,
      nCtx: 8192,
      kvType: "f16",
      weightsGpu: 4.5 * 1024 ** 3,
      weightsCpu: 0,
      kvGpu: 128 * 1024 * 8192,
      buffer: 100 * 1024 * 1024,
      freeVram: 15 * 1024 ** 3,
      nLayer: 32,
      ngl: 32,
      fullyFits: true,
      totalWeightBytes: 4.5 * 1024 ** 3,
      kvPerToken: 128 * 1024,
    });

    expect(evalRes.verdictType).toBe("great");
    expect(evalRes.verdictTitle).toBe("Runs great");
    expect(evalRes.speed.tokPerSec).toBeGreaterThan(20);
  });
});
