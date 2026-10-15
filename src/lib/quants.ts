import type { DeviceInfo } from "./devices";
import type { GgufEntry } from "./hf";
import { formatBytes } from "./format";

export type QuantTier = {
  name: string;
  sizeRatio: number; // approximate size compared to Q4_K_M (= 1.0)
  qualityNote: string;
  badge?: string;
};

export const STANDARD_QUANTS: QuantTier[] = [
  {
    name: "Q2_K",
    sizeRatio: 0.65,
    qualityNote: "Maximum compression. Noticeable loss in complex reasoning; fits very small VRAM.",
  },
  {
    name: "Q3_K_M",
    sizeRatio: 0.8,
    qualityNote: "Compact. Minor quality loss; great if Q4 doesn't quite fit your GPU.",
  },
  {
    name: "Q4_K_M",
    sizeRatio: 1.0,
    qualityNote: "Recommended sweet spot. Near-lossless 4-bit; best balance of speed, size, and reasoning.",
    badge: "Recommended",
  },
  {
    name: "Q5_K_M",
    sizeRatio: 1.18,
    qualityNote: "High fidelity. Imperceptible difference from 16-bit; slightly higher VRAM requirement.",
  },
  {
    name: "Q6_K",
    sizeRatio: 1.35,
    qualityNote: "Very high quality. Excellent precision for coding and nuanced benchmarks.",
  },
  {
    name: "Q8_0",
    sizeRatio: 1.7,
    qualityNote: "Reference quality. Indistinguishable from FP16; highest precision at 8-bit.",
  },
];

export type QuantComparisonRow = {
  quant: string;
  filePath?: string;
  sizeBytes: number;
  formattedSize: string;
  fitsStatus: "Full VRAM" | "Partial" | "CPU Only" | "Won't Fit";
  fitsBadgeClass: "great" | "slow" | "wont-fit";
  ngl: number;
  nLayer: number;
  estTokPerSec: number;
  qualityNote: string;
  badge?: string;
  isCurrent: boolean;
};

/**
 * Builds the side-by-side quant comparison table for the given device and model.
 */
export function buildQuantComparison(options: {
  device: DeviceInfo;
  files?: GgufEntry[];
  currentFileName: string;
  currentSizeBytes: number;
  nLayer: number;
  vramGb: number;
  appleUnified: boolean;
  kvGpuBytes: number;
  bufferBytes: number;
}): QuantComparisonRow[] {
  const {
    device,
    files,
    currentFileName,
    currentSizeBytes,
    nLayer,
    vramGb,
    appleUnified,
    kvGpuBytes,
    bufferBytes,
  } = options;

  const vramAvailBytes = vramGb * 1024 ** 3 * (appleUnified ? 0.75 : 1);
  const sysRamAvailBytes = device.systemRamGb * 1024 ** 3 * 0.85;
  const totalDeviceBytes = vramAvailBytes + (appleUnified ? 0 : sysRamAvailBytes);

  // If we have actual repo files, use them
  if (files && files.length > 1) {
    const rows: QuantComparisonRow[] = [];

    // Filter out mmproj, projector, etc.
    const validFiles = files.filter(
      (f) => !/mmproj|projector|imatrix/i.test(f.path) && !/-\d+-of-\d+\.gguf$/i.test(f.path)
    );

    // Sort files logically from small to large or by standard quant order
    for (const file of validFiles) {
      const fileName = file.path.split("/").pop() ?? file.path;
      const quantMatch = fileName.match(/(IQ\d_[A-Z]+|Q\d_[A-Z0-9_]+|F16|BF16)/i);
      const quant = quantMatch ? quantMatch[1].toUpperCase() : fileName.replace(".gguf", "");

      const sizeBytes = file.size;
      const isCurrent = file.path.endsWith(currentFileName) || currentFileName.endsWith(file.path);

      // Match quality note from standard tiers if known
      const standard = STANDARD_QUANTS.find((q) => q.name.toUpperCase() === quant);
      const qualityNote =
        standard?.qualityNote ??
        (quant.startsWith("IQ")
          ? "Importance matrix quantization for high efficiency."
          : "Standard ggml quantization format.");

      const row = evaluateQuantRow({
        quant,
        filePath: file.path,
        sizeBytes,
        isCurrent,
        vramAvailBytes,
        totalDeviceBytes,
        device,
        nLayer,
        kvGpuBytes,
        bufferBytes,
        qualityNote,
        badge: standard?.badge,
      });

      rows.push(row);
    }

    if (rows.length > 0) {
      // Sort rows by file size
      return rows.sort((a, b) => a.sizeBytes - b.sizeBytes);
    }
  }

  // Fallback: Estimate sizes for standard tiers based on current file
  // Detect current file's quant tier to determine baseline
  const currentTier = STANDARD_QUANTS.find((q) =>
    currentFileName.toUpperCase().includes(q.name.toUpperCase())
  ) ?? STANDARD_QUANTS[2]; // Default to Q4_K_M

  const baselineQ4Size = currentSizeBytes / currentTier.sizeRatio;

  return STANDARD_QUANTS.map((tier) => {
    const sizeBytes = Math.round(baselineQ4Size * tier.sizeRatio);
    const isCurrent = currentFileName.toUpperCase().includes(tier.name.toUpperCase());

    return evaluateQuantRow({
      quant: tier.name,
      sizeBytes,
      isCurrent,
      vramAvailBytes,
      totalDeviceBytes,
      device,
      nLayer,
      kvGpuBytes,
      bufferBytes,
      qualityNote: tier.qualityNote,
      badge: tier.badge,
    });
  });
}

