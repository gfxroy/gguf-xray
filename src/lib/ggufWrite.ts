import { GGUF_MAGIC, GGUF_TYPE } from "./gguf";

/** Little-endian GGUF writer for tests. */
export class GgufWriter {
  private buf = new Uint8Array(256);
  private off = 0;

  get bytes(): Uint8Array {
    return this.buf.slice(0, this.off);
  }

  private grow(n: number): void {
    if (this.off + n <= this.buf.length) return;
    let cap = this.buf.length;
    while (cap < this.off + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf);
    this.buf = next;
  }

  u8(n: number): this {
    this.grow(1);
    this.buf[this.off++] = n & 0xff;
    return this;
  }
  i8(n: number): this {
    return this.u8(n);
  }
  u16(n: number): this {
    this.grow(2);
    this.buf[this.off++] = n & 0xff;
    this.buf[this.off++] = (n >>> 8) & 0xff;
    return this;
  }
  i16(n: number): this {
    return this.u16(n);
  }
  u32(n: number): this {
    this.grow(4);
    this.buf[this.off++] = n & 0xff;
    this.buf[this.off++] = (n >>> 8) & 0xff;
    this.buf[this.off++] = (n >>> 16) & 0xff;
    this.buf[this.off++] = (n >>> 24) & 0xff;
    return this;
  }
  i32(n: number): this {
    return this.u32(n);
  }
  u64(n: number): this {
    this.grow(8);
    new DataView(this.buf.buffer, this.buf.byteOffset + this.off, 8).setBigUint64(0, BigInt(n), true);
    this.off += 8;
    return this;
  }
  i64(n: number): this {
    this.grow(8);
    new DataView(this.buf.buffer, this.buf.byteOffset + this.off, 8).setBigInt64(0, BigInt(n), true);
    this.off += 8;
    return this;
  }
  f32(n: number): this {
    this.grow(4);
    new DataView(this.buf.buffer, this.buf.byteOffset + this.off, 4).setFloat32(0, n, true);
    this.off += 4;
    return this;
  }
  f64(n: number): this {
    this.grow(8);
    new DataView(this.buf.buffer, this.buf.byteOffset + this.off, 8).setFloat64(0, n, true);
    this.off += 8;
    return this;
  }
  bool(v: boolean): this {
    return this.u8(v ? 1 : 0);
  }
  str(s: string): this {
    const enc = new TextEncoder().encode(s);
    this.u64(enc.length);
    this.grow(enc.length);
    this.buf.set(enc, this.off);
    this.off += enc.length;
    return this;
  }
  raw(bytes: Uint8Array): this {
    this.grow(bytes.length);
    this.buf.set(bytes, this.off);
    this.off += bytes.length;
    return this;
  }

  header(version: number, tensorCount: number, kvCount: number): this {
    this.u32(GGUF_MAGIC);
    this.u32(version);
    this.u64(tensorCount);
    this.u64(kvCount);
    return this;
  }

  kvScalar(key: string, type: number, write: (w: this) => void): this {
    this.str(key);
    this.u32(type);
    write(this);
    return this;
  }

  kvString(key: string, value: string): this {
    return this.kvScalar(key, GGUF_TYPE.STRING, (w) => w.str(value));
  }
  kvU32(key: string, value: number): this {
    return this.kvScalar(key, GGUF_TYPE.UINT32, (w) => w.u32(value));
  }
  kvI32(key: string, value: number): this {
    return this.kvScalar(key, GGUF_TYPE.INT32, (w) => w.i32(value));
  }
  kvU64(key: string, value: number): this {
    return this.kvScalar(key, GGUF_TYPE.UINT64, (w) => w.u64(value));
  }
  kvBool(key: string, value: boolean): this {
    return this.kvScalar(key, GGUF_TYPE.BOOL, (w) => w.bool(value));
  }
  kvF32(key: string, value: number): this {
    return this.kvScalar(key, GGUF_TYPE.FLOAT32, (w) => w.f32(value));
  }
  kvF64(key: string, value: number): this {
    return this.kvScalar(key, GGUF_TYPE.FLOAT64, (w) => w.f64(value));
  }
  kvU8(key: string, value: number): this {
    return this.kvScalar(key, GGUF_TYPE.UINT8, (w) => w.u8(value));
  }
  kvI8(key: string, value: number): this {
    return this.kvScalar(key, GGUF_TYPE.INT8, (w) => w.i8(value));
  }
  kvU16(key: string, value: number): this {
    return this.kvScalar(key, GGUF_TYPE.UINT16, (w) => w.u16(value));
  }
  kvI16(key: string, value: number): this {
    return this.kvScalar(key, GGUF_TYPE.INT16, (w) => w.i16(value));
  }
  kvI64(key: string, value: number): this {
    return this.kvScalar(key, GGUF_TYPE.INT64, (w) => w.i64(value));
  }

