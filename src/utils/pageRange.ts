export function parsePageRange(value: string, total: number): number[] {
  if (!value.trim()) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set<number>();
  for (const part of value.split(",")) {
    const [startText, endText] = part.trim().split("-");
    const start = Number(startText);
    const end = endText ? Number(endText) : start;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > total || start > end) {
      throw new Error(`Invalid page range: ${part}`);
    }
    for (let page = start; page <= end; page += 1) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}
