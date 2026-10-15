import type { DeviceInfo } from "./devices";
import type { ArchInfo, KvType } from "./memory";
import type { GgufFile } from "./gguf";
import { formatBytes } from "./format";

export type SpeedEstimate = {
  tokPerSec: number;
  timePerTokenMs: number;
  bytesReadPerToken: number;
  gpuBandwidthGBs: number;
  cpuBandwidthGBs: number;
  offloadFraction: number;
  formulaDescription: string;
};

export type VerdictType = "great" | "slow" | "wont-fit";

export type EvaluationResult = {
  verdictType: VerdictType;
  verdictTitle: string;
  verdictDescription: string;
  speed: SpeedEstimate;
  maxContextTokens: number;
  bestQuantRecommendation: string;
  fitsInVram: boolean;
  fitsInRam: boolean;
};

/**
 * Calculates autoregressive token generation speed based on memory bandwidth.
 *
 * Formula:
 * In LLM generation (batch size 1), each token requires reading the active
 * model weights from memory.
 * - When 100% on GPU/Unified:
 *     Tok/s = (GPU_Bandwidth * efficiency) / (Weights_GPU + KV_Current_Context)
 * - When partially offloaded (split between GPU VRAM and CPU RAM):
 *     Time_per_token = (Weights_GPU / GPU_BW) + (Weights_CPU / CPU_BW) + PCIe_Bus_Penalty
 *     Tok/s = 1 / Time_per_token
 * - When CPU only:
 *     Tok/s = (CPU_Bandwidth * efficiency) / (Total_Weights + KV_Current_Context)
 */
export function estimateSpeed(options: {
  device: DeviceInfo;
  weightsGpu: number;
  weightsCpu: number;
  kvTotalBytes: number;
  nLayer: number;
  ngl: number;
}): SpeedEstimate {
  const { device, weightsGpu, weightsCpu, kvTotalBytes, nLayer, ngl } = options;

  const totalWeights = weightsGpu + weightsCpu;
  const bytesReadPerToken = Math.max(1, totalWeights + kvTotalBytes);
  const gpuBwBytes = device.bandwidthGBs * 1e9;
  const cpuBwBytes = (device.category === "apple" ? device.bandwidthGBs : Math.min(60, device.bandwidthGBs || 50)) * 1e9;

  const offloadFraction = nLayer > 0 ? Math.min(1, Math.max(0, ngl / nLayer)) : 1;

  // Practical kernel memory efficiency (~75% on GPU, ~65% on CPU)
  const gpuEfficiency = 0.75;
  const cpuEfficiency = 0.65;

  let timePerTokenSec: number;
  let formulaDesc: string;

  if (device.isApple || offloadFraction >= 0.999) {
    // 100% on GPU or unified memory
    const effectiveBw = gpuBwBytes * gpuEfficiency;
    timePerTokenSec = bytesReadPerToken / effectiveBw;
    formulaDesc = `Full offload: ${device.bandwidthGBs} GB/s bandwidth × 75% efficiency ÷ ${formatBytes(bytesReadPerToken)} read/tok`;
  } else if (offloadFraction <= 0.001) {
    // 0% GPU / pure CPU
    const effectiveBw = cpuBwBytes * cpuEfficiency;
    timePerTokenSec = bytesReadPerToken / effectiveBw;
    formulaDesc = `Pure CPU: ${Math.round(cpuBwBytes / 1e9)} GB/s RAM bandwidth × 65% efficiency ÷ ${formatBytes(bytesReadPerToken)} read/tok`;
  } else {
    // Partial offload: sum of GPU memory time + CPU memory time + PCIe sync latency
    const gpuTime = (weightsGpu + kvTotalBytes * offloadFraction) / (gpuBwBytes * gpuEfficiency);
    const cpuTime = (weightsCpu + kvTotalBytes * (1 - offloadFraction)) / (cpuBwBytes * cpuEfficiency);
    const pcieTransferLatency = 0.008; // ~8ms latency across PCIe bus synchronization
    timePerTokenSec = gpuTime + cpuTime + pcieTransferLatency;
    formulaDesc = `Partial offload (${ngl}/${nLayer} layers on GPU + remainder on CPU over PCIe)`;
  }

  const tokPerSec = timePerTokenSec > 0 ? Math.min(350, Math.max(0.1, 1 / timePerTokenSec)) : 0;
  const timePerTokenMs = timePerTokenSec * 1000;

  return {
    tokPerSec: Math.round(tokPerSec * 10) / 10,
    timePerTokenMs: Math.round(timePerTokenMs),
    bytesReadPerToken,
    gpuBandwidthGBs: device.bandwidthGBs,
    cpuBandwidthGBs: Math.round(cpuBwBytes / 1e9),
    offloadFraction,
    formulaDescription: formulaDesc,
  };
}

/**
 * Calculates the maximum context length that can fit in remaining VRAM.
 */
export function calculateMaxContext(options: {
  vramAvailableBytes: number;
  weightsBytes: number;
  computeBufferBytes: number;
  kvBytesPerToken: number;
  nCtxTrain: number;
}): number {
  const { vramAvailableBytes, weightsBytes, computeBufferBytes, kvBytesPerToken, nCtxTrain } = options;
  if (kvBytesPerToken <= 0) return nCtxTrain;

  const remainingForKv = vramAvailableBytes - weightsBytes - computeBufferBytes;
  if (remainingForKv <= 0) return 0;

  const possibleTokens = Math.floor(remainingForKv / kvBytesPerToken);
  return Math.max(512, Math.min(nCtxTrain, possibleTokens));
}

