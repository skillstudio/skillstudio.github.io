import type { ProductField, WorkspaceFieldDefinition, WorkspaceTemplate } from "../types/spreadsheet";

const labels: Record<ProductField, string> = {
  supplier: "Supplier", sku: "SKU", title: "Product Title", description: "Description",
  category: "Category", brand: "Brand", cost: "Cost", costCurrency: "Cost Currency",
  salePrice: "Price", saleCurrency: "Currency", weight: "Weight (kg)", shipping: "Shipping",
  stock: "Stock", barcode: "Barcode", mainImage: "Main Image URL",
  additionalImages: "Additional Image URLs", variants: "Variants",
};

const numericRoles = new Set<ProductField>(["cost", "salePrice", "weight", "shipping", "stock"]);

function field(role: ProductField, required = false, label = labels[role]): WorkspaceFieldDefinition {
  return {
    id: role, label, role, required, exportable: true, visible: true, options: [], source: "template",
    type: role === "mainImage" ? "image-url" : numericRoles.has(role) ? "number" : "text",
  };
}

function calculationField(role: "cost" | "costCurrency" | "shipping") {
  return { ...field(role), exportable: false, visible: false };
}

const common = [
  field("sku", true), field("title", true), field("description"), field("category"),
  field("brand"), field("cost", true), field("costCurrency"), field("salePrice", true),
  field("saleCurrency"), field("stock", true), field("weight"), field("shipping"),
  field("barcode"), field("mainImage"), field("additionalImages"), field("variants"),
];

function template(
  id: WorkspaceTemplate["id"],
  marketplace: WorkspaceTemplate["marketplace"],
  zh: string,
  en: string,
  fields = common,
): WorkspaceTemplate {
  return { id, marketplace, name: { zh, en }, fields: fields.map((item) => ({ ...item, options: [...item.options] })) };
}

export const workspaceTemplates: WorkspaceTemplate[] = [
  template("aliexpress", "aliexpress", "AliExpress 商品", "AliExpress products", [
    field("sku", true, "Seller SKU"), field("title", true, "Product Title"), field("description"),
    field("category", true), field("brand"), field("salePrice", true, "Retail Price"),
    field("saleCurrency", true), field("stock", true, "Quantity"), field("weight"),
    field("mainImage", true), field("additionalImages"), field("variants"),
    calculationField("cost"), calculationField("costCurrency"), calculationField("shipping"),
  ]),
  template("amazon", "amazon", "Amazon 商品", "Amazon products", [
    field("sku", true, "seller-sku"), field("title", true, "item-name"), field("description", false, "product-description"),
    field("brand", true, "brand-name"), field("salePrice", true, "standard-price"),
    field("stock", true, "quantity"), field("barcode", false, "external-product-id"),
    field("mainImage", true, "main-image-url"), field("additionalImages", false, "other-image-url"),
    calculationField("cost"), calculationField("costCurrency"), calculationField("shipping"),
  ]),
  template("temu", "temu", "Temu 商品", "Temu products", [
    field("sku", true, "Supplier SKU"), field("title", true, "Product Name"), field("description"),
    field("category", true), field("salePrice", true, "Supply Price"), field("stock", true),
    field("weight"), field("mainImage", true), field("additionalImages"), field("variants"),
    calculationField("cost"), calculationField("costCurrency"), calculationField("shipping"),
  ]),
  template("shopee", "shopee", "Shopee 商品", "Shopee products", [
    field("sku", true, "Parent SKU"), field("title", true, "Product Name"), field("description"),
    field("category", true, "Category ID"), field("brand"), field("salePrice", true, "Price"),
    field("stock", true), field("weight"), field("mainImage", true, "Cover Image"),
    field("additionalImages", false, "Product Images"), field("variants"),
    calculationField("cost"), calculationField("costCurrency"), calculationField("shipping"),
  ]),
];

export function cloneTemplate(template: WorkspaceTemplate): WorkspaceTemplate {
  return { ...template, fields: template.fields.map((field) => ({ ...field, options: [...field.options] })) };
}
