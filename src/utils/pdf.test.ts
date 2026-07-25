import { describe, expect, it } from "vitest";
import { parsePageRange } from "./pageRange";
import { calculateCompositeLayout } from "./pdfLayout";

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

describe("calculateCompositeLayout", () => {
  const sizes = [{ width: 100, height: 200 }, { width: 120, height: 180 }, { width: 90, height: 210 }];

  it("stacks pages vertically using the widest page", () => {
    expect(calculateCompositeLayout(sizes, "long")).toMatchObject({ width: 120, height: 590, columns: 1, rows: 3 });
  });

  it("lays pages out in the requested grid", () => {
    expect(calculateCompositeLayout(sizes, "grid", 2)).toMatchObject({ width: 240, height: 420, columns: 2, rows: 2 });
  });
});
