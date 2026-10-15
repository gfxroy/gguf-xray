import { useState } from "react";
import type { CommandsBundle } from "../lib/commands";

type Props = {
  commands: CommandsBundle;
};

export function CommandsSection({ commands }: Props) {
  const [activeTab, setActiveTab] = useState<"ollama" | "lmstudio" | "llamacpp">("ollama");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
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
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  return (
    <div className="section-card fade">
      <div className="section-header">
        <h3 className="section-title">Ready-to-Run Commands</h3>
        <p className="section-subtitle">
          Copy-paste configurations tuned specifically for your hardware and context length.
        </p>
      </div>

      <div className="command-tabs">
        <button
          type="button"
          className={`cmd-tab ${activeTab === "ollama" ? "active" : ""}`}
          onClick={() => setActiveTab("ollama")}
        >
          Ollama
        </button>
        <button
          type="button"
          className={`cmd-tab ${activeTab === "lmstudio" ? "active" : ""}`}
          onClick={() => setActiveTab("lmstudio")}
        >
          LM Studio
        </button>
        <button
          type="button"
          className={`cmd-tab ${activeTab === "llamacpp" ? "active" : ""}`}
          onClick={() => setActiveTab("llamacpp")}
        >
          llama.cpp
        </button>
      </div>

      <div className="tab-body">
        {activeTab === "ollama" && (
          <div className="tab-pane fade">
            <div className="cmd-block">
              <div className="cmd-header-row">
                <span className="cmd-lang-label">One-line Terminal Command</span>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => void copy(commands.ollamaRun, "ol-run")}
                >
                  {copiedKey === "ol-run" ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <pre className="code-box">{commands.ollamaRun}</pre>
            </div>

            <div className="cmd-block" style={{ marginTop: 14 }}>
              <div className="cmd-header-row">
                <span className="cmd-lang-label">Modelfile Configuration</span>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => void copy(commands.ollamaModelfile, "ol-mf")}
                >
                  {copiedKey === "ol-mf" ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <pre className="code-box">{commands.ollamaModelfile}</pre>
            </div>
          </div>
        )}

        {activeTab === "lmstudio" && (
          <div className="tab-pane fade">
            <div className="cmd-block">
              <div className="cmd-header-row">
                <span className="cmd-lang-label">Recommended LM Studio Settings</span>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => void copy(commands.lmStudioPreset, "lms")}
                >
                  {copiedKey === "lms" ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <pre className="code-box">{commands.lmStudioPreset}</pre>
            </div>
          </div>
        )}

        {activeTab === "llamacpp" && (
          <div className="tab-pane fade">
            <div className="cmd-block">
              <div className="cmd-header-row">
                <span className="cmd-lang-label">llama-server (HTTP API & Web UI)</span>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => void copy(commands.llamaServer, "llama-server")}
                >
                  {copiedKey === "llama-server" ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <pre className="code-box">{commands.llamaServer}</pre>
            </div>

            <div className="cmd-block" style={{ marginTop: 14 }}>
              <div className="cmd-header-row">
                <span className="cmd-lang-label">llama-cli (Interactive Terminal Chat)</span>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => void copy(commands.llamaCli, "llama-cli")}
                >
                  {copiedKey === "llama-cli" ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <pre className="code-box">{commands.llamaCli}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
