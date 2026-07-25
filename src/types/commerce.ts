import type { ImageFormat } from "./media";

export type CommerceStage =
  | "idle" | "preparing-model" | "analyzing" | "segmenting"
  | "composing" | "exporting" | "packaging" | "done" | "error" | "cancelled";

export type QualityWarning = "low-resolution" | "soft-focus" | "underexposed" | "overexposed" | "subject-review";
export type SubjectExtractionMode = "original" | "standard" | "precise";

export type PhotoQualityReport = {
  width: number;
  height: number;
  sharpness: number;
  brightness: number;
  score: number;
  warnings: QualityWarning[];
};

export type ProductPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  quality?: PhotoQualityReport;
};

export type ProductGroup = {
  id: string;
  name: string;
  photoIds: string[];
  primaryPhotoId?: string;
};

export type MarketplaceId =
  | "universal" | "taobao" | "jd" | "pdd" | "douyin"
  | "amazon" | "shopify" | "ebay" | "etsy" | "walmart" | "aliexpress"
  | "temu" | "shein" | "shopee" | "lazada" | "tiktok-shop" | "mercado-libre";

export type MarketplacePreset = {
  id: string;
  marketplace: MarketplaceId;
  label: { zh: string; en: string };
  role: "main" | "detail" | "thumbnail";
  width: number;
  height: number;
  format: ImageFormat;
  background: "transparent" | "white" | "brand" | "studio";
  subjectOccupancy: number;
  quality: number;
  allowOverlays?: boolean;
};

export type CompressionProfile = "high" | "balanced" | "light" | "custom";

export type CommerceCompressionSettings = {
  enabled: boolean;
  profile: CompressionProfile;
  quality: number;
};

export type LogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type LogoWatermarkSettings = {
  enabled: boolean;
  position: LogoPosition;
  opacity: number;
  scale: number;
  margin: number;
};

export type BrandKit = {
  primaryColor: string;
  secondaryColor: string;
  shadowStrength: number;
  watermark: string;
  badge: string;
  logoWatermark: LogoWatermarkSettings;
};

export type CommerceAsset = {
  id: string;
  groupId: string;
  photoId: string;
  presetId: string;
  marketplace: MarketplaceId | "source";
  role: string;
  fileName: string;
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  warnings: QualityWarning[];
  outputQuality: number;
  sourceSize: number;
  uncompressedSize: number;
  logoStatus: "applied" | "excluded" | "disabled";
};

export type CommerceProject = {
  name: string;
  photos: ProductPhoto[];
  groups: ProductGroup[];
  presetIds: string[];
  brandKit: BrandKit;
  compression: CommerceCompressionSettings;
  logoFile?: File;
  subjectMode: SubjectExtractionMode;
};

export type CommerceManifest = {
  version: "2.0.0";
  project: string;
  generatedAt: string;
  localProcessing: true;
  assets: Array<Omit<CommerceAsset, "blob" | "previewUrl">>;
};

export type CommerceProgress = {
  stage: CommerceStage;
  current: number;
  total: number;
  message: string;
};

export type CommerceStagePresentation = {
  label: { zh: string; en: string };
  description: { zh: string; en: string };
};

export type DeliverySummary = {
  productCount: number;
  photoCount: number;
  platformCount: number;
  outputCount: number;
  reviewCount: number;
  outputBytes: number;
};
