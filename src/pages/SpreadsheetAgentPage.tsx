import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download,
  FileSpreadsheet, Image as ImageIcon, Info, Loader2, LockKeyhole, Plus, RotateCcw,
  Search, Settings2, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { cloneTemplate, workspaceTemplates } from "../data/spreadsheetTemplates";
import type {
  EditableProduct, FieldValue, InspectorContext, PricingConfig, PricingResult,
  SourceSheetSnapshot, SourceToWorkspaceMapping, StandardFieldRole,
  WorkspaceFieldDefinition, WorkspaceFieldType, WorkspaceTemplate,
} from "../types/spreadsheet";
import { downloadBlob } from "../utils/download";
import { parseSpreadsheet, productFieldLabels } from "../utils/spreadsheetAgent";
import {
  blankWorkspaceProduct, createWorkspaceProducts, exportWorkspaceCsv, exportWorkspaceXlsx,
  fieldByRole, isSafeWorkspaceImage, priceWorkspaceProduct, suggestMappings,
  templateFromWorkbook, validateWorkspaceProduct,
} from "../utils/productWorkspace";

type Filter = "all" | "valid" | "issues" | "modified";
type UndoState = { template: WorkspaceTemplate | null; fields: WorkspaceFieldDefinition[]; products: EditableProduct[] };
type PriceMode = "empty" | "all";
export type FinancialSummary = {
  units: number; pricedProducts: number; revenue: number; productCost: number;
  grossProfit: number; grossMargin: number; operatingFees: number; netProfit: number; netMargin: number;
};

const defaultPricing: PricingConfig = {
  exchangeRate: 0.14, costCurrency: "CNY", shipping: 2, platformRate: 8, fixedFee: 0.3,
  targetMargin: 20, saleCurrency: "USD", rounding: "99",
};
const pricingCurrencies = ["CNY", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "HKD", "SGD"];
const fieldTypes: WorkspaceFieldType[] = ["text", "number", "image-url", "boolean", "date", "single-select", "multi-select"];
const standardRoles: StandardFieldRole[] = [
  "none", "supplier", "sku", "title", "description", "category", "brand", "cost",
  "costCurrency", "salePrice", "saleCurrency", "weight", "shipping", "stock",
  "barcode", "mainImage", "additionalImages", "variants",
];
const enabledWorkspaceTemplates = workspaceTemplates.filter((item) => item.id === "aliexpress");

