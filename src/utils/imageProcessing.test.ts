import { describe, expect, it } from "vitest";
import { extensionFor, formatBytes, outputName } from "./imageProcessing";

describe("image processing helpers", () => {
  it("builds deterministic output names", () => {
    expect(outputName("photo.final.png", "resized", "image/webp")).toBe("photo.final-resized.webp");
  });

  it("maps supported formats to extensions", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
  });

  it("formats file sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });
});
