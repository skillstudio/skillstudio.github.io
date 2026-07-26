import * as XLSX from "xlsx";
import type {
  EditableProduct, FieldValue, PricingConfig, PricingResult, SourceSheetSnapshot, SourceToWorkspaceMapping,
  StandardFieldRole, WorkspaceFieldDefinition, WorkspaceIssue, WorkspaceTemplate,
} from "../types/spreadsheet";

const roleAliases: Record<Exclude<StandardFieldRole, "none">, string[]> = {
  supplier: ["supplier", "vendor", "供应商", "供货商"],
  sku: ["sku", "seller sku", "货号", "商品编码", "产品编码", "供应商sku", "商品id", "商品 id", "offer id", "1688商品id"],
  title: ["title", "name", "product title", "product name", "商品名称", "商品标题", "产品名称", "标题"],
  description: ["description", "detail", "商品描述", "详情", "描述"],
  category: ["category", "category id", "类目", "分类", "产品分类", "所属分组", "商品分组", "分组"],
  brand: ["brand", "品牌"],
  cost: ["cost", "purchase price", "unit cost", "采购价", "采购价格", "成本", "进货价", "供货价", "商品价格", "1688价格", "拿货价"],
  costCurrency: ["cost currency", "成本币种", "采购币种"],
  salePrice: ["sale price", "retail price", "standard price", "price", "售价", "销售价", "价格"],
  saleCurrency: ["currency", "sale currency", "币种", "销售币种"],
  weight: ["weight", "gross weight", "重量", "毛重"],
  shipping: ["shipping", "freight", "物流费", "运费"],
  stock: ["stock", "inventory", "quantity", "库存", "库存量", "数量"],
  barcode: ["barcode", "ean", "upc", "gtin", "条码"],
  mainImage: ["main image", "cover image", "image url", "主图", "主图链接", "图片地址", "图片链接"],
  additionalImages: ["additional images", "product images", "gallery", "附图", "更多图片"],
  variants: ["variants", "variation", "options", "变体", "规格", "属性"],
};

function clean(value: string) {
  return value.trim().toLowerCase().replace(/[_\-()/（）\s]+/g, " ");
}

function newId(prefix: string) {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return `${prefix}-${Date.now().toString(36)}-${values[0].toString(36)}${values[1].toString(36)}`;
}

function roleForHeader(header: string): { role: StandardFieldRole; confidence: number } {
  const normalized = clean(header);
  for (const [role, aliases] of Object.entries(roleAliases) as Array<[Exclude<StandardFieldRole, "none">, string[]]>) {
    if (aliases.some((alias) => clean(alias) === normalized)) return { role, confidence: 0.98 };
  }
  for (const [role, aliases] of Object.entries(roleAliases) as Array<[Exclude<StandardFieldRole, "none">, string[]]>) {
    if (aliases.some((alias) => normalized.includes(clean(alias)) || clean(alias).includes(normalized))) return { role, confidence: 0.78 };
  }
  return { role: "none", confidence: 0.2 };
}

export function suggestMappings(snapshot: SourceSheetSnapshot, template: WorkspaceTemplate): SourceToWorkspaceMapping[] {
  const used = new Set<string>();
  return template.fields.map((field) => {
    const candidates = snapshot.headers.map((header) => {
      const guess = roleForHeader(header);
      const labelMatch = clean(header) === clean(field.label);
      const score = labelMatch ? 1 : field.role !== "none" && guess.role === field.role ? guess.confidence : 0;
      return { header, score };
    }).filter((candidate) => !used.has(candidate.header)).sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (best && best.score >= 0.7) used.add(best.header);
    return { fieldId: field.id, sourceHeader: best && best.score >= 0.7 ? best.header : "", confidence: best?.score ?? 0 };
  });
}

function convertValue(value: unknown, field: WorkspaceFieldDefinition): FieldValue {
  if (field.type === "number") {
    if (value === null || value === undefined || String(value).trim() === "") return "";
    const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : "";
  }
  if (field.type === "boolean") return ["true", "1", "yes", "是"].includes(String(value ?? "").trim().toLowerCase());
  return value === null || value === undefined ? "" : String(value);
}

export function createWorkspaceProducts(
  snapshot: SourceSheetSnapshot,
  fields: WorkspaceFieldDefinition[],
  mappings: SourceToWorkspaceMapping[],
): EditableProduct[] {
  return snapshot.rows.filter((row) => Object.values(row).some((value) => String(value ?? "").trim())).map((row, index) => ({
    id: newId("product"),
    sourceRow: index + 2,
    values: Object.fromEntries(fields.map((field) => {
      const mapping = mappings.find((item) => item.fieldId === field.id);
      return [field.id, convertValue(mapping?.sourceHeader ? row[mapping.sourceHeader] : "", field)];
    })),
  }));
}

export function blankWorkspaceProduct(fields: WorkspaceFieldDefinition[]): EditableProduct {
  return {
    id: newId("product"),
    values: Object.fromEntries(fields.map((field) => [field.id, field.type === "boolean" ? false : ""])),
  };
}

export function fieldByRole(fields: WorkspaceFieldDefinition[], role: StandardFieldRole) {
  return fields.find((field) => field.role === role);
}

function numeric(product: EditableProduct, field?: WorkspaceFieldDefinition) {
  const value = field ? Number(product.values[field.id]) : 0;
  return Number.isFinite(value) ? value : 0;
}

