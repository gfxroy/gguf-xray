import { useEffect, useMemo, useRef, useState } from "react";
import { DevicePicker } from "./components/DevicePicker";
import { ModelPicker } from "./components/ModelPicker";
import { VerdictBanner } from "./components/VerdictBanner";
import { QuantTable } from "./components/QuantTable";
import { CommandsSection } from "./components/CommandsSection";
import { DetailsSection } from "./components/DetailsSection";
import {
  DEFAULT_DEVICE,
  findDevice,
  type DeviceInfo,
} from "./lib/devices";
import {
  DEFAULT_MODEL,
  findCuratedModel,
} from "./lib/models";
import {
  blobSource,
  httpSource,
  listGgufFiles,
  loadGgufHeader,
  parseHfUrl,
  pickDefaultGguf,
  resolveUrl,
  type GgufEntry,
} from "./lib/hf";
import type { GgufFile } from "./lib/gguf";
import { archFromMetadata, type KvType } from "./lib/memory";
import { planOffload } from "./lib/planner";
import { evaluateDeviceFit } from "./lib/speed";
import { buildCommands } from "./lib/commands";
import { buildQuantComparison } from "./lib/quants";
import {
  parseHashState,
  updateLocationHash,
} from "./lib/urlState";
import { formatBytes } from "./lib/format";

type ReadyState = {
  gguf: GgufFile;
  fileName: string;
  bytesRead: number;
  totalBytes: number | null;
  repoId?: string;
  files?: GgufEntry[];
};

