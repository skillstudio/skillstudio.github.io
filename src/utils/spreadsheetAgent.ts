import * as XLSX from "xlsx";
import type {
  FieldMapping, NormalizedProduct, PricingConfig, ProductField, ProductIssue,
} from "../types/spreadsheet";

export const productFieldLabels: Record<ProductField, { zh: string; en: string }> = {
  supplier: { zh: "供应商", en: "Supplier" },
  sku: { zh: "SKU", en: "SKU" },
  title: { zh: "商品标题", en: "Title" },
  description: { zh: "商品描述", en: "Description" },
  category: { zh: "类目", en: "Category" },
  brand: { zh: "品牌", en: "Brand" },
  cost: { zh: "成本", en: "Cost" },
  costCurrency: { zh: "成本币种", en: "Cost currency" },
  salePrice: { zh: "销售价格", en: "Sale price" },
  saleCurrency: { zh: "销售币种", en: "Sale currency" },
  weight: { zh: "重量 (kg)", en: "Weight (kg)" },
  shipping: { zh: "物流费", en: "Shipping" },
  stock: { zh: "库存", en: "Stock" },
  barcode: { zh: "条码", en: "Barcode" },
  mainImage: { zh: "主图 URL", en: "Main image URL" },
  additionalImages: { zh: "附图 URL", en: "Additional image URLs" },
  variants: { zh: "变体", en: "Variants" },
};

export const productFields = Object.keys(productFieldLabels) as ProductField[];

const aliases: Record<ProductField, string[]> = {
  supplier: ["supplier", "vendor", "供应商", "供货商", "厂家"],
  sku: ["sku", "seller sku", "货号", "商品编码", "产品编码", "供应商sku", "商品id", "商品 id", "offer id", "1688商品id"],
  title: ["title", "name", "product name", "商品名称", "商品标题", "产品名称", "标题"],
  description: ["description", "detail", "商品描述", "产品描述", "详情", "描述"],
  category: ["category", "类目", "分类", "产品分类", "所属分组", "商品分组", "分组"],
  brand: ["brand", "品牌"],
  cost: ["cost", "purchase price", "unit cost", "采购价", "采购价格", "成本", "进货价", "供货价", "商品价格", "1688价格", "拿货价"],
  costCurrency: ["cost currency", "currency", "成本币种", "采购币种", "币种"],
  salePrice: ["sale price", "selling price", "price", "售价", "销售价"],
  saleCurrency: ["sale currency", "销售币种"],
  weight: ["weight", "gross weight", "重量", "毛重", "重量kg"],
  shipping: ["shipping", "freight", "物流费", "运费"],
  stock: ["stock", "inventory", "quantity", "库存", "库存量", "数量"],
  barcode: ["barcode", "ean", "upc", "gtin", "条码"],
  mainImage: ["main image", "image", "image url", "主图", "主图链接", "图片地址", "图片链接"],
  additionalImages: ["additional images", "gallery", "附图", "附图链接", "更多图片"],
  variants: ["variants", "variation", "options", "变体", "规格", "属性"],
};

function cleanHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_\-()/（）\s]+/g, " ");
}

