export type ProductField =
  | "supplier" | "sku" | "title" | "description" | "category" | "brand"
  | "cost" | "costCurrency" | "salePrice" | "saleCurrency" | "weight"
  | "shipping" | "stock" | "barcode" | "mainImage" | "additionalImages"
  | "variants";

export type FieldMapping = {
  source: string;
  target: ProductField | "ignore";
  confidence: number;
  reason: "alias" | "content" | "manual";
};

export type NormalizedProduct = {
  id: string;
  sourceRow: number;
  supplier: string;
  sku: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  cost: number;
  costCurrency: string;
  salePrice: number;
  saleCurrency: string;
  weight: number;
  shipping: number;
  stock: number;
  barcode: string;
  mainImage: string;
  additionalImages: string;
  variants: string;
  extensions: Record<string, unknown>;
};

export type PricingConfig = {
  exchangeRate: number;
  costCurrency: string;
  shipping: number;
  platformRate: number;
  fixedFee: number;
  targetMargin: number;
  saleCurrency: string;
  rounding: "none" | "99" | "integer";
};

export type ProductIssue = {
  field: ProductField;
  severity: "error" | "warning";
  message: string;
};

export type WorkspaceFieldType = "text" | "number" | "image-url" | "boolean" | "date" | "single-select" | "multi-select";
export type StandardFieldRole = ProductField | "none";
export type FieldValue = string | number | boolean;

export type SourceSheetSnapshot = {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
};

export type WorkspaceFieldDefinition = {
  id: string;
  label: string;
  type: WorkspaceFieldType;
  role: StandardFieldRole;
  required: boolean;
  exportable: boolean;
  visible: boolean;
  options: string[];
  source: "template" | "custom";
};

export type WorkspaceTemplate = {
  id: string;
  name: { zh: string; en: string };
  marketplace: "generic" | "aliexpress" | "amazon" | "temu" | "shopee" | "custom";
  fields: WorkspaceFieldDefinition[];
};

export type SourceToWorkspaceMapping = {
  fieldId: string;
  sourceHeader: string | "";
  confidence: number;
};

export type EditableProduct = {
  id: string;
  sourceRow?: number;
  values: Record<string, FieldValue>;
};

export type PricingFailureReason =
  | "missing-cost"
  | "missing-role"
  | "invalid-config"
  | "non-finite-price";

export type PricingResult =
  | { success: true; product: EditableProduct; price: number; profit: number; margin: number }
  | { success: false; product: EditableProduct; reason: PricingFailureReason };

export type InspectorContext =
  | { type: "workspace" }
  | { type: "product"; productId: string }
  | { type: "products"; productIds: string[] }
  | { type: "field"; fieldId: string }
  | { type: "mapping"; fieldId: string }
  | { type: "template-migration"; templateId: string };

export type WorkspaceIssue = {
  fieldId: string;
  severity: "error" | "warning";
  message: string;
};
