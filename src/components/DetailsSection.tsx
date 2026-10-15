import { useState } from "react";
import { formatBytes } from "../lib/format";
import { formatMetaValue, type GgufFile } from "../lib/gguf";
import type { Plan } from "../lib/planner";
import type { SpeedEstimate } from "../lib/speed";

type Props = {
  gguf: GgufFile;
  plan: Plan;
  speed: SpeedEstimate;
  bytesRead: number;
  totalBytes: number | null;
  fileName: string;
};

export function DetailsSection({
  gguf,
  plan,
  speed,
  bytesRead,
  totalBytes,
  fileName,
}: Props) {
  const [metaSearch, setMetaSearch] = useState("");

  const filteredKv = metaSearch.trim()
    ? gguf.kv.filter(
        (kv) =>
          kv.key.toLowerCase().includes(metaSearch.toLowerCase()) ||
          formatMetaValue(kv.value).toLowerCase().includes(metaSearch.toLowerCase())
      )
    : gguf.kv;

  const pctDownloaded = totalBytes && totalBytes > 0 ? ((bytesRead / totalBytes) * 100).toFixed(2) : null;

  return (
    <details className="details-container">
      <summary className="details-summary">
        <span className="summary-title">Advanced Details & Expert Breakdown</span>
        <span className="summary-hint">Memory formulas, tensors, layers, and raw metadata</span>
      </summary>

      <div className="details-body fade">
        {/* Network Range Request Audit */}
        <div className="detail-card">
          <h4 className="detail-card-title">Network Audit ({fileName})</h4>
          <p className="detail-card-desc">
            X-Ray parsed the real file header without downloading weights:
          </p>
          <div className="audit-stats">
            <div className="audit-stat">
              <span className="audit-lbl">Header Read</span>
              <span className="audit-val font-mono">{formatBytes(bytesRead)}</span>
            </div>
            <div className="audit-stat">
              <span className="audit-lbl">Total File Size</span>
              <span className="audit-val font-mono">
                {totalBytes ? formatBytes(totalBytes) : "Unknown"}
              </span>
            </div>
            <div className="audit-stat">
              <span className="audit-lbl">Bandwidth Saved</span>
              <span className="audit-val font-mono">
                {pctDownloaded ? `${(100 - Number(pctDownloaded)).toFixed(1)}%` : "99%+"}
              </span>
            </div>
          </div>
        </div>

        {/* Speed Formula Explanation */}
        <div className="detail-card">
          <h4 className="detail-card-title">How Speed is Estimated</h4>
          <p className="detail-card-desc">
            In autoregressive LLM inference (token generation with batch size 1), memory bandwidth is the primary bottleneck. Every single generated token requires streaming the active model weights through the memory bus.
          </p>

          <div className="formula-box font-mono">
            <strong>Formula:</strong>
            <br />
            <code>
              Tokens/sec = (Memory_Bandwidth × Efficiency) ÷ (Active_Weights + KV_Cache_Per_Token)
            </code>
            <br />
            <br />
            • GPU VRAM efficiency is modeled at ~75% for optimized CUDA/Metal kernels.
            <br />
            • CPU RAM efficiency is modeled at ~65% for DDR4/DDR5 system memory.
            <br />
            • Partial offload introduces a ~8ms PCIe host-device synchronization penalty per token.
          </div>

          <div className="calc-breakdown">
            <strong>Current active calculation:</strong>
            <p className="calc-desc font-mono">{speed.formulaDescription}</p>
          </div>
        </div>

        {/* Tensors Breakdown */}
        <div className="detail-card">
          <h4 className="detail-card-title">Tensor Data Types ({plan.byType.length} types)</h4>
          <div className="table-responsive">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th className="num">Count</th>
                  <th className="num">Byte Size</th>
                  <th className="num">% of Weights</th>
                </tr>
              </thead>
              <tbody>
                {plan.byType.map((t) => (
                  <tr key={t.type}>
                    <td className="font-mono">{t.name}</td>
                    <td className="num font-mono">{t.count}</td>
                    <td className="num font-mono">{formatBytes(t.bytes)}</td>
                    <td className="num font-mono">
                      {plan.totalWeightBytes > 0
                        ? `${((t.bytes / plan.totalWeightBytes) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Layer Breakdown */}
        {plan.byLayer.length > 0 && (
          <div className="detail-card">
            <h4 className="detail-card-title">
              Layers Breakdown ({plan.byLayer.length} repeating blocks)
            </h4>
            <div className="table-responsive" style={{ maxHeight: 280, overflowY: "auto" }}>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Layer</th>
                    <th>Status</th>
                    <th className="num">Tensors</th>
                    <th className="num">Weights</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.byLayer.map((l) => {
                    const isGpu = plan.gpuLayers.includes(l.layer);
                    return (
                      <tr key={l.layer} className={isGpu ? "row-gpu" : ""}>
                        <td className="font-mono">blk.{l.layer}</td>
                        <td>
                          <span className={`tiny-badge ${isGpu ? "badge-gpu" : "badge-cpu"}`}>
                            {isGpu ? "GPU" : "CPU"}
                          </span>
                        </td>
                        <td className="num font-mono">{l.count}</td>
                        <td className="num font-mono">{formatBytes(l.bytes)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Raw Metadata Explorer */}
        <div className="detail-card">
          <div className="meta-explorer-header">
            <h4 className="detail-card-title" style={{ margin: 0 }}>
              Raw GGUF Metadata ({gguf.kv.length} keys)
            </h4>
            <input
              type="text"
              className="meta-search"
              placeholder="Filter keys (e.g. context, head, arch)..."
              value={metaSearch}
              onChange={(e) => setMetaSearch(e.target.value)}
            />
          </div>

          <div className="metadata-scroll-list font-mono">
            {filteredKv.length > 0 ? (
              filteredKv.map((kv) => (
                <div key={kv.key} className="meta-row">
                  <span className="meta-key">{kv.key}</span>
                  <span className="meta-val">{formatMetaValue(kv.value)}</span>
                </div>
              ))
            ) : (
              <div className="meta-empty">No metadata keys matching "{metaSearch}".</div>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
