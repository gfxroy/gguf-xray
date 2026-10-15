import type { KvType } from "./memory";

export type CommandsBundle = {
  llamaServer: string;
  llamaCli: string;
  ollamaRun: string;
  ollamaModelfile: string;
  lmStudioPreset: string;
};

export function buildCommands(options: {
  fileName: string;
  repoId?: string;
  ngl: number;
  nLayer: number;
  fullyFits: boolean;
  nCtx: number;
  kvType: KvType;
}): CommandsBundle {
  const { fileName, repoId, ngl, nLayer, fullyFits, nCtx, kvType } = options;

  const cmdNgl = fullyFits ? 99 : ngl;
  const kvFlags = kvType === "f16" ? "" : ` -ctk ${kvType} -ctv ${kvType}`;
  const safeFile = shellFile(fileName);

  // llama.cpp
  const llamaServer = `llama-server -m ${safeFile} -ngl ${cmdNgl} -c ${nCtx} -fa on${kvFlags}`;
  const llamaCli = `llama-cli -m ${safeFile} -ngl ${cmdNgl} -c ${nCtx} -fa on${kvFlags} -p "You are a helpful assistant." --conversation`;

  // Ollama
  // Generate friendly model tag name if possible, e.g. "llama3.2:1b" or "qwen2.5:7b"
  const tagGuess = inferOllamaTag(fileName, repoId);
  const ollamaRun = tagGuess ? `ollama run ${tagGuess}` : `ollama run ${fileName.replace(/\.gguf$/i, "").toLowerCase()}`;

  const ollamaModelfile = [
    `# Modelfile (run: ollama create my-model -f ./Modelfile && ollama run my-model)`,
    `FROM ./${fileName}`,
    `PARAMETER num_ctx ${nCtx}`,
    `PARAMETER num_gpu ${cmdNgl}`,
    ``,
    `# Optional performance environment:`,
    `# OLLAMA_FLASH_ATTENTION=1`,
    kvType !== "f16" ? `# OLLAMA_KV_CACHE_TYPE=${kvType}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // LM Studio
  const offloadText = fullyFits
    ? "Max (all layers on GPU)"
    : ngl === 0
    ? "0 (CPU only)"
    : `${ngl} of ${nLayer} layers (${Math.round((ngl / Math.max(1, nLayer)) * 100)}%)`;

  const lmStudioPreset = [
    `LM Studio Configuration:`,
    repoId ? `• Model / Repo: ${repoId}` : `• Model File: ${fileName}`,
    `• GPU Offload: ${offloadText}`,
    `• Context Length: ${nCtx.toLocaleString()} tokens`,
    `• Flash Attention: Enabled (fa: on)`,
    kvType !== "f16" ? `• KV Cache Type: ${kvType}` : `• KV Cache: Default (fp16)`,
  ].join("\n");

  return {
    llamaServer,
    llamaCli,
    ollamaRun,
    ollamaModelfile,
    lmStudioPreset,
  };
}

function inferOllamaTag(fileName: string, repoId?: string): string | null {
  const s = (repoId ?? fileName).toLowerCase();
  if (s.includes("llama-3.2-1b") || s.includes("llama3.2-1b")) return "llama3.2:1b";
  if (s.includes("llama-3.2-3b") || s.includes("llama3.2-3b")) return "llama3.2:3b";
  if (s.includes("llama-3.1-8b") || s.includes("llama3.1-8b")) return "llama3.1:8b";
  if (s.includes("llama-3.3-70b") || s.includes("llama3.3-70b")) return "llama3.3:70b";
  if (s.includes("qwen2.5-1.5b") || s.includes("qwen-2.5-1.5b")) return "qwen2.5:1.5b";
  if (s.includes("qwen2.5-7b") || s.includes("qwen-2.5-7b")) return "qwen2.5:7b";
  if (s.includes("qwen2.5-14b") || s.includes("qwen-2.5-14b")) return "qwen2.5:14b";
  if (s.includes("qwen2.5-coder-7b")) return "qwen2.5-coder:7b";
  if (s.includes("gemma-2-2b") || s.includes("gemma2-2b")) return "gemma2:2b";
  if (s.includes("gemma-2-9b") || s.includes("gemma2-9b")) return "gemma2:9b";
  if (s.includes("mistral-7b")) return "mistral:7b";
  if (s.includes("phi-3.5-mini") || s.includes("phi3.5-mini")) return "phi3.5:mini";
  if (s.includes("deepseek-r1-distill-qwen-1.5b")) return "deepseek-r1:1.5b";
  if (s.includes("deepseek-r1-distill-qwen-7b")) return "deepseek-r1:7b";
  if (s.includes("deepseek-r1-distill-llama-8b")) return "deepseek-r1:8b";
  if (s.includes("deepseek-r1-distill-qwen-14b")) return "deepseek-r1:14b";
  return null;
}

function shellFile(name: string): string {
  if (/^[A-Za-z0-9._+/-]+$/.test(name)) return name;
  return `'${name.replace(/'/g, `'\\''`)}'`;
}
