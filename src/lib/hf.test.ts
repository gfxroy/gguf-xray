import { blobSource, loadGgufHeader, parseHfUrl, pickDefaultGguf } from "./hf";
import { llamaLikeGguf } from "./ggufWrite";

describe("parseHfUrl", () => {
  it("parses a repo URL", () => {
    expect(parseHfUrl("https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF")).toEqual({
      kind: "repo",
      repoId: "bartowski/Llama-3.2-1B-Instruct-GGUF",
      revision: "main",
    });
  });

  it("parses a bare org/name", () => {
    expect(parseHfUrl("unsloth/Qwen3-8B-GGUF")).toEqual({
      kind: "repo",
      repoId: "unsloth/Qwen3-8B-GGUF",
      revision: "main",
    });
  });

  it("parses a resolve .gguf URL", () => {
    const u =
      "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf";
    expect(parseHfUrl(u)).toEqual({
      kind: "file",
      repoId: "bartowski/Llama-3.2-1B-Instruct-GGUF",
      revision: "main",
      path: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    });
  });

  it("parses blob and tree file URLs", () => {
    expect(
      parseHfUrl("https://huggingface.co/org/mod/blob/main/q.gguf"),
    ).toMatchObject({ kind: "file", path: "q.gguf" });
    expect(
      parseHfUrl("https://huggingface.co/org/mod/tree/refs%2Fpr%2F1"),
    ).toMatchObject({ kind: "repo", revision: "refs/pr/1" });
  });

  it("rejects non-HF hosts", () => {
    expect(() => parseHfUrl("https://example.com/foo.gguf")).toThrow(/huggingface/);
  });
});

describe("pickDefaultGguf", () => {
  it("prefers Q4_K_M over other quants and skips mmproj", () => {
    const pick = pickDefaultGguf([
      { path: "mmproj-f16.gguf", size: 100 },
      { path: "model-Q8_0.gguf", size: 200 },
      { path: "model-Q4_K_M.gguf", size: 150 },
      { path: "model-Q4_K_S.gguf", size: 140 },
    ]);
    expect(pick.path).toBe("model-Q4_K_M.gguf");
  });
});

describe("loadGgufHeader", () => {
  it("reads a local blob incrementally", async () => {
    const bytes = llamaLikeGguf({ nLayer: 2 });
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy]);
    const loaded = await loadGgufHeader(blobSource(blob));
    expect(loaded.gguf.version).toBe(3);
    expect(loaded.gguf.tensors.length).toBeGreaterThan(0);
    expect(loaded.bytesRead).toBeGreaterThan(0);
    expect(loaded.totalBytes).toBe(bytes.length);
  });

  it("grows when the first chunk is too small", async () => {
    const bytes = llamaLikeGguf({ nLayer: 8, tokens: Array.from({ length: 40 }, (_, i) => `t${i}`) });
    let reads = 0;
    const loaded = await loadGgufHeader({
      size: bytes.length,
      read: async (start, length) => {
        reads++;
        return bytes.subarray(start, start + Math.min(64, length));
      },
    });
    expect(loaded.gguf.tensors.length).toBeGreaterThan(0);
    expect(reads).toBeGreaterThan(1);
  });
});
