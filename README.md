# GGUF X-Ray

**Paste a Hugging Face GGUF link. See exactly what fits your GPU — read from the real file, not guessed.**

**Live:** https://gfxroy.github.io/gguf-xray/

![screenshot](docs/screenshot.png)

Paste a model repo or a direct `.gguf` URL. X-Ray fetches only the header with HTTP Range requests, parses the real tensors and metadata, then tells you how many llama.cpp layers fit in the VRAM you have.

## How it works

**Header, not the weights.** A GGUF file is a short typed header (magic, version, key-value metadata, tensor names/shapes/types/offsets) followed by a huge aligned weight blob. The header of a 7B Q4_K_M file is typically 1–3 MB, almost all of it tokenizer strings. We request the first 2 MB, parse, and if the parser hits the end of the buffer it throws a typed `NeedMoreBytes` with the offset it needs. The loader doubles the window and Range-fetches again. The weight blob is never downloaded. Local files use `Blob.slice` the same way.

**Parser.** GGUF v2/v3, little-endian. Metadata values cover every `gguf_type` including nested arrays. Large arrays (`tokenizer.ggml.tokens`, vocab scores, anything past a few thousand primitives) are skipped by walking lengths without allocating strings — we keep the count. Tensor infos give exact byte sizes from the ggml type table (block size × bytes per block for F32/F16/BF16, Q4_0…Q8_K, IQ*, TQ*, MXFP4, …).

**Memory model.** Architecture keys (`{arch}.block_count`, `context_length`, `embedding_length`, `attention.head_count`, `head_count_kv` which may be a per-layer array, `key_length` / `value_length`, `sliding_window`, `expert_count` / `expert_used_count`, DeepSeek-2 `kv_lora_rank`) drive the KV cache. For Llama-3-8B that is 32 × 8 × 128 × 2 × 2 = 128 KiB per token in f16. MLA stores a compressed latent (`kv_lora_rank` + rope dim) instead of `n_head_kv × head_dim`. Sliding-window layers (Gemma-style every-other-layer) use `min(ctx, window)`.

**Compute buffer.** With flash attention (`-fa on`) llama.cpp does not allocate an n_ctx² score matrix. The ggml graph is dominated by FFN scratch:

```
64 MiB graph overhead + 4 × n_ff × 512 × 4 bytes
```

`n_ubatch` is llama-server’s default 512. For MoE, `n_ff` is `expert_feed_forward_length × expert_used_count`. Real backends vary; treat this as ±30%.

**Offload plan.** llama.cpp `-ngl N` puts the last N repeating layers (`blk.{i}.*`) on the GPU. Embeddings and the output tensor join them only when N equals the layer count (the command then uses `-ngl 99`). GPU VRAM = those weights + KV for those layers + the compute buffer. Apple unified memory is counted at 75% of the listed size. The page emits a copy-ready `llama-server` line and the Ollama env / Modelfile equivalent.

## Limitations

- Header size is guessed from Range responses. A few CDNs ignore Range; we then stream and abort, but a misbehaving server could still send more than we want.
- Gated Hugging Face repos need a token in the browser, which this page does not collect. Open the file locally instead.
- Split GGUF (`-00001-of-00002`) is listed; only the file you pick is parsed.
- Compute-buffer and CUDA/Metal runtime overhead are estimates. Measure with `llama-server` if you are close to the limit.
- Big-endian GGUF v3 is not implemented. Almost every public file is little-endian.
- KV cache ignores prefix-sharing, cache quantization quirks beyond f16/q8_0/q4_0, and draft-model extra memory.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

Vite + React + TypeScript. Tests are Vitest against synthetic GGUF buffers. Deployed to GitHub Pages with GitHub Actions.

## License

MIT © Aaditya Roy