function cloneProducts(products: EditableProduct[]) {
  return products.map((product) => ({ ...product, values: { ...product.values } }));
}
function fieldValue(value: FieldValue | undefined) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "");
}
function safeLink(value: unknown) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}
function isSupportedSpreadsheetFile(file: File) {
  return /\.(csv|xlsx|xls)$/i.test(file.name);
}
export function formatFinancialAmount(value: number, currency: string) {
  const code = currency.trim().toUpperCase() || "USD";
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safe)} ${code}`;
  } catch {
    return `${safe.toFixed(2)} ${code}`;
  }
}
function pricingMessage(reason: Exclude<PricingResult, { success: true }>["reason"], zh: boolean) {
  const messages = {
    "missing-cost": zh ? "缺少有效成本" : "Missing valid cost",
    "missing-role": zh ? "缺少成本或售价字段角色" : "Missing cost or price field role",
    "invalid-config": zh ? "定价参数无效" : "Invalid pricing configuration",
    "non-finite-price": zh ? "无法得到有效售价" : "Could not produce a valid price",
  };
  return messages[reason];
}

export function workspaceFinancialSummary(products: EditableProduct[], fields: WorkspaceFieldDefinition[], config: PricingConfig): FinancialSummary {
  const costField = fieldByRole(fields, "cost");
  const priceField = fieldByRole(fields, "salePrice");
  const stockField = fieldByRole(fields, "stock");
  const shippingField = fieldByRole(fields, "shipping");
  let units = 0; let pricedProducts = 0; let revenue = 0; let productCost = 0; let operatingFees = 0;
  for (const product of products) {
    const price = priceField ? Number(product.values[priceField.id]) : 0;
    const cost = costField ? Number(product.values[costField.id]) : 0;
    const stockValue = stockField ? Number(product.values[stockField.id]) : 1;
    const stock = Number.isFinite(stockValue) ? Math.max(0, stockValue) : 0;
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(cost) || cost < 0 || stock <= 0) continue;
    const rawShipping = shippingField ? product.values[shippingField.id] : "";
    const shipping = rawShipping === "" || rawShipping === undefined || rawShipping === null
      ? config.shipping : Number(rawShipping);
    units += stock; pricedProducts += 1; revenue += price * stock;
    productCost += cost * config.exchangeRate * stock;
    operatingFees += ((Number.isFinite(shipping) ? shipping : 0) + config.fixedFee) * stock + price * stock * config.platformRate / 100;
  }
  const grossProfit = revenue - productCost;
  const netProfit = grossProfit - operatingFees;
  return {
    units, pricedProducts, revenue, productCost, grossProfit,
    grossMargin: revenue > 0 ? grossProfit / revenue * 100 : 0,
    operatingFees, netProfit, netMargin: revenue > 0 ? netProfit / revenue * 100 : 0,
  };
}

export function SpreadsheetAgentPage() {
  const { language } = useLanguage();
  const zh = language === "zh";
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const customTemplateRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [snapshot, setSnapshot] = useState<SourceSheetSnapshot | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourcePage, setSourcePage] = useState(1);
  const [highlightSourceRow, setHighlightSourceRow] = useState<number>();
  const [template, setTemplate] = useState<WorkspaceTemplate | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<WorkspaceTemplate | null>(null);
  const [mappingSnapshot, setMappingSnapshot] = useState<SourceSheetSnapshot | null>(null);
  const [mappings, setMappings] = useState<SourceToWorkspaceMapping[]>([]);
  const [customTemplateBuffer, setCustomTemplateBuffer] = useState<ArrayBuffer>();
  const [customTemplateSheet, setCustomTemplateSheet] = useState("");
  const [customTemplateFile, setCustomTemplateFile] = useState<File | null>(null);
  const [customTemplateSheets, setCustomTemplateSheets] = useState<string[]>([]);
  const [products, setProducts] = useState<EditableProduct[]>([]);
  const [fields, setFields] = useState<WorkspaceFieldDefinition[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspector, setInspector] = useState<InspectorContext>({ type: "workspace" });
  const [undoStack, setUndoStack] = useState<UndoState[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [pricing, setPricing] = useState<PricingConfig>(() => {
    try { return { ...defaultPricing, ...JSON.parse(localStorage.getItem("imgskills-spreadsheet-pricing") || "{}") }; }
    catch { return defaultPricing; }
  });
  const [priceNotice, setPriceNotice] = useState("");
  const [fxLoading, setFxLoading] = useState(false);
  const [fxMeta, setFxMeta] = useState<{ date?: string; updatedAt?: string; error?: string }>({});
  const [fxRefreshKey, setFxRefreshKey] = useState(0);
  const [imageConsent, setImageConsent] = useState(false);
  const [consentPrompt, setConsentPrompt] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [exportValidationNotice, setExportValidationNotice] = useState(false);
  const [dirty, setDirty] = useState(false);
  const pageSize = 12;
  const sourcePageSize = 10;

  useEffect(() => localStorage.setItem("imgskills-spreadsheet-pricing", JSON.stringify(pricing)), [pricing]);
  useEffect(() => {
    const controller = new AbortController();
    async function refreshRate() {
      const base = pricing.costCurrency.trim().toUpperCase();
      const quote = pricing.saleCurrency.trim().toUpperCase();
      if (!base || !quote) return;
      if (base === quote) {
        setPricing((value) => ({ ...value, exchangeRate: 1 }));
        setFxMeta({ date: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() });
        return;
      }
      setFxLoading(true); setFxMeta((value) => ({ ...value, error: undefined }));
      try {
        const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as { date?: string; rate?: number };
        if (!Number.isFinite(data.rate) || Number(data.rate) <= 0) throw new Error("Invalid rate");
        setPricing((value) => ({ ...value, exchangeRate: Number(data.rate) }));
        setFxMeta({ date: data.date, updatedAt: new Date().toISOString() });
      } catch (reason) {
        if (!controller.signal.aborted) setFxMeta((value) => ({ ...value, error: reason instanceof Error ? reason.message : "Unavailable" }));
      } finally {
        if (!controller.signal.aborted) setFxLoading(false);
      }
    }
    void refreshRate();
    return () => controller.abort();
  }, [pricing.costCurrency, pricing.saleCurrency, fxRefreshKey]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(() => {
    const clear = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !consentPrompt && !previewImage) {
        if (pendingTemplate) {
          setPendingTemplate(null); setMappingSnapshot(null);
          setMappings(snapshot && template ? suggestMappings(snapshot, template) : []);
        }
        setSelectedIds([]); setInspector({ type: "workspace" });
      }
    };
    window.addEventListener("keydown", clear);
    return () => window.removeEventListener("keydown", clear);
  }, [consentPrompt, previewImage, pendingTemplate, snapshot, template]);

  function rememberUndo() {
    setUndoStack((stack) => [...stack.slice(-19), {
      template: template ? cloneTemplate(template) : null,
      fields: fields.map((field) => ({ ...field, options: [...field.options] })),
      products: cloneProducts(products),
    }]);
  }
  function undo() {
    const state = undoStack[undoStack.length - 1];
    if (!state) return;
    setTemplate(state.template); setFields(state.fields); setProducts(state.products);
    setUndoStack((stack) => stack.slice(0, -1)); setSelectedIds([]);
    setInspector({ type: "workspace" }); setDirty(true);
  }

  async function importSource(file: File, requestedSheet?: string) {
    setBusy(true); setError(""); setExportValidationNotice(false);
    try {
      const parsed = await parseSpreadsheet(file, requestedSheet);
      const nextSnapshot = {
        fileName: file.name, sheetName: parsed.sheetName,
        headers: [...parsed.headers], rows: parsed.rows.map((row) => ({ ...row })),
      };
      const defaultTemplate = cloneTemplate(enabledWorkspaceTemplates[0] ?? workspaceTemplates[0]);
      const nextMappings = suggestMappings(nextSnapshot, defaultTemplate);
      setSourceFile(file); setSheetNames(parsed.workbook.SheetNames); setSnapshot(nextSnapshot);
      setTemplate(defaultTemplate); setFields(defaultTemplate.fields);
      setMappings(nextMappings); setProducts(createWorkspaceProducts(nextSnapshot, defaultTemplate.fields, nextMappings));
      setPendingTemplate(null); setMappingSnapshot(null); setSelectedIds([]);
      setInspector({ type: "workspace" }); setImageConsent(false);
      setSourcePage(1); setPage(1); setDirty(false); setUndoStack([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (zh ? "无法读取该表格。" : "Could not read this spreadsheet."));
    } finally { setBusy(false); }
  }

  function currentAsSnapshot(): SourceSheetSnapshot | null {
    if (!template || !products.length) return snapshot;
    return {
      fileName: snapshot?.fileName || "workspace", sheetName: template.name[language],
      headers: fields.map((field) => field.label),
      rows: products.map((product) => Object.fromEntries(fields.map((field) => [field.label, product.values[field.id] ?? ""]))),
    };
  }
  function chooseTemplate(next: WorkspaceTemplate) {
    const source = currentAsSnapshot();
    if (!source || next.id === template?.id) return;
    const copy = cloneTemplate(next);
    setPendingTemplate(copy); setMappingSnapshot(source);
    setMappings(suggestMappings(source, copy));
    setInspector({ type: "template-migration", templateId: copy.id });
  }
  function confirmMapping() {
    if (!pendingTemplate || !mappingSnapshot) return;
    rememberUndo();
    const nextProducts = createWorkspaceProducts(mappingSnapshot, pendingTemplate.fields, mappings);
    setTemplate(pendingTemplate); setFields(pendingTemplate.fields); setProducts(nextProducts);
    setPendingTemplate(null); setMappingSnapshot(null); setSelectedIds([]);
    setInspector({ type: "workspace" }); setDirty(true);
  }
  function cancelTemplate() {
    setPendingTemplate(null); setMappingSnapshot(null);
    setMappings(snapshot && template ? suggestMappings(snapshot, template) : []);
    setInspector({ type: "workspace" });
  }
  async function uploadCustomTemplate(file?: File) {
    if (!file) return;
    try {
      const result = await templateFromWorkbook(file);
      setCustomTemplateFile(file); setCustomTemplateSheets(result.sheetNames);
      setCustomTemplateBuffer(result.buffer); setCustomTemplateSheet(result.sheetNames[0] || "");
      chooseTemplate(result.template);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (zh ? "无法读取自定义模板。" : "Could not read the custom template."));
    }
  }
  async function changeCustomTemplateSheet(sheetName: string) {
    if (!customTemplateFile) return;
    const result = await templateFromWorkbook(customTemplateFile, sheetName);
    setCustomTemplateSheet(sheetName); setCustomTemplateBuffer(result.buffer); chooseTemplate(result.template);
  }

  function selectProduct(product: EditableProduct) {
    setSelectedIds([]); setPriceNotice(""); setInspector({ type: "product", productId: product.id });
    if (product.sourceRow) {
      setHighlightSourceRow(product.sourceRow);
      setSourcePage(Math.ceil((product.sourceRow - 1) / sourcePageSize));
    }
  }
  function toggleProduct(id: string, checked: boolean) {
    const next = checked ? [...new Set([...selectedIds, id])] : selectedIds.filter((item) => item !== id);
    setSelectedIds(next); setPriceNotice("");
    setInspector(next.length === 1 ? { type: "product", productId: next[0] } : next.length > 1 ? { type: "products", productIds: next } : { type: "workspace" });
  }
  function updateProduct(id: string, fieldId: string, value: FieldValue) {
    setProducts((items) => items.map((item) => item.id === id ? { ...item, values: { ...item.values, [fieldId]: value } } : item));
    const field = fields.find((item) => item.id === fieldId);
    if (field?.role === "costCurrency" && String(value).trim()) {
      setPricing((current) => ({ ...current, costCurrency: String(value).trim().toUpperCase() }));
    }
    if (field?.role === "saleCurrency" && String(value).trim()) {
      setPricing((current) => ({ ...current, saleCurrency: String(value).trim().toUpperCase() }));
    }
    setDirty(true);
  }
  function addProduct() {
    rememberUndo();
    const product = blankWorkspaceProduct(fields);
    setProducts((items) => [product, ...items]); setSelectedIds([]);
    setInspector({ type: "product", productId: product.id }); setDirty(true);
  }
  function duplicateProduct(product: EditableProduct) {
    rememberUndo();
    const next = { ...blankWorkspaceProduct(fields), values: { ...product.values }, sourceRow: undefined };
    setProducts((items) => [next, ...items]); setInspector({ type: "product", productId: next.id }); setDirty(true);
  }
  function deleteProducts(ids: string[]) {
    if (!ids.length) return;
    const first = products.findIndex((item) => ids.includes(item.id));
    rememberUndo();
    const remaining = products.filter((item) => !ids.includes(item.id));
    setProducts(remaining); setSelectedIds([]); setDirty(true);
    const next = remaining[Math.min(Math.max(first, 0), remaining.length - 1)];
    setInspector(next ? { type: "product", productId: next.id } : { type: "workspace" });
  }
  function addField() {
    rememberUndo();
    const id = `field-${Date.now().toString(36)}`;
    const field: WorkspaceFieldDefinition = {
      id, label: zh ? "新字段" : "New field", type: "text", role: "none",
      required: false, exportable: true, visible: true, options: [], source: "custom",
    };
    setFields((items) => [...items, field]);
    setProducts((items) => items.map((item) => ({ ...item, values: { ...item.values, [id]: "" } })));
    setInspector({ type: "field", fieldId: id }); setDirty(true);
  }
  function updateField(id: string, patch: Partial<WorkspaceFieldDefinition>) {
    setFields((items) => items.map((field) => {
      if (field.id !== id) return patch.role && patch.role !== "none" && field.role === patch.role ? { ...field, role: "none" } : field;
      return { ...field, ...patch };
    }));
    setDirty(true);
  }
  function deleteField(id: string) {
    const index = fields.findIndex((field) => field.id === id);
    rememberUndo();
    const nextFields = fields.filter((field) => field.id !== id);
    setFields(nextFields);
    setProducts((items) => items.map((item) => {
      const values = { ...item.values }; delete values[id]; return { ...item, values };
    }));
    const next = nextFields[Math.min(Math.max(index, 0), nextFields.length - 1)];
    setInspector(next ? { type: "field", fieldId: next.id } : { type: "workspace" }); setDirty(true);
  }
  function moveField(id: string, direction: -1 | 1) {
    const index = fields.findIndex((field) => field.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= fields.length) return;
    rememberUndo();
    setFields((items) => {
      const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next;
    });
    setDirty(true);
  }
  function batchUpdate(fieldId: string, value: FieldValue) {
    if (!selectedIds.length) return;
    rememberUndo();
    setProducts((items) => items.map((item) => selectedIds.includes(item.id) ? { ...item, values: { ...item.values, [fieldId]: value } } : item));
    setDirty(true);
  }

  const pricingTargets = inspector.type === "products"
    ? products.filter((product) => inspector.productIds.includes(product.id))
    : inspector.type === "product"
      ? products.filter((product) => product.id === inspector.productId)
      : products;
  const costField = fieldByRole(fields, "cost");
  const priceField = fieldByRole(fields, "salePrice");
  const costCurrencyField = fieldByRole(fields, "costCurrency");
  const saleCurrencyField = fieldByRole(fields, "saleCurrency");
  const productWithPricingDefaults = (product: EditableProduct, options?: { usePriceAsCost?: boolean }) => {
    const values = { ...product.values };
    if (costCurrencyField && !fieldValue(values[costCurrencyField.id])) values[costCurrencyField.id] = pricing.costCurrency;
    if (saleCurrencyField && !fieldValue(values[saleCurrencyField.id])) values[saleCurrencyField.id] = pricing.saleCurrency;
    if (options?.usePriceAsCost && costField && priceField && !Number(values[costField.id]) && Number(values[priceField.id]) > 0) {
      values[costField.id] = Number(values[priceField.id]);
    }
    return { ...product, values };
  };
  const pricingPreview = useMemo(() => pricingTargets.map((product) => priceWorkspaceProduct(productWithPricingDefaults(product, { usePriceAsCost: inspector.type === "product" }), fields, pricing)), [pricingTargets, fields, pricing, inspector.type]);
  const pricingSuccess = pricingPreview.filter((result) => result.success);
  const missingCost = pricingPreview.filter((result) => !result.success && result.reason === "missing-cost").length;
  const filledPrices = priceField ? pricingTargets.filter((product) => Number(product.values[priceField.id]) > 0).length : 0;
  const financialSummary = useMemo(() => workspaceFinancialSummary(products, fields, pricing), [products, fields, pricing]);

  function reprice(mode: PriceMode) {
    setPriceNotice(""); setError(""); setExportValidationNotice(false);
    const results = pricingTargets.map((product) => priceWorkspaceProduct(productWithPricingDefaults(product, { usePriceAsCost: inspector.type === "product" }), fields, pricing));
    const invalid = results.find((result) => !result.success && result.reason !== "missing-cost");
    if (invalid && !invalid.success) {
      setError(pricingMessage(invalid.reason, zh)); return;
    }
    const changes = new Map<string, EditableProduct>();
    results.forEach((result) => {
      if (!result.success) return;
      const current = pricingTargets.find((product) => product.id === result.product.id);
      if (mode === "empty" && priceField && current && Number(current.values[priceField.id]) > 0) return;
      changes.set(result.product.id, result.product);
    });
    if (!changes.size) {
      setPriceNotice(zh ? "没有需要更新的商品。" : "No products need updating."); return;
    }
    rememberUndo();
    setProducts((items) => items.map((item) => changes.get(item.id) ?? item));
    setDirty(true);
    setPriceNotice(zh ? `已更新 ${changes.size} 件商品的售价。` : `Updated prices for ${changes.size} products.`);
  }

  function exportFile(format: "xlsx" | "csv") {
    const exportProducts = products.map((product) => productWithPricingDefaults(product));
    const errors = exportProducts.flatMap((product) => validateWorkspaceProduct(product, fields)).filter((issue) => issue.severity === "error");
    if (errors.length) {
      setError("");
      setExportValidationNotice(true);
      return;
    }
    setExportValidationNotice(false);
    const base = `${template?.marketplace || "products"}-${new Date().toISOString().slice(0, 10)}`;
    const blob = format === "xlsx"
      ? exportWorkspaceXlsx(exportProducts, fields, template?.marketplace === "custom" ? customTemplateBuffer : undefined, customTemplateSheet)
      : exportWorkspaceCsv(exportProducts, fields);
    downloadBlob(blob, `${base}.${format}`); setDirty(false);
  }
  function reset() {
    if (dirty && !window.confirm(zh ? "未导出的修改将丢失，确定更换文件吗？" : "Unexported changes will be lost. Change file?")) return;
    sourceInputRef.current?.click();
  }

  const sourceFiltered = useMemo(() => snapshot?.rows.filter((row) =>
    !sourceSearch || Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(sourceSearch.toLowerCase()))) ?? [], [snapshot, sourceSearch]);
  const sourcePageCount = Math.max(1, Math.ceil(sourceFiltered.length / sourcePageSize));
  const sourceRows = sourceFiltered.slice((sourcePage - 1) * sourcePageSize, sourcePage * sourcePageSize);
  const issues = useMemo(() => new Map(products.map((product) => [product.id, validateWorkspaceProduct(productWithPricingDefaults(product), fields)])), [products, fields, pricing]);
  const sourceByRow = useMemo(() => new Map(snapshot?.rows.map((row, index) => [index + 2, row]) ?? []), [snapshot]);
  const modified = (product: EditableProduct) => {
    if (!product.sourceRow) return true;
    const source = sourceByRow.get(product.sourceRow);
    if (!source) return true;
    return fields.some((field) => {
      const mapping = mappings.find((item) => item.fieldId === field.id);
      return mapping?.sourceHeader && String(source[mapping.sourceHeader] ?? "") !== fieldValue(product.values[field.id]);
    });
  };
  const filtered = useMemo(() => products.filter((product) => {
    const matches = !search || Object.values(product.values).some((value) => fieldValue(value).toLowerCase().includes(search.toLowerCase()));
    const hasIssues = (issues.get(product.id)?.length ?? 0) > 0;
    return matches && (filter === "all" || filter === "valid" && !hasIssues || filter === "issues" && hasIssues || filter === "modified" && modified(product));
  }), [products, search, filter, issues, sourceByRow, fields, mappings]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageProducts = filtered.slice((page - 1) * pageSize, page * pageSize);
  const allIssues = [...issues.values()].flat();
  const errorCount = allIssues.filter((issue) => issue.severity === "error").length;
  const warningCount = allIssues.filter((issue) => issue.severity === "warning").length;
  useEffect(() => {
    if (exportValidationNotice && errorCount === 0) setExportValidationNotice(false);
  }, [exportValidationNotice, errorCount]);
  const errorMessage = error || (exportValidationNotice && errorCount > 0
    ? (zh ? `存在 ${errorCount} 个必填或格式错误，请修正后导出。` : `${errorCount} required or format errors must be fixed before export.`)
    : "");
  const imageField = fieldByRole(fields, "mainImage") ?? fields.find((field) => field.type === "image-url");
  const skuField = fieldByRole(fields, "sku");
  const titleField = fieldByRole(fields, "title");
  const stockField = fieldByRole(fields, "stock");
  const visibleFields = fields.filter((field) => field.visible !== false).slice(0, 8);

  return (
    <div className="spreadsheet-dark min-h-[calc(100vh-5rem)] bg-slate-950 text-white">
      <section className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto max-w-[96rem] px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300"><Sparkles className="size-4" />{zh ? "电商数据工具" : "Commerce data tool"}</div><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">{zh ? "商品表格 Agent" : "Product Spreadsheet Agent"}</h1><p className="mt-2 text-sm text-slate-400">{zh ? "导入、整理、定价并导出商品数据。" : "Import, organize, price, and export product data."}</p></div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[96rem] space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        {errorMessage && <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{errorMessage}</span><button className="ml-auto" onClick={() => { setError(""); setExportValidationNotice(false); }}><X className="size-4" /></button></div>}
        <input ref={sourceInputRef} className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) { if (isSupportedSpreadsheetFile(file)) void importSource(file); else setError(zh ? "请上传 .xlsx、.xls 或 .csv 表格文件。" : "Please upload a .xlsx, .xls, or .csv spreadsheet file."); } event.target.value = ""; }} />
        <input ref={customTemplateRef} className="sr-only" type="file" accept=".xlsx" onChange={(event) => { void uploadCustomTemplate(event.target.files?.[0]); event.target.value = ""; }} />

        {!snapshot ? <ImportCard zh={zh} busy={busy} onBrowse={() => sourceInputRef.current?.click()} onFile={(file) => { if (isSupportedSpreadsheetFile(file)) void importSource(file); else setError(zh ? "请上传 .xlsx、.xls 或 .csv 表格文件。" : "Please upload a .xlsx, .xls, or .csv spreadsheet file."); }} onReject={() => setError(zh ? "请拖入 .xlsx、.xls 或 .csv 表格文件。" : "Please drop a .xlsx, .xls, or .csv spreadsheet file.")} /> : <>
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-[0_24px_70px_rgba(2,6,23,0.22)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><FileSpreadsheet className="size-5" /></span><div className="min-w-0"><h2 className="truncate font-semibold">{snapshot.fileName}</h2><p className="mt-0.5 text-xs text-slate-500">{snapshot.sheetName} · {snapshot.rows.length} {zh ? "行" : "rows"} · {snapshot.headers.length} {zh ? "列" : "columns"}</p></div></div>
              <div className="flex gap-2">{sheetNames.length > 1 && <select value={snapshot.sheetName} onChange={(event) => sourceFile && void importSource(sourceFile, event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">{sheetNames.map((name) => <option key={name}>{name}</option>)}</select>}<button onClick={reset} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50"><Upload className="size-4" />{zh ? "更换文件" : "Change file"}</button></div>
            </div>
            <div className="p-5">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-sm font-semibold">{zh ? "原始数据预览" : "Source data preview"}</h3><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><input value={sourceSearch} onChange={(event) => { setSourceSearch(event.target.value); setSourcePage(1); }} placeholder={zh ? "搜索原始数据" : "Search source data"} className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" /></div></div>
              <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full whitespace-nowrap text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2.5">{zh ? "行" : "Row"}</th>{snapshot.headers.map((header) => <th key={header} className="px-3 py-2.5 font-semibold">{header}</th>)}</tr></thead><tbody>{sourceRows.map((row, index) => { const rowNumber = sourceFiltered.indexOf(row) + 2; return <tr key={`${rowNumber}-${index}`} className={highlightSourceRow === rowNumber ? "bg-cyan-50 ring-1 ring-inset ring-cyan-300" : "hover:bg-slate-50"}><td className="border-t border-slate-100 px-3 py-2 text-slate-400">{rowNumber}</td>{snapshot.headers.map((header) => { const text = String(row[header] ?? ""); const href = safeLink(text); return <td key={header} className="max-w-64 truncate border-t border-slate-100 px-3 py-2" title={text}>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-700 underline decoration-cyan-300 underline-offset-2">{text}</a> : text}</td>; })}</tr>; })}</tbody></table></div>
              <Pager page={sourcePage} count={sourcePageCount} total={sourceFiltered.length} zh={zh} onPage={setSourcePage} />
            </div>
          </section>

          {template && <section ref={workspaceRef} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-[0_24px_70px_rgba(2,6,23,0.22)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div><h2 className="text-lg font-semibold">{zh ? "商品工作台" : "Product workspace"}</h2><p className="mt-0.5 text-xs text-slate-500">{products.length} {zh ? "件商品" : "products"} · {fields.length} {zh ? "个字段" : "fields"} · <span className={errorCount ? "text-red-600" : "text-emerald-600"}>{errorCount} {zh ? "个错误" : "errors"}</span></p></div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={addProduct} className="tool-primary"><Plus className="size-4" />{zh ? "新增商品" : "Add product"}</button>
                <button disabled={!selectedIds.length} onClick={() => deleteProducts(selectedIds)} className="tool-button"><Trash2 className="size-4" />{zh ? "删除所选" : "Delete selected"}</button>
                <button disabled={!undoStack.length} onClick={undo} className="tool-button"><RotateCcw className="size-4" />{zh ? "撤销" : "Undo"}</button>
                <button onClick={addField} className="tool-button"><Settings2 className="size-4" />{zh ? "新增字段" : "Add field"}</button>
                <select aria-label={zh ? "切换工作台模板" : "Switch workspace template"} value={pendingTemplate?.id ?? template.id} onChange={(event) => { const next = enabledWorkspaceTemplates.find((item) => item.id === event.target.value); if (next) chooseTemplate(next); }} className="min-h-10 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold">
                  {enabledWorkspaceTemplates.map((item) => <option key={item.id} value={item.id}>{item.name[language]}</option>)}
                </select>
              </div>
            </div>

            <div className="grid xl:grid-cols-[minmax(0,1fr)_23rem]">
              <div className="min-w-0 border-slate-200 p-4 xl:border-r" onClick={(event) => { if (event.currentTarget === event.target) { setSelectedIds([]); setInspector({ type: "workspace" }); } }}>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={zh ? "搜索商品" : "Search products"} className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" /></div><select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="all">{zh ? "全部商品" : "All products"}</option><option value="valid">{zh ? "校验通过" : "Valid"}</option><option value="issues">{zh ? "存在问题" : "Has issues"}</option><option value="modified">{zh ? "已修改" : "Modified"}</option></select></div>
                <div className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block"><table className="w-full whitespace-nowrap text-left text-xs"><thead className="sticky top-0 z-10 bg-slate-50 text-slate-500"><tr><th className="w-10 px-3 py-3"><input type="checkbox" aria-label={zh ? "选择当前页" : "Select page"} checked={pageProducts.length > 0 && pageProducts.every((item) => selectedIds.includes(item.id))} onChange={(event) => { const ids = pageProducts.map((item) => item.id); const next = event.target.checked ? [...new Set([...selectedIds, ...ids])] : selectedIds.filter((id) => !ids.includes(id)); setSelectedIds(next); setInspector(next.length > 1 ? { type: "products", productIds: next } : next.length === 1 ? { type: "product", productId: next[0] } : { type: "workspace" }); }} /></th>{imageField && <th className="px-3 py-3">{zh ? "图片" : "Image"}</th>}{visibleFields.filter((field) => field.id !== imageField?.id).map((field) => <th key={field.id} className={`px-3 py-3 ${inspector.type === "field" && inspector.fieldId === field.id ? "bg-cyan-100 text-cyan-800" : ""}`}><button onClick={() => setInspector({ type: "field", fieldId: field.id })} className="font-semibold hover:text-cyan-700">{field.label}{field.required ? " *" : ""}</button></th>)}<th className="px-3 py-3">{zh ? "状态" : "Status"}</th><th className="px-3 py-3" /></tr></thead><tbody>{pageProducts.map((product) => { const selected = selectedIds.includes(product.id) || inspector.type === "product" && inspector.productId === product.id; const productIssues = issues.get(product.id) ?? []; return <tr key={product.id} onClick={() => selectProduct(product)} className={`cursor-pointer transition ${selected ? "bg-cyan-50 ring-1 ring-inset ring-cyan-300" : "hover:bg-slate-50"}`}><td className="border-t border-slate-100 px-3 py-2" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(product.id)} onChange={(event) => toggleProduct(product.id, event.target.checked)} /></td>{imageField && <td className="border-t border-slate-100 px-3 py-2" onClick={(event) => event.stopPropagation()}><WorkspaceImage value={String(product.values[imageField.id] ?? "")} consent={imageConsent} zh={zh} onRequest={() => setConsentPrompt(true)} onPreview={setPreviewImage} /></td>}{visibleFields.filter((field) => field.id !== imageField?.id).map((field) => <td key={field.id} className="max-w-52 truncate border-t border-slate-100 px-3 py-3" title={fieldValue(product.values[field.id])}>{fieldValue(product.values[field.id]) || "—"}</td>)}<td className="border-t border-slate-100 px-3 py-2">{productIssues.length ? <button onClick={(event) => { event.stopPropagation(); selectProduct(product); }} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700"><AlertTriangle className="size-3" />{productIssues.length}</button> : <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="size-3.5" />{zh ? "正常" : "Valid"}</span>}</td><td className="border-t border-slate-100 px-2 py-2" onClick={(event) => event.stopPropagation()}><div className="flex"><button onClick={() => duplicateProduct(product)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Copy className="size-4" /></button><button onClick={() => deleteProducts([product.id])} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="size-4" /></button></div></td></tr>; })}</tbody></table></div>
                <div className="grid gap-3 lg:hidden">{pageProducts.map((product) => { const selected = inspector.type === "product" && inspector.productId === product.id || selectedIds.includes(product.id); return <div key={product.id} role="button" tabIndex={0} onClick={() => selectProduct(product)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectProduct(product); }} className={`w-full cursor-pointer rounded-xl border p-3 text-left ${selected ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white"}`}><div className="flex items-center gap-3">{imageField && <span onClick={(event) => event.stopPropagation()}><WorkspaceImage value={String(product.values[imageField.id] ?? "")} consent={imageConsent} zh={zh} onRequest={() => setConsentPrompt(true)} onPreview={setPreviewImage} /></span>}<span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-cyan-700">{fieldValue(skuField ? product.values[skuField.id] : "") || (zh ? "无 SKU" : "No SKU")}</span><span className="mt-1 block truncate font-semibold">{fieldValue(titleField ? product.values[titleField.id] : "") || (zh ? "未命名商品" : "Untitled")}</span><span className="mt-2 block text-xs text-slate-500">{fieldValue(priceField ? product.values[priceField.id] : "")}{stockField ? ` · ${zh ? "库存" : "Stock"} ${fieldValue(product.values[stockField.id])}` : ""}</span></span></div></div>; })}</div>
                <Pager page={page} count={pageCount} total={filtered.length} zh={zh} onPage={setPage} />
              </div>

              <aside className="min-w-0 bg-slate-900/70">
                <Inspector
                  zh={zh} language={language} context={inspector} products={products} fields={fields}
                  mappings={mappings} source={sourceByRow} issues={issues} template={template}
                  pendingTemplate={pendingTemplate} mappingSnapshot={mappingSnapshot}
                  customTemplateSheets={customTemplateSheets} customTemplateSheet={customTemplateSheet}
                  pricing={pricing} pricingSuccess={pricingSuccess} missingCost={missingCost} filledPrices={filledPrices}
                  financialSummary={financialSummary}
                  fxLoading={fxLoading} fxMeta={fxMeta}
                  priceNotice={priceNotice} errorCount={errorCount} warningCount={warningCount}
                  onWorkspace={() => { setSelectedIds([]); setInspector({ type: "workspace" }); }}
                  onProduct={updateProduct} onBatch={batchUpdate} onField={updateField}
                  onDeleteField={deleteField} onMoveField={moveField}
                  onMapping={(fieldId, sourceHeader) => setMappings((items) => items.map((item) => item.fieldId === fieldId ? { ...item, sourceHeader, confidence: 1 } : item))}
                  onConfirmTemplate={confirmMapping} onCancelTemplate={cancelTemplate}
                  onCustomSheet={(name) => void changeCustomTemplateSheet(name)}
                  onPricing={setPricing} onReprice={reprice}
                  onRefreshRate={() => setFxRefreshKey((value) => value + 1)}
                  onFilterIssues={() => { setFilter("issues"); setInspector({ type: "workspace" }); }}
                  onExport={exportFile} imageConsent={imageConsent}
                  onRequestImage={() => setConsentPrompt(true)} onPreviewImage={setPreviewImage}
                />
              </aside>
            </div>
          </section>}
        </>}
      </main>

      {consentPrompt && <ConsentDialog zh={zh} onClose={() => setConsentPrompt(false)} onAllow={() => { setImageConsent(true); setConsentPrompt(false); }} />}
      {previewImage && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4" onClick={() => setPreviewImage("")}><button aria-label={zh ? "关闭" : "Close"} className="absolute right-5 top-5 rounded-full bg-slate-800 p-3 text-white"><X className="size-5" /></button><img src={previewImage} alt="" referrerPolicy="no-referrer" crossOrigin="anonymous" className="max-h-[80vh] max-w-full rounded-2xl object-contain" /></div>}
    </div>
  );
}