export default function App() {
  const [device, setDevice] = useState<DeviceInfo>(DEFAULT_DEVICE);
  const [vramGb, setVramGb] = useState<number>(DEFAULT_DEVICE.vramGb);
  const [appleUnified, setAppleUnified] = useState<boolean>(DEFAULT_DEVICE.isApple);

  const [url, setUrl] = useState<string>(DEFAULT_MODEL.repoUrl);
  const [busy, setBusy] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [ready, setReady] = useState<ReadyState | null>(null);

  const [nCtx, setNCtx] = useState<number>(8192);
  const [kvType, setKvType] = useState<KvType>("f16");
  const [ctxTouched, setCtxTouched] = useState<boolean>(false);

  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const hasInitialized = useRef<boolean>(false);

  const inspect = async (
    rawUrl: string,
    targetFile?: string,
    stateOverrides?: { devId?: string; vram?: number; apple?: boolean; ctx?: number; kv?: KvType }
  ) => {
    setError("");
    setBusy(true);
    setStatus("Connecting to Hugging Face…");

    try {
      const target = parseHfUrl(rawUrl);
      let files: GgufEntry[] | undefined;
      let path: string;
      let size: number | undefined;

      if (target.kind === "repo") {
        setStatus("Listing repository files…");
        files = await listGgufFiles(target.repoId, target.revision);

        if (targetFile) {
          const match = files.find(
            (f) => f.path === targetFile || f.path.endsWith(targetFile)
          );
          if (match) {
            path = match.path;
            size = match.size;
          } else {
            const pick = pickDefaultGguf(files);
            path = pick.path;
            size = pick.size;
          }
        } else {
          const pick = pickDefaultGguf(files);
          path = pick.path;
          size = pick.size;
        }
      } else {
        path = target.path;
      }

      setStatus("Reading GGUF header via Range request…");
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
      setUrl(rawUrl);

      const arch = archFromMetadata(loaded.gguf.metadata);
      if (arch && !ctxTouched) {
        setNCtx(Math.min(8192, arch.nCtxTrain));
      }

      // Update URL hash
      updateLocationHash({
        deviceId: stateOverrides?.devId ?? device.id,
        vramGb: stateOverrides?.vram ?? vramGb,
        apple: stateOverrides?.apple ?? appleUnified,
        model: target.repoId,
        file: name,
        ctx: stateOverrides?.ctx ?? nCtx,
        kv: stateOverrides?.kv ?? kvType,
      });
    } catch (e) {
      setReady(null);
      setError(
        e instanceof Error
          ? e.message
          : "An unexpected error occurred while inspecting the GGUF file."
      );
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  // Restore state from URL Hash on mount, or load initial default
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    if (typeof window !== "undefined" && window.location.hash) {
      const state = parseHashState(window.location.hash);
      let devId = DEFAULT_DEVICE.id;
      let vram = DEFAULT_DEVICE.vramGb;
      let apple = DEFAULT_DEVICE.isApple;

      if (state.deviceId) {
        const found = findDevice(state.deviceId);
        if (found) {
          setDevice(found);
          devId = found.id;
          vram = state.vramGb ?? found.vramGb;
          apple = state.apple ?? found.isApple;
          setVramGb(vram);
          setAppleUnified(apple);
        } else if (state.vramGb) {
          vram = state.vramGb;
          setVramGb(vram);
          if (state.apple != null) {
            apple = state.apple;
            setAppleUnified(apple);
          }
        }
      } else if (state.vramGb) {
        vram = state.vramGb;
        setVramGb(vram);
        if (state.apple != null) {
          apple = state.apple;
          setAppleUnified(apple);
        }
      }

      if (state.ctx) {
        setNCtx(state.ctx);
        setCtxTouched(true);
      }
      if (state.kv) setKvType(state.kv);

      if (state.model) {
        const targetModel = findCuratedModel(state.model)?.repoUrl ?? state.model;
        setUrl(targetModel);
        void inspect(targetModel, state.file, {
          devId,
          vram,
          apple,
          ctx: state.ctx,
          kv: state.kv,
        });
        return;
      }
    }

    // Default inspection on initial visit
    void inspect(DEFAULT_MODEL.repoUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronize URL Hash when settings change
  const syncHash = (preferredFile?: string) => {
    const curFile = preferredFile ?? ready?.fileName;
    updateLocationHash({
      deviceId: device.id,
      vramGb,
      apple: appleUnified,
      model: ready?.repoId ?? url,
      file: curFile,
      ctx: nCtx,
      kv: kvType,
    });
  };

  const onLocal = async (file: File) => {
    setError("");
    setBusy(true);
    setStatus(`Reading ${file.name} header locally…`);

    try {
      const loaded = await loadGgufHeader(blobSource(file));
      setReady({
        gguf: loaded.gguf,
        fileName: file.name,
        bytesRead: loaded.bytesRead,
        totalBytes: loaded.totalBytes,
      });

      const arch = archFromMetadata(loaded.gguf.metadata);
      if (arch && !ctxTouched) {
        setNCtx(Math.min(8192, arch.nCtxTrain));
      }
    } catch (e) {
      setReady(null);
      setError(
        e instanceof Error
          ? e.message
          : "Could not parse local GGUF file header."
      );
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const switchFile = async (path: string) => {
    if (!ready?.repoId || !ready.files) return;
    const entry = ready.files.find((f) => f.path === path);
    setBusy(true);
    setStatus("Reading file header…");
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

      syncHash(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const handleCopyShareLink = async () => {
    syncHash();
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const t = document.createElement("textarea");
      t.value = shareUrl;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
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
      appleUnified,
      nCtx: ctx,
      kvType,
    });
  }, [ready, arch, nCtx, maxCtx, vramGb, appleUnified, kvType]);

  const evaluation = useMemo(() => {
    if (!ready || !plan) return null;
    const weightsCpu = Math.max(0, plan.totalWeightBytes - plan.weightsGpu);
    return evaluateDeviceFit({
      device,
      gguf: ready.gguf,
      arch,
      vramGb,
      appleUnified,
      nCtx,
      kvType,
      weightsGpu: plan.weightsGpu,
      weightsCpu,
      kvGpu: plan.kvGpu,
      buffer: plan.buffer,
      freeVram: plan.free,
      nLayer: plan.nLayer,
      ngl: plan.ngl,
      fullyFits: plan.fullyFits,
      totalWeightBytes: plan.totalWeightBytes,
      kvPerToken: plan.kvPerToken,
    });
  }, [ready, plan, device, vramGb, appleUnified, nCtx, kvType, arch]);

  const commands = useMemo(() => {
    if (!ready || !plan) return null;
    return buildCommands({
      fileName: ready.fileName,
      repoId: ready.repoId,
      ngl: plan.ngl,
      nLayer: plan.nLayer,
      fullyFits: plan.fullyFits,
      nCtx,
      kvType,
    });
  }, [ready, plan, nCtx, kvType]);

  const quantRows = useMemo(() => {
    if (!ready || !plan) return [];
    return buildQuantComparison({
      device,
      files: ready.files,
      currentFileName: ready.fileName,
      currentSizeBytes: ready.totalBytes ?? plan.totalWeightBytes,
      nLayer: plan.nLayer,
      vramGb,
      appleUnified,
      kvGpuBytes: plan.kvGpu,
      bufferBytes: plan.buffer,
    });
  }, [ready, plan, device, vramGb, appleUnified]);

  return (
    <main className="wrap">
      {/* Brand & Hero Header */}
      <header className="hero-section">
        <div className="brand-eyebrow">
          <span className="brand-dot" />
          <span>GGUF X-RAY · HARDWARE-AWARE MODEL INSPECTOR</span>
        </div>
        <h1 className="hero-title">Can my computer run this AI model?</h1>
        <p className="hero-lede">
          Pick your hardware, choose an open-source model, and get an instant real-hardware verdict with memory-bandwidth speed estimates and exact run commands.
        </p>
      </header>

      {/* Step 1: Device Selection */}
      <DevicePicker
        currentDevice={device}
        onSelectDevice={(d) => {
          setDevice(d);
          setVramGb(d.vramGb);
          setAppleUnified(d.isApple);
        }}
        vramGb={vramGb}
        onChangeVram={(v) => setVramGb(v)}
        isApple={appleUnified}
        onChangeApple={(ap) => setAppleUnified(ap)}
      />

      {/* Step 2: Model Selection */}
      <ModelPicker
        currentUrl={url}
        onInspectUrl={(u) => inspect(u)}
        onInspectLocal={(f) => onLocal(f)}
        busy={busy}
        status={status}
      />

      {/* Error state */}
      {error && (
        <div className="error-banner fade" role="alert">
          <div className="error-icon">!</div>
          <div className="error-content">
            <span className="error-title">Inspection Error</span>
            <p className="error-desc">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {busy && !ready && (
        <div className="skeleton-loading-box fade">
          <div className="skeleton-line title" />
          <div className="skeleton-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        </div>
      )}

      {/* Ready Results */}
      {ready && plan && evaluation && commands && (
        <section className="results-container fade" aria-live="polite">
          {/* Result Header & Share Button */}
          <div className="results-top-bar">
            <div className="results-model-info">
              <span className="active-model-title">
                {arch?.name ?? ready.fileName}
              </span>
              <span className="active-model-meta">
                {ready.fileName} · Read {formatBytes(ready.bytesRead)}
                {ready.totalBytes ? ` of ${formatBytes(ready.totalBytes)}` : ""}
              </span>
            </div>

            <div className="results-actions">
              {ready.files && ready.files.length > 1 && (
                <div className="file-selector-wrap">
                  <select
                    className="file-select"
                    value={
                      ready.files.find((f) => f.path.endsWith(ready.fileName))?.path ??
                      ready.fileName
                    }
                    onChange={(e) => void switchFile(e.target.value)}
                    disabled={busy}
                    aria-label="Select quantization file"
                  >
                    {ready.files.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.path.split("/").pop()} ({formatBytes(f.size)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                className="share-btn"
                onClick={() => void handleCopyShareLink()}
                title="Copy link to this exact result"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span>{copiedShare ? "Link copied!" : "Share result"}</span>
              </button>
            </div>
          </div>

          {/* Verdict Banner with Metrics & Memory Allocation Bar */}
          <VerdictBanner
            evaluation={evaluation}
            plan={plan}
            nCtx={nCtx}
            maxCtx={maxCtx}
            onChangeCtx={(c) => {
              setCtxTouched(true);
              setNCtx(c);
            }}
            kvType={kvType}
            onChangeKvType={(k) => setKvType(k)}
            vramGb={vramGb}
            onChangeVramGb={(gb) => setVramGb(gb)}
            appleUnified={appleUnified}
          />

          {/* Quantization Comparison Table Side by Side */}
          <QuantTable
            rows={quantRows}
            onSelectFile={(path) => void switchFile(path)}
            busy={busy}
          />

          {/* Ready-to-Run Commands (Ollama, LM Studio, llama.cpp) */}
          <CommandsSection commands={commands} />

          {/* Collapsible Details & Expert Breakdown */}
          <DetailsSection
            gguf={ready.gguf}
            plan={plan}
            speed={evaluation.speed}
            bytesRead={ready.bytesRead}
            totalBytes={ready.totalBytes}
            fileName={ready.fileName}
          />
        </section>
      )}

      {/* Footer */}
      <footer className="footer-wrap">
        <p className="footer-note">
          GGUF X-Ray reads only typed headers via HTTP Range requests. Never downloads full model weights.
        </p>
        <div className="footer-links">
          <a href="https://github.com/gfxroy/gguf-xray" target="_blank" rel="noreferrer">
            GitHub Source
          </a>
          <span>·</span>
          <span>MIT License © Aaditya Roy</span>
        </div>
      </footer>
    </main>
  );
}
