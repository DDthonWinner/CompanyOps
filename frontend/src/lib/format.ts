// Compact token count: 210000 → "210K", 1240000 → "1.2M". null/undefined → "미수집".
export function fmtTokens(n: number | null | undefined): string {
  if (n == null) return "미수집";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
