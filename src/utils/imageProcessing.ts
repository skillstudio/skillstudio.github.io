import type { CropArea, ExportOptions, ImageFormat, ProcessedAsset } from "../types/media";

export const SUPPORTED_IMAGE_TYPES = new Set<ImageFormat>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isSupportedImage(file: File): boolean {
  return SUPPORTED_IMAGE_TYPES.has(file.type as ImageFormat);
}

export function createJobId(file: File): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${file.name}-${file.size}-${file.lastModified}-${suffix}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function extensionFor(format: ImageFormat): string {
  return format === "image/jpeg" ? "jpg" : format === "image/png" ? "png" : "webp";
}

export function outputName(fileName: string, suffix: string, format: ImageFormat): string {
  const stem = fileName.replace(/\.[^/.]+$/, "");
  return `${stem}-${suffix}.${extensionFor(format)}`;
}

export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

export function createCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser");
  return { canvas, context };
}

export function fillExportBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: ExportOptions,
): void {
  if (options.format === "image/jpeg") {
    context.fillStyle = options.backgroundColor || "#ffffff";
    context.fillRect(0, 0, width, height);
  }
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  options: ExportOptions,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Image export failed")),
      options.format,
      Math.min(1, Math.max(0.1, options.quality / 100)),
    );
  });
}

export async function renderImage(
  file: File,
  width: number,
  height: number,
  options: ExportOptions,
  suffix: string,
): Promise<ProcessedAsset> {
  const image = await decodeImage(file);
  try {
    const { canvas, context } = createCanvas(width, height);
    fillExportBackground(context, canvas.width, canvas.height, options);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, options);
    return {
      blob,
      fileName: outputName(file.name, suffix, options.format),
      mimeType: options.format,
      width: canvas.width,
      height: canvas.height,
      originalSize: file.size,
      outputSize: blob.size,
    };
  } finally {
    image.close();
  }
}

export async function compressImage(
  file: File,
  options: ExportOptions,
): Promise<ProcessedAsset> {
  const image = await decodeImage(file);
  try {
    const { canvas, context } = createCanvas(image.width, image.height);
    fillExportBackground(context, canvas.width, canvas.height, options);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const qualities = options.format === "image/png"
      ? [100]
      : Array.from(
        new Set([
          Math.min(100, Math.max(40, options.quality)),
          ...Array.from({ length: 13 }, (_, index) => Math.max(40, options.quality - (index + 1) * 5)),
        ]),
      ).sort((a, b) => b - a);

    let smallest: { blob: Blob; quality: number } | null = null;
    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, { ...options, quality });
      if (!smallest || blob.size < smallest.blob.size) smallest = { blob, quality };
      if (blob.size < file.size) {
        return {
          blob,
          fileName: outputName(file.name, "compressed", options.format),
          mimeType: options.format,
          width: canvas.width,
          height: canvas.height,
          originalSize: file.size,
          outputSize: blob.size,
          compressionStatus: "reduced",
          actualQuality: quality,
        };
      }
    }

    // Re-encoding an already optimized file can increase its size. If the
    // requested format matches, keep the original bytes instead of returning
    // a misleading "compressed" file that is larger.
    if (file.type === options.format) {
      return {
        blob: file,
        fileName: outputName(file.name, "compressed", options.format),
        mimeType: options.format,
        width: canvas.width,
        height: canvas.height,
        originalSize: file.size,
        outputSize: file.size,
        compressionStatus: "unchanged",
        actualQuality: 100,
      };
    }
    throw new Error(smallest ? "NO_SMALLER_OUTPUT" : "COMPRESSION_FAILED");
  } finally {
    image.close();
  }
}

export async function cropImage(
  file: File,
  area: CropArea,
  rotation: number,
  options: ExportOptions,
): Promise<ProcessedAsset> {
  const image = await decodeImage(file);
  try {
    const radians = rotation * Math.PI / 180;
    const boundsWidth = Math.abs(Math.cos(radians) * image.width) + Math.abs(Math.sin(radians) * image.height);
    const boundsHeight = Math.abs(Math.sin(radians) * image.width) + Math.abs(Math.cos(radians) * image.height);
    const rotated = createCanvas(boundsWidth, boundsHeight);
    rotated.context.translate(rotated.canvas.width / 2, rotated.canvas.height / 2);
    rotated.context.rotate(radians);
    rotated.context.drawImage(image, -image.width / 2, -image.height / 2);

    const result = createCanvas(area.width, area.height);
    fillExportBackground(result.context, result.canvas.width, result.canvas.height, options);
    result.context.drawImage(
      rotated.canvas,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      result.canvas.width,
      result.canvas.height,
    );
    const blob = await canvasToBlob(result.canvas, options);
    return {
      blob,
      fileName: outputName(file.name, "cropped", options.format),
      mimeType: options.format,
      width: result.canvas.width,
      height: result.canvas.height,
      originalSize: file.size,
      outputSize: blob.size,
    };
  } finally {
    image.close();
  }
}
