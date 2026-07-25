export type PdfOutputMode = "pages" | "long" | "grid";

export function calculateCompositeLayout(
  sizes: Array<{ width: number; height: number }>,
  mode: Exclude<PdfOutputMode, "pages">,
  columns = 2,
) {
  if (!sizes.length) return { width: 0, height: 0, columns: 0, rows: 0, cellWidth: 0, cellHeight: 0 };
  const cellWidth = Math.max(...sizes.map((size) => size.width));
  const cellHeight = Math.max(...sizes.map((size) => size.height));
  if (mode === "long") {
    return {
      width: cellWidth,
      height: sizes.reduce((sum, size) => sum + size.height, 0),
      columns: 1,
      rows: sizes.length,
      cellWidth,
      cellHeight,
    };
  }
  const safeColumns = Math.max(1, Math.min(columns, sizes.length));
  const rows = Math.ceil(sizes.length / safeColumns);
  return { width: cellWidth * safeColumns, height: cellHeight * rows, columns: safeColumns, rows, cellWidth, cellHeight };
}
