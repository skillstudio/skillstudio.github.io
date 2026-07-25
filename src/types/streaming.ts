import type { ImageFormat } from "./media";

export type CompositeEstimate = {
  width: number;
  height: number;
  pixels: number;
  estimatedCanvasBytes: number;
  format: ImageFormat;
  strategy: "canvas" | "stream";
  formatError?: "jpeg-dimension-limit";
};

export type RasterChunk = {
  y: number;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
};

export interface StreamingImageEncoder {
  start(metadata: { width: number; height: number }): Promise<void>;
  writeRows(chunk: RasterChunk): Promise<void>;
  finish(): Promise<void>;
  cancel(reason?: unknown): Promise<void>;
}

export interface ByteSink {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}
