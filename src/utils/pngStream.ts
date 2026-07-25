import type { ByteSink, RasterChunk, StreamingImageEncoder } from "../types/streaming";

const encoder = new TextEncoder();
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

let crcTable: Uint32Array | undefined;

export function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let value = n;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      crcTable[n] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(arrays.reduce((sum, array) => sum + array.length, 0));
  let offset = 0;
  arrays.forEach((array) => { output.set(array, offset); offset += array.length; });
  return output;
}

export function pngChunk(type: string, data = new Uint8Array()): Uint8Array {
  const typeBytes = encoder.encode(type);
  return concat(uint32(data.length), typeBytes, data, uint32(crc32(concat(typeBytes, data))));
}

export class PngStreamingEncoder implements StreamingImageEncoder {
  private compression?: CompressionStream;
  private compressionWriter?: WritableStreamDefaultWriter<BufferSource>;
  private pump?: Promise<void>;
  private started = false;
  private finished = false;

  constructor(private readonly sink: ByteSink) {}

  async start({ width, height }: { width: number; height: number }): Promise<void> {
    if (this.started) throw new Error("Encoder already started");
    this.started = true;
    await this.sink.write(PNG_SIGNATURE);
    const ihdr = new Uint8Array(13);
    const view = new DataView(ihdr.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    ihdr.set([8, 6, 0, 0, 0], 8);
    await this.sink.write(pngChunk("IHDR", ihdr));

    this.compression = new CompressionStream("deflate");
    this.compressionWriter = this.compression.writable.getWriter();
    this.pump = (async () => {
      const reader = this.compression!.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value?.length) await this.sink.write(pngChunk("IDAT", value));
      }
    })();
  }

  async writeRows(chunk: RasterChunk): Promise<void> {
    if (!this.compressionWriter || this.finished) throw new Error("Encoder is not writable");
    const stride = chunk.width * 4;
    const scanlines = new Uint8Array((stride + 1) * chunk.height);
    for (let row = 0; row < chunk.height; row += 1) {
      const target = row * (stride + 1);
      scanlines[target] = 0;
      scanlines.set(chunk.rgba.subarray(row * stride, (row + 1) * stride), target + 1);
    }
    await this.compressionWriter.write(scanlines);
  }

  async finish(): Promise<void> {
    if (!this.compressionWriter || !this.pump || this.finished) return;
    this.finished = true;
    await this.compressionWriter.close();
    await this.pump;
    await this.sink.write(pngChunk("IEND"));
    await this.sink.close();
  }

  async cancel(reason?: unknown): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    try { await this.compressionWriter?.abort(reason); } catch { /* already closed */ }
    await this.sink.abort(reason);
  }
}
