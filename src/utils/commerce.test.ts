import { describe, expect, it } from "vitest";
import { commercePresets, defaultCommercePresetIds } from "../data/commercePresets";
import { chooseProductBox, effectiveOutputQuality, logoPlacement, logoStatusFor, qualityWarnings, safeName, suggestedGroupName } from "./commerce";

describe("commerce studio utilities", () => {
  it("sanitizes names for cross-platform ZIP paths", () => {
    expect(safeName(' Summer / SKU:01? ')).toBe("Summer-SKU-01");
    expect(safeName("")).toBe("untitled");
  });

  it("suggests an SKU group from the filename prefix", () => {
    expect(suggestedGroupName("SHOE-001-front.jpg")).toBe("SHOE");
    expect(suggestedGroupName("bag_side.webp")).toBe("bag");
  });

  it("reports resolution, focus and exposure independently", () => {
    expect(qualityWarnings(640, 900, 30, 5)).toEqual([
      "low-resolution", "soft-focus", "underexposed",
    ]);
    expect(qualityWarnings(1800, 1800, 120, 30)).toEqual([]);
  });

  it("ships a practical, device-conscious universal default pack", () => {
    const defaults = commercePresets.filter((preset) => defaultCommercePresetIds.includes(preset.id));
    expect(defaults.map((preset) => preset.id)).toEqual([
      "universal-cutout",
      "universal-main",
      "universal-detail",
      "universal-thumbnail",
    ]);
    expect(defaults.every((preset) => preset.marketplace === "universal")).toBe(true);
    expect(commercePresets.every((preset) => preset.width > 0 && preset.height > 0)).toBe(true);
  });

  it("applies project compression to JPEG and keeps PNG lossless", () => {
    const compression = { enabled: true, profile: "light" as const, quality: 70 };
    expect(effectiveOutputQuality("image/jpeg", 94, compression)).toBe(70);
    expect(effectiveOutputQuality("image/webp", 92, compression)).toBe(70);
    expect(effectiveOutputQuality("image/png", 80, compression)).toBe(100);
    expect(effectiveOutputQuality("image/jpeg", 94, { ...compression, enabled: false })).toBe(94);
  });

  it("excludes logos from transparent and compliance outputs", () => {
    const main = commercePresets.find((preset) => preset.id === "amazon-main")!;
    const brand = commercePresets.find((preset) => preset.id === "universal-brand")!;
    const cutout = commercePresets.find((preset) => preset.id === "universal-cutout")!;
    expect(logoStatusFor(main, true, true)).toBe("excluded");
    expect(logoStatusFor(cutout, true, true)).toBe("excluded");
    expect(logoStatusFor(brand, true, true)).toBe("applied");
    expect(logoStatusFor(brand, false, true)).toBe("disabled");
  });

  it("positions a proportional logo in each corner", () => {
    const settings = { enabled: true, position: "bottom-right" as const, opacity: 80, scale: 10, margin: 5 };
    expect(logoPlacement(1000, 800, 400, 200, settings)).toEqual({
      x: 860, y: 710, width: 100, height: 50,
    });
    expect(logoPlacement(1000, 800, 400, 200, { ...settings, position: "top-left" })).toEqual({
      x: 40, y: 40, width: 100, height: 50,
    });
  });

  it("prefers a confident centered product detection over edge clutter", () => {
    expect(chooseProductBox([
      { score: 0.7, label: "bag", box: { xmin: 0, ymin: 300, xmax: 180, ymax: 1000 } },
      { score: 0.82, label: "product package", box: { xmin: 260, ymin: 180, xmax: 760, ymax: 920 } },
    ], 1000, 1200)).toEqual({ xmin: 260, ymin: 180, xmax: 760, ymax: 920 });
    expect(chooseProductBox([], 1000, 1200)).toBeNull();
  });
});
