import { describe, expect, it } from "vitest";
import { POPULAR_DEVICES, findDevice, searchDevices, detectHardware } from "./devices";

describe("devices", () => {
  it("contains NVIDIA, Apple, AMD, Intel, and CPU devices", () => {
    const cats = new Set(POPULAR_DEVICES.map((d) => d.category));
    expect(cats.has("nvidia")).toBe(true);
    expect(cats.has("apple")).toBe(true);
    expect(cats.has("amd")).toBe(true);
    expect(cats.has("intel")).toBe(true);
    expect(cats.has("cpu")).toBe(true);
  });

  it("findDevice returns correct item by id", () => {
    const dev = findDevice("rtx-4090");
    expect(dev).toBeDefined();
    expect(dev?.vramGb).toBe(24);
    expect(dev?.bandwidthGBs).toBe(1008);
    expect(dev?.isApple).toBe(false);

    const m4 = findDevice("apple-m4-pro-48gb");
    expect(m4).toBeDefined();
    expect(m4?.vramGb).toBe(48);
    expect(m4?.isApple).toBe(true);
  });

  it("searchDevices filters correctly", () => {
    const rtx40 = searchDevices("4070");
    expect(rtx40.length).toBeGreaterThan(0);
    expect(rtx40.every((d) => d.name.includes("4070") || d.shortName.includes("4070"))).toBe(true);

    const apple = searchDevices("apple");
    expect(apple.length).toBeGreaterThan(0);
    expect(apple.every((d) => d.category === "apple" || d.name.toLowerCase().includes("apple"))).toBe(true);

    const emptySearch = searchDevices("");
    expect(emptySearch.length).toBe(POPULAR_DEVICES.length);
  });

  it("detectHardware runs without error in node/test environment", async () => {
    const res = await detectHardware();
    expect(res).toBeDefined();
    expect(typeof res.explanation).toBe("string");
  });
});
