import type { KvType } from "./memory";

export type UrlState = {
  deviceId?: string;
  vramGb?: number;
  apple?: boolean;
  model?: string; // id, repoId, or full URL
  file?: string;
  ctx?: number;
  kv?: KvType;
};

export function parseHashState(hash: string): UrlState {
  const clean = hash.replace(/^[#?]+/, "").trim();
  if (!clean) return {};

  const params = new URLSearchParams(clean);
  const state: UrlState = {};

  const dev = params.get("dev");
  if (dev) state.deviceId = dev;

  const vram = params.get("vram");
  if (vram) {
    const num = Number(vram);
    if (!Number.isNaN(num) && num > 0) state.vramGb = num;
  }

  const apple = params.get("apple");
  if (apple != null) {
    state.apple = apple === "1" || apple === "true";
  }

  const model = params.get("m");
  if (model) state.model = decodeURIComponent(model);

  const file = params.get("f");
  if (file) state.file = decodeURIComponent(file);

  const ctx = params.get("ctx");
  if (ctx) {
    const num = Number(ctx);
    if (!Number.isNaN(num) && num > 0) state.ctx = num;
  }

  const kv = params.get("kv");
  if (kv === "f16" || kv === "q8_0" || kv === "q4_0") {
    state.kv = kv;
  }

  return state;
}

export function buildHashState(state: UrlState): string {
  const params = new URLSearchParams();

  if (state.deviceId) params.set("dev", state.deviceId);
  if (state.vramGb != null) params.set("vram", String(state.vramGb));
  if (state.apple != null) params.set("apple", state.apple ? "1" : "0");
  if (state.model) params.set("m", state.model);
  if (state.file) params.set("f", state.file);
  if (state.ctx != null) params.set("ctx", String(state.ctx));
  if (state.kv && state.kv !== "f16") params.set("kv", state.kv);

  const s = params.toString();
  return s ? `#${s}` : "";
}

export function updateLocationHash(state: UrlState): void {
  if (typeof window === "undefined") return;
  const hash = buildHashState(state);
  if (window.location.hash !== hash) {
    window.history.replaceState(null, "", hash || window.location.pathname);
  }
}
