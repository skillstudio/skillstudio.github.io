import {
  Crop,
  FileImage,
  ImageDown,
  Maximize,
  RefreshCcw,
  Stamp,
  Store,
  Sheet,
  type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "../i18n/translations";

export type ToolStatus = "available" | "planned";

export type Tool = {
  nameKey: TranslationKey;
  path: string;
  descriptionKey: TranslationKey;
  status: ToolStatus;
  icon: LucideIcon;
};

export const tools: Tool[] = [
  {
    nameKey: "spreadsheetAgent",
    path: "/spreadsheet-agent",
    descriptionKey: "spreadsheetAgentDesc",
    status: "available",
    icon: Sheet,
  },
  {
    nameKey: "commerceStudio",
    path: "/commerce-studio",
    descriptionKey: "commerceStudioDesc",
    status: "available",
    icon: Store,
  },
  {
    nameKey: "compressor",
    path: "/compress",
    descriptionKey: "compressorDesc",
    status: "available",
    icon: ImageDown,
  },
  {
    nameKey: "pdf",
    path: "/pdf-to-image",
    descriptionKey: "pdfDesc",
    status: "available",
    icon: FileImage,
  },
  {
    nameKey: "resize",
    path: "/image-resize",
    descriptionKey: "resizeDesc",
    status: "available",
    icon: Maximize,
  },
  {
    nameKey: "converter",
    path: "/image-converter",
    descriptionKey: "converterDesc",
    status: "available",
    icon: RefreshCcw,
  },
  {
    nameKey: "crop",
    path: "/image-crop",
    descriptionKey: "cropDesc",
    status: "available",
    icon: Crop,
  },
  {
    nameKey: "watermark",
    path: "/image-watermark",
    descriptionKey: "watermarkDesc",
    status: "available",
    icon: Stamp,
  },
];
