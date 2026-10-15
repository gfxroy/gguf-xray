export type CuratedModel = {
  id: string;
  name: string;
  family: "llama" | "qwen" | "gemma" | "mistral" | "phi" | "deepseek";
  params: string;
  description: string;
  repoUrl: string;
  defaultQuant: string;
  featured?: boolean;
};

export const CURATED_MODELS: CuratedModel[] = [
  // --- Llama 3.x ---
  {
    id: "llama-3.2-1b",
    name: "Llama 3.2 1B Instruct",
    family: "llama",
    params: "1.2B",
    description: "Ultra-compact edge model from Meta; fits on virtually any GPU or laptop.",
    repoUrl: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF",
    defaultQuant: "Q4_K_M",
    featured: true,
  },
  {
    id: "llama-3.2-3b",
    name: "Llama 3.2 3B Instruct",
    family: "llama",
    params: "3.2B",
    description: "Great balance of fast generation and high quality for lightweight devices.",
    repoUrl: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF",
    defaultQuant: "Q4_K_M",
    featured: true,
  },
  {
    id: "llama-3.1-8b",
    name: "Llama 3.1 8B Instruct",
    family: "llama",
    params: "8.0B",
    description: "The gold-standard general purpose 8B model with 128k context support.",
    repoUrl: "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
    defaultQuant: "Q4_K_M",
    featured: true,
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B Instruct",
    family: "llama",
    params: "70.6B",
    description: "State-of-the-art open weights flagship. Demands 40+ GB VRAM or high-RAM Mac.",
    repoUrl: "https://huggingface.co/bartowski/Llama-3.3-70B-Instruct-GGUF",
    defaultQuant: "Q4_K_M",
  },

  // --- Qwen 2.5 ---
  {
    id: "qwen-2.5-1.5b",
    name: "Qwen 2.5 1.5B Instruct",
    family: "qwen",
    params: "1.5B",
    description: "Remarkably strong multilingual & reasoning capabilities in a tiny footprint.",
    repoUrl: "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF",
    defaultQuant: "Q4_K_M",
    featured: true,
  },
  {
    id: "qwen-2.5-7b",
    name: "Qwen 2.5 7B Instruct",
    family: "qwen",
    params: "7.6B",
    description: "Top-tier 7B model outperforming many larger models on code and math.",
    repoUrl: "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF",
    defaultQuant: "Q4_K_M",
    featured: true,
  },
  {
    id: "qwen-2.5-coder-7b",
    name: "Qwen 2.5 Coder 7B Instruct",
    family: "qwen",
    params: "7.6B",
    description: "Dedicated code generation specialist with exceptional benchmark scores.",
    repoUrl: "https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF",
    defaultQuant: "Q4_K_M",
  },
  {
    id: "qwen-2.5-14b",
    name: "Qwen 2.5 14B Instruct",
    family: "qwen",
    params: "14.7B",
    description: "Sweet-spot mid-sized powerhouse; runs comfortably on 16GB VRAM GPUs.",
    repoUrl: "https://huggingface.co/bartowski/Qwen2.5-14B-Instruct-GGUF",
    defaultQuant: "Q4_K_M",
  },

  // --- Gemma 2 ---
  {
    id: "gemma-2-2b",
    name: "Gemma 2 2B IT",
    family: "gemma",
    params: "2.6B",
    description: "Google's ultra-efficient small model with sliding-window attention.",
    repoUrl: "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF",
    defaultQuant: "Q4_K_M",
    featured: true,
  },
  {
    id: "gemma-2-9b",
    name: "Gemma 2 9B IT",
    family: "gemma",
    params: "9.2B",
    description: "Punching far above its weight class; near 70B performance in 9B parameters.",
    repoUrl: "https://huggingface.co/bartowski/gemma-2-9b-it-GGUF",
    defaultQuant: "Q4_K_M",
  },

  // --- Mistral ---
  {
    id: "mistral-7b-v0.3",
    name: "Mistral 7B Instruct v0.3",
    family: "mistral",
    params: "7.2B",
    description: "The definitive open-source community favorite with tool-calling support.",
    repoUrl: "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF",
    defaultQuant: "Q4_K_M",
  },

  // --- Phi ---
  {
    id: "phi-3.5-mini",
    name: "Phi 3.5 Mini Instruct",
    family: "phi",
    params: "3.8B",
    description: "Microsoft's high-reasoning synthetic data model with 128k context.",
    repoUrl: "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF",
    defaultQuant: "Q4_K_M",
  },

  // --- DeepSeek R1 Distills ---
  {
    id: "deepseek-r1-distill-qwen-1.5b",
    name: "DeepSeek R1 Distill Qwen 1.5B",
    family: "deepseek",
    params: "1.5B",
    description: "Lightweight reasoning model distilled from DeepSeek R1 into Qwen 1.5B.",
    repoUrl: "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF",
    defaultQuant: "Q4_K_M",
    featured: true,
  },
  {
    id: "deepseek-r1-distill-qwen-7b",
    name: "DeepSeek R1 Distill Qwen 7B",
    family: "deepseek",
    params: "7.6B",
    description: "Popular chain-of-thought reasoning model; fits in 8 GB VRAM at 4-bit.",
    repoUrl: "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF",
    defaultQuant: "Q4_K_M",
    featured: true,
  },
  {
    id: "deepseek-r1-distill-llama-8b",
    name: "DeepSeek R1 Distill Llama 8B",
    family: "deepseek",
    params: "8.0B",
    description: "DeepSeek R1 reasoning reasoning distilled into Llama 3.1 8B architecture.",
    repoUrl: "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Llama-8B-GGUF",
    defaultQuant: "Q4_K_M",
  },
  {
    id: "deepseek-r1-distill-qwen-14b",
    name: "DeepSeek R1 Distill Qwen 14B",
    family: "deepseek",
    params: "14.7B",
    description: "Strongest distilled reasoning model under 20B parameters.",
    repoUrl: "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF",
    defaultQuant: "Q4_K_M",
  },
];

export const DEFAULT_MODEL = CURATED_MODELS[0]; // Llama 3.2 1B

export function findCuratedModel(idOrUrl: string): CuratedModel | undefined {
  return CURATED_MODELS.find(
    (m) =>
      m.id === idOrUrl ||
      m.repoUrl === idOrUrl ||
      m.repoUrl.replace("https://huggingface.co/", "") === idOrUrl.replace("https://huggingface.co/", "")
  );
}