/**
 * Determines the comprehensive verdict: "Runs great", "Runs slowly", or "Won't fit".
 */
export function evaluateDeviceFit(options: {
  device: DeviceInfo;
  gguf: GgufFile;
  arch: ArchInfo | null;
  vramGb: number;
  appleUnified: boolean;
  nCtx: number;
  kvType: KvType;
  weightsGpu: number;
  weightsCpu: number;
  kvGpu: number;
  buffer: number;
  freeVram: number;
  nLayer: number;
  ngl: number;
  fullyFits: boolean;
  totalWeightBytes: number;
  kvPerToken: number;
}): EvaluationResult {
  const {
    device,
    arch,
    vramGb,
    appleUnified,
    nCtx,
    weightsGpu,
    weightsCpu,
    kvGpu,
    buffer,
    nLayer,
    ngl,
    fullyFits,
    totalWeightBytes,
    kvPerToken,
  } = options;

  const nCtxTrain = arch?.nCtxTrain ?? 8192;
  const vramAvailBytes = vramGb * 1024 ** 3 * (appleUnified ? 0.75 : 1);
  const sysRamAvailBytes = device.systemRamGb * 1024 ** 3 * 0.85; // leave 15% for OS

  const totalNeededBytes = totalWeightBytes + kvGpu + buffer;
  const totalDeviceBytes = vramAvailBytes + (appleUnified ? 0 : sysRamAvailBytes);

  const fitsInVram = fullyFits;
  const fitsInRam = totalNeededBytes <= totalDeviceBytes;

  const speed = estimateSpeed({
    device,
    weightsGpu,
    weightsCpu,
    kvTotalBytes: kvGpu,
    nLayer,
    ngl,
  });

  const maxContextTokens = calculateMaxContext({
    vramAvailableBytes: vramAvailBytes,
    weightsBytes: totalWeightBytes,
    computeBufferBytes: buffer,
    kvBytesPerToken: kvPerToken,
    nCtxTrain,
  });

  let verdictType: VerdictType;
  let verdictTitle: string;
  let verdictDescription: string;

  if (totalNeededBytes > totalDeviceBytes && !fitsInVram) {
    verdictType = "wont-fit";
    verdictTitle = "Won't fit";
    verdictDescription = `Model requires ${formatBytes(totalNeededBytes)}, exceeding available memory (${formatBytes(totalDeviceBytes)}). System will run out of memory.`;
  } else if (fitsInVram && (speed.tokPerSec >= 15 || device.isApple)) {
    verdictType = "great";
    verdictTitle = "Runs great";
    const ctxText = maxContextTokens >= nCtxTrain ? `full ${nCtxTrain.toLocaleString()} context` : `up to ${maxContextTokens.toLocaleString()} context`;
    verdictDescription = `100% offloaded to ${device.shortName} VRAM. Expect ~${speed.tokPerSec} tok/s at ${nCtx.toLocaleString()} context (supports ${ctxText}).`;
  } else if (fitsInVram && speed.tokPerSec < 15) {
    verdictType = "slow";
    verdictTitle = "Runs slowly";
    verdictDescription = `Fits in memory, but limited memory bandwidth yields ~${speed.tokPerSec} tok/s.`;
  } else if (ngl > 0 && fitsInRam) {
    verdictType = "slow";
    verdictTitle = "Runs slowly";
    verdictDescription = `Partially offloaded: ${ngl}/${nLayer} layers on GPU, remainder in system RAM. Bottlenecked by PCIe/RAM (~${speed.tokPerSec} tok/s).`;
  } else if (fitsInRam) {
    verdictType = "slow";
    verdictTitle = "Runs slowly";
    verdictDescription = `Too large for GPU VRAM. Runs purely on CPU system RAM at ~${speed.tokPerSec} tok/s.`;
  } else {
    verdictType = "wont-fit";
    verdictTitle = "Won't fit";
    verdictDescription = `Requires more memory than your system has available.`;
  }

  // Best quant recommendation logic
  const bestQuantRecommendation = recommendBestQuant(totalWeightBytes, vramAvailBytes);

  return {
    verdictType,
    verdictTitle,
    verdictDescription,
    speed,
    maxContextTokens,
    bestQuantRecommendation,
    fitsInVram,
    fitsInRam,
  };
}

/**
 * Recommends the ideal quantization for the device's available VRAM.
 */
export function recommendBestQuant(modelFp16OrCurrentBytes: number, vramBytes: number): string {
  // If current fits with 30%+ headroom, recommend Q8_0 or Q6_K
  // If comfortably fits, recommend Q4_K_M (the golden standard)
  // If tight, recommend Q3_K_M or Q2_K
  const ratio = vramBytes / Math.max(1, modelFp16OrCurrentBytes);
  if (ratio > 1.8) return "Q8_0 (Reference quality — ample VRAM headroom)";
  if (ratio > 1.3) return "Q6_K (High fidelity — minimal perplexity loss)";
  if (ratio >= 0.9) return "Q4_K_M (Recommended sweet spot — near-lossless 4-bit)";
  if (ratio >= 0.7) return "Q3_K_M (Compact — fits tight VRAM with slight loss)";
  return "Q2_K (Maximum compression — noticeable loss but fits tiny VRAM)";
}
