import { NeedMoreBytes, parseGguf, type GgufFile } from "./gguf";

const INITIAL_BYTES = 2 * 1024 * 1024;
const MAX_HEADER_BYTES = 64 * 1024 * 1024;

export type HfRepo = {
  kind: "repo";
  repoId: string;
  revision: string;
};

export type HfFile = {
  kind: "file";
  repoId: string;
  revision: string;
  path: string;
};

export type HfTarget = HfRepo | HfFile;

export type GgufEntry = { path: string; size: number };

const HF_HOST = /^(?:www\.)?(?:huggingface\.co|hf\.co)$/i;

export function parseHfUrl(input: string): HfTarget {
  const raw = input.trim();
  if (!raw) throw new Error("Paste a Hugging Face model URL or a direct .gguf link.");

  // Bare repo id: org/name
  if (/^[\w.-]+\/[\w.-]+$/.test(raw) && !raw.includes("://")) {
    return { kind: "repo", repoId: raw, revision: "main" };
  }

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    throw new Error("That does not look like a URL.");
  }
  if (!HF_HOST.test(url.hostname)) {
    throw new Error("Need a huggingface.co model URL.");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("URL is missing org/model.");
  if (parts[0] === "datasets" || parts[0] === "spaces") {
    throw new Error("Need a model repo, not a dataset or space.");
  }
  const repoId = `${parts[0]}/${parts[1]}`;
  const rest = parts.slice(2);

  if (rest.length === 0) return { kind: "repo", repoId, revision: "main" };

  const kind = rest[0];
  if (kind === "tree" || kind === "blob" || kind === "resolve" || kind === "raw") {
    const revision = decodeURIComponent(rest[1] || "main");
    const path = rest.slice(2).map(decodeURIComponent).join("/");
    if ((kind === "blob" || kind === "resolve" || kind === "raw") && path.toLowerCase().endsWith(".gguf")) {
      return { kind: "file", repoId, revision, path };
    }
    if (kind === "tree" && path.toLowerCase().endsWith(".gguf")) {
      return { kind: "file", repoId, revision, path };
    }
    return { kind: "repo", repoId, revision };
  }

  // huggingface.co/org/name/file.gguf
  const maybeFile = rest.join("/");
  if (maybeFile.toLowerCase().endsWith(".gguf")) {
    return { kind: "file", repoId, revision: "main", path: maybeFile };
  }
  return { kind: "repo", repoId, revision: "main" };
}

export function resolveUrl(repoId: string, revision: string, path: string): string {
  return `https://huggingface.co/${repoId}/resolve/${encodeURI(revision)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export function treeUrl(repoId: string, revision: string): string {
  return `https://huggingface.co/api/models/${repoId}/tree/${encodeURI(revision)}`;
}

type TreeItem = { path?: string; type?: string; size?: number; lfs?: { size?: number } };

export async function listGgufFiles(repoId: string, revision = "main"): Promise<GgufEntry[]> {
  const files: GgufEntry[] = [];
  let url: string | null = `${treeUrl(repoId, revision)}?recursive=1`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(await hfError(res, repoId));
    }
    const data: unknown = await res.json();
    const items = Array.isArray(data) ? (data as TreeItem[]) : [];
    for (const it of items) {
      const path = it.path ?? "";
      if (!path.toLowerCase().endsWith(".gguf")) continue;
      const size = it.lfs?.size ?? it.size ?? 0;
      files.push({ path, size });
    }
    url = nextLink(res.headers.get("Link"));
  }
  if (files.length === 0) throw new Error(`No .gguf files in ${repoId}.`);
  return files;
}

function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

async function hfError(res: Response, repoId: string): Promise<string> {
  if (res.status === 401 || res.status === 403) return `${repoId} is gated or private.`;
  if (res.status === 404) return `Repo ${repoId} was not found.`;
  return `Hugging Face returned ${res.status} for ${repoId}.`;
}

const PREFERRED = [/Q4_K_M/i, /Q4_K_S/i, /Q5_K_M/i, /Q4_0(?!_)/i, /Q5_K_S/i, /Q6_K/i, /Q8_0/i];

