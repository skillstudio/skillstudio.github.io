import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import type { CompositeEstimate, RasterChunk, StreamingImageEncoder } from "../types/streaming";
import type { ImageFormat } from "../types/media";
import { createCanvas } from "./imageProcessing";
import { calculateCompositeLayout, type PdfOutputMode } from "./pdfLayout";

const SAFE_CANVAS_PIXELS = 64_000_000;
const SAFE_CANVAS_EDGE = 16_384;
export const JPEG_MAX_DIMENSION = 65_535;
export const STREAM_BAND_HEIGHT = 512;

type PageMetric = { pageNumber: number; width: number; height: number };

async function loadMetrics(file: File, pageNumbers: number[], scale: number): Promise<PageMetric[]> {
  const task = getDocument({ data: await file.arrayBuffer() });
  const document = await task.promise;
  try {
    return await Promise.all(pageNumbers.map(async (pageNumber) => {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      page.cleanup();
      return { pageNumber, width: Math.ceil(viewport.width), height: Math.ceil(viewport.height) };
    }));
  } finally {
    await task.destroy();
  }
}

export async function estimatePdfComposite(
  file: File,
  pageNumbers: number[],
  scale: number,
  mode: Exclude<PdfOutputMode, "pages">,
  columns: number,
  format: ImageFormat,
): Promise<CompositeEstimate> {
  const metrics = await loadMetrics(file, pageNumbers, scale);
  const layout = calculateCompositeLayout(metrics, mode, columns);
  const pixels = layout.width * layout.height;
  const formatError = format === "image/jpeg" && (layout.width > JPEG_MAX_DIMENSION || layout.height > JPEG_MAX_DIMENSION)
    ? "jpeg-dimension-limit"
    : undefined;
  return {
    width: layout.width,
    height: layout.height,
    pixels,
    estimatedCanvasBytes: pixels * 4,
    format,
    strategy: pixels > SAFE_CANVAS_PIXELS || layout.width > SAFE_CANVAS_EDGE || layout.height > SAFE_CANVAS_EDGE ? "stream" : "canvas",
    formatError,
  };
}

async function renderPageSlice(
  document: PDFDocumentProxy,
  metric: PageMetric,
  sourceY: number,
  height: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const page = await document.getPage(metric.pageNumber);
  const viewport = page.getViewport({ scale });
  const { canvas, context } = createCanvas(metric.width, height);
  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: [1, 0, 0, 1, 0, -sourceY],
  }).promise;
  page.cleanup();
  return canvas;
}

async function writeBand(
  encoder: StreamingImageEncoder,
  canvas: HTMLCanvasElement,
  y: number,
): Promise<void> {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser");
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  const chunk: RasterChunk = { y, width: canvas.width, height: canvas.height, rgba: data.data };
  await encoder.writeRows(chunk);
  canvas.width = 1;
  canvas.height = 1;
}

export async function streamPdfComposite(
  file: File,
  pageNumbers: number[],
  scale: number,
  mode: Exclude<PdfOutputMode, "pages">,
  columns: number,
  encoder: StreamingImageEncoder,
  onProgress: (rowsDone: number, rowsTotal: number) => void,
  signal?: AbortSignal,
): Promise<{ width: number; height: number }> {
  const task = getDocument({ data: await file.arrayBuffer() });
  const document = await task.promise;
  try {
    const metrics = await Promise.all(pageNumbers.map(async (pageNumber) => {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      page.cleanup();
      return { pageNumber, width: Math.ceil(viewport.width), height: Math.ceil(viewport.height) };
    }));
    const layout = calculateCompositeLayout(metrics, mode, columns);
    await encoder.start({ width: layout.width, height: layout.height });
    let outputY = 0;

    if (mode === "long") {
      for (const metric of metrics) {
        for (let sourceY = 0; sourceY < metric.height; sourceY += STREAM_BAND_HEIGHT) {
          signal?.throwIfAborted();
          const height = Math.min(STREAM_BAND_HEIGHT, metric.height - sourceY);
          const strip = createCanvas(layout.width, height);
          const pageSlice = await renderPageSlice(document, metric, sourceY, height, scale);
          strip.context.drawImage(pageSlice, Math.floor((layout.width - metric.width) / 2), 0);
          pageSlice.width = 1;
          pageSlice.height = 1;
          await writeBand(encoder, strip.canvas, outputY);
          outputY += height;
          onProgress(outputY, layout.height);
        }
      }
    } else {
      for (let row = 0; row < layout.rows; row += 1) {
        const rowMetrics = metrics.slice(row * layout.columns, (row + 1) * layout.columns);
        for (let bandY = 0; bandY < layout.cellHeight; bandY += STREAM_BAND_HEIGHT) {
          signal?.throwIfAborted();
          const height = Math.min(STREAM_BAND_HEIGHT, layout.cellHeight - bandY);
          const strip = createCanvas(layout.width, height);
          for (const [column, metric] of rowMetrics.entries()) {
            const pageTop = Math.floor((layout.cellHeight - metric.height) / 2);
            const intersectionTop = Math.max(bandY, pageTop);
            const intersectionBottom = Math.min(bandY + height, pageTop + metric.height);
            if (intersectionBottom <= intersectionTop) continue;
            const sliceHeight = intersectionBottom - intersectionTop;
            const pageSlice = await renderPageSlice(document, metric, intersectionTop - pageTop, sliceHeight, scale);
            const x = column * layout.cellWidth + Math.floor((layout.cellWidth - metric.width) / 2);
            strip.context.drawImage(pageSlice, x, intersectionTop - bandY);
            pageSlice.width = 1;
            pageSlice.height = 1;
          }
          await writeBand(encoder, strip.canvas, outputY);
          outputY += height;
          onProgress(outputY, layout.height);
        }
      }
    }
    await encoder.finish();
    return { width: layout.width, height: layout.height };
  } catch (error) {
    await encoder.cancel(error);
    throw error;
  } finally {
    await task.destroy();
  }
}
