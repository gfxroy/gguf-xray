import { GGML_TYPE, tensorByteSize } from "./ggml";
import {
  GGUF_TYPE,
  NeedMoreBytes,
  breakdownTensors,
  formatMetaValue,
  isArrayValue,
  parseGguf,
} from "./gguf";
import { ggmlTypeName } from "./ggml";
import { GgufWriter, llamaLikeGguf } from "./ggufWrite";

describe("parseGguf", () => {
  it("parses v3 magic, version, empty kv and tensors", () => {
    const w = new GgufWriter().header(3, 0, 0);
    const g = parseGguf(w.bytes);
    expect(g.version).toBe(3);
    expect(g.tensorCount).toBe(0);
    expect(g.kvCount).toBe(0);
  });

  it("parses v2 the same way as v3", () => {
    const w = new GgufWriter().header(2, 0, 1).kvString("general.architecture", "llama");
    const g = parseGguf(w.bytes);
    expect(g.version).toBe(2);
    expect(g.metadata["general.architecture"]).toBe("llama");
  });

  it("rejects a bad magic", () => {
    const buf = new Uint8Array([0x47, 0x47, 0x4a, 0x54, 3, 0, 0, 0]);
    expect(() => parseGguf(buf)).toThrow(/not a GGUF/);
  });

  it("rejects version 1", () => {
    const w = new GgufWriter().header(1, 0, 0);
    expect(() => parseGguf(w.bytes)).toThrow(/unsupported GGUF version 1/);
  });

  it("reads every scalar value type", () => {
    const w = new GgufWriter().header(3, 0, 12);
    w.kvU8("t.u8", 255);
    w.kvI8("t.i8", -128);
    w.kvU16("t.u16", 65535);
    w.kvI16("t.i16", -32768);
    w.kvU32("t.u32", 4000000000);
    w.kvI32("t.i32", -2000000000);
    w.kvF32("t.f32", 1.5);
    w.kvBool("t.bool", true);
    w.kvString("t.str", "hello");
    w.kvU64("t.u64", 2 ** 40);
    w.kvI64("t.i64", -(2 ** 40));
    w.kvF64("t.f64", Math.PI);
    const g = parseGguf(w.bytes);
    expect(g.metadata["t.u8"]).toBe(255);
    expect(g.metadata["t.i8"]).toBe(-128);
    expect(g.metadata["t.u16"]).toBe(65535);
    expect(g.metadata["t.i16"]).toBe(-32768);
    expect(g.metadata["t.u32"]).toBe(4000000000);
    expect(g.metadata["t.i32"]).toBe(-2000000000);
    expect(g.metadata["t.f32"]).toBeCloseTo(1.5);
    expect(g.metadata["t.bool"]).toBe(true);
    expect(g.metadata["t.str"]).toBe("hello");
    expect(g.metadata["t.u64"]).toBe(2 ** 40);
    expect(g.metadata["t.i64"]).toBe(-(2 ** 40));
    expect(g.metadata["t.f64"]).toBeCloseTo(Math.PI);
  });

  it("reads arrays of numbers and strings", () => {
    const w = new GgufWriter().header(3, 0, 2);
    w.kvArray("llama.attention.head_count_kv", GGUF_TYPE.UINT32, [4, 4, 8, 8]);
    w.kvArray("small.tokens", GGUF_TYPE.STRING, ["a", "bb", "ccc"]);
    const g = parseGguf(w.bytes);
    const heads = g.metadata["llama.attention.head_count_kv"];
    expect(isArrayValue(heads) && heads.values).toEqual([4, 4, 8, 8]);
    const toks = g.metadata["small.tokens"];
    expect(isArrayValue(toks) && toks.values).toEqual(["a", "bb", "ccc"]);
  });

  it("reads nested arrays", () => {
    const w = new GgufWriter().header(3, 0, 1);
    w.kvNestedArray("nested", GGUF_TYPE.INT32, [
      [1, 2],
      [3, 4, 5],
    ]);
    const g = parseGguf(w.bytes);
    const n = g.metadata["nested"];
    expect(isArrayValue(n)).toBe(true);
    if (isArrayValue(n) && n.values) {
      expect(n.count).toBe(2);
      const a0 = n.values[0];
      const a1 = n.values[1];
      expect(isArrayValue(a0) && a0.values).toEqual([1, 2]);
      expect(isArrayValue(a1) && a1.values).toEqual([3, 4, 5]);
    }
  });

  it("skips large tokenizer string arrays, counting only", () => {
    const tokens = Array.from({ length: 200 }, (_, i) => `tok_${i}`);
    const w = new GgufWriter().header(3, 1, 2);
    w.kvString("general.architecture", "llama");
    w.kvArray("tokenizer.ggml.tokens", GGUF_TYPE.STRING, tokens);
    w.tensor("output_norm.weight", [8], GGML_TYPE.F32, 0);
    const g = parseGguf(w.bytes);
    const arr = g.metadata["tokenizer.ggml.tokens"];
    expect(isArrayValue(arr) && arr.skipped).toBe(true);
    expect(isArrayValue(arr) && arr.count).toBe(200);
    expect(isArrayValue(arr) && arr.values).toBeUndefined();
    expect(g.tensors).toHaveLength(1);
    expect(g.tensors[0].name).toBe("output_norm.weight");
  });

  it("parses tensor infos: name, dims, type, offset", () => {
    const w = new GgufWriter().header(3, 2, 0);
    w.tensor("blk.0.attn_q.weight", [4096, 4096], GGML_TYPE.Q4_K, 0);
    w.tensor("blk.0.attn_norm.weight", [4096], GGML_TYPE.F32, 144 * 65536);
    const g = parseGguf(w.bytes);
    expect(g.tensors[0]).toMatchObject({
      name: "blk.0.attn_q.weight",
      dims: [4096, 4096],
      type: GGML_TYPE.Q4_K,
      offset: 0,
    });
    expect(g.tensors[0].nbytes).toBe(tensorByteSize(GGML_TYPE.Q4_K, [4096, 4096]));
    expect(g.tensors[1].nbytes).toBe(4096 * 4);
  });

  it("throws NeedMoreBytes on a truncated header", () => {
    const full = llamaLikeGguf({ nLayer: 2, tokens: ["a", "b", "c"] });
    expect(parseGguf(full).version).toBe(3);
    let threw = 0;
    for (let n = 4; n < full.length; n += Math.max(1, Math.floor(full.length / 20))) {
      try {
        parseGguf(full.subarray(0, n));
      } catch (e) {
        expect(e).toBeInstanceOf(NeedMoreBytes);
        expect((e as NeedMoreBytes).needed).toBeGreaterThan(n);
        threw++;
      }
    }
    expect(threw).toBeGreaterThan(5);
  });

  it("NeedMoreBytes.needed is enough to finish parsing", () => {
    const full = llamaLikeGguf({ nLayer: 4 });
    const cut = full.subarray(0, 80);
    try {
      parseGguf(cut);
      throw new Error("expected NeedMoreBytes");
    } catch (e) {
      expect(e).toBeInstanceOf(NeedMoreBytes);
      const needed = (e as NeedMoreBytes).needed;
      const g = parseGguf(full.subarray(0, Math.min(full.length, needed + 4096)));
      expect(g.tensors.length).toBeGreaterThan(0);
    }
  });

  it("aligns dataStart to general.alignment", () => {
    const w = new GgufWriter().header(3, 0, 1).kvU32("general.alignment", 64);
    const g = parseGguf(w.bytes);
    expect(g.alignment).toBe(64);
    expect(g.dataStart % 64).toBe(0);
    expect(g.dataStart).toBeGreaterThanOrEqual(g.infoEnd);
  });

  it("breaks tensors down by type and blk.N layer", () => {
    const buf = llamaLikeGguf({ nLayer: 3 });
    const g = parseGguf(buf);
    const bd = breakdownTensors(g.tensors, ggmlTypeName);
    expect(bd.byLayer).toHaveLength(3);
    expect(bd.byType.some((t) => t.name === "Q4_K")).toBe(true);
    expect(bd.byType.some((t) => t.name === "F32")).toBe(true);
    expect(bd.otherBytes).toBeGreaterThan(0);
  });

  it("formatMetaValue summarizes skipped arrays", () => {
    expect(formatMetaValue({ kind: "array", elemType: GGUF_TYPE.STRING, count: 128256, skipped: true })).toBe(
      "[128256 str]",
    );
  });
});