function ImportCard({
  zh, busy, onBrowse, onFile, onReject,
}: {
  zh: boolean; busy: boolean; onBrowse: () => void; onFile: (file: File) => void; onReject: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const handleDrag = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!busy) setDragging(event.type === "dragenter" || event.type === "dragover");
  };
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (busy) return;
    const file = event.dataTransfer.files[0];
    if (!file) return;
    if (!isSupportedSpreadsheetFile(file)) {
      onReject();
      return;
    }
    onFile(file);
  };
  const steps = zh ? [
    ["安装采购助手", "进入 1688 顶部导航的“下载插件”，在“1688 官方采购助手”区域点击“立即安装”。"],
    ["加入选品池", "在商品页或搜索结果页打开采购助手工具条，点击“加入选品池”。"],
    ["导出表格", "进入“选品池”，勾选需要处理的商品，点击右上角“导出表格”。"],
    ["导入 ImgSkills", "回到这里上传导出的 Excel 或 CSV。商品ID 会作为 Seller SKU，商品价格会作为 Cost，所属分组会作为 Category。"],
  ] : [
    ["Install the assistant", "Open 1688's plugin download entry and install the official procurement assistant."],
    ["Add products", "Use the assistant toolbar on product or search pages, then click Add to selection pool."],
    ["Export the sheet", "Open the selection pool, select products, and click Export sheet."],
    ["Import here", "Upload the exported Excel or CSV. Product ID maps to Seller SKU, product price maps to Cost, and group maps to Category."],
  ];
  return <section className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`rounded-2xl border p-8 text-center shadow-[0_24px_70px_rgba(2,6,23,0.22)] transition sm:p-12 ${dragging ? "border-cyan-300 bg-cyan-300/10 ring-2 ring-cyan-300/30" : "border-slate-800 bg-slate-900/60"}`}
    >
      <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200"><FileSpreadsheet className="size-8" /></span>
      <h2 className="mt-5 text-xl font-semibold text-white">{zh ? "导入商品表格" : "Import product spreadsheet"}</h2>
      <p className="mt-2 text-sm text-slate-500">{zh ? "点击选择，或将 Excel/CSV 拖拽到这里" : "Choose a file, or drag Excel/CSV here"}</p>
      <p className="mt-1 text-xs text-slate-600">.xlsx · .xls · .csv</p>
      <button disabled={busy} onClick={onBrowse} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-bold text-slate-950 hover:bg-cyan-200">{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{zh ? "选择表格文件" : "Choose spreadsheet"}</button>
    </div>
    <details className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.22)]" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-400/10 text-orange-200"><Info className="size-5" /></span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-white">{zh ? "如何从 1688 导出商品表格" : "How to export a product sheet from 1688"}</span>
            <span className="mt-1 block text-xs text-slate-500">{zh ? "适用于 1688 官方采购助手与选品池导出。" : "For the official 1688 assistant and selection pool export."}</span>
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <ol className="mt-5 space-y-3">
        {steps.map(([title, description], index) => <li key={title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-cyan-300/10 text-sm font-bold text-cyan-200">{index + 1}</span>
          <span>
            <span className="block text-sm font-semibold text-slate-100">{title}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>
          </span>
        </li>)}
      </ol>
      <a href="https://www.1688.com/" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-cyan-200 hover:border-cyan-300/70">{zh ? "打开 1688" : "Open 1688"}<ChevronRight className="size-3.5" /></a>
    </details>
  </section>;
}

