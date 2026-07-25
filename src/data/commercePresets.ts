import type { MarketplacePreset } from "../types/commerce";

export const commercePresets: MarketplacePreset[] = [
  { id: "universal-cutout", marketplace: "universal", label: { zh: "透明底商品素材", en: "Transparent product cutout" }, role: "main", width: 1600, height: 1600, format: "image/png", background: "transparent", subjectOccupancy: 0.82, quality: 100 },
  { id: "universal-main", marketplace: "universal", label: { zh: "通用商城主图", en: "Universal main" }, role: "main", width: 1600, height: 1600, format: "image/jpeg", background: "white", subjectOccupancy: 0.82, quality: 92 },
  { id: "universal-brand", marketplace: "universal", label: { zh: "品牌色营销主图", en: "Branded marketing image" }, role: "main", width: 1600, height: 1600, format: "image/jpeg", background: "brand", subjectOccupancy: 0.78, quality: 92 },
  { id: "universal-studio", marketplace: "universal", label: { zh: "摄影棚营销主图", en: "Studio marketing image" }, role: "main", width: 1600, height: 1600, format: "image/jpeg", background: "studio", subjectOccupancy: 0.78, quality: 92 },
  { id: "universal-detail", marketplace: "universal", label: { zh: "通用 3:4 详情图", en: "Universal 3:4 detail" }, role: "detail", width: 1200, height: 1600, format: "image/jpeg", background: "brand", subjectOccupancy: 0.76, quality: 92 },
  { id: "universal-thumbnail", marketplace: "universal", label: { zh: "商品列表缩略图", en: "Product thumbnail" }, role: "thumbnail", width: 480, height: 480, format: "image/jpeg", background: "white", subjectOccupancy: 0.84, quality: 88 },
  { id: "taobao-main", marketplace: "taobao", label: { zh: "淘宝 / 天猫主图", en: "Taobao / Tmall main" }, role: "main", width: 800, height: 800, format: "image/jpeg", background: "white", subjectOccupancy: 0.82, quality: 92 },
  { id: "taobao-detail", marketplace: "taobao", label: { zh: "淘宝 / 天猫详情图", en: "Taobao / Tmall detail" }, role: "detail", width: 750, height: 1000, format: "image/jpeg", background: "brand", subjectOccupancy: 0.76, quality: 92 },
  { id: "jd-main", marketplace: "jd", label: { zh: "京东主图", en: "JD main" }, role: "main", width: 800, height: 800, format: "image/jpeg", background: "white", subjectOccupancy: 0.82, quality: 92 },
  { id: "pdd-main", marketplace: "pdd", label: { zh: "拼多多主图", en: "Pinduoduo main" }, role: "main", width: 800, height: 800, format: "image/jpeg", background: "white", subjectOccupancy: 0.82, quality: 92 },
  { id: "douyin-square", marketplace: "douyin", label: { zh: "抖音商城方图", en: "Douyin square" }, role: "main", width: 600, height: 600, format: "image/jpeg", background: "studio", subjectOccupancy: 0.8, quality: 92 },
  { id: "douyin-portrait", marketplace: "douyin", label: { zh: "抖音商城竖图", en: "Douyin portrait" }, role: "detail", width: 1242, height: 1660, format: "image/jpeg", background: "brand", subjectOccupancy: 0.76, quality: 92 },
  { id: "amazon-main", marketplace: "amazon", label: { zh: "Amazon 白底主图", en: "Amazon white main" }, role: "main", width: 2000, height: 2000, format: "image/jpeg", background: "white", subjectOccupancy: 0.85, quality: 94, allowOverlays: false },
  { id: "shopify-main", marketplace: "shopify", label: { zh: "Shopify 主图", en: "Shopify main" }, role: "main", width: 2048, height: 2048, format: "image/jpeg", background: "studio", subjectOccupancy: 0.8, quality: 92 },
  { id: "ebay-main", marketplace: "ebay", label: { zh: "eBay 主图", en: "eBay main" }, role: "main", width: 1600, height: 1600, format: "image/jpeg", background: "white", subjectOccupancy: 0.82, quality: 92, allowOverlays: false },
  { id: "etsy-main", marketplace: "etsy", label: { zh: "Etsy 主图", en: "Etsy main" }, role: "main", width: 2000, height: 2000, format: "image/jpeg", background: "studio", subjectOccupancy: 0.78, quality: 92 },
  { id: "walmart-main", marketplace: "walmart", label: { zh: "Walmart 白底主图", en: "Walmart white main" }, role: "main", width: 2000, height: 2000, format: "image/jpeg", background: "white", subjectOccupancy: 0.85, quality: 94, allowOverlays: false },
  { id: "aliexpress-main", marketplace: "aliexpress", label: { zh: "AliExpress 主图", en: "AliExpress main" }, role: "main", width: 1000, height: 1000, format: "image/jpeg", background: "white", subjectOccupancy: 0.84, quality: 92, allowOverlays: false },
  { id: "temu-main", marketplace: "temu", label: { zh: "Temu 主图", en: "Temu main" }, role: "main", width: 1600, height: 1600, format: "image/jpeg", background: "white", subjectOccupancy: 0.84, quality: 92, allowOverlays: false },
  { id: "shein-main", marketplace: "shein", label: { zh: "SHEIN 竖版主图", en: "SHEIN portrait main" }, role: "main", width: 1340, height: 1785, format: "image/jpeg", background: "white", subjectOccupancy: 0.78, quality: 92, allowOverlays: false },
  { id: "shopee-main", marketplace: "shopee", label: { zh: "Shopee 主图", en: "Shopee main" }, role: "main", width: 1200, height: 1200, format: "image/jpeg", background: "white", subjectOccupancy: 0.82, quality: 92, allowOverlays: false },
  { id: "lazada-main", marketplace: "lazada", label: { zh: "Lazada 主图", en: "Lazada main" }, role: "main", width: 1200, height: 1200, format: "image/jpeg", background: "white", subjectOccupancy: 0.82, quality: 92, allowOverlays: false },
  { id: "tiktok-shop-main", marketplace: "tiktok-shop", label: { zh: "TikTok Shop 主图", en: "TikTok Shop main" }, role: "main", width: 1200, height: 1200, format: "image/jpeg", background: "white", subjectOccupancy: 0.82, quality: 92, allowOverlays: false },
  { id: "mercado-libre-main", marketplace: "mercado-libre", label: { zh: "Mercado Libre 主图", en: "Mercado Libre main" }, role: "main", width: 1200, height: 1200, format: "image/jpeg", background: "white", subjectOccupancy: 0.82, quality: 92, allowOverlays: false },
];

export const defaultCommercePresetIds = [
  "universal-cutout", "universal-main", "universal-brand", "universal-studio",
  "universal-detail", "universal-thumbnail", "taobao-main", "amazon-main",
];
