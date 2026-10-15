import { useMemo, useRef, useState } from "react";
import { formatBytes, formatCtx, formatInt } from "./lib/format";
import { formatMetaValue, type GgufFile } from "./lib/gguf";
import {
  EXAMPLES,
  blobSource,
  httpSource,
  listGgufFiles,
  loadGgufHeader,
  parseHfUrl,
  pickDefaultGguf,
  resolveUrl,
  type GgufEntry,
} from "./lib/hf";
import { archFromMetadata, type KvType } from "./lib/memory";
import { VRAM_PRESETS, planOffload } from "./lib/planner";

type Ready = {
  gguf: GgufFile;
  fileName: string;
  bytesRead: number;
  totalBytes: number | null;
  repoId?: string;
  files?: GgufEntry[];
};

function useCopy() {
  const [done, setDone] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  };
  return [done, copy] as const;
}

export default function App() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState<Ready | null>(null);
  const [vramGb, setVramGb] = useState(16);
  const [apple, setApple] = useState(false);
  const [nCtx, setNCtx] = useState(8192);
  const [kvType, setKvType] = useState<KvType>("f16");
  const [ctxTouched, setCtxTouched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [copiedCmd, copyCmd] = useCopy();
  const [copiedOl, copyOl] = useCopy();

  const inspect = async (raw: string) => {
    setError("");
    setBusy(true);
    setStatus("Listing files…");
    try {
      const target = parseHfUrl(raw);
      let files: GgufEntry[] | undefined;
      let path: string;
      let size: number | undefined;
      if (target.kind === "repo") {
        files = await listGgufFiles(target.repoId, target.revision);
        const pick = pickDefaultGguf(files);
        path = pick.path;
        size = pick.size;
      } else {
        path = target.path;
      }
      setStatus("Reading header…");
      const fileUrl = resolveUrl(target.repoId, target.revision, path);
      const loaded = await loadGgufHeader(httpSource(fileUrl, size));
      const name = path.split("/").pop() ?? path;
      setReady({
        gguf: loaded.gguf,
        fileName: name,
        bytesRead: loaded.bytesRead,
        totalBytes: loaded.totalBytes ?? size ?? null,
        repoId: target.repoId,
        files,
      });
      const arch = archFromMetadata(loaded.gguf.metadata);
      if (arch && !ctxTouched) setNCtx(Math.min(8192, arch.nCtxTrain));
    } catch (e) {
      setReady(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const onLocal = async (file: File) => {
    setError("");
    setBusy(true);
    setStatus("Reading header…");
    try {
      const loaded = await loadGgufHeader(blobSource(file));
      setReady({
        gguf: loaded.gguf,
        fileName: file.name,
        bytesRead: loaded.bytesRead,
        totalBytes: loaded.totalBytes,
      });
      const arch = archFromMetadata(loaded.gguf.metadata);
      if (arch && !ctxTouched) setNCtx(Math.min(8192, arch.nCtxTrain));
    } catch (e) {
      setReady(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const switchFile = async (path: string) => {
    if (!ready?.repoId || !ready.files) return;
    const entry = ready.files.find((f) => f.path === path);
    setBusy(true);
    setStatus("Reading header…");
    setError("");
    try {
      const fileUrl = resolveUrl(ready.repoId, "main", path);
      const loaded = await loadGgufHeader(httpSource(fileUrl, entry?.size));
      const name = path.split("/").pop() ?? path;
      setReady({
        ...ready,
        gguf: loaded.gguf,
        fileName: name,
        bytesRead: loaded.bytesRead,
        totalBytes: loaded.totalBytes ?? entry?.size ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const arch = ready ? archFromMetadata(ready.gguf.metadata) : null;
  const maxCtx = arch?.nCtxTrain ?? 131072;
  const plan = useMemo(() => {
    if (!ready) return null;
    const ctx = Math.max(512, Math.min(nCtx, maxCtx));
    return planOffload({
      gguf: ready.gguf,
      arch,
      fileName: ready.fileName,
      vramGb,
      appleUnified: apple,
      nCtx: ctx,
      kvType,
    });
  }, [ready, arch, nCtx, maxCtx, vramGb, apple, kvType]);

  return (
    <main className="wrap">
      <header>
        <div className="brand">GGUF X-Ray</div>
        <h1>See exactly what fits your GPU.</h1>
        <p className="lede">
          Paste a Hugging Face GGUF link. We read the real file header — not a guess from the name.
        </p>
      </header>

      <div className="chips">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.url}
            type="button"
            className="chip"
            aria-pressed={url === ex.url}
            onClick={() => {
              setUrl(ex.url);
              void inspect(ex.url);
            }}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <form
        className="inspect"
        onSubmit={(e) => {
          e.preventDefault();
          void inspect(url);
        }}
      >
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Hugging Face GGUF URL"
        />
        <button className="primary" type="submit" disabled={busy || !url.trim()}>
          {busy ? "Reading…" : "Inspect"}
        </button>
      </form>

      <div className="local">
        <input
          ref={fileRef}
          type="file"
          accept=".gguf,application/octet-stream"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onLocal(f);
            e.target.value = "";
          }}
        />
        <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
          Or open a local .gguf
        </button>
        {status && <span className="status">{status}</span>}
      </div>

      {error && <div className="err fade">{error}</div>}

      {ready && plan && (
        <section className="fade" aria-live="polite">
          <p className="meta-line">
            Read {formatBytes(ready.bytesRead)}
            {ready.totalBytes != null ? ` of ${formatBytes(ready.totalBytes)}` : ""}
            {" · "}
            {arch?.name ?? ready.fileName}
            {ready.files && ready.files.length > 1 ? "" : ` · ${ready.fileName}`}
          </p>

          {ready.files && ready.files.length > 1 && (
            <div className="filepick">
              <select
                aria-label="GGUF file"
                value={ready.files.find((f) => f.path.endsWith(ready.fileName))?.path ?? ready.fileName}
                onChange={(e) => void switchFile(e.target.value)}
              >
                {ready.files.map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.path.split("/").pop()} ({formatBytes(f.size)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <h2 className="verdict">{plan.verdict}</h2>

          <Bar plan={plan} />

          <div className="controls">
            <div className="ctrl">
              <div className="ctrl-row">
                <span className="label">VRAM</span>
                <span className="val">{vramGb} GB{apple ? " unified × 75%" : ""}</span>
              </div>
              <div className="presets">
                {VRAM_PRESETS.map((g) => (
                  <button key={g} type="button" aria-pressed={vramGb === g} onClick={() => setVramGb(g)}>
                    {g}
                  </button>
                ))}
              </div>
              <label className="check">
                <input type="checkbox" checked={apple} onChange={(e) => setApple(e.target.checked)} />
                Apple unified memory
              </label>
            </div>

            <div className="ctrl">
              <div className="ctrl-row">
                <span className="label">Context</span>
                <span className="val">{formatInt(nCtx)} ({formatCtx(nCtx)})</span>
              </div>
              <input
                type="range"
                min={512}
                max={maxCtx}
                step={ctxStep(maxCtx)}
                value={Math.min(nCtx, maxCtx)}
                onChange={(e) => {
                  setCtxTouched(true);
                  setNCtx(Number(e.target.value));
                }}
                aria-label="Context length"
              />
            </div>

            <div className="ctrl">
              <div className="ctrl-row">
                <span className="label">KV cache</span>
              </div>
              <div className="kvseg presets">
                {(["f16", "q8_0", "q4_0"] as const).map((t) => (
                  <button key={t} type="button" aria-pressed={kvType === t} onClick={() => setKvType(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="cmd-row">
              <span className="label">llama.cpp</span>
              <button type="button" className="ghost" onClick={() => void copyCmd(plan.command)}>
                {copiedCmd ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="cmd">{plan.command}</pre>
          </div>

          <div>
            <div className="cmd-row">
              <span className="label">Ollama</span>
              <button type="button" className="ghost" onClick={() => void copyOl(plan.ollamaEnv)}>
                {copiedOl ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="cmd">{plan.ollamaEnv}</pre>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              Tensors
            </div>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th className="num">Count</th>
                  <th className="num">Size</th>
                </tr>
              </thead>
              <tbody>
                {plan.byType.map((t) => (
                  <tr key={t.type}>
                    <td>{t.name}</td>
                    <td className="num">{t.count}</td>
                    <td className="num">{formatBytes(t.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {plan.byLayer.length > 0 && (
            <details>
              <summary>Layers ({plan.byLayer.length})</summary>
              <table>
                <thead>
                  <tr>
                    <th>Layer</th>
                    <th className="num">Tensors</th>
                    <th className="num">Weights</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.byLayer.map((l) => (
                    <tr key={l.layer}>
                      <td>blk.{l.layer}</td>
                      <td className="num">{l.count}</td>
                      <td className="num">{formatBytes(l.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          <details>
            <summary>Raw metadata ({ready.gguf.kv.length})</summary>
            <div className="kvlist">
              {ready.gguf.kv.map((kv) => (
                <div key={kv.key}>
                  <span className="k">{kv.key}</span>
                  <span className="v">{formatMetaValue(kv.value)}</span>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

      <footer>
        Reads only the GGUF header via HTTP Range requests. Nothing is uploaded.{" "}
        <a href="https://github.com/gfxroy/gguf-xray">Source</a>
      </footer>
    </main>
  );
}

function ctxStep(max: number): number {
  if (max <= 4096) return 256;
  if (max <= 32768) return 512;
  return 1024;
}

function Bar({ plan }: { plan: NonNullable<ReturnType<typeof planOffload>> }) {
  const denom = Math.max(plan.available, plan.used, 1);
  const w = (plan.weightsGpu / denom) * 100;
  const k = (plan.kvGpu / denom) * 100;
  const b = (plan.buffer / denom) * 100;
  const f = (plan.free / denom) * 100;
  return (
    <div>
      <div className="bar" aria-hidden="true">
        <div className="seg w" style={{ width: `${w}%` }} />
        <div className="seg k" style={{ width: `${k}%` }} />
        <div className="seg b" style={{ width: `${b}%` }} />
        <div className="seg f" style={{ width: `${f}%` }} />
      </div>
      <div className="legend" style={{ marginTop: 10 }}>
        <span>
          <span className="swatch w" />
          weights <b>{formatBytes(plan.weightsGpu)}</b>
        </span>
        <span>
          <span className="swatch k" />
          KV <b>{formatBytes(plan.kvGpu)}</b>
        </span>
        <span>
          <span className="swatch b" />
          buffer <b>{formatBytes(plan.buffer)}</b>
        </span>
        <span>
          free <b>{formatBytes(plan.free)}</b>
        </span>
      </div>
    </div>
  );
}