function guessField(header: string, values: unknown[]): FieldMapping {
  const normalized = cleanHeader(header);
  for (const field of productFields) {
    const exact = aliases[field].some((alias) => cleanHeader(alias) === normalized);
    if (exact) return { source: header, target: field, confidence: 0.98, reason: "alias" };
  }
  for (const field of productFields) {
    const partial = aliases[field].some((alias) => normalized.includes(cleanHeader(alias)));
    if (partial) return { source: header, target: field, confidence: 0.84, reason: "alias" };
  }
  const sample = values.filter((value) => value !== undefined && value !== "").slice(0, 12).map(String);
  if (sample.length && sample.filter((value) => /^https:\/\//i.test(value)).length / sample.length > 0.7) {
    return { source: header, target: "mainImage", confidence: 0.72, reason: "content" };
  }
  return { source: header, target: "ignore", confidence: 0.2, reason: "content" };
}

export type ParsedSheet = {
  workbook: XLSX.WorkBook;
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
  mappings: FieldMapping[];
};

export async function parseSpreadsheet(file: File, requestedSheet?: string): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const workbook = file.name.toLowerCase().endsWith(".csv")
    ? XLSX.read(new TextDecoder("utf-8").decode(buffer), { type: "string", cellDates: false })
    : XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = requestedSheet && workbook.Sheets[requestedSheet] ? requestedSheet : workbook.SheetNames[0];
  if (!sheetName) throw new Error("This workbook has no worksheets.");
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const headers = (matrix[0] ?? []).map((value, index) => String(value || `Column ${index + 1}`).trim());
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const mappings = headers.map((header) => guessField(header, rows.map((row) => row[header])));
  return { workbook, sheetName, headers, rows, mappings };
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function number(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function createLocalId(index: number) {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const random = new Uint32Array(2);
  crypto.getRandomValues(random);
  return `product-${Date.now().toString(36)}-${index.toString(36)}-${random[0].toString(36)}${random[1].toString(36)}`;
}

export function normalizeProducts(rows: Record<string, unknown>[], mappings: FieldMapping[]): NormalizedProduct[] {
  return rows.filter((row) => Object.values(row).some((value) => text(value))).map((row, index) => {
    const values: Partial<Record<ProductField, unknown>> = {};
    const extensions: Record<string, unknown> = {};
    for (const mapping of mappings) {
      if (mapping.target === "ignore") extensions[mapping.source] = row[mapping.source];
      else values[mapping.target] = row[mapping.source];
    }
    return {
      id: createLocalId(index), sourceRow: index + 2,
      supplier: text(values.supplier), sku: text(values.sku), title: text(values.title),
      description: text(values.description), category: text(values.category), brand: text(values.brand),
      cost: number(values.cost), costCurrency: text(values.costCurrency) || "CNY",
      salePrice: number(values.salePrice), saleCurrency: text(values.saleCurrency) || "USD",
      weight: number(values.weight), shipping: number(values.shipping), stock: Math.max(0, Math.round(number(values.stock))),
      barcode: text(values.barcode), mainImage: text(values.mainImage),
      additionalImages: text(values.additionalImages), variants: text(values.variants), extensions,
    };
  });
}

export function calculatePrice(product: NormalizedProduct, config: PricingConfig): number {
  const denominator = 1 - config.platformRate / 100 - config.targetMargin / 100;
  if (denominator <= 0 || config.exchangeRate <= 0) return Number.NaN;
  const base = (product.cost * config.exchangeRate + (product.shipping || config.shipping) + config.fixedFee) / denominator;
  if (config.rounding === "integer") return Math.ceil(base);
  if (config.rounding === "99") return Math.floor(base) + 0.99 < base ? Math.floor(base) + 1.99 : Math.floor(base) + 0.99;
  return Math.round(base * 100) / 100;
}

export function applyPricing(product: NormalizedProduct, config: PricingConfig): NormalizedProduct {
  return { ...product, salePrice: calculatePrice(product, config), saleCurrency: config.saleCurrency };
}

export function validateProduct(product: NormalizedProduct): ProductIssue[] {
  const issues: ProductIssue[] = [];
  if (!product.sku) issues.push({ field: "sku", severity: "error", message: "SKU is required" });
  if (!product.title) issues.push({ field: "title", severity: "error", message: "Title is required" });
  if (!(product.cost > 0)) issues.push({ field: "cost", severity: "error", message: "Cost must be greater than zero" });
  if (!Number.isFinite(product.salePrice) || product.salePrice <= 0) issues.push({ field: "salePrice", severity: "error", message: "Sale price is invalid" });
  if (product.stock < 0) issues.push({ field: "stock", severity: "error", message: "Stock cannot be negative" });
  if (product.mainImage && !isSafeImageUrl(product.mainImage)) issues.push({ field: "mainImage", severity: "warning", message: "Image must use a valid HTTPS URL" });
  return issues;
}

export function isSafeImageUrl(value: string): boolean {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

const exportHeaders: Array<[ProductField, string]> = [
  ["sku", "SKU"], ["title", "Product Title"], ["description", "Description"], ["category", "Category"],
  ["brand", "Brand"], ["salePrice", "Price"], ["saleCurrency", "Currency"], ["stock", "Stock"],
  ["weight", "Weight (kg)"], ["barcode", "Barcode"], ["mainImage", "Main Image URL"],
  ["additionalImages", "Additional Image URLs"], ["variants", "Variants"],
];

export function createAliExpressWorkbook(products: NormalizedProduct[], template?: ArrayBuffer): XLSX.WorkBook {
  if (template) {
    const workbook = XLSX.read(template, { type: "array" });
    const name = workbook.SheetNames[0];
    const sheet = workbook.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    const headers = (matrix[0] ?? []).map(String);
    const rows = products.map((product) => headers.map((header) => {
      const mapping = guessField(header, []);
      return mapping.target === "ignore" ? "" : product[mapping.target];
    }));
    XLSX.utils.sheet_add_aoa(sheet, rows, { origin: 1 });
    return workbook;
  }
  const data = products.map((product) => Object.fromEntries(exportHeaders.map(([field, label]) => [label, product[field]])));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), "Products");
  const issues = products.flatMap((product) => validateProduct(product).map((issue) => ({
    "Source row": product.sourceRow, Field: productFieldLabels[issue.field].en,
    Severity: issue.severity, Message: issue.message,
  })));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(issues.length ? issues : [{ Status: "No validation issues" }]), "Validation");
  return workbook;
}

export function workbookBlob(workbook: XLSX.WorkBook): Blob {
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
