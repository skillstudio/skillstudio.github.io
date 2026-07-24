import {
  Crop,
  FileImage,
  ImageDown,
  Maximize,
  RefreshCcw,
  Stamp,
  type LucideIcon,
} from "lucide-react";

export type ToolStatus = "available" | "planned";

export type Tool = {
  name: string;
  path: string;
  description: string;
  status: ToolStatus;
  icon: LucideIcon;
};

export const tools: Tool[] = [
  {
    name: "Image Compressor",
    path: "/compress",
    description: "Reduce image size locally with browser-native processing.",
    status: "available",
    icon: ImageDown,
  },
  {
    name: "PDF to Image",
    path: "/pdf-to-image",
    description: "Export pages into sharp image files without uploading.",
    status: "planned",
    icon: FileImage,
  },
  {
    name: "Image Resize",
    path: "/image-resize",
    description: "Resize assets for apps, stores, marketplaces, and social.",
    status: "planned",
    icon: Maximize,
  },
  {
    name: "Image Converter",
    path: "/image-converter",
    description: "Convert between JPG, PNG, and WEBP formats.",
    status: "planned",
    icon: RefreshCcw,
  },
  {
    name: "Image Crop",
    path: "/image-crop",
    description: "Crop images for profiles, products, and publishing.",
    status: "planned",
    icon: Crop,
  },
  {
    name: "Image Watermark",
    path: "/image-watermark",
    description: "Apply local text or brand marks before sharing.",
    status: "planned",
    icon: Stamp,
  },
];
