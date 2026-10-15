import { formatBytes, formatCtx, formatInt } from "../lib/format";
import type { EvaluationResult } from "../lib/speed";
import type { Plan } from "../lib/planner";
import type { KvType } from "../lib/memory";

type Props = {
  evaluation: EvaluationResult;
  plan: Plan;
  nCtx: number;
  maxCtx: number;
  onChangeCtx: (ctx: number) => void;
  kvType: KvType;
  onChangeKvType: (kv: KvType) => void;
  vramGb: number;
  onChangeVramGb: (gb: number) => void;
  appleUnified: boolean;
};

const VRAM_PRESETS = [8, 12, 16, 24, 32, 48, 80];

export function VerdictBanner({
  evaluation,
  plan,
  nCtx,
  maxCtx,
  onChangeCtx,
  kvType,
  onChangeKvType,
  vramGb,
  onChangeVramGb,
  appleUnified,
}: Props) {
  const { verdictType, verdictTitle, verdictDescription, speed, maxContextTokens, bestQuantRecommendation } =
    evaluation;

  const denom = Math.max(plan.available, plan.used, 1);
  const wPct = (plan.weightsGpu / denom) * 100;
  const kPct = (plan.kvGpu / denom) * 100;
  const bPct = (plan.buffer / denom) * 100;
  const fPct = (plan.free / denom) * 100;

  const step = ctxStep(maxCtx);

  return (
    <div className={`verdict-container verdict-${verdictType} fade`}>
      {/* Big Verdict Header */}
      <div className="verdict-header">
        <div className="verdict-badge-row">
          <span className={`verdict-icon-dot ${verdictType}`} />
          <h2 className="verdict-headline">{verdictTitle}</h2>
        </div>
        <p className="verdict-summary">{verdictDescription}</p>
      </div>

      {/* 4 Key Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Estimated Speed</span>
          <div className="metric-value-wrap">
            <span className="metric-val">~{speed.tokPerSec}</span>
            <span className="metric-unit">tok/s</span>
          </div>
          <span className="metric-sub">{speed.timePerTokenMs} ms/token · {speed.gpuBandwidthGBs} GB/s bus</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Best Quant for Device</span>
          <div className="metric-value-wrap">
            <span className="metric-val-text">{bestQuantRecommendation.split(" ")[0]}</span>
          </div>
          <span className="metric-sub">{bestQuantRecommendation.replace(/^Q\w+\s*/, "")}</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Max Context</span>
          <div className="metric-value-wrap">
            <span className="metric-val">{formatInt(maxContextTokens)}</span>
            <span className="metric-unit">tokens</span>
          </div>
          <span className="metric-sub">
            {maxContextTokens >= maxCtx ? "Full native context" : "VRAM limited"}
          </span>
        </div>

        <div className="metric-card">
          <span className="metric-label">GPU Offload</span>
          <div className="metric-value-wrap">
            <span className="metric-val">
              {plan.nLayer > 0 ? `${plan.ngl}/${plan.nLayer}` : "0/0"}
            </span>
            <span className="metric-unit">layers</span>
          </div>
          <span className="metric-sub">
            {plan.fullyFits
              ? "100% weights in VRAM"
              : plan.ngl === 0
              ? "All layers in system RAM"
              : `${Math.round((plan.ngl / Math.max(1, plan.nLayer)) * 100)}% layers on GPU`}
          </span>
        </div>
      </div>

      {/* Memory Allocation Visualizer Bar */}
      <div className="memory-section">
        <div className="memory-bar-header">
          <span className="memory-bar-title">
            Memory Allocation ({formatBytes(plan.available)} available{appleUnified ? " · Apple Unified 75%" : ""})
          </span>
          <span className="memory-bar-used">
            {formatBytes(plan.used)} used ({Math.round((plan.used / Math.max(1, plan.available)) * 100)}%)
          </span>
        </div>

        <div className="mem-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, (plan.used / denom) * 100)}>
          <div className="mem-seg weights" style={{ width: `${wPct}%` }} title={`Weights: ${formatBytes(plan.weightsGpu)}`} />
          <div className="mem-seg kv" style={{ width: `${kPct}%` }} title={`KV Cache: ${formatBytes(plan.kvGpu)}`} />
          <div className="mem-seg buffer" style={{ width: `${bPct}%` }} title={`Compute Buffer: ${formatBytes(plan.buffer)}`} />
          <div className="mem-seg free" style={{ width: `${fPct}%` }} title={`Free VRAM: ${formatBytes(plan.free)}`} />
        </div>

        <div className="mem-legend">
          <div className="legend-item">
            <span className="swatch weights" />
            <span className="legend-label">Weights</span>
            <span className="legend-val">{formatBytes(plan.weightsGpu)}</span>
          </div>
          <div className="legend-item">
            <span className="swatch kv" />
            <span className="legend-label">KV Cache</span>
            <span className="legend-val">{formatBytes(plan.kvGpu)}</span>
          </div>
          <div className="legend-item">
            <span className="swatch buffer" />
            <span className="legend-label">Compute Buffer</span>
            <span className="legend-val">{formatBytes(plan.buffer)}</span>
          </div>
          <div className="legend-item">
            <span className="swatch free" />
            <span className="legend-label">Free VRAM</span>
            <span className="legend-val">{formatBytes(plan.free)}</span>
          </div>
        </div>
      </div>

      {/* Interactive Controls Drawer */}
      <div className="interactive-controls">
        <div className="ctrl-group">
          <div className="ctrl-header-row">
            <span className="ctrl-title">Target Context Length</span>
            <span className="ctrl-val">{formatInt(nCtx)} tokens ({formatCtx(nCtx)})</span>
          </div>
          <input
            type="range"
            className="slider"
            min={512}
            max={maxCtx}
            step={step}
            value={Math.min(nCtx, maxCtx)}
            onChange={(e) => onChangeCtx(Number(e.target.value))}
            aria-label="Context length"
          />
        </div>

        <div className="ctrl-split-row">
          <div className="ctrl-group">
            <div className="ctrl-header-row">
              <span className="ctrl-title">KV Cache Precision</span>
            </div>
            <div className="toggle-group">
              {(["f16", "q8_0", "q4_0"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`toggle-btn ${kvType === t ? "active" : ""}`}
                  onClick={() => onChangeKvType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="ctrl-group">
            <div className="ctrl-header-row">
              <span className="ctrl-title">Quick VRAM Preset</span>
            </div>
            <div className="presets-list">
              {VRAM_PRESETS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`preset-btn ${vramGb === g ? "active" : ""}`}
                  onClick={() => onChangeVramGb(g)}
                >
                  {g}G
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ctxStep(max: number): number {
  if (max <= 4096) return 256;
  if (max <= 32768) return 512;
  return 1024;
}
