import { useEffect } from "react";
import type { Language } from "../i18n/translations";

type SeoEntry = {
  zh: { title: string; description: string };
  en: { title: string; description: string };
};

const seoByPath: Record<string, SeoEntry> = {
  "/": {
    zh: {
      title: "ImgSkills 图像技能平台｜图片压缩、格式转换与电商图片处理",
      description: "ImgSkills 提供图片压缩、格式转换、缩放、裁剪、水印、PDF 转图片及电商商品图批量制作工具，支持在线预览与打包下载。",
    },
    en: {
      title: "ImgSkills Image Skills Platform | Practical Image Tools",
      description: "Compress, convert, resize, crop and watermark images, export PDF pages, and prepare marketplace product image packs with ImgSkills.",
    },
  },
  "/commerce-studio": {
    zh: {
      title: "电商图片批量处理工具｜多平台商品图制作 - ImgSkills",
      description: "批量处理商品原图，完成背景优化、主体构图、平台尺寸适配和结构化 ZIP 交付，覆盖常用国内及跨境电商平台。",
    },
    en: {
      title: "Commerce Product Image Studio | Marketplace Image Packs - ImgSkills",
      description: "Prepare product photos for common domestic and cross-border marketplaces with background, framing, sizing, and structured ZIP delivery.",
    },
  },
  "/spreadsheet-agent": {
    zh: {
      title: "本地 AI 电商表格 Agent｜AliExpress 商品批量导入 - ImgSkills",
      description: "在浏览器本地识别 Excel 与 CSV 商品字段，编辑商品、批量定价并生成 AliExpress 导入工作簿，文件无需上传。",
    },
    en: {
      title: "Local AI Commerce Spreadsheet Agent for AliExpress - ImgSkills",
      description: "Normalize Excel and CSV supplier data, edit products, calculate pricing, and create AliExpress import workbooks locally in your browser.",
    },
  },
  "/compress": {
    zh: {
      title: "在线图片压缩工具｜JPG、PNG、WEBP 批量压缩 - ImgSkills",
      description: "批量压缩 JPG、PNG 和 WEBP 图片，可调整输出质量，查看压缩前后体积，并下载单张图片或 ZIP 文件。",
    },
    en: {
      title: "Online Image Compressor for JPG, PNG and WEBP - ImgSkills",
      description: "Compress JPG, PNG and WEBP images in batches, adjust output quality, compare file sizes, and download individual files or a ZIP.",
    },
  },
  "/pdf-to-image": {
    zh: {
      title: "PDF 转图片工具｜导出 PNG、JPG、长图与宫格图 - ImgSkills",
      description: "将 PDF 页面导出为 PNG 或 JPG，支持页面范围、渲染倍率、逐页图片、长图、宫格图及 ZIP 打包下载。",
    },
    en: {
      title: "PDF to Image Converter for PNG, JPG, Long Images and Grids - ImgSkills",
      description: "Export PDF pages to PNG or JPG with page ranges, scale controls, individual images, long composites, grids, and ZIP downloads.",
    },
  },
  "/image-resize": {
    zh: {
      title: "在线图片缩放工具｜批量调整图片尺寸 - ImgSkills",
      description: "按像素或百分比批量调整图片尺寸，支持锁定纵横比、常用尺寸预设、输出格式和质量设置。",
    },
    en: {
      title: "Online Batch Image Resizer with Presets - ImgSkills",
      description: "Resize images in batches by pixels or percentage with aspect-ratio locking, common presets, output formats, and quality controls.",
    },
  },
  "/image-converter": {
    zh: {
      title: "在线图片格式转换｜JPG、PNG、WEBP 批量转换 - ImgSkills",
      description: "批量转换 JPG、PNG 和 WEBP 图片格式，支持质量调节、透明背景处理及 ZIP 打包下载。",
    },
    en: {
      title: "Online JPG, PNG and WEBP Image Converter - ImgSkills",
      description: "Convert JPG, PNG and WEBP images in batches with quality controls, transparency handling, and ZIP downloads.",
    },
  },
  "/image-crop": {
    zh: {
      title: "在线图片裁剪工具｜比例裁剪、旋转与导出 - ImgSkills",
      description: "在线裁剪图片，支持自由比例及常用比例预设、缩放、旋转、实时预览和多格式导出。",
    },
    en: {
      title: "Online Image Cropper with Ratios and Rotation - ImgSkills",
      description: "Crop images with freeform and preset ratios, zoom, rotation, live previews, and multiple export formats.",
    },
  },
  "/image-watermark": {
    zh: {
      title: "在线图片水印工具｜文字与 Logo 批量水印 - ImgSkills",
      description: "为图片批量添加文字或 Logo 水印，支持位置、透明度、缩放、旋转、阴影和平铺参数设置。",
    },
    en: {
      title: "Online Batch Image Watermark Tool for Text and Logos - ImgSkills",
      description: "Apply text or logo watermarks in batches with position, opacity, scale, rotation, shadow, and tiled layout controls.",
    },
  },
};

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function Seo({ pathname, language }: { pathname: string; language: Language }) {
  useEffect(() => {
    const entry = seoByPath[pathname] ?? seoByPath["/"];
    const seo = entry[language];
    const canonicalUrl = new URL(pathname === "/" ? "/" : `${pathname}/`, "https://imgskills.com").toString();

    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title = seo.title;
    setMeta('meta[name="description"]', "name", "description", seo.description);
    setMeta('meta[property="og:title"]', "property", "og:title", seo.title);
    setMeta('meta[property="og:description"]', "property", "og:description", seo.description);
    setMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    setMeta('meta[property="og:locale"]', "property", "og:locale", language === "zh" ? "zh_CN" : "en_US");
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", seo.title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", seo.description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    let structuredData = document.head.querySelector<HTMLScriptElement>("#imgskills-structured-data");
    if (!structuredData) {
      structuredData = document.createElement("script");
      structuredData.id = "imgskills-structured-data";
      structuredData.type = "application/ld+json";
      document.head.appendChild(structuredData);
    }
    structuredData.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": "https://imgskills.com/#website",
          url: "https://imgskills.com/",
          name: "ImgSkills",
          alternateName: language === "zh" ? "图像技能平台" : "Image Skills Platform",
          inLanguage: language === "zh" ? "zh-CN" : "en",
        },
        {
          "@type": "WebApplication",
          "@id": `${canonicalUrl}#application`,
          name: seo.title.split("｜")[0].split(" | ")[0],
          url: canonicalUrl,
          description: seo.description,
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Any",
          browserRequirements: "Requires a modern web browser",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          isPartOf: { "@id": "https://imgskills.com/#website" },
        },
      ],
    });
  }, [language, pathname]);

  return null;
}
