import { describe, expect, it } from "vitest";
import { parseHashState, buildHashState } from "./urlState";

describe("urlState", () => {
  it("roundtrips state to hash and back", () => {
    const original = {
      deviceId: "rtx-4090",
      vramGb: 24,
      apple: false,
      model: "bartowski/Llama-3.2-1B-Instruct-GGUF",
      file: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
      ctx: 8192,
      kv: "q8_0" as const,
    };

    const hash = buildHashState(original);
    expect(hash.startsWith("#")).toBe(true);

    const parsed = parseHashState(hash);
    expect(parsed.deviceId).toBe(original.deviceId);
    expect(parsed.vramGb).toBe(original.vramGb);
    expect(parsed.apple).toBe(original.apple);
    expect(parsed.model).toBe(original.model);
    expect(parsed.file).toBe(original.file);
    expect(parsed.ctx).toBe(original.ctx);
    expect(parsed.kv).toBe(original.kv);
  });

  it("handles empty or partial hash strings", () => {
    expect(parseHashState("")).toEqual({});
    expect(parseHashState("#")).toEqual({});

    const partial = parseHashState("#dev=rtx-3060-12gb&ctx=4096");
    expect(partial.deviceId).toBe("rtx-3060-12gb");
    expect(partial.ctx).toBe(4096);
    expect(partial.model).toBeUndefined();
  });
});
