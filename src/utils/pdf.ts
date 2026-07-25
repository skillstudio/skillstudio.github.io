import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ExportOptions, ProcessedAsset } from "../types/media";
import { canvasToBlob, createCanvas, extensionFor } from "./imageProcessing";
import { calculateCompositeLayout, type PdfOutputMode } from "./pdfLayout";

export type { PdfOutputMode } from "./pdfLayout";

GlobalWorkerOptions.workerSrc = workerSrc;

export async function composePdfPages(
  assets: ProcessedAsset[],
  sourceName: string,
  mode: Exclude<PdfOutputMode, "pages">,
  columns: number,
  options: ExportOptions,
  signal?: AbortSignal,
): Promise<ProcessedAsset> {
  signal?.throwIfAborted();
  const layout = calculateCompositeLayout(assets, mode, columns);
  const { canvas, context } = createCanvas(layout.width, layout.height);
  if (options.format === "image/jpeg") {
    context.fillStyle = options.backgroundColor || "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const bitmaps = await Promise.all(assets.map((asset) => createImageBitmap(asset.blob)));
  try {
    let longY = 0;
    bitmaps.forEach((bitmap, index) => {
      signal?.throwIfAborted();
      if (mode === "long") {
        context.drawImage(bitmap, Math.floor((layout.width - bitmap.width) / 2), longY);
        longY += bitmap.height;
        return;
      }
      const column = index % layout.columns;
      const row = Math.floor(index / layout.columns);
      const x = column * layout.cellWidth + Math.floor((layout.cellWidth - bitmap.width) / 2);
      const y = row * layout.cellHeight + Math.floor((layout.cellHeight - bitmap.height) / 2);
      context.drawImage(bitmap, x, y);
    });
    const blob = await canvasToBlob(canvas, options);
    const stem = sourceName.replace(/\.pdf$/i, "");
    return {
      blob,
      fileName: `${stem}-${mode === "long" ? "long-image" : "grid"}.${extensionFor(options.format)}`,
      mimeType: options.format,
      width: canvas.width,
      height: canvas.height,
      originalSize: assets[0]?.originalSize || 0,
      outputSize: blob.size,
    };
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

export async function pdfPageCount(file: File): Promise<number> {
  const task = getDocument({ data: await file.arrayBuffer() });
  const document = await task.promise;
  const count = document.numPages;
  await task.destroy();
  return count;
}

export async function renderPdfPages(
  file: File,
  pageNumbers: number[],
  scale: number,
  options: ExportOptions,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ProcessedAsset[]> {
  const task = getDocument({ data: await file.arrayBuffer() });
  const document = await task.promise;
  const assets: ProcessedAsset[] = [];
  const stem = file.name.replace(/\.pdf$/i, "");
  try {
    for (const [index, pageNumber] of pageNumbers.entries()) {
      signal?.throwIfAborted();
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const { canvas, context } = createCanvas(viewport.width, viewport.height);
      if (options.format === "image/jpeg") {
        context.fillStyle = options.backgroundColor || "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      signal?.throwIfAborted();
      const blob = await canvasToBlob(canvas, options);
      assets.push({
        blob,
        fileName: `${stem}-page-${String(pageNumber).padStart(3, "0")}.${extensionFor(options.format)}`,
        mimeType: options.format,
        width: canvas.width,
        height: canvas.height,
        originalSize: file.size,
        outputSize: blob.size,
      });
      page.cleanup();
      onProgress(index + 1, pageNumbers.length);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    return assets;
  } finally {
    await task.destroy();
  }
}
