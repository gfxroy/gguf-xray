/** ggml tensor types as stored in GGUF (uint32). Block size + bytes per block from llama.cpp. */

export const GGML_TYPE = {
  F32: 0,
  F16: 1,
  Q4_0: 2,
  Q4_1: 3,
  Q5_0: 6,
  Q5_1: 7,
  Q8_0: 8,
  Q8_1: 9,
  Q2_K: 10,
  Q3_K: 11,
  Q4_K: 12,
  Q5_K: 13,
  Q6_K: 14,
  Q8_K: 15,
  IQ2_XXS: 16,
  IQ2_XS: 17,
  IQ3_XXS: 18,
  IQ1_S: 19,
  IQ4_NL: 20,
  IQ3_S: 21,
  IQ2_S: 22,
  IQ4_XS: 23,
  I8: 24,
  I16: 25,
  I32: 26,
  I64: 27,
  F64: 28,
  IQ1_M: 29,
  BF16: 30,
  TQ1_0: 34,
  TQ2_0: 35,
  MXFP4: 39,
  NVFP4: 40,
  Q1_0: 41,
  Q2_0: 42,
} as const;

export type GgmlTypeId = (typeof GGML_TYPE)[keyof typeof GGML_TYPE];

const QK_K = 256;

export type GgmlTypeInfo = {
  id: number;
  name: string;
  blockSize: number;
  bytesPerBlock: number;
};

const T = (
  id: number,
  name: string,
  blockSize: number,
  bytesPerBlock: number,
): GgmlTypeInfo => ({ id, name, blockSize, bytesPerBlock });

/** (block_size, bytes_per_block) from llama.cpp gguf-py GGML_QUANT_SIZES. */
export const GGML_TYPES: Record<number, GgmlTypeInfo> = {
  [GGML_TYPE.F32]: T(0, "F32", 1, 4),
  [GGML_TYPE.F16]: T(1, "F16", 1, 2),
  [GGML_TYPE.Q4_0]: T(2, "Q4_0", 32, 2 + 16),
  [GGML_TYPE.Q4_1]: T(3, "Q4_1", 32, 2 + 2 + 16),
  [GGML_TYPE.Q5_0]: T(6, "Q5_0", 32, 2 + 4 + 16),
  [GGML_TYPE.Q5_1]: T(7, "Q5_1", 32, 2 + 2 + 4 + 16),
  [GGML_TYPE.Q8_0]: T(8, "Q8_0", 32, 2 + 32),
  [GGML_TYPE.Q8_1]: T(9, "Q8_1", 32, 2 + 2 + 32),
  [GGML_TYPE.Q2_K]: T(10, "Q2_K", 256, 2 + 2 + QK_K / 16 + QK_K / 4),
  [GGML_TYPE.Q3_K]: T(11, "Q3_K", 256, 2 + QK_K / 4 + QK_K / 8 + 12),
  [GGML_TYPE.Q4_K]: T(12, "Q4_K", 256, 2 + 2 + QK_K / 2 + 12),
  [GGML_TYPE.Q5_K]: T(13, "Q5_K", 256, 2 + 2 + QK_K / 2 + QK_K / 8 + 12),
  [GGML_TYPE.Q6_K]: T(14, "Q6_K", 256, 2 + QK_K / 2 + QK_K / 4 + QK_K / 16),
  [GGML_TYPE.Q8_K]: T(15, "Q8_K", 256, 4 + QK_K + QK_K / 8),
  [GGML_TYPE.IQ2_XXS]: T(16, "IQ2_XXS", 256, 2 + QK_K / 4),
  [GGML_TYPE.IQ2_XS]: T(17, "IQ2_XS", 256, 2 + QK_K / 4 + QK_K / 32),
  [GGML_TYPE.IQ3_XXS]: T(18, "IQ3_XXS", 256, 2 + QK_K / 4 + QK_K / 8),
  [GGML_TYPE.IQ1_S]: T(19, "IQ1_S", 256, 2 + QK_K / 8 + QK_K / 16),
  [GGML_TYPE.IQ4_NL]: T(20, "IQ4_NL", 32, 2 + 16),
  [GGML_TYPE.IQ3_S]: T(21, "IQ3_S", 256, 2 + QK_K / 4 + QK_K / 8 + QK_K / 32 + 4),
  [GGML_TYPE.IQ2_S]: T(22, "IQ2_S", 256, 2 + QK_K / 4 + QK_K / 16),
  [GGML_TYPE.IQ4_XS]: T(23, "IQ4_XS", 256, 2 + 2 + QK_K / 2 + QK_K / 64),
  [GGML_TYPE.I8]: T(24, "I8", 1, 1),
  [GGML_TYPE.I16]: T(25, "I16", 1, 2),
  [GGML_TYPE.I32]: T(26, "I32", 1, 4),
  [GGML_TYPE.I64]: T(27, "I64", 1, 8),
  [GGML_TYPE.F64]: T(28, "F64", 1, 8),
  [GGML_TYPE.IQ1_M]: T(29, "IQ1_M", 256, QK_K / 8 + QK_K / 16 + QK_K / 32),
  [GGML_TYPE.BF16]: T(30, "BF16", 1, 2),
  [GGML_TYPE.TQ1_0]: T(34, "TQ1_0", 256, 2 + 4 * 13),
  [GGML_TYPE.TQ2_0]: T(35, "TQ2_0", 256, 2 + 64),
  [GGML_TYPE.MXFP4]: T(39, "MXFP4", 32, 1 + 16),
  [GGML_TYPE.NVFP4]: T(40, "NVFP4", 64, 4 + 32),
  [GGML_TYPE.Q1_0]: T(41, "Q1_0", 128, 2 + 16),
  [GGML_TYPE.Q2_0]: T(42, "Q2_0", 64, 2 + 16),
};

export function ggmlType(id: number): GgmlTypeInfo {
  const t = GGML_TYPES[id];
  if (!t) throw new Error(`Unknown ggml type ${id}`);
  return t;
}

export function ggmlTypeName(id: number): string {
  return GGML_TYPES[id]?.name ?? `TYPE_${id}`;
}

/** Bytes per element for a KV-cache storage type (quantized types use block packing). */
export function bytesPerElement(id: number): number {
  const t = ggmlType(id);
  return t.bytesPerBlock / t.blockSize;
}

/**
 * Exact tensor payload size in bytes.
 * GGML stores `ceil(n_elements / block_size) * bytes_per_block`.
 * ne[0] is normally divisible by block_size.
 */
export function tensorByteSize(typeId: number, dims: readonly number[]): number {
  const t = ggmlType(typeId);
  let n = 1;
  for (const d of dims) n *= d;
  if (n === 0) return 0;
  const blocks = Math.ceil(n / t.blockSize);
  return blocks * t.bytesPerBlock;
}

export function elementsOf(dims: readonly number[]): number {
  let n = 1;
  for (const d of dims) n *= d;
  return n;
}
