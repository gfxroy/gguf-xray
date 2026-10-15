import type { QuantComparisonRow } from "../lib/quants";

type Props = {
  rows: QuantComparisonRow[];
  onSelectFile?: (filePath: string) => void;
  busy?: boolean;
};

export function QuantTable({ rows, onSelectFile, busy }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="section-card fade">
      <div className="section-header">
        <h3 className="section-title">Quantization Comparison</h3>
        <p className="section-subtitle">
          Side-by-side memory fit and estimated generation speed for your device.
        </p>
      </div>

      <div className="table-responsive">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Quant</th>
              <th className="num">Size</th>
              <th>Hardware Fit</th>
              <th className="num">Est. Speed</th>
              <th>Quality & Tradeoff</th>
              {onSelectFile && <th className="act">Action</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.quant + (row.filePath ?? "")}
                className={row.isCurrent ? "row-current" : ""}
              >
                <td>
                  <div className="quant-name-cell">
                    <span className="quant-code">{row.quant}</span>
                    {row.badge && <span className="quant-tag">{row.badge}</span>}
                    {row.isCurrent && <span className="current-tag">Active</span>}
                  </div>
                </td>
                <td className="num font-mono">{row.formattedSize}</td>
                <td>
                  <span className={`status-pill-badge badge-${row.fitsBadgeClass}`}>
                    {row.fitsStatus}
                    {row.ngl > 0 && row.ngl < row.nLayer ? ` (${row.ngl}/${row.nLayer})` : ""}
                  </span>
                </td>
                <td className="num font-mono">
                  {row.estTokPerSec > 0 ? `~${row.estTokPerSec} tok/s` : "—"}
                </td>
                <td className="quality-note-cell">{row.qualityNote}</td>
                {onSelectFile && (
                  <td className="act">
                    {row.filePath ? (
                      <button
                        type="button"
                        className={`use-quant-btn ${row.isCurrent ? "active" : ""}`}
                        disabled={row.isCurrent || busy}
                        onClick={() => onSelectFile(row.filePath!)}
                      >
                        {row.isCurrent ? "Active" : "Inspect"}
                      </button>
                    ) : (
                      <span className="no-file-text">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
