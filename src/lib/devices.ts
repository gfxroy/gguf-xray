export type DeviceCategory = "nvidia" | "apple" | "amd" | "intel" | "cpu" | "custom";

export type DeviceInfo = {
  id: string;
  name: string;
  shortName: string;
  category: DeviceCategory;
  vramGb: number;
  /** System RAM in GB (relevant for CPU offload or custom setups). */
  systemRamGb: number;
  /** Memory bandwidth in GB/s. */
  bandwidthGBs: number;
  isApple: boolean;
  notes?: string;
};

export const POPULAR_DEVICES: DeviceInfo[] = [
  // --- NVIDIA RTX 50 Series ---
  {
    id: "rtx-5090",
    name: "NVIDIA GeForce RTX 5090",
    shortName: "RTX 5090",
    category: "nvidia",
    vramGb: 32,
    systemRamGb: 64,
    bandwidthGBs: 1792,
    isApple: false,
    notes: "32 GB GDDR7 @ 1792 GB/s",
  },
  {
    id: "rtx-5080",
    name: "NVIDIA GeForce RTX 5080",
    shortName: "RTX 5080",
    category: "nvidia",
    vramGb: 16,
    systemRamGb: 32,
    bandwidthGBs: 960,
    isApple: false,
    notes: "16 GB GDDR7 @ 960 GB/s",
  },
  {
    id: "rtx-5070",
    name: "NVIDIA GeForce RTX 5070",
    shortName: "RTX 5070",
    category: "nvidia",
    vramGb: 12,
    systemRamGb: 32,
    bandwidthGBs: 672,
    isApple: false,
    notes: "12 GB GDDR7 @ 672 GB/s",
  },

  // --- NVIDIA RTX 40 Series ---
  {
    id: "rtx-4090",
    name: "NVIDIA GeForce RTX 4090",
    shortName: "RTX 4090",
    category: "nvidia",
    vramGb: 24,
    systemRamGb: 64,
    bandwidthGBs: 1008,
    isApple: false,
    notes: "24 GB GDDR6X @ 1008 GB/s",
  },
  {
    id: "rtx-4080",
    name: "NVIDIA GeForce RTX 4080 / 4080 Super",
    shortName: "RTX 4080",
    category: "nvidia",
    vramGb: 16,
    systemRamGb: 32,
    bandwidthGBs: 717,
    isApple: false,
    notes: "16 GB GDDR6X @ 717 GB/s",
  },
  {
    id: "rtx-4070-ti-super",
    name: "NVIDIA GeForce RTX 4070 Ti Super",
    shortName: "RTX 4070 Ti S",
    category: "nvidia",
    vramGb: 16,
    systemRamGb: 32,
    bandwidthGBs: 672,
    isApple: false,
    notes: "16 GB GDDR6X @ 672 GB/s",
  },
  {
    id: "rtx-4070-ti",
    name: "NVIDIA GeForce RTX 4070 Ti",
    shortName: "RTX 4070 Ti",
    category: "nvidia",
    vramGb: 12,
    systemRamGb: 32,
    bandwidthGBs: 504,
    isApple: false,
    notes: "12 GB GDDR6X @ 504 GB/s",
  },
  {
    id: "rtx-4070",
    name: "NVIDIA GeForce RTX 4070 / 4070 Super",
    shortName: "RTX 4070",
    category: "nvidia",
    vramGb: 12,
    systemRamGb: 32,
    bandwidthGBs: 504,
    isApple: false,
    notes: "12 GB GDDR6X @ 504 GB/s",
  },
  {
    id: "rtx-4060-ti-16gb",
    name: "NVIDIA GeForce RTX 4060 Ti (16 GB)",
    shortName: "RTX 4060 Ti 16G",
    category: "nvidia",
    vramGb: 16,
    systemRamGb: 32,
    bandwidthGBs: 288,
    isApple: false,
    notes: "16 GB GDDR6 @ 288 GB/s",
  },
  {
    id: "rtx-4060-ti-8gb",
    name: "NVIDIA GeForce RTX 4060 Ti (8 GB)",
    shortName: "RTX 4060 Ti 8G",
    category: "nvidia",
    vramGb: 8,
    systemRamGb: 32,
    bandwidthGBs: 288,
    isApple: false,
    notes: "8 GB GDDR6 @ 288 GB/s",
  },
  {
    id: "rtx-4060",
    name: "NVIDIA GeForce RTX 4060",
    shortName: "RTX 4060",
    category: "nvidia",
    vramGb: 8,
    systemRamGb: 16,
    bandwidthGBs: 272,
    isApple: false,
    notes: "8 GB GDDR6 @ 272 GB/s",
  },

  // --- NVIDIA RTX 30 Series ---
  {
    id: "rtx-3090",
    name: "NVIDIA GeForce RTX 3090 / 3090 Ti",
    shortName: "RTX 3090",
    category: "nvidia",
    vramGb: 24,
    systemRamGb: 32,
    bandwidthGBs: 936,
    isApple: false,
    notes: "24 GB GDDR6X @ 936 GB/s",
  },
  {
    id: "rtx-3080-10gb",
    name: "NVIDIA GeForce RTX 3080 (10 GB)",
    shortName: "RTX 3080",
    category: "nvidia",
    vramGb: 10,
    systemRamGb: 32,
    bandwidthGBs: 760,
    isApple: false,
    notes: "10 GB GDDR6X @ 760 GB/s",
  },
  {
    id: "rtx-3070",
    name: "NVIDIA GeForce RTX 3070 / 3070 Ti",
    shortName: "RTX 3070",
    category: "nvidia",
    vramGb: 8,
    systemRamGb: 32,
    bandwidthGBs: 448,
    isApple: false,
    notes: "8 GB GDDR6 @ 448 GB/s",
  },
  {
    id: "rtx-3060-12gb",
    name: "NVIDIA GeForce RTX 3060 (12 GB)",
    shortName: "RTX 3060 12G",
    category: "nvidia",
    vramGb: 12,
    systemRamGb: 16,
    bandwidthGBs: 360,
    isApple: false,
    notes: "12 GB GDDR6 @ 360 GB/s",
  },

  // --- NVIDIA RTX 20 Series ---
  {
    id: "rtx-2080-ti",
    name: "NVIDIA GeForce RTX 2080 Ti",
    shortName: "RTX 2080 Ti",
    category: "nvidia",
    vramGb: 11,
    systemRamGb: 32,
    bandwidthGBs: 616,
    isApple: false,
    notes: "11 GB GDDR6 @ 616 GB/s",
  },
  {
    id: "rtx-2070",
    name: "NVIDIA GeForce RTX 2070 / 2070 Super",
    shortName: "RTX 2070",
    category: "nvidia",
    vramGb: 8,
    systemRamGb: 16,
    bandwidthGBs: 448,
    isApple: false,
    notes: "8 GB GDDR6 @ 448 GB/s",
  },
  {
    id: "rtx-2060-12gb",
    name: "NVIDIA GeForce RTX 2060 (12 GB)",
    shortName: "RTX 2060 12G",
    category: "nvidia",
    vramGb: 12,
    systemRamGb: 16,
    bandwidthGBs: 336,
    isApple: false,
    notes: "12 GB GDDR6 @ 336 GB/s",
  },
  {
    id: "rtx-2060-6gb",
    name: "NVIDIA GeForce RTX 2060 (6 GB)",
    shortName: "RTX 2060 6G",
    category: "nvidia",
    vramGb: 6,
    systemRamGb: 16,
    bandwidthGBs: 336,
    isApple: false,
    notes: "6 GB GDDR6 @ 336 GB/s",
  },

  // --- Apple Silicon (M1 - M4) ---
  {
    id: "apple-m4-max-128gb",
    name: "Apple M4 Max (128 GB Unified)",
    shortName: "M4 Max 128G",
    category: "apple",
    vramGb: 128,
    systemRamGb: 128,
    bandwidthGBs: 546,
    isApple: true,
    notes: "128 GB Unified @ 546 GB/s",
  },
  {
    id: "apple-m4-max-64gb",
    name: "Apple M4 Max (64 GB Unified)",
    shortName: "M4 Max 64G",
    category: "apple",
    vramGb: 64,
    systemRamGb: 64,
    bandwidthGBs: 410,
    isApple: true,
    notes: "64 GB Unified @ 410 GB/s",
  },
  {
    id: "apple-m4-pro-48gb",
    name: "Apple M4 Pro (48 GB Unified)",
    shortName: "M4 Pro 48G",
    category: "apple",
    vramGb: 48,
    systemRamGb: 48,
    bandwidthGBs: 273,
    isApple: true,
    notes: "48 GB Unified @ 273 GB/s",
  },
  {
    id: "apple-m4-pro-24gb",
    name: "Apple M4 Pro (24 GB Unified)",
    shortName: "M4 Pro 24G",
    category: "apple",
    vramGb: 24,
    systemRamGb: 24,
    bandwidthGBs: 273,
    isApple: true,
    notes: "24 GB Unified @ 273 GB/s",
  },
  {
    id: "apple-m4-16gb",
    name: "Apple M4 (16 GB Unified)",
    shortName: "M4 16G",
    category: "apple",
    vramGb: 16,
    systemRamGb: 16,
    bandwidthGBs: 120,
    isApple: true,
    notes: "16 GB Unified @ 120 GB/s",
  },
  {
    id: "apple-m3-max-128gb",
    name: "Apple M3 Max (128 GB Unified)",
    shortName: "M3 Max 128G",
    category: "apple",
    vramGb: 128,
    systemRamGb: 128,
    bandwidthGBs: 400,
    isApple: true,
    notes: "128 GB Unified @ 400 GB/s",
  },
  {
    id: "apple-m3-max-64gb",
    name: "Apple M3 Max (64 GB Unified)",
    shortName: "M3 Max 64G",
    category: "apple",
    vramGb: 64,
    systemRamGb: 64,
    bandwidthGBs: 300,
    isApple: true,
    notes: "64 GB Unified @ 300 GB/s",
  },
  {
    id: "apple-m3-pro-36gb",
    name: "Apple M3 Pro (36 GB Unified)",
    shortName: "M3 Pro 36G",
    category: "apple",
    vramGb: 36,
    systemRamGb: 36,
    bandwidthGBs: 150,
    isApple: true,
    notes: "36 GB Unified @ 150 GB/s",
  },
  {
    id: "apple-m3-pro-18gb",
    name: "Apple M3 Pro (18 GB Unified)",
    shortName: "M3 Pro 18G",
    category: "apple",
    vramGb: 18,
    systemRamGb: 18,
    bandwidthGBs: 150,
    isApple: true,
    notes: "18 GB Unified @ 150 GB/s",
  },
  {
    id: "apple-m2-ultra-192gb",
    name: "Apple M2 Ultra (192 GB Unified)",
    shortName: "M2 Ultra 192G",
    category: "apple",
    vramGb: 192,
    systemRamGb: 192,
    bandwidthGBs: 800,
    isApple: true,
    notes: "192 GB Unified @ 800 GB/s",
  },
  {
    id: "apple-m2-max-64gb",
    name: "Apple M2 Max (64 GB Unified)",
    shortName: "M2 Max 64G",
    category: "apple",
    vramGb: 64,
    systemRamGb: 64,
    bandwidthGBs: 400,
    isApple: true,
    notes: "64 GB Unified @ 400 GB/s",
  },
  {
    id: "apple-m1-max-32gb",
    name: "Apple M1 Max (32 GB Unified)",
    shortName: "M1 Max 32G",
    category: "apple",
    vramGb: 32,
    systemRamGb: 32,
    bandwidthGBs: 400,
    isApple: true,
    notes: "32 GB Unified @ 400 GB/s",
  },
  {
    id: "apple-m1-m2-m3-16gb",
    name: "Apple M1 / M2 / M3 (16 GB Unified)",
    shortName: "M1/M2/M3 16G",
    category: "apple",
    vramGb: 16,
    systemRamGb: 16,
    bandwidthGBs: 100,
    isApple: true,
    notes: "16 GB Unified @ ~100 GB/s",
  },
  {
    id: "apple-m1-m2-m3-8gb",
    name: "Apple M1 / M2 / M3 (8 GB Unified)",
    shortName: "M1/M2/M3 8G",
    category: "apple",
    vramGb: 8,
    systemRamGb: 8,
    bandwidthGBs: 68,
    isApple: true,
    notes: "8 GB Unified @ ~68 GB/s",
  },

  // --- AMD Radeon ---
  {
    id: "rx-7900-xtx",
    name: "AMD Radeon RX 7900 XTX",
    shortName: "RX 7900 XTX",
    category: "amd",
    vramGb: 24,
    systemRamGb: 32,
    bandwidthGBs: 960,
    isApple: false,
    notes: "24 GB GDDR6 @ 960 GB/s",
  },
  {
    id: "rx-7900-xt",
    name: "AMD Radeon RX 7900 XT",
    shortName: "RX 7900 XT",
    category: "amd",
    vramGb: 20,
    systemRamGb: 32,
    bandwidthGBs: 800,
    isApple: false,
    notes: "20 GB GDDR6 @ 800 GB/s",
  },
  {
    id: "rx-7800-xt",
    name: "AMD Radeon RX 7800 XT",
    shortName: "RX 7800 XT",
    category: "amd",
    vramGb: 16,
    systemRamGb: 32,
    bandwidthGBs: 624,
    isApple: false,
    notes: "16 GB GDDR6 @ 624 GB/s",
  },
  {
    id: "rx-6800-xt",
    name: "AMD Radeon RX 6800 XT",
    shortName: "RX 6800 XT",
    category: "amd",
    vramGb: 16,
    systemRamGb: 32,
    bandwidthGBs: 512,
    isApple: false,
    notes: "16 GB GDDR6 @ 512 GB/s",
  },
  {
    id: "rx-6700-xt",
    name: "AMD Radeon RX 6700 XT",
    shortName: "RX 6700 XT",
    category: "amd",
    vramGb: 12,
    systemRamGb: 16,
    bandwidthGBs: 384,
    isApple: false,
    notes: "12 GB GDDR6 @ 384 GB/s",
  },

  // --- Intel Arc ---
  {
    id: "intel-arc-b580",
    name: "Intel Arc Battlemage B580",
    shortName: "Arc B580",
    category: "intel",
    vramGb: 12,
    systemRamGb: 32,
    bandwidthGBs: 456,
    isApple: false,
    notes: "12 GB GDDR6 @ 456 GB/s",
  },
  {
    id: "intel-arc-a770-16gb",
    name: "Intel Arc A770 (16 GB)",
    shortName: "Arc A770 16G",
    category: "intel",
    vramGb: 16,
    systemRamGb: 32,
    bandwidthGBs: 560,
    isApple: false,
    notes: "16 GB GDDR6 @ 560 GB/s",
  },
  {
    id: "intel-arc-a750-8gb",
    name: "Intel Arc A750 (8 GB)",
    shortName: "Arc A750 8G",
    category: "intel",
    vramGb: 8,
    systemRamGb: 16,
    bandwidthGBs: 512,
    isApple: false,
    notes: "8 GB GDDR6 @ 512 GB/s",
  },

  // --- CPU Only / Fallback ---
  {
    id: "cpu-ddr5-32gb",
    name: "CPU Only (32 GB DDR5 RAM)",
    shortName: "CPU (32G DDR5)",
    category: "cpu",
    vramGb: 0,
    systemRamGb: 32,
    bandwidthGBs: 60,
    isApple: false,
    notes: "Dual-channel DDR5 @ ~60 GB/s",
  },
  {
    id: "cpu-ddr4-16gb",
    name: "CPU Only (16 GB DDR4 RAM)",
    shortName: "CPU (16G DDR4)",
    category: "cpu",
    vramGb: 0,
    systemRamGb: 16,
    bandwidthGBs: 35,
    isApple: false,
    notes: "Dual-channel DDR4 @ ~35 GB/s",
  },
];