export function priceWorkspaceProduct(
  product: EditableProduct,
  fields: WorkspaceFieldDefinition[],
  config: PricingConfig,
): PricingResult {
  const costField = fieldByRole(fields, "cost");
  const shippingField = fieldByRole(fields, "shipping");
  const priceField = fieldByRole(fields, "salePrice");
  const currencyField = fieldByRole(fields, "saleCurrency");
  if (!costField || !priceField) return { success: false, product, reason: "missing-role" };
  const cost = numeric(product, costField);
  if (cost <= 0) return { success: false, product, reason: "missing-cost" };
  const shippingValue = shippingField ? product.values[shippingField.id] : "";
  const productShipping = shippingValue === "" || shippingValue === undefined || shippingValue === null
    ? config.shipping
    : numeric(product, shippingField);
  const denominator = 1 - config.platformRate / 100 - config.targetMargin / 100;
  if (
    denominator <= 0 || config.exchangeRate <= 0 || config.shipping < 0 ||
    config.fixedFee < 0 || config.platformRate < 0 || config.targetMargin < 0
  ) return { success: false, product, reason: "invalid-config" };
  const baseCost = cost * config.exchangeRate + productShipping + config.fixedFee;
  const raw = baseCost / denominator;
  const price = config.rounding === "integer" ? Math.ceil(raw)
    : config.rounding === "99" ? (Math.floor(raw) + 0.99 < raw ? Math.floor(raw) + 1.99 : Math.floor(raw) + 0.99)
      : Math.round(raw * 100) / 100;
  if (!Number.isFinite(price) || price <= 0) return { success: false, product, reason: "non-finite-price" };
  const next = { ...product, values: { ...product.values, [priceField.id]: price, ...(currencyField ? { [currencyField.id]: config.saleCurrency } : {}) } };
  const profit = price * (1 - config.platformRate / 100) - baseCost;
  return { success: true, product: next, price, profit, margin: profit / price * 100 };
}

export function validateWorkspaceProduct(product: EditableProduct, fields: WorkspaceFieldDefinition[]): WorkspaceIssue[] {
  const issues: WorkspaceIssue[] = [];
  for (const field of fields) {
    const value = product.values[field.id];
    if (field.required && (value === "" || value === undefined || value === null)) {
      issues.push({ fieldId: field.id, severity: "error", message: `${field.label} is required` });
    }
    if (field.type === "number" && value !== "" && !Number.isFinite(Number(value))) {
      issues.push({ fieldId: field.id, severity: "error", message: `${field.label} must be a number` });
    }
    if ((field.role === "cost" || field.role === "salePrice") && Number(value) <= 0) {
      issues.push({ fieldId: field.id, severity: "error", message: `${field.label} must be greater than zero` });
    }
    if (field.role === "stock" && Number(value) < 0) {
      issues.push({ fieldId: field.id, severity: "error", message: `${field.label} cannot be negative` });
    }
    if (field.type === "image-url" && value && !isSafeWorkspaceImage(String(value))) {
      issues.push({ fieldId: field.id, severity: "warning", message: `${field.label} must use HTTPS` });
    }
  }
  return issues;
}

export function isSafeWorkspaceImage(value: string) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function exportedFields(fields: WorkspaceFieldDefinition[]) {
  return fields.filter((field) => field.exportable !== false);
}

function exportRows(products: EditableProduct[], fields: WorkspaceFieldDefinition[]) {
  return products.map((product) => Object.fromEntries(exportedFields(fields).map((field) => {
    const value = product.values[field.id];
    return [field.label, Array.isArray(value) ? value.join(";") : value ?? ""];
  })));
}

export function exportWorkspaceXlsx(
  products: EditableProduct[],
  fields: WorkspaceFieldDefinition[],
  customTemplate?: ArrayBuffer,
  targetSheet?: string,
): Blob {
  const rows = exportRows(products, fields);
  const workbook = customTemplate ? XLSX.read(customTemplate, { type: "array", cellStyles: true }) : XLSX.utils.book_new();
  if (customTemplate) {
    const name = targetSheet && workbook.Sheets[targetSheet] ? targetSheet : workbook.SheetNames[0];
    const sheet = workbook.Sheets[name];
    const headers = exportedFields(fields).map((field) => field.label);
    XLSX.utils.sheet_add_aoa(sheet, [headers, ...rows.map((row) => headers.map((header) => row[header]))], { origin: "A1" });
  } else {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows, { header: exportedFields(fields).map((field) => field.label) }), "Products");
  }
  return new Blob([XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function exportWorkspaceCsv(products: EditableProduct[], fields: WorkspaceFieldDefinition[]): Blob {
  const sheet = XLSX.utils.json_to_sheet(exportRows(products, fields), { header: exportedFields(fields).map((field) => field.label) });
  return new Blob([`\uFEFF${XLSX.utils.sheet_to_csv(sheet)}`], { type: "text/csv;charset=utf-8" });
}

export async function templateFromWorkbook(file: File, sheetName?: string): Promise<{ template: WorkspaceTemplate; buffer: ArrayBuffer; sheetNames: string[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellStyles: true });
  const selected = sheetName && workbook.Sheets[sheetName] ? sheetName : workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[selected], { header: 1, defval: "" });
  const headers = (rows[0] ?? []).map((value, index) => String(value || `Column ${index + 1}`));
  const template: WorkspaceTemplate = {
    id: `custom-${file.name}`, marketplace: "custom", name: { zh: file.name, en: file.name },
    fields: headers.map((label, index) => {
      const guessed = roleForHeader(label);
      const numericRoles = ["cost", "salePrice", "stock", "weight", "shipping"];
      return {
        id: `custom-field-${index}`, label, role: guessed.role, required: false, exportable: true, visible: true, options: [], source: "template",
        type: guessed.role === "mainImage" ? "image-url" : numericRoles.includes(guessed.role) ? "number" : "text",
      };
    }),
  };
  return { template, buffer, sheetNames: workbook.SheetNames };
}
