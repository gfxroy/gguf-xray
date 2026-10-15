import { tensorByteSize } from "./ggml";

export const GGUF_MAGIC = 0x46554747; // "GGUF" little-endian uint32
export const GGUF_DEFAULT_ALIGNMENT = 32;

export const GGUF_TYPE = {
  UINT8: 0,
  INT8: 1,
  UINT16: 2,
  INT16: 3,
  UINT32: 4,
  INT32: 5,
  FLOAT32: 6,
  BOOL: 7,
  STRING: 8,
  ARRAY: 9,
  UINT64: 10,
  INT64: 11,
  FLOAT64: 12,
} as const;

export type GgufValueType = (typeof GGUF_TYPE)[keyof typeof GGUF_TYPE];

const SCALAR_SIZE: Record<number, number> = {
  [GGUF_TYPE.UINT8]: 1,
  [GGUF_TYPE.INT8]: 1,
  [GGUF_TYPE.UINT16]: 2,
  [GGUF_TYPE.INT16]: 2,
  [GGUF_TYPE.UINT32]: 4,
  [GGUF_TYPE.INT32]: 4,
  [GGUF_TYPE.FLOAT32]: 4,
  [GGUF_TYPE.BOOL]: 1,
  [GGUF_TYPE.UINT64]: 8,
  [GGUF_TYPE.INT64]: 8,
  [GGUF_TYPE.FLOAT64]: 8,
};

const TYPE_NAMES: Record<number, string> = {
  0: "u8",
  1: "i8",
  2: "u16",
  3: "i16",
  4: "u32",
  5: "i32",
  6: "f32",
  7: "bool",
  8: "str",
  9: "arr",
  10: "u64",
  11: "i64",
  12: "f64",
};

export function ggufTypeName(t: number): string {
  return TYPE_NAMES[t] ?? `t${t}`;
}

/** Thrown when the buffer ends before the GGUF header/tensor-info section is complete. */
export class NeedMoreBytes extends Error {
  readonly needed: number;
  constructor(needed: number) {
    super(`Need more bytes: header extends to offset ${needed}`);
    this.name = "NeedMoreBytes";
    this.needed = needed;
  }
}

export class GgufError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GgufError";
  }
}

export type GgufArray = {
  kind: "array";
  elemType: number;
  count: number;
  values?: GgufValue[];
  skipped?: boolean;
};

export type GgufValue = number | boolean | string | bigint | GgufArray;

export type GgufKv = {
  key: string;
  type: number;
  value: GgufValue;
};

export type GgufTensor = {
  name: string;
  dims: number[];
  type: number;
  offset: number;
  nbytes: number;
};

export type GgufFile = {
  version: number;
  tensorCount: number;
  kvCount: number;
  kv: GgufKv[];
  metadata: Record<string, GgufValue>;
  tensors: GgufTensor[];
  alignment: number;
  /** Byte offset where tensor infos end (before alignment padding). */
  infoEnd: number;
  /** Byte offset of the tensor data blob (aligned). */
  dataStart: number;
  /** Sum of tensor payloads (may be slightly under file size due to padding). */
  tensorBytes: number;
};

const MAX_STRING = 8 * 1024 * 1024;
const MAX_DIMS = 8;
const STORE_STRING_ARRAY_MAX = 16;
const STORE_PRIM_ARRAY_MAX = 1024;

class Reader {
  view: DataView;
  u8: Uint8Array;
  off = 0;
  littleEndian = true;

  constructor(buf: Uint8Array) {
    this.u8 = buf;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  get length(): number {
    return this.u8.length;
  }

  need(n: number): void {
    const end = this.off + n;
    if (end > this.u8.length) throw new NeedMoreBytes(end);
  }

  u8n(): number {
    this.need(1);
    return this.u8[this.off++];
  }
  i8(): number {
    this.need(1);
    const v = this.view.getInt8(this.off);
    this.off += 1;
    return v;
  }
  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.off, this.littleEndian);
    this.off += 2;
    return v;
  }
  i16(): number {
    this.need(2);
    const v = this.view.getInt16(this.off, this.littleEndian);
    this.off += 2;
    return v;
  }
  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.off, this.littleEndian);
    this.off += 4;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.off, this.littleEndian);
    this.off += 4;
    return v;
  }
  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.off, this.littleEndian);
    this.off += 4;
    return v;
  }
  f64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.off, this.littleEndian);
    this.off += 8;
    return v;
  }
  u64(): number {
    this.need(8);
    let lo: number;
    let hi: number;
    if (this.littleEndian) {
      lo = this.view.getUint32(this.off, true);
      hi = this.view.getUint32(this.off + 4, true);
    } else {
      hi = this.view.getUint32(this.off, false);
      lo = this.view.getUint32(this.off + 4, false);
    }
    this.off += 8;
    if (hi > 0x1fffff) throw new GgufError(`uint64 ${hi >>> 0}:${lo >>> 0} exceeds safe integer range`);
    return hi * 0x100000000 + lo;
  }
  i64(): number {
    this.need(8);
    const v = this.view.getBigInt64(this.off, this.littleEndian);
    this.off += 8;
    if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new GgufError(`int64 ${v} exceeds safe integer range`);
    }
    return Number(v);
  }
  bool(): boolean {
    const v = this.i8();
    return v !== 0;
  }
  skip(n: number): void {
    this.need(n);
    this.off += n;
  }
  str(): string {
    const len = this.u64();
    if (len > MAX_STRING) throw new GgufError(`string length ${len} is too large`);
    this.need(len);
    const slice = this.u8.subarray(this.off, this.off + len);
    this.off += len;
    return utf8Decode(slice);
  }
  skipStr(): void {
    const len = this.u64();
    if (len > MAX_STRING) throw new GgufError(`string length ${len} is too large`);
    this.skip(len);
  }
}