export const DEFAULT_DEVICE = POPULAR_DEVICES.find((d) => d.id === "rtx-4090") ?? POPULAR_DEVICES[0];

export function findDevice(id: string): DeviceInfo | undefined {
  return POPULAR_DEVICES.find((d) => d.id === id);
}

export function searchDevices(query: string): DeviceInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return POPULAR_DEVICES;
  return POPULAR_DEVICES.filter((d) => {
    return (
      d.name.toLowerCase().includes(q) ||
      d.shortName.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      (d.notes && d.notes.toLowerCase().includes(q))
    );
  });
}

export type DetectedHardware = {
  rawGpuName?: string;
  vendor?: string;
  matchedDevice?: DeviceInfo;
  reportedMemoryGb?: number;
  explanation: string;
};

/**
 * Best-effort device detection via WebGPU and navigator.deviceMemory.
 * Web browsers sandbox and obscure exact GPU memory for privacy reasons,
 * so we explain what we could infer.
 */
export async function detectHardware(): Promise<DetectedHardware> {
  let rawGpuName = "";
  let vendor = "";
  let reportedMemoryGb: number | undefined;

  if (typeof navigator !== "undefined" && "deviceMemory" in navigator) {
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    if (typeof mem === "number" && mem > 0) {
      reportedMemoryGb = mem;
    }
  }

  // Try WebGPU
  if (typeof navigator !== "undefined" && "gpu" in navigator && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        // Modern WebGPU provides adapter.info
        const info = (adapter as unknown as { info?: { vendor?: string; architecture?: string; description?: string } }).info;
        if (info) {
          vendor = info.vendor || "";
          rawGpuName = [info.vendor, info.architecture, info.description].filter(Boolean).join(" ");
        }
        // Fallback older requestAdapterInfo()
        if (!rawGpuName && typeof (adapter as unknown as { requestAdapterInfo?: () => Promise<{ vendor?: string; device?: string; description?: string }> }).requestAdapterInfo === "function") {
          try {
            const ai = await (adapter as unknown as { requestAdapterInfo: () => Promise<{ vendor?: string; device?: string; description?: string }> }).requestAdapterInfo();
            vendor = ai.vendor || vendor;
            rawGpuName = [ai.vendor, ai.device, ai.description].filter(Boolean).join(" ");
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // WebGPU not permitted or failed
    }
  }

  // Attempt to match rawGpuName with known popular devices
  let matchedDevice: DeviceInfo | undefined;
  if (rawGpuName) {
    const s = rawGpuName.toLowerCase();
    matchedDevice = POPULAR_DEVICES.find((d) => s.includes(d.shortName.toLowerCase()) || s.includes(d.id));
    if (!matchedDevice) {
      if (s.includes("apple") || s.includes("metal")) {
        matchedDevice = POPULAR_DEVICES.find((d) => d.id === "apple-m4-16gb");
      } else if (s.includes("nvidia") || s.includes("geforce")) {
        matchedDevice = POPULAR_DEVICES.find((d) => d.id === "rtx-4070");
      } else if (s.includes("amd") || s.includes("radeon")) {
        matchedDevice = POPULAR_DEVICES.find((d) => d.id === "rx-7800-xt");
      } else if (s.includes("intel")) {
        matchedDevice = POPULAR_DEVICES.find((d) => d.id === "intel-arc-b580");
      }
    }
  }

  let explanation: string;
  if (rawGpuName || reportedMemoryGb) {
    const parts: string[] = [];
    if (rawGpuName) parts.push(`GPU identified as "${rawGpuName}" via WebGPU`);
    if (reportedMemoryGb) parts.push(`~${reportedMemoryGb} GB system RAM reported (browsers clamp this to 8 GB max for privacy)`);
    explanation = parts.join(". ") + ". Please verify or adjust your exact model.";
  } else {
    explanation = "Browser privacy protections prevented automatic hardware detection. Please pick your device from the list.";
  }

  return {
    rawGpuName: rawGpuName || undefined,
    vendor: vendor || undefined,
    matchedDevice,
    reportedMemoryGb,
    explanation,
  };
}