function evaluateQuantRow(options: {
  quant: string;
  filePath?: string;
  sizeBytes: number;
  isCurrent: boolean;
  vramAvailBytes: number;
  totalDeviceBytes: number;
  device: DeviceInfo;
  nLayer: number;
  kvGpuBytes: number;
  bufferBytes: number;
  qualityNote: string;
  badge?: string;
}): QuantComparisonRow {
  const {
    quant,
    filePath,
    sizeBytes,
    isCurrent,
    vramAvailBytes,
    totalDeviceBytes,
    device,
    nLayer,
    kvGpuBytes,
    bufferBytes,
    qualityNote,
    badge,
  } = options;

  const totalNeeded = sizeBytes + kvGpuBytes + bufferBytes;

  let fitsStatus: "Full VRAM" | "Partial" | "CPU Only" | "Won't Fit";
  let fitsBadgeClass: "great" | "slow" | "wont-fit";
  let ngl = 0;
  let estTokPerSec = 0;

  if (totalNeeded <= vramAvailBytes) {
    fitsStatus = "Full VRAM";
    fitsBadgeClass = "great";
    ngl = nLayer;
    const gpuBw = device.bandwidthGBs * 1e9 * 0.75;
    estTokPerSec = Math.round((gpuBw / Math.max(1, sizeBytes + kvGpuBytes)) * 10) / 10;
  } else if (totalNeeded <= totalDeviceBytes) {
    // How many layers fit in VRAM?
    const perLayerWeights = nLayer > 0 ? sizeBytes / nLayer : sizeBytes;
    const perLayerKv = nLayer > 0 ? kvGpuBytes / nLayer : 0;
    const remainingForLayers = Math.max(0, vramAvailBytes - bufferBytes);
    const layersFit = Math.max(
      0,
      Math.min(nLayer, Math.floor(remainingForLayers / Math.max(1, perLayerWeights + perLayerKv)))
    );

    if (layersFit > 0) {
      fitsStatus = "Partial";
      fitsBadgeClass = "slow";
      ngl = layersFit;
      // Partial offload speed
      const offFrac = layersFit / nLayer;
      const gpuTime = (sizeBytes * offFrac) / (device.bandwidthGBs * 1e9 * 0.75);
      const cpuTime = (sizeBytes * (1 - offFrac)) / (Math.min(60, device.bandwidthGBs || 50) * 1e9 * 0.65);
      estTokPerSec = Math.round((1 / (gpuTime + cpuTime + 0.008)) * 10) / 10;
    } else {
      fitsStatus = "CPU Only";
      fitsBadgeClass = "slow";
      ngl = 0;
      const cpuBw = Math.min(60, device.bandwidthGBs || 50) * 1e9 * 0.65;
      estTokPerSec = Math.round((cpuBw / Math.max(1, sizeBytes + kvGpuBytes)) * 10) / 10;
    }
  } else {
    fitsStatus = "Won't Fit";
    fitsBadgeClass = "wont-fit";
    ngl = 0;
    estTokPerSec = 0;
  }

  return {
    quant,
    filePath,
    sizeBytes,
    formattedSize: formatBytes(sizeBytes),
    fitsStatus,
    fitsBadgeClass,
    ngl,
    nLayer,
    estTokPerSec: Math.min(350, Math.max(0, estTokPerSec)),
    qualityNote,
    badge,
    isCurrent,
  };
}
