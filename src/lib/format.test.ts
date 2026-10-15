import { formatBytes, formatCtx } from "./format";

describe("formatBytes", () => {
  it("formats binary units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(128 * 1024)).toBe("128 KB");
    expect(formatBytes(1.8 * 1024 * 1024)).toBe("1.8 MB");
    expect(formatBytes(4.9 * 1024 ** 3)).toBe("4.9 GB");
  });
});

describe("formatCtx", () => {
  it("uses k for multiples of 1024", () => {
    expect(formatCtx(8192)).toBe("8k");
    expect(formatCtx(32768)).toBe("32k");
    expect(formatCtx(512)).toBe("512");
  });
});