let decoder: TextDecoder | null = null;
function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    decoder ??= new TextDecoder("utf-8");
    return decoder.decode(bytes);
  }
  // Node test fallback without relying on global TextDecoder quirks
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  try {
    return decodeURIComponent(escape(s));
  } catch {
    return s;
  }
}

function readScalar(r: Reader, type: number): GgufValue {
  switch (type) {
    case GGUF_TYPE.UINT8:
      return r.u8n();
    case GGUF_TYPE.INT8:
      return r.i8();
    case GGUF_TYPE.UINT16:
      return r.u16();
    case GGUF_TYPE.INT16:
      return r.i16();
    case GGUF_TYPE.UINT32:
      return r.u32();
    case GGUF_TYPE.INT32:
      return r.i32();
    case GGUF_TYPE.FLOAT32:
      return r.f32();
    case GGUF_TYPE.BOOL:
      return r.bool();
    case GGUF_TYPE.STRING:
      return r.str();
    case GGUF_TYPE.UINT64:
      return r.u64();
    case GGUF_TYPE.INT64:
      return r.i64();
    case GGUF_TYPE.FLOAT64:
      return r.f64();
    default:
      throw new GgufError(`unknown GGUF value type ${type}`);
  }
}

function skipArrayBody(r: Reader, elem: number, n: number): void {
  if (n === 0) return;
  const sz = SCALAR_SIZE[elem];
  if (sz != null) {
    const bytes = n * sz;
    r.skip(bytes);
    return;
  }
  if (elem === GGUF_TYPE.STRING) {
    for (let i = 0; i < n; i++) r.skipStr();
    return;
  }
  if (elem === GGUF_TYPE.ARRAY) {
    for (let i = 0; i < n; i++) {
      const inner = r.u32();
      const cn = r.u64();
      skipArrayBody(r, inner, cn);
    }
    return;
  }
  throw new GgufError(`unknown GGUF array element type ${elem}`);
}

function shouldSkipArray(key: string, elem: number, n: number): boolean {
  if (key.startsWith("tokenizer.")) return n > STORE_STRING_ARRAY_MAX || elem === GGUF_TYPE.STRING;
  if (elem === GGUF_TYPE.STRING) return n > STORE_STRING_ARRAY_MAX;
  if (elem === GGUF_TYPE.ARRAY) return n > 64;
  return n > STORE_PRIM_ARRAY_MAX;
}

function readArray(r: Reader, key: string): GgufArray {
  const elemType = r.u32();
  const count = r.u64();
  if (shouldSkipArray(key, elemType, count)) {
    skipArrayBody(r, elemType, count);
    return { kind: "array", elemType, count, skipped: true };
  }
  const values: GgufValue[] = [];
  if (elemType === GGUF_TYPE.ARRAY) {
    for (let i = 0; i < count; i++) values.push(readArray(r, `${key}[]`));
  } else {
    for (let i = 0; i < count; i++) values.push(readScalar(r, elemType));
  }
  return { kind: "array", elemType, count, values };
}

function readValue(r: Reader, type: number, key: string): GgufValue {
  if (type === GGUF_TYPE.ARRAY) return readArray(r, key);
  return readScalar(r, type);
}

function alignUp(n: number, a: number): number {
  return Math.ceil(n / a) * a;
}

/**
 * Parse a GGUF v2/v3 header and tensor-info section from a growable buffer.
 * Does not read tensor payloads. Throws NeedMoreBytes if the buffer is truncated.
 */
