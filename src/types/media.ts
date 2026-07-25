export type JobStatus = "pending" | "processing" | "done" | "error" | "cancelled";
export type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

export type ExportOptions = {
  format: ImageFormat;
  quality: number;
  backgroundColor?: string;
};

export type ProcessedAsset = {
  blob: Blob;
  fileName: string;
  mimeType: ImageFormat;
  width: number;
  height: number;
  originalSize: number;
  outputSize: number;
  previewUrl?: string;
};

export type ProcessingJob = {
  id: string;
  file: File;
  status: JobStatus;
  result?: ProcessedAsset;
  error?: string;
};

export type ToolDefinition = {
  nameKey: string;
  descriptionKey: string;
  path: string;
  status: "available" | "planned";
};

export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};
