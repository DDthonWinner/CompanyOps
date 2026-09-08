export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const segment = (progress: number, start: number, end: number) => clamp((progress - start) / (end - start));
export const smooth = (value: number) => value * value * (3 - 2 * value);

export const CHAPTERS = [
  { label: "Possibility", at: 0 },
  { label: "Project", at: 0.32 },
  { label: "CompanyOps", at: 0.55 },
  { label: "AI Team", at: 0.78 },
  { label: "Office", at: 1 },
];

export function chapterAt(progress: number) {
  return progress < 0.21 ? 0 : progress < 0.45 ? 1 : progress < 0.67 ? 2 : progress < 0.9 ? 3 : 4;
}

export function buildingPosition(index: number): [number, number, number] {
  const local = Math.max(0, index) % 12;
  return [(local % 3 - 1) * 15, [17, 23, 19][local % 3], -7 - Math.floor(local / 3) * 13];
}
