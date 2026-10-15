import { useRef, useState } from "react";
import { CURATED_MODELS, type CuratedModel } from "../lib/models";

type Props = {
  currentUrl: string;
  onInspectUrl: (url: string) => Promise<void>;
  onInspectLocal: (file: File) => Promise<void>;
  busy: boolean;
  status: string;
};

export function ModelPicker({
  currentUrl,
  onInspectUrl,
  onInspectLocal,
  busy,
  status,
}: Props) {
  const [inputUrl, setInputUrl] = useState(currentUrl);
  const [activeFamily, setActiveFamily] = useState<string>("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const families = [
    { id: "all", label: "All Models" },
    { id: "llama", label: "Llama 3" },
    { id: "qwen", label: "Qwen 2.5" },
    { id: "deepseek", label: "DeepSeek R1" },
    { id: "gemma", label: "Gemma 2" },
    { id: "mistral", label: "Mistral" },
    { id: "phi", label: "Phi 3.5" },
  ];

  const filteredModels =
    activeFamily === "all"
      ? CURATED_MODELS
      : CURATED_MODELS.filter((m) => m.family === activeFamily);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim() && !busy) {
      void onInspectUrl(inputUrl.trim());
    }
  };

  const handleSelectCurated = (model: CuratedModel) => {
    setInputUrl(model.repoUrl);
    void onInspectUrl(model.repoUrl);
  };

  return (
    <div className="picker-box">
      <div className="picker-header">
        <span className="step-tag">Step 2</span>
        <h2 className="step-title">Choose an AI model</h2>
      </div>

      {/* Model Family Filter Tabs */}
      <div className="family-tabs">
        {families.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`tab-btn ${activeFamily === f.id ? "active" : ""}`}
            onClick={() => setActiveFamily(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Curated Model Cards / Pills */}
      <div className="model-grid">
        {filteredModels.map((m) => {
          const isSelected =
            currentUrl === m.repoUrl ||
            currentUrl.replace("https://huggingface.co/", "") ===
              m.repoUrl.replace("https://huggingface.co/", "");
          return (
            <button
              key={m.id}
              type="button"
              className={`model-card ${isSelected ? "selected" : ""}`}
              onClick={() => handleSelectCurated(m)}
              disabled={busy}
            >
              <div className="model-card-top">
                <span className="model-card-name">{m.name}</span>
                <span className="model-card-params">{m.params}</span>
              </div>
              <p className="model-card-desc">{m.description}</p>
            </button>
          );
        })}
      </div>

      {/* Custom URL Input */}
      <form className="url-form" onSubmit={handleSubmit}>
        <div className="url-input-wrap">
          <input
            type="url"
            className="url-input"
            placeholder="Paste any Hugging Face repo (e.g. bartowski/Qwen2.5-7B-Instruct-GGUF) or direct .gguf link..."
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            disabled={busy}
            aria-label="Hugging Face URL"
          />
          <button
            type="submit"
            className="inspect-btn"
            disabled={busy || !inputUrl.trim()}
          >
            {busy ? (
              <span className="spinner-text">
                <span className="dot-pulse" /> Reading…
              </span>
            ) : (
              "Check Model"
            )}
          </button>
        </div>
      </form>

      {/* Local File Picker & Status */}
      <div className="local-file-row">
        <input
          ref={fileRef}
          type="file"
          accept=".gguf,application/octet-stream"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onInspectLocal(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="ghost-link"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Or test a local .gguf file from your computer</span>
        </button>

        {status && (
          <div className="status-pill fade">
            <span className="status-dot" />
            <span>{status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
