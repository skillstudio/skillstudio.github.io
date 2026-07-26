import { describe, expect, it } from "vitest";
import { cloneTemplate, workspaceTemplates } from "../data/spreadsheetTemplates";
import { formatFinancialAmount, workspaceFinancialSummary } from "../pages/SpreadsheetAgentPage";
import {
  createWorkspaceProducts, exportWorkspaceCsv, priceWorkspaceProduct, suggestMappings,
} from "./productWorkspace";
import type { PricingConfig, SourceSheetSnapshot } from "../types/spreadsheet";

const snapshot: SourceSheetSnapshot = {
  fileName: "supplier.csv", sheetName: "Sheet1",
  headers: ["货号", "商品名称", "采购价", "库存", "图片地址"],
  rows: [{ 货号: "A-1", 商品名称: "Lamp", 采购价: 20, 库存: 8, 图片地址: "https://example.com/a.jpg" }],
};

const selectionPoolSnapshot: SourceSheetSnapshot = {
  fileName: "selection-pool.csv", sheetName: "选品池导出",
  headers: ["序号", "商品标题", "商品ID", "商品链接", "图片地址", "商品价格", "加入时间", "平台", "店铺名称", "所属分组", "标签", "备注"],
  rows: [{
    序号: "1", 商品标题: "高级感无领西装套裙", 商品ID: "1016465348058",
    商品链接: "https://detail.1688.com/offer/1016465348058.html",
    图片地址: "https://cbu01.alicdn.com/img/ibank/example.jpg", 商品价格: "158",
    加入时间: "2026-07-25 23:50:01", 平台: "1688", 店铺名称: "福州靓点服饰有限公司",
    所属分组: "默认", 标签: "-", 备注: "-",
  }],
};

describe("product workspace", () => {
  it("suggests mappings and creates editable products without changing source", () => {
    const template = cloneTemplate(workspaceTemplates[0]);
    const mappings = suggestMappings(snapshot, template);
    const products = createWorkspaceProducts(snapshot, template.fields, mappings);
    expect(products[0].values.sku).toBe("A-1");
    products[0].values.title = "Changed";
    expect(snapshot.rows[0].商品名称).toBe("Lamp");
  });

  it("prices products by field role", () => {
    const template = cloneTemplate(workspaceTemplates[0]);
    const products = createWorkspaceProducts(snapshot, template.fields, suggestMappings(snapshot, template));
    const config: PricingConfig = { exchangeRate: 0.14, costCurrency: "CNY", shipping: 2, platformRate: 8, fixedFee: 0.3, targetMargin: 20, saleCurrency: "USD", rounding: "99" };
    const result = priceWorkspaceProduct(products[0], template.fields, config);
    expect(result.success && result.product.values.salePrice).toBe(7.99);
  });

  it("maps 1688 selection pool fields into AliExpress workspace fields", () => {
    const template = cloneTemplate(workspaceTemplates[0]);
    const mappings = suggestMappings(selectionPoolSnapshot, template);
    const products = createWorkspaceProducts(selectionPoolSnapshot, template.fields, mappings);
    const product = products[0];
    expect(mappings.find((item) => item.fieldId === "sku")?.sourceHeader).toBe("商品ID");
    expect(mappings.find((item) => item.fieldId === "category")?.sourceHeader).toBe("所属分组");
    expect(mappings.find((item) => item.fieldId === "cost")?.sourceHeader).toBe("商品价格");
    expect(mappings.find((item) => item.fieldId === "salePrice")?.sourceHeader).toBe("");
    expect(product.values.sku).toBe("1016465348058");
    expect(product.values.category).toBe("默认");
    expect(product.values.cost).toBe(158);
    expect(product.values.salePrice).toBe("");
  });

  it("keeps an explicit zero product shipping fee instead of using the global fallback", () => {
    const template = cloneTemplate(workspaceTemplates[0]);
    const products = createWorkspaceProducts(snapshot, template.fields, suggestMappings(snapshot, template));
    products[0].values.shipping = 0;
    const config: PricingConfig = { exchangeRate: 0.14, costCurrency: "CNY", shipping: 2, platformRate: 8, fixedFee: 0.3, targetMargin: 20, saleCurrency: "USD", rounding: "none" };
    const result = priceWorkspaceProduct(products[0], template.fields, config);
    expect(result.success && result.price).toBe(4.31);
  });

  it("exports UTF-8 BOM CSV", async () => {
    const template = cloneTemplate(workspaceTemplates[0]);
    const products = createWorkspaceProducts(snapshot, template.fields, suggestMappings(snapshot, template));
    expect([...new Uint8Array(await exportWorkspaceCsv(products, template.fields).arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("formats and summarizes financial values with explicit currency codes", () => {
    const template = cloneTemplate(workspaceTemplates[0]);
    const products = createWorkspaceProducts(snapshot, template.fields, suggestMappings(snapshot, template));
    products[0].values.salePrice = 7.99;
    products[0].values.saleCurrency = "USD";
    const config: PricingConfig = { exchangeRate: 0.14, costCurrency: "CNY", shipping: 2, platformRate: 8, fixedFee: 0.3, targetMargin: 20, saleCurrency: "USD", rounding: "99" };
    const summary = workspaceFinancialSummary(products, template.fields, config);
    expect(formatFinancialAmount(27964.23, "usd")).toBe("27,964.23 USD");
    expect(summary.units).toBe(8);
    expect(summary.pricedProducts).toBe(1);
    expect(summary.revenue).toBeCloseTo(63.92, 2);
  });
});
