// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ByteSink } from "../types/streaming";
import { crc32, PngStreamingEncoder, pngChunk } from "./pngStream";

function join(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  chunks.forEach((chunk) => { result.set(chunk, offset); offset += chunk.length; });
  return result;
}

describe("streaming PNG encoder", () => {
  it("calculates the standard CRC-32 check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("writes valid PNG chunks and filtered RGBA scanlines", async () => {
    const output: Uint8Array[] = [];
    const sink: ByteSink = {
      write: async (chunk) => { output.push(chunk.slice()); },
      close: async () => {},
      abort: async () => {},
    };
    const encoder = new PngStreamingEncoder(sink);
    await encoder.start({ width: 2, height: 2 });
    await encoder.writeRows({
      y: 0,
      width: 2,
      height: 2,
      rgba: new Uint8ClampedArray([
        255, 0, 0, 255, 0, 255, 0, 255,
        0, 0, 255, 255, 255, 255, 255, 255,
      ]),
    });
    await encoder.finish();

    const png = join(output);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const idat: Uint8Array[] = [];
    let offset = 8;
    const types: string[] = [];
    while (offset < png.length) {
      const view = new DataView(png.buffer, png.byteOffset + offset);
      const length = view.getUint32(0);
      const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
      types.push(type);
      if (type === "IDAT") idat.push(png.slice(offset + 8, offset + 8 + length));
      offset += 12 + length;
    }
    expect(types[0]).toBe("IHDR");
    expect(types[types.length - 1]).toBe("IEND");

    const inflated = new Uint8Array(await new Response(
      new Blob([join(idat).slice().buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream("deflate")),
    ).arrayBuffer());
    expect(inflated.length).toBe(18);
    expect(inflated[0]).toBe(0);
    expect(inflated[9]).toBe(0);
    expect(pngChunk("IEND").length).toBe(12);
  });
});