export function pickDefaultGguf(files: GgufEntry[]): GgufEntry {
  const usable = files.filter((f) => !/mmproj|projector|imatrix/i.test(f.path));
  const pool = usable.length ? usable : files;
  const unsplit = pool.filter((f) => !/-\d+-of-\d+\.gguf$/i.test(f.path));
  const ranked = unsplit.length ? unsplit : pool;
  for (const re of PREFERRED) {
    const hit = ranked.find((f) => re.test(f.path));
    if (hit) return hit;
  }
  return ranked[0];
}

export type ByteSource = {
  read: (start: number, length: number) => Promise<Uint8Array<ArrayBufferLike>>;
  size?: number;
};

export async function fetchRange(url: string, start: number, length: number): Promise<{ data: Uint8Array; total: number | null }> {
  const end = start + length - 1;
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
  if (res.status === 206) {
    const data = new Uint8Array(await res.arrayBuffer());
    const total = parseContentRangeTotal(res.headers.get("Content-Range"));
    return { data, total };
  }
  if (res.status === 200) {
    const total = Number(res.headers.get("Content-Length")) || null;
    const data = await readStreamLimited(res, start, length);
    return { data, total };
  }
  if (res.status === 401 || res.status === 403) throw new Error("File is gated or private.");
  if (res.status === 404) throw new Error("File was not found.");
  throw new Error(`Fetch failed (${res.status}).`);
}

function parseContentRangeTotal(h: string | null): number | null {
  if (!h) return null;
  const m = h.match(/\/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

async function readStreamLimited(res: Response, start: number, length: number): Promise<Uint8Array> {
  if (!res.body) {
    const all = new Uint8Array(await res.arrayBuffer());
    return all.subarray(start, start + length);
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  const need = start + length;
  try {
    while (got < need) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      got += value.length;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
  const all = concat(chunks);
  return all.subarray(start, Math.min(start + length, all.length));
}

function concat(parts: readonly Uint8Array<ArrayBufferLike>[]): Uint8Array<ArrayBuffer> {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function blobSource(blob: Blob): ByteSource {
  return {
    size: blob.size,
    read: async (start, length) => {
      const end = Math.min(blob.size, start + length);
      const buf = await blob.slice(start, end).arrayBuffer();
      return new Uint8Array(buf);
    },
  };
}

export function httpSource(url: string, knownSize?: number): ByteSource {
  let total = knownSize;
  return {
    get size() {
      return total;
    },
    read: async (start, length) => {
      const { data, total: t } = await fetchRange(url, start, length);
      if (t != null) total = t;
      return data;
    },
  };
}

export type LoadedGguf = {
  gguf: GgufFile;
  bytesRead: number;
  totalBytes: number | null;
};

export async function loadGgufHeader(source: ByteSource): Promise<LoadedGguf> {
  let buf: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  let want = INITIAL_BYTES;

  for (;;) {
    const known = source.size;
    if (known != null) want = Math.min(want, known);
    if (buf.length < want) {
      const piece = await source.read(buf.length, want - buf.length);
      buf = concat([buf, piece]);
      if (piece.length === 0 && buf.length < want) break;
    }
    try {
      const gguf = parseGguf(buf);
      return { gguf, bytesRead: buf.length, totalBytes: source.size ?? known ?? null };
    } catch (e) {
      if (e instanceof NeedMoreBytes) {
        const next = Math.max(e.needed, Math.min(MAX_HEADER_BYTES, Math.max(want * 2, e.needed)));
        if (e.needed > MAX_HEADER_BYTES) {
          throw new Error(`GGUF header is larger than ${MAX_HEADER_BYTES / 1024 / 1024} MB.`, { cause: e });
        }
        if (known != null && buf.length >= known) {
          throw new Error("File ended before the GGUF header did.", { cause: e });
        }
        if (next <= want && buf.length >= want) {
          throw new Error("File ended before the GGUF header did.", { cause: e });
        }
        want = known != null ? Math.min(next, known) : next;
        continue;
      }
      throw e;
    }
  }
  throw new Error("File ended before the GGUF header did.");
}

export const EXAMPLES = [
  {
    label: "Llama 3.2 1B",
    url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF",
  },
  {
    label: "Qwen 2.5 1.5B",
    url: "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF",
  },
  {
    label: "Gemma 2 2B",
    url: "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF",
  },
] as const;
