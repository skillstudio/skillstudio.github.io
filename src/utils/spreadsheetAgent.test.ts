import { describe, expect, it } from "vitest";
import { applyPricing, calculatePrice, normalizeProducts, validateProduct } from "./spreadsheetAgent";
import type { FieldMapping, NormalizedProduct, PricingConfig } from "../types/spreadsheet";

const config: PricingConfig = {
  exchangeRate: 0.14, costCurrency: "CNY", shipping: 2, platformRate: 8, fixedFee: 0.3,
  targetMargin: 20, saleCurrency: "USD", rounding: "none",
};

describe("spreadsheet agent", () => {
  it("normalizes supplier rows without mutating them", () => {
    const row = { 货号: "A-1", 商品名称: "Lamp", 成本: 20 };
    const mappings: FieldMapping[] = [
      { source: "货号", target: "sku", confidence: 1, reason: "alias" },
      { source: "商品名称", target: "title", confidence: 1, reason: "alias" },
      { source: "成本", target: "cost", confidence: 1, reason: "alias" },
    ];
    const result = normalizeProducts([row], mappings)[0];
    expect(result).toMatchObject({ sku: "A-1", title: "Lamp", cost: 20 });
    expect(row).toEqual({ 货号: "A-1", 商品名称: "Lamp", 成本: 20 });
  });

  it("creates products when randomUUID is unavailable on a LAN origin", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { configurable: true, value: undefined });
    try {
      const result = normalizeProducts([{ SKU: "LAN-1", Title: "LAN product", Cost: 10 }], [
        { source: "SKU", target: "sku", confidence: 1, reason: "alias" },
        { source: "Title", target: "title", confidence: 1, reason: "alias" },
        { source: "Cost", target: "cost", confidence: 1, reason: "alias" },
      ]);
      expect(result[0].id).toMatch(/^product-/);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { configurable: true, value: original });
    }
  });

  it("calculates and rounds prices", () => {
    const product = { cost: 20, shipping: 0 } as NormalizedProduct;
    expect(calculatePrice(product, config)).toBeCloseTo(7.08, 2);
    expect(applyPricing(product, { ...config, rounding: "99" }).salePrice).toBe(7.99);
  });

  it("treats 1688 selection pool price as cost and product id as sku", () => {
    const rows = [{ 商品ID: "1016465348058", 商品标题: "高级感无领西装套裙", 商品价格: "158", 所属分组: "默认", 图片地址: "https://example.com/a.jpg" }];
    const mappings: FieldMapping[] = [
      { source: "商品ID", target: "sku", confidence: 0.98, reason: "alias" },
      { source: "商品标题", target: "title", confidence: 0.98, reason: "alias" },
      { source: "商品价格", target: "cost", confidence: 0.98, reason: "alias" },
      { source: "所属分组", target: "category", confidence: 0.98, reason: "alias" },
      { source: "图片地址", target: "mainImage", confidence: 0.98, reason: "alias" },
    ];
    const product = normalizeProducts(rows, mappings)[0];
    expect(product.sku).toBe("1016465348058");
    expect(product.cost).toBe(158);
    expect(product.salePrice).toBe(0);
    expect(product.category).toBe("默认");
    expect(validateProduct(product).some((issue) => issue.field === "category")).toBe(false);
  });

  it("reports missing required fields", () => {
    const product = { sku: "", title: "", cost: 0, salePrice: 0, stock: 0, mainImage: "" } as NormalizedProduct;
    expect(validateProduct(product).filter((issue) => issue.severity === "error")).toHaveLength(4);
  });
});