export function parseGguf(buffer: Uint8Array): GgufFile {
  const r = new Reader(buffer);
  const magic = r.u32();
  if (magic !== GGUF_MAGIC) {
    const ascii = String.fromCharCode(buffer[0] ?? 0, buffer[1] ?? 0, buffer[2] ?? 0, buffer[3] ?? 0);
    throw new GgufError(`not a GGUF file (magic ${ascii || magic})`);
  }
  const version = r.u32();
  if (version !== 2 && version !== 3) {
    throw new GgufError(`unsupported GGUF version ${version} (need v2 or v3)`);
  }
  const tensorCount = r.u64();
  const kvCount = r.u64();
  if (tensorCount > 1_000_000) throw new GgufError(`implausible tensor count ${tensorCount}`);
  if (kvCount > 100_000) throw new GgufError(`implausible kv count ${kvCount}`);

  const kv: GgufKv[] = [];
  const metadata: Record<string, GgufValue> = {};
  for (let i = 0; i < kvCount; i++) {
    const key = r.str();
    const type = r.u32();
    const value = readValue(r, type, key);
    kv.push({ key, type, value });
    metadata[key] = value;
  }

  const tensors: GgufTensor[] = [];
  for (let i = 0; i < tensorCount; i++) {
    const name = r.str();
    const nDims = r.u32();
    if (nDims > MAX_DIMS) throw new GgufError(`tensor ${name} has ${nDims} dims`);
    const dims: number[] = [];
    for (let d = 0; d < nDims; d++) dims.push(r.i64());
    const type = r.u32();
    const offset = r.u64();
    let nbytes: number;
    try {
      nbytes = tensorByteSize(type, dims);
    } catch {
      nbytes = 0;
    }
    tensors.push({ name, dims, type, offset, nbytes });
  }

  const infoEnd = r.off;
  const alignment = metaU32(metadata["general.alignment"]) ?? GGUF_DEFAULT_ALIGNMENT;
  const dataStart = alignUp(infoEnd, alignment);
  let tensorBytes = 0;
  for (const t of tensors) tensorBytes += t.nbytes;

  return {
    version,
    tensorCount,
    kvCount,
    kv,
    metadata,
    tensors,
    alignment,
    infoEnd,
    dataStart,
    tensorBytes,
  };
}

export function isNeedMoreBytes(e: unknown): e is NeedMoreBytes {
  return e instanceof NeedMoreBytes;
}

export function isArrayValue(v: GgufValue | undefined | null): v is GgufArray {
  return typeof v === "object" && v !== null && (v as GgufArray).kind === "array";
}

export function metaU32(v: GgufValue | undefined): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

export function metaString(v: GgufValue | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function metaNumber(v: GgufValue | undefined): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  return undefined;
}

export function metaBool(v: GgufValue | undefined): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

/** Scalar or array of numbers (e.g. per-layer head_count_kv). */
export function metaNumbers(v: GgufValue | undefined): number | number[] | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (isArrayValue(v) && v.values) {
    const nums = v.values.filter((x): x is number => typeof x === "number");
    if (nums.length) return nums;
  }
  return undefined;
}

export function formatMetaValue(v: GgufValue): string {
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return String(v);
  }
  if (typeof v === "bigint") return v.toString();
  if (isArrayValue(v)) {
    if (v.skipped || !v.values) return `[${v.count} ${ggufTypeName(v.elemType)}]`;
    if (v.count <= 8) return `[${v.values.map(formatMetaValue).join(", ")}]`;
    return `[${v.count} ${ggufTypeName(v.elemType)}: ${v.values.slice(0, 4).map(formatMetaValue).join(", ")}, …]`;
  }
  return String(v);
}

const LAYER_RE = /^blk\.(\d+)\./;

export function layerIndex(tensorName: string): number | null {
  const m = LAYER_RE.exec(tensorName);
  return m ? Number(m[1]) : null;
}

export type TensorBreakdown = {
  byType: { type: number; name: string; count: number; bytes: number }[];
  byLayer: { layer: number; bytes: number; count: number }[];
  otherBytes: number;
  otherCount: number;
  totalBytes: number;
};

export function breakdownTensors(
  tensors: GgufTensor[],
  typeName: (id: number) => string,
): TensorBreakdown {
  const typeMap = new Map<number, { type: number; name: string; count: number; bytes: number }>();
  const layerMap = new Map<number, { layer: number; bytes: number; count: number }>();
  let otherBytes = 0;
  let otherCount = 0;
  let totalBytes = 0;
  for (const t of tensors) {
    totalBytes += t.nbytes;
    const rec = typeMap.get(t.type) ?? { type: t.type, name: typeName(t.type), count: 0, bytes: 0 };
    rec.count++;
    rec.bytes += t.nbytes;
    typeMap.set(t.type, rec);
    const li = layerIndex(t.name);
    if (li == null) {
      otherBytes += t.nbytes;
      otherCount++;
    } else {
      const lr = layerMap.get(li) ?? { layer: li, bytes: 0, count: 0 };
      lr.bytes += t.nbytes;
      lr.count++;
      layerMap.set(li, lr);
    }
  }
  const byType = [...typeMap.values()].sort((a, b) => b.bytes - a.bytes);
  const byLayer = [...layerMap.values()].sort((a, b) => a.layer - b.layer);
  return { byType, byLayer, otherBytes, otherCount, totalBytes };
}
