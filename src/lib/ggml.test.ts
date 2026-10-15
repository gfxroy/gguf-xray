import { GGML_TYPE, GGML_TYPES, bytesPerElement, ggmlType, tensorByteSize } from "./ggml";

describe("ggml type table", () => {
  it("matches llama.cpp GGML_QUANT_SIZES for every listed type", () => {
    const expected: Record<number, [number, number]> = {
      [GGML_TYPE.F32]: [1, 4],
      [GGML_TYPE.F16]: [1, 2],
      [GGML_TYPE.Q4_0]: [32, 18],
      [GGML_TYPE.Q4_1]: [32, 20],
      [GGML_TYPE.Q5_0]: [32, 22],
      [GGML_TYPE.Q5_1]: [32, 24],
      [GGML_TYPE.Q8_0]: [32, 34],
      [GGML_TYPE.Q8_1]: [32, 36],
      [GGML_TYPE.Q2_K]: [256, 84],
      [GGML_TYPE.Q3_K]: [256, 110],
      [GGML_TYPE.Q4_K]: [256, 144],
      [GGML_TYPE.Q5_K]: [256, 176],
      [GGML_TYPE.Q6_K]: [256, 210],
      [GGML_TYPE.Q8_K]: [256, 292],
      [GGML_TYPE.IQ2_XXS]: [256, 66],
      [GGML_TYPE.IQ2_XS]: [256, 74],
      [GGML_TYPE.IQ3_XXS]: [256, 98],
      [GGML_TYPE.IQ1_S]: [256, 50],
      [GGML_TYPE.IQ4_NL]: [32, 18],
      [GGML_TYPE.IQ3_S]: [256, 110],
      [GGML_TYPE.IQ2_S]: [256, 82],
      [GGML_TYPE.IQ4_XS]: [256, 136],
      [GGML_TYPE.I8]: [1, 1],
      [GGML_TYPE.I16]: [1, 2],
      [GGML_TYPE.I32]: [1, 4],
      [GGML_TYPE.I64]: [1, 8],
      [GGML_TYPE.F64]: [1, 8],
      [GGML_TYPE.IQ1_M]: [256, 56],
      [GGML_TYPE.BF16]: [1, 2],
      [GGML_TYPE.TQ1_0]: [256, 54],
      [GGML_TYPE.TQ2_0]: [256, 66],
      [GGML_TYPE.MXFP4]: [32, 17],
      [GGML_TYPE.NVFP4]: [64, 36],
      [GGML_TYPE.Q1_0]: [128, 18],
      [GGML_TYPE.Q2_0]: [64, 18],
    };
    for (const [id, [bs, bpb]] of Object.entries(expected)) {
      const t = ggmlType(Number(id));
      expect(t.blockSize).toBe(bs);
      expect(t.bytesPerBlock).toBe(bpb);
    }
    expect(Object.keys(GGML_TYPES).length).toBe(Object.keys(expected).length);
  });

  it("computes Q4_K tensor bytes as n_elements / 256 * 144", () => {
    // 256 elements = 1 block = 144 bytes
    expect(tensorByteSize(GGML_TYPE.Q4_K, [256])).toBe(144);
    expect(tensorByteSize(GGML_TYPE.Q4_K, [4096, 4096])).toBe(((4096 * 4096) / 256) * 144);
  });

  it("computes F32 / F16 / BF16 / Q8_0 / MXFP4 sizes", () => {
    expect(tensorByteSize(GGML_TYPE.F32, [100, 4])).toBe(1600);
    expect(tensorByteSize(GGML_TYPE.F16, [64])).toBe(128);
    expect(tensorByteSize(GGML_TYPE.BF16, [64])).toBe(128);
    expect(tensorByteSize(GGML_TYPE.Q8_0, [32])).toBe(34);
    expect(tensorByteSize(GGML_TYPE.Q8_0, [64])).toBe(68);
    expect(tensorByteSize(GGML_TYPE.MXFP4, [32])).toBe(17);
    expect(tensorByteSize(GGML_TYPE.Q4_0, [32])).toBe(18);
  });

  it("rounds up a partial last block", () => {
    expect(tensorByteSize(GGML_TYPE.Q4_0, [33])).toBe(36);
  });

  it("returns 0 for empty dims", () => {
    expect(tensorByteSize(GGML_TYPE.F32, [0, 10])).toBe(0);
  });

  it("bytesPerElement for KV types", () => {
    expect(bytesPerElement(GGML_TYPE.F16)).toBe(2);
    expect(bytesPerElement(GGML_TYPE.Q8_0)).toBe(34 / 32);
    expect(bytesPerElement(GGML_TYPE.Q4_0)).toBe(18 / 32);
  });

  it("throws on an unknown type", () => {
    expect(() => ggmlType(4)).toThrow(/Unknown ggml type 4/);
  });
});
