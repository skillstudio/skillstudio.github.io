export type OutputFormat = "original" | "image/jpeg" | "image/webp";

export type CompressionResult = {
  blob: Blob;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  mimeType: string;
};

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isSupportedImage(file: File): boolean {
  return supportedTypes.has(file.type);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export async function compressImage(
  file: File,
  qualityPercent: number,
  outputFormat: OutputFormat,
): Promise<CompressionResult> {
  if (!isSupportedImage(file)) {
    throw new Error("Unsupported image type");
  }

  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    throw new Error("Canvas is not available in this browser");
  }

  context.drawImage(image, 0, 0);

  const mimeType = outputFormat === "original" ? file.type : outputFormat;
  const quality = Math.min(Math.max(qualityPercent / 100, 0.1), 1);
  const blob = await canvasToBlob(canvas, mimeType, quality);
  const compressedSize = blob.size;

  return {
    blob,
    fileName: buildOutputFileName(file.name, mimeType),
    originalSize: file.size,
    compressedSize,
    savedPercent: calculateSavedPercent(file.size, compressedSize),
    mimeType,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be loaded"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Image compression failed"));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

function buildOutputFileName(fileName: string, mimeType: string): string {
  const extension = mimeType === "image/webp" ? "webp" : mimeType === "image/png" ? "png" : "jpg";
  const name = fileName.replace(/\.[^/.]+$/, "");
  return `${name}-compressed.${extension}`;
}

function calculateSavedPercent(originalSize: number, compressedSize: number): number {
  if (originalSize <= 0) {
    return 0;
  }

  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
}
