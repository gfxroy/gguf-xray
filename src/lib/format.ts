/** Binary units, short labels. 131072 → "128 KB". */
export function formatBytes(n: number, digits = 1): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  const abs = Math.abs(n);
  if (abs < 1024) return `${Math.round(n)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const d = v >= 100 ? 0 : v >= 10 ? Math.min(digits, 1) : digits;
  const s = v.toFixed(d).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return `${s} ${units[i]}`;
}

export function formatGb(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  const d = gb >= 10 ? 1 : 2;
  return `${gb.toFixed(d)} GB`;
}

export function formatCtx(n: number): string {
  if (n >= 1024 && n % 1024 === 0) return `${n / 1024}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
