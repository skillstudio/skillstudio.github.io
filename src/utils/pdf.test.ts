import { describe, expect, it } from "vitest";
import { parsePageRange } from "./pageRange";

describe("parsePageRange", () => {
  it("returns every page for an empty range", () => {
    expect(parsePageRange("", 4)).toEqual([1, 2, 3, 4]);
  });

  it("expands, sorts, and deduplicates page ranges", () => {
    expect(parsePageRange("3,1-2,2", 5)).toEqual([1, 2, 3]);
  });

  it("rejects pages outside the document", () => {
    expect(() => parsePageRange("1-6", 5)).toThrow("Invalid page range");
  });
});