type InspectorProps = {
  zh: boolean; language: "zh" | "en"; context: InspectorContext; products: EditableProduct[];
  fields: WorkspaceFieldDefinition[]; mappings: SourceToWorkspaceMapping[];
  source: Map<number, Record<string, unknown>>; issues: Map<string, ReturnType<typeof validateWorkspaceProduct>>;
  template: WorkspaceTemplate; pendingTemplate: WorkspaceTemplate | null; mappingSnapshot: SourceSheetSnapshot | null;
  customTemplateSheets: string[]; customTemplateSheet: string; pricing: PricingConfig;
  pricingSuccess: Array<Extract<PricingResult, { success: true }>>; missingCost: number; filledPrices: number;
  financialSummary: FinancialSummary;
  fxLoading: boolean; fxMeta: { date?: string; updatedAt?: string; error?: string };
  priceNotice: string; errorCount: number; warningCount: number;
  onWorkspace: () => void; onProduct: (id: string, fieldId: string, value: FieldValue) => void;
  onBatch: (fieldId: string, value: FieldValue) => void; onField: (id: string, patch: Partial<WorkspaceFieldDefinition>) => void;
  onDeleteField: (id: string) => void; onMoveField: (id: string, direction: -1 | 1) => void;
  onMapping: (fieldId: string, sourceHeader: string) => void; onConfirmTemplate: () => void; onCancelTemplate: () => void;
  onCustomSheet: (name: string) => void; onPricing: (value: PricingConfig) => void; onReprice: (mode: PriceMode) => void;
  onRefreshRate: () => void;
  onFilterIssues: () => void; onExport: (format: "xlsx" | "csv") => void;
  imageConsent: boolean; onRequestImage: () => void; onPreviewImage: (url: string) => void;
};

