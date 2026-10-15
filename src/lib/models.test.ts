import { describe, expect, it } from "vitest";
import { CURATED_MODELS, findCuratedModel } from "./models";

describe("models", () => {
  it("includes all requested families", () => {
    const families = new Set(CURATED_MODELS.map((m) => m.family));
    expect(families.has("llama")).toBe(true);
    expect(families.has("qwen")).toBe(true);
    expect(families.has("gemma")).toBe(true);
    expect(families.has("mistral")).toBe(true);
    expect(families.has("phi")).toBe(true);
    expect(families.has("deepseek")).toBe(true);
  });

  it("findCuratedModel matches by id and repoUrl", () => {
    const m = findCuratedModel("llama-3.2-1b");
    expect(m).toBeDefined();
    expect(m?.name).toContain("Llama 3.2 1B");

    const byUrl = findCuratedModel("https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF");
    expect(byUrl?.id).toBe("llama-3.2-1b");

    const byRepo = findCuratedModel("bartowski/Llama-3.2-1B-Instruct-GGUF");
    expect(byRepo?.id).toBe("llama-3.2-1b");
  });
});