  kvArray(key: string, elemType: number, values: unknown[]): this {
    this.str(key);
    this.u32(GGUF_TYPE.ARRAY);
    this.u32(elemType);
    this.u64(values.length);
    for (const v of values) this.writeElem(elemType, v);
    return this;
  }

  kvNestedArray(key: string, innerType: number, rows: unknown[][]): this {
    this.str(key);
    this.u32(GGUF_TYPE.ARRAY);
    this.u32(GGUF_TYPE.ARRAY);
    this.u64(rows.length);
    for (const row of rows) {
      this.u32(innerType);
      this.u64(row.length);
      for (const v of row) this.writeElem(innerType, v);
    }
    return this;
  }

  private writeElem(type: number, v: unknown): void {
    switch (type) {
      case GGUF_TYPE.UINT8:
        this.u8(v as number);
        break;
      case GGUF_TYPE.INT8:
        this.i8(v as number);
        break;
      case GGUF_TYPE.UINT16:
        this.u16(v as number);
        break;
      case GGUF_TYPE.INT16:
        this.i16(v as number);
        break;
      case GGUF_TYPE.UINT32:
        this.u32(v as number);
        break;
      case GGUF_TYPE.INT32:
        this.i32(v as number);
        break;
      case GGUF_TYPE.FLOAT32:
        this.f32(v as number);
        break;
      case GGUF_TYPE.BOOL:
        this.bool(v as boolean);
        break;
      case GGUF_TYPE.STRING:
        this.str(v as string);
        break;
      case GGUF_TYPE.UINT64:
        this.u64(v as number);
        break;
      case GGUF_TYPE.INT64:
        this.i64(v as number);
        break;
      case GGUF_TYPE.FLOAT64:
        this.f64(v as number);
        break;
      default:
        throw new Error(`writer: unsupported elem type ${type}`);
    }
  }

  tensor(name: string, dims: number[], type: number, offset: number): this {
    this.str(name);
    this.u32(dims.length);
    for (const d of dims) this.i64(d);
    this.u32(type);
    this.u64(offset);
    return this;
  }
}

export function llamaLikeGguf(opts?: {
  version?: number;
  nLayer?: number;
  nEmbd?: number;
  nHead?: number;
  nHeadKv?: number;
  nCtx?: number;
  nFf?: number;
  tokens?: string[];
}): Uint8Array {
  const version = opts?.version ?? 3;
  const nLayer = opts?.nLayer ?? 32;
  const nEmbd = opts?.nEmbd ?? 4096;
  const nHead = opts?.nHead ?? 32;
  const nHeadKv = opts?.nHeadKv ?? 8;
  const nCtx = opts?.nCtx ?? 8192;
  const nFf = opts?.nFf ?? 14336;
  const tokens = opts?.tokens;

  const tensors: { name: string; dims: number[]; type: number }[] = [];
  tensors.push({ name: "token_embd.weight", dims: [nEmbd, 128], type: 12 }); // Q4_K
  for (let i = 0; i < nLayer; i++) {
    tensors.push({ name: `blk.${i}.attn_q.weight`, dims: [nEmbd, nEmbd], type: 12 });
    tensors.push({ name: `blk.${i}.attn_k.weight`, dims: [nEmbd, (nEmbd / nHead) * nHeadKv], type: 12 });
    tensors.push({ name: `blk.${i}.ffn_down.weight`, dims: [nFf, nEmbd], type: 12 });
    tensors.push({ name: `blk.${i}.attn_norm.weight`, dims: [nEmbd], type: 0 }); // F32
  }
  tensors.push({ name: "output.weight", dims: [nEmbd, 128], type: 12 });
  tensors.push({ name: "output_norm.weight", dims: [nEmbd], type: 0 });

  const w = new GgufWriter();
  const extra = tokens ? 1 : 0;
  w.header(version, tensors.length, 10 + extra);
  w.kvString("general.architecture", "llama");
  w.kvString("general.name", "Llama-3-8B-test");
  w.kvU32("llama.block_count", nLayer);
  w.kvU32("llama.context_length", nCtx);
  w.kvU32("llama.embedding_length", nEmbd);
  w.kvU32("llama.feed_forward_length", nFf);
  w.kvU32("llama.attention.head_count", nHead);
  w.kvU32("llama.attention.head_count_kv", nHeadKv);
  w.kvU32("llama.attention.key_length", nEmbd / nHead);
  w.kvU32("llama.attention.value_length", nEmbd / nHead);
  if (tokens) w.kvArray("tokenizer.ggml.tokens", GGUF_TYPE.STRING, tokens);

  let off = 0;
  for (const t of tensors) {
    w.tensor(t.name, t.dims, t.type, off);
    // payload not written; offset is dummy
    off += 32;
  }
  return w.bytes;
}