function Inspector(props: InspectorProps) {
  const { zh, context, fields, products } = props;
  const product = context.type === "product" ? products.find((item) => item.id === context.productId) : undefined;
  const field = context.type === "field" || context.type === "mapping" ? fields.find((item) => item.id === context.fieldId) : undefined;
  return <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4">
    <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{context.type === "workspace" ? (zh ? "工作台设置" : "Workspace settings") : context.type === "product" ? (zh ? "商品属性" : "Product properties") : context.type === "products" ? (zh ? "批量属性" : "Batch properties") : context.type === "field" ? (zh ? "字段属性" : "Field properties") : (zh ? "模板映射" : "Template mapping")}</h3>{context.type !== "workspace" && <button onClick={props.onWorkspace} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600"><ArrowLeft className="size-3.5" />{zh ? "工作台" : "Workspace"}</button>}</div>

    {context.type === "workspace" && <WorkspaceProperties {...props} />}
    {context.type === "product" && product && <ProductProperties {...props} product={product} />}
    {context.type === "products" && <BatchProperties {...props} selected={products.filter((item) => context.productIds.includes(item.id))} />}
    {context.type === "field" && field && <FieldProperties {...props} field={field} />}
    {(context.type === "template-migration" || context.type === "mapping") && <MappingProperties {...props} focusField={field?.id} />}
  </div>;
}

function WorkspaceProperties(props: InspectorProps) {
  const { zh, products, fields, pricing, financialSummary } = props;
  return <div className="space-y-5">
    <PropertyCard title={zh ? "工作台概览" : "Workspace overview"}><div className="grid grid-cols-2 gap-2">{[[products.length, zh ? "商品" : "Products"], [fields.length, zh ? "字段" : "Fields"], [props.errorCount, zh ? "错误" : "Errors"], [props.warningCount, zh ? "警告" : "Warnings"]].map(([value, label]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}</div>{props.errorCount > 0 && <button onClick={props.onFilterIssues} className="mt-3 text-xs font-semibold text-cyan-700 underline">{zh ? "查看问题商品" : "View issue products"}</button>}</PropertyCard>
    <FinancialSummaryCard zh={zh} summary={financialSummary} currency={pricing.saleCurrency} />
    <PropertyCard title={zh ? "导出" : "Export"}><p className="text-xs leading-5 text-slate-500">{zh ? "导出当前工作台中的全部商品和可导出字段。" : "Export all products and exportable workspace fields."}</p><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => props.onExport("xlsx")} className="export-primary"><Download className="size-4" />Excel</button><button onClick={() => props.onExport("csv")} className="export-secondary"><Download className="size-4" />CSV</button></div></PropertyCard>
  </div>;
}

function ProductProperties(props: InspectorProps & { product: EditableProduct }) {
  const { zh, product, fields, mappings, source, issues } = props;
  const originalRow = product.sourceRow ? source.get(product.sourceRow) : undefined;
  const productIssues = issues.get(product.id) ?? [];
  const primaryRoles = new Set<StandardFieldRole>(["mainImage", "sku", "title", "cost", "costCurrency", "salePrice", "saleCurrency", "stock"]);
  const productRoles = new Set<StandardFieldRole>(["supplier", "description", "category", "brand", "barcode"]);
  const logisticsRoles = new Set<StandardFieldRole>(["weight", "shipping"]);
  const primary = fields.filter((field) => primaryRoles.has(field.role));
  const productFields = fields.filter((field) => productRoles.has(field.role));
  const logistics = fields.filter((field) => logisticsRoles.has(field.role));
  const groupedIds = new Set([...primary, ...productFields, ...logistics].map((field) => field.id));
  const media = fields.filter((field) => !groupedIds.has(field.id));
  const imageField = primary.find((field) => field.role === "mainImage");
  const renderField = (field: WorkspaceFieldDefinition) => {
    const sourceHeader = mappings.find((item) => item.fieldId === field.id)?.sourceHeader;
    const original = originalRow && sourceHeader ? originalRow[sourceHeader] : undefined;
    const value = field.role === "costCurrency" && !fieldValue(product.values[field.id])
      ? props.pricing.costCurrency
      : field.role === "saleCurrency" && !fieldValue(product.values[field.id])
        ? props.pricing.saleCurrency
        : product.values[field.id];
    const changed = original !== undefined && String(original) !== fieldValue(value);
    const problem = productIssues.find((item) => item.fieldId === field.id);
    const full = ["description", "additionalImages", "variants"].includes(field.role);
    return <label key={field.id} className={full ? "col-span-2" : ""}><span className="flex items-center justify-between text-[11px] font-semibold text-slate-600"><span>{field.label}{field.required && <span className="text-red-500"> *</span>}</span>{problem && <AlertTriangle className={`size-3.5 ${problem.severity === "error" ? "text-red-600" : "text-amber-600"}`} />}</span><WorkspaceInput field={field} value={value} onChange={(value) => props.onProduct(product.id, field.id, value)} />{changed && <span className="mt-1 block truncate rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-800">{zh ? "原始值" : "Original"}: {String(original)}</span>}</label>;
  };
  return <div className="space-y-3">
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">{imageField && <WorkspaceImage value={String(product.values[imageField.id] ?? "")} consent={props.imageConsent} zh={zh} onRequest={props.onRequestImage} onPreview={props.onPreviewImage} />}<div className="min-w-0"><p className="truncate text-xs font-semibold text-cyan-700">{product.sourceRow ? (zh ? `来源第 ${product.sourceRow} 行` : `Source row ${product.sourceRow}`) : (zh ? "手动新增" : "Manually added")}</p><p className={`mt-1 text-[11px] ${productIssues.length ? "text-amber-700" : "text-emerald-700"}`}>{productIssues.length ? (zh ? `${productIssues.length} 个字段问题` : `${productIssues.length} field issues`) : (zh ? "校验正常" : "Valid")}</p></div></div>
    <PricingProperties {...props} />
    <ProductBasicProperties title={zh ? "商品基础属性" : "Basic product properties"} fields={primary} renderField={renderField} />
    <ProductFieldGroup title={zh ? "商品信息" : "Product information"} fields={productFields} issues={productIssues} renderField={renderField} />
    <ProductFieldGroup title={zh ? "物流信息" : "Logistics"} fields={logistics} issues={productIssues} renderField={renderField} />
    <ProductFieldGroup title={zh ? "图片与变体" : "Images and variants"} fields={media} issues={productIssues} renderField={renderField} />
  </div>;
}

function ProductBasicProperties({
  title, fields, renderField,
}: {
  title: string;
  fields: WorkspaceFieldDefinition[];
  renderField: (field: WorkspaceFieldDefinition) => React.ReactNode;
}) {
  if (!fields.length) return null;
  return <PropertyCard title={title}>
    <div className="grid grid-cols-2 gap-2.5">{fields.map(renderField)}</div>
  </PropertyCard>;
}

function ProductFieldGroup({
  title, fields, issues, renderField,
}: {
  title: string;
  fields: WorkspaceFieldDefinition[];
  issues: ReturnType<typeof validateWorkspaceProduct>;
  renderField: (field: WorkspaceFieldDefinition) => React.ReactNode;
}) {
  if (!fields.length) return null;
  const fieldIds = new Set(fields.map((field) => field.id));
  const errorCount = issues.filter((issue) => fieldIds.has(issue.fieldId)).length;
  return <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-700">
      <span>{title}<span className="ml-1.5 font-normal text-slate-400">{fields.length}</span></span>
      <span className="flex items-center gap-2">{errorCount > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">{errorCount}</span>}<ChevronDown className="size-3.5 text-slate-400 transition group-open:rotate-180" /></span>
    </summary>
    <div className="grid grid-cols-2 gap-2.5 border-t border-slate-100 p-3">{fields.map(renderField)}</div>
  </details>;
}

function BatchProperties(props: InspectorProps & { selected: EditableProduct[] }) {
  const { zh, fields, selected } = props;
  const roles = new Set<StandardFieldRole>(["category", "brand", "stock", "saleCurrency", "shipping"]);
  const batchFields = fields.filter((field) => roles.has(field.role));
  return <div className="space-y-5"><PropertyCard title={zh ? `已选择 ${selected.length} 件商品` : `${selected.length} products selected`}><div className="space-y-3">{batchFields.map((field) => { const values = new Set(selected.map((item) => fieldValue(item.values[field.id]))); return <label key={field.id} className="block"><span className="text-xs font-semibold text-slate-600">{field.label}</span><WorkspaceInput field={field} value={values.size === 1 ? selected[0]?.values[field.id] : ""} placeholder={values.size > 1 ? (zh ? "多个值" : "Multiple values") : undefined} onChange={(value) => props.onBatch(field.id, value)} /></label>; })}{!batchFields.length && <p className="text-xs text-slate-500">{zh ? "请为字段设置类目、品牌、库存、币种或物流费角色。" : "Assign category, brand, stock, currency, or shipping roles to fields."}</p>}</div></PropertyCard><PricingProperties {...props} /></div>;
}

function FieldProperties(props: InspectorProps & { field: WorkspaceFieldDefinition }) {
  const { zh, language, fields, field } = props;
  const index = fields.findIndex((item) => item.id === field.id);
  return <div className="space-y-4"><label className="property-label">{zh ? "字段名称" : "Field name"}<input value={field.label} onChange={(event) => props.onField(field.id, { label: event.target.value })} className="property-input" /></label><label className="property-label">{zh ? "字段类型" : "Field type"}<select value={field.type} onChange={(event) => props.onField(field.id, { type: event.target.value as WorkspaceFieldType })} className="property-input">{fieldTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="property-label">{zh ? "标准角色" : "Standard role"}<select value={field.role} onChange={(event) => props.onField(field.id, { role: event.target.value as StandardFieldRole })} className="property-input">{standardRoles.map((role) => <option key={role} value={role}>{role === "none" ? (zh ? "无" : "None") : productFieldLabels[role][language]}</option>)}</select></label>{(field.type === "single-select" || field.type === "multi-select") && <label className="property-label">{zh ? "选项（分号分隔）" : "Options (semicolon separated)"}<input value={field.options.join(";")} onChange={(event) => props.onField(field.id, { options: event.target.value.split(";").map((item) => item.trim()).filter(Boolean) })} className="property-input" /></label>}<div className="grid grid-cols-2 gap-2"><Toggle checked={field.required} label={zh ? "必填" : "Required"} onChange={(required) => props.onField(field.id, { required })} /><Toggle checked={field.visible} label={zh ? "表格显示" : "Visible"} onChange={(visible) => props.onField(field.id, { visible })} /><Toggle checked={field.exportable} label={zh ? "参与导出" : "Export"} onChange={(exportable) => props.onField(field.id, { exportable })} /></div><div className="flex gap-2"><button disabled={index <= 0} onClick={() => props.onMoveField(field.id, -1)} className="tool-button flex-1">{zh ? "左移" : "Move left"}</button><button disabled={index >= fields.length - 1} onClick={() => props.onMoveField(field.id, 1)} className="tool-button flex-1">{zh ? "右移" : "Move right"}</button></div><button onClick={() => props.onDeleteField(field.id)} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-semibold text-red-700"><Trash2 className="size-4" />{zh ? "删除字段" : "Delete field"}</button></div>;
}

function MappingProperties(props: InspectorProps & { focusField?: string }) {
  const { zh, pendingTemplate, mappingSnapshot, mappings, customTemplateSheets, customTemplateSheet } = props;
  if (!pendingTemplate || !mappingSnapshot) return <p className="text-sm text-slate-500">{zh ? "当前没有待处理的模板映射。" : "There is no pending template mapping."}</p>;
  const shown = props.focusField ? pendingTemplate.fields.filter((field) => field.id === props.focusField) : pendingTemplate.fields;
  return <div className="space-y-3">{customTemplateSheets.length > 1 && pendingTemplate.marketplace === "custom" && <label className="property-label">{zh ? "模板工作表" : "Template sheet"}<select value={customTemplateSheet} onChange={(event) => props.onCustomSheet(event.target.value)} className="property-input">{customTemplateSheets.map((name) => <option key={name}>{name}</option>)}</select></label>}<div className="space-y-2.5">{shown.map((field) => { const mapping = mappings.find((item) => item.fieldId === field.id); return <label key={field.id} className="property-label">{field.label}{field.required && " *"}<select value={mapping?.sourceHeader ?? ""} onChange={(event) => props.onMapping(field.id, event.target.value)} className="property-input"><option value="">{zh ? "不导入 / 留空" : "Do not import / leave blank"}</option>{mappingSnapshot.headers.map((header) => <option key={header}>{header}</option>)}</select><span className="mt-1 text-[10px] font-normal text-slate-400">{Math.round((mapping?.confidence ?? 0) * 100)}% {zh ? "匹配度" : "match"}</span></label>; })}</div><div className="grid grid-cols-2 gap-2 pt-2"><button onClick={props.onCancelTemplate} className="tool-button justify-center">{zh ? "取消" : "Cancel"}</button><button onClick={props.onConfirmTemplate} className="tool-primary justify-center">{zh ? "应用模板" : "Apply template"}</button></div></div>;
}

function FinancialSummaryCard({ zh, summary, currency }: { zh: boolean; summary: FinancialSummary; currency: string }) {
  const metrics = [
    [zh ? "预计销售额" : "Projected revenue", formatFinancialAmount(summary.revenue, currency), "text-cyan-200"],
    [zh ? "采购成本" : "Product cost", formatFinancialAmount(summary.productCost, currency), "text-slate-200"],
    [zh ? "毛利" : "Gross profit", formatFinancialAmount(summary.grossProfit, currency), summary.grossProfit >= 0 ? "text-emerald-200" : "text-rose-200"],
    [zh ? "毛利率" : "Gross margin", `${summary.grossMargin.toFixed(1)}%`, summary.grossMargin >= 0 ? "text-emerald-200" : "text-rose-200"],
    [zh ? "物流与平台费用" : "Shipping & platform fees", formatFinancialAmount(summary.operatingFees, currency), "text-amber-200"],
  ] as const;
  const netTone = summary.netProfit >= 0 ? "text-emerald-200" : "text-rose-200";
  return <PropertyCard title={zh ? "财务概览" : "Financial overview"}>
    <div className="mb-3 space-y-1 text-[11px] text-slate-500">
      <div className="flex items-center justify-between gap-3"><span>{zh ? `按库存 ${summary.units} 件估算` : `Estimated for ${summary.units} inventory units`}</span><span>{summary.pricedProducts} {zh ? "个已定价商品" : "priced products"}</span></div>
      <p>{zh ? "仅统计有有效售价、成本和库存的商品。" : "Only products with valid price, cost, and stock are included."}</p>
    </div>
    <div className="grid grid-cols-2 gap-2">{metrics.map(([label, value, tone]) => <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/55 p-2.5"><p className="text-[10px] text-slate-500">{label}</p><p className={`mt-1 break-words text-sm font-semibold leading-5 ${tone}`} title={value}>{value}</p></div>)}
      <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-950/55 p-2.5">
        <p className="text-[10px] text-slate-500">{zh ? "预计净收益" : "Projected net profit"}</p>
        <p className={`mt-1 break-words text-sm font-semibold leading-5 ${netTone}`} title={formatFinancialAmount(summary.netProfit, currency)}>{formatFinancialAmount(summary.netProfit, currency)}</p>
        <p className={`mt-0.5 text-xs ${netTone}`}>{zh ? "预计净利率" : "Projected net margin"} {summary.netMargin.toFixed(1)}%</p>
      </div>
    </div>{summary.pricedProducts === 0 && <p className="mt-3 text-xs leading-5 text-amber-200">{zh ? "请先填写或计算商品售价，财务汇总将按库存自动更新。" : "Add or calculate product prices to populate the inventory-based financial summary."}</p>}
  </PropertyCard>;
}

function PricingProperties(props: InspectorProps & { embedded?: boolean }) {
  const { zh, pricing, pricingSuccess, priceNotice } = props;
  const [fixedFeeHelp, setFixedFeeHelp] = useState(false);
  const sample = pricingSuccess[0];
  const selectedProductId = props.context.type === "product" ? props.context.productId : undefined;
  const selectedProduct = selectedProductId ? props.products.find((product) => product.id === selectedProductId) : undefined;
  const productCostField = selectedProduct ? fieldByRole(props.fields, "cost") : undefined;
  const productCostCurrencyField = selectedProduct ? fieldByRole(props.fields, "costCurrency") : undefined;
  const productCostCurrency = selectedProduct && productCostCurrencyField
    ? fieldValue(selectedProduct.values[productCostCurrencyField.id]) || pricing.costCurrency
    : pricing.costCurrency;
  const productSaleCurrencyField = selectedProduct ? fieldByRole(props.fields, "saleCurrency") : undefined;
  const productSalePriceField = selectedProduct ? fieldByRole(props.fields, "salePrice") : undefined;
  const productCostValue = selectedProduct && productCostField ? fieldValue(selectedProduct.values[productCostField.id]) : "";
  const productSalePriceValue = selectedProduct && productSalePriceField ? fieldValue(selectedProduct.values[productSalePriceField.id]) : "";
  const productCostInputValue = productCostValue || productSalePriceValue;
  const setCostCurrency = (currency: string) => {
    props.onPricing({ ...pricing, costCurrency: currency });
    if (selectedProduct && productCostCurrencyField) props.onProduct(selectedProduct.id, productCostCurrencyField.id, currency);
  };
  const setSaleCurrency = (currency: string) => {
    props.onPricing({ ...pricing, saleCurrency: currency });
    if (selectedProduct && productSaleCurrencyField) props.onProduct(selectedProduct.id, productSaleCurrencyField.id, currency);
  };
  const currencyModule = <section className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h5 className="text-sm font-semibold text-slate-100">{zh ? "币种与汇率" : "Currency & rate"}</h5>
        <p className="mt-1 text-[11px] text-slate-500">{pricing.costCurrency} → {pricing.saleCurrency}</p>
      </div>
      <button type="button" disabled={props.fxLoading} onClick={props.onRefreshRate} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 disabled:opacity-50">
        {props.fxLoading ? (zh ? "更新中…" : "Updating…") : (zh ? "获取最新" : "Refresh")}
      </button>
    </div>
    <div className="grid grid-cols-2 gap-2.5">
      <label>
        <span className="text-xs text-slate-500">{zh ? "成本币种" : "Cost currency"}</span>
        <select value={pricing.costCurrency} onChange={(event) => setCostCurrency(event.target.value)} className="property-input">
          {pricingCurrencies.map((currency) => <option key={currency}>{currency}</option>)}
        </select>
      </label>
      <label>
        <span className="text-xs text-slate-500">{zh ? "销售币种" : "Sale currency"}</span>
        <select value={pricing.saleCurrency} onChange={(event) => setSaleCurrency(event.target.value)} className="property-input">
          {pricingCurrencies.map((currency) => <option key={currency}>{currency}</option>)}
        </select>
      </label>
      <label className="col-span-2">
        <span className="text-xs text-slate-500">{`${pricing.costCurrency} → ${pricing.saleCurrency} ${zh ? "参考汇率" : "reference rate"}`}</span>
        <input type="number" min="0" step="0.0001" value={pricing.exchangeRate} onChange={(event) => props.onPricing({ ...pricing, exchangeRate: Number(event.target.value) })} className="property-input" />
        <span className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
          <span>{props.fxMeta.error ? (zh ? "实时参考汇率不可用，当前为手动值" : "Latest reference rate unavailable; using manual value") : props.fxMeta.date ? `${zh ? "参考数据日期" : "Reference date"} ${props.fxMeta.date}` : (zh ? "可手动输入" : "Manual value")}</span>
          <span>{zh ? `1 ${pricing.costCurrency} = ${pricing.exchangeRate} ${pricing.saleCurrency}` : `1 ${pricing.costCurrency} = ${pricing.exchangeRate} ${pricing.saleCurrency}`}</span>
        </span>
      </label>
    </div>
  </section>;
  const scopeLabel = props.context.type === "product"
    ? (zh ? "当前商品计算预览" : "Current product preview")
    : props.context.type === "products"
      ? (zh ? "所选商品计算预览" : "Selected products preview")
      : (zh ? "首件商品计算预览" : "First product preview");
  const recalculateLabel = props.context.type === "product"
    ? (zh ? "重新计算当前商品" : "Recalculate product")
    : props.context.type === "products"
      ? (zh ? "重新计算所选" : "Recalculate selected")
      : (zh ? "重新计算全部" : "Recalculate all");
  const pricingControls = <>{selectedProduct && productCostField && <label className="block"><span className="flex items-center justify-between text-xs text-slate-500"><span>{zh ? "商品成本" : "Product cost"}</span><span className="font-semibold text-slate-400">{productCostCurrency}</span></span><input type="number" min="0" step="0.01" value={productCostInputValue} onChange={(event) => props.onProduct(selectedProduct.id, productCostField.id, event.target.value === "" ? "" : Number(event.target.value))} className="property-input" />{!productCostValue && productSalePriceValue && <span className="mt-1 block text-[10px] text-slate-500">{zh ? "默认显示当前售价，修改后写入商品成本。" : "Defaults to current price; edits write to product cost."}</span>}</label>}<div className="grid grid-cols-2 gap-3">{([
    ["shipping", zh ? "默认物流费" : "Default shipping"],
    ["platformRate", zh ? "平台费 %" : "Platform %"], ["fixedFee", zh ? "每件固定费用" : "Fixed fee per item"],
    ["targetMargin", zh ? "目标利润率 %" : "Target margin %"],
  ] as const).map(([key, label]) => {
    const hasCurrencyUnit = key === "shipping" || key === "fixedFee";
    return <label key={key} className={key === "fixedFee" ? "relative" : ""}><span className="flex items-center gap-1 text-xs text-slate-500">{label}{key === "fixedFee" && <button type="button" aria-label={zh ? "查看每件固定费用说明" : "About fixed fee per item"} aria-expanded={fixedFeeHelp} onClick={() => setFixedFeeHelp((value) => !value)} className="rounded-full text-slate-400 transition hover:text-cyan-200"><Info className="size-3.5" /></button>}</span>{key === "fixedFee" && fixedFeeHelp && <span role="status" className="absolute right-0 top-6 z-20 w-64 rounded-lg border border-slate-700 bg-slate-900 p-3 text-[11px] font-normal leading-5 text-slate-300 shadow-xl">{zh ? "每售出一件商品产生的固定金额费用，例如每单交易手续费、支付渠道固定手续费或每件处理费；没有此类费用时填写 0。" : "A fixed amount charged for each item sold, such as a per-order transaction fee, payment processing fee, or per-item handling fee. Enter 0 when none applies."}</span>}<span className="relative block"><input type="number" step="0.01" value={pricing[key]} onChange={(event) => props.onPricing({ ...pricing, [key]: Number(event.target.value) })} className={`property-input ${hasCurrencyUnit ? "pr-14" : ""}`} />{hasCurrencyUnit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-500">{pricing.saleCurrency}</span>}</span></label>;
  })}</div>{sample && <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3 text-xs"><p className="text-slate-500">{scopeLabel}</p><div className="mt-2 grid grid-cols-3 gap-2"><span>{zh ? "建议售价" : "Suggested price"} <b className="block text-slate-100">{sample.price.toFixed(2)} {pricing.saleCurrency}</b></span><span>{zh ? "预计利润" : "Profit"} <b className="block text-slate-100">{sample.profit.toFixed(2)} {pricing.saleCurrency}</b></span><span>{zh ? "利润率" : "Margin"} <b className="block text-slate-100">{sample.margin.toFixed(1)}%</b></span></div></div>}<button onClick={() => props.onReprice("all")} className="tool-primary w-full justify-center">{recalculateLabel}</button>{priceNotice && <p className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-2 text-xs text-emerald-200">{priceNotice}</p>}</>;
  const content = <div className="space-y-3">{currencyModule}<PropertyCard title={zh ? "售价计算" : "Price calculation"}><div className="space-y-3">{pricingControls}</div></PropertyCard></div>;
  return props.embedded ? content : content;
}

function PropertyCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-semibold">{title}</h4>{children}</section>;
}
function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}
function Pager({ page, count, total, zh, onPage }: { page: number; count: number; total: number; zh: boolean; onPage: (page: number) => void }) {
  return <div className="mt-4 flex items-center justify-between text-xs"><span className="text-slate-500">{total} {zh ? "项" : "items"}</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronLeft className="size-4" /></button><span>{page} / {count}</span><button disabled={page >= count} onClick={() => onPage(page + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronRight className="size-4" /></button></div></div>;
}
function WorkspaceImage({ value, consent, zh, onRequest, onPreview }: { value: string; consent: boolean; zh: boolean; onRequest: () => void; onPreview: (url: string) => void }) {
  const [failed, setFailed] = useState(false);
  if (!isSafeWorkspaceImage(value)) return <span title={zh ? "无有效 HTTPS 图片" : "No valid HTTPS image"} className="flex size-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><ImageIcon className="size-5" /></span>;
  if (!consent || failed) return <button type="button" aria-label={zh ? "点击加载商品图片" : "Click to load product image"} title={failed ? (zh ? "加载失败，点击重试" : "Failed; click to retry") : (zh ? "点击后确认加载外部图片" : "Click to confirm external image loading")} onClick={() => { setFailed(false); if (!consent) onRequest(); }} className="flex size-11 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100 text-slate-500 hover:border-cyan-500 hover:text-cyan-700"><LockKeyhole className="size-4" /></button>;
  return <button type="button" aria-label={zh ? "查看商品图片" : "View product image"} onClick={() => onPreview(value)} className="overflow-hidden rounded-lg"><img src={value} alt="" loading="lazy" referrerPolicy="no-referrer" crossOrigin="anonymous" onError={() => setFailed(true)} className="size-11 object-cover" /></button>;
}
function WorkspaceInput({ field, value, onChange, placeholder }: { field: WorkspaceFieldDefinition; value?: FieldValue; onChange: (value: FieldValue) => void; placeholder?: string }) {
  const classes = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";
  if (field.type === "boolean") return <label className="mt-1 flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />{field.label}</label>;
  if (field.type === "single-select") return <select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className={classes}><option value="">—</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select>;
  if (["description", "additionalImages", "variants"].includes(field.role)) return <textarea rows={3} value={fieldValue(value)} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`${classes} resize-y`} />;
  return <input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={fieldValue(value)} placeholder={placeholder} onChange={(event) => onChange(field.type === "number" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value)} className={classes} />;
}
function ConsentDialog({ zh, onClose, onAllow }: { zh: boolean; onClose: () => void; onAllow: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl"><LockKeyhole className="size-6 text-cyan-300" /><h2 className="mt-3 text-lg font-semibold">{zh ? "加载外部商品图片？" : "Load external product images?"}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{zh ? "浏览器将直接访问表格中的 HTTPS 图片地址，图片网站可能获取你的 IP 地址和请求时间。" : "Your browser will contact HTTPS image hosts directly. They may receive your IP address and request time."}</p><div className="mt-6 flex gap-3"><button onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-slate-700 font-semibold">{zh ? "取消" : "Cancel"}</button><button onClick={onAllow} className="min-h-11 flex-1 rounded-xl bg-cyan-600 font-semibold">{zh ? "允许本次会话加载" : "Allow this session"}</button></div></div></div>;
}
