import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { networkInterfaces } from "node:os";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const toolRoutes = [
  "compress",
  "pdf-to-image",
  "image-resize",
  "image-converter",
  "image-crop",
  "image-watermark",
  "commerce-studio",
  "spreadsheet-agent",
];

const routeSeo: Record<string, { title: string; description: string }> = {
  "compress": {
    title: "在线图片压缩工具｜JPG、PNG、WEBP 批量压缩 - ImgSkills",
    description: "批量压缩 JPG、PNG 和 WEBP 图片，可调整输出质量，查看压缩前后体积，并下载单张图片或 ZIP 文件。",
  },
  "pdf-to-image": {
    title: "PDF 转图片工具｜导出 PNG、JPG、长图与宫格图 - ImgSkills",
    description: "将 PDF 页面导出为 PNG 或 JPG，支持页面范围、渲染倍率、逐页图片、长图、宫格图及 ZIP 打包下载。",
  },
  "image-resize": {
    title: "在线图片缩放工具｜批量调整图片尺寸 - ImgSkills",
    description: "按像素或百分比批量调整图片尺寸，支持锁定纵横比、常用尺寸预设、输出格式和质量设置。",
  },
  "image-converter": {
    title: "在线图片格式转换｜JPG、PNG、WEBP 批量转换 - ImgSkills",
    description: "批量转换 JPG、PNG 和 WEBP 图片格式，支持质量调节、透明背景处理及 ZIP 打包下载。",
  },
  "image-crop": {
    title: "在线图片裁剪工具｜比例裁剪、旋转与导出 - ImgSkills",
    description: "在线裁剪图片，支持自由比例及常用比例预设、缩放、旋转、实时预览和多格式导出。",
  },
  "image-watermark": {
    title: "在线图片水印工具｜文字与 Logo 批量水印 - ImgSkills",
    description: "为图片批量添加文字或 Logo 水印，支持位置、透明度、缩放、旋转、阴影和平铺参数设置。",
  },
  "commerce-studio": {
    title: "电商图片批量处理工具｜多平台商品图制作 - ImgSkills",
    description: "批量处理商品原图，完成背景优化、主体构图、平台尺寸适配和结构化 ZIP 交付，覆盖常用国内及跨境电商平台。",
  },
  "spreadsheet-agent": {
    title: "本地 AI 电商表格 Agent｜AliExpress 商品批量导入 - ImgSkills",
    description: "在浏览器本地识别 Excel 与 CSV 商品字段，编辑商品、批量定价并生成 AliExpress 导入工作簿，文件无需上传。",
  },
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function githubPagesRoutes() {
  return {
    name: "github-pages-routes",
    closeBundle() {
      const output = resolve("dist");
      const sourceHtml = readFileSync(resolve(output, "index.html"), "utf8");
      for (const route of toolRoutes) {
        const directory = resolve(output, route);
        mkdirSync(directory, { recursive: true });
        const seo = routeSeo[route];
        const canonicalUrl = `https://imgskills.com/${route}/`;
        const html = sourceHtml
          .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
          .replace(/(<meta\s+name="description"\s+content=")[^"]*("\s*\/>)/, `$1${escapeHtml(seo.description)}$2`)
          .replace(/(<link\s+rel="canonical"\s+href=")[^"]*("\s*\/>)/, `$1${canonicalUrl}$2`)
          .replace(/(<meta\s+property="og:title"\s+content=")[^"]*("\s*\/>)/, `$1${escapeHtml(seo.title)}$2`)
          .replace(/(<meta\s+property="og:description"\s+content=")[^"]*("\s*\/>)/, `$1${escapeHtml(seo.description)}$2`)
          .replace(/(<meta\s+property="og:url"\s+content=")[^"]*("\s*\/>)/, `$1${canonicalUrl}$2`)
          .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*("\s*\/>)/, `$1${escapeHtml(seo.title)}$2`)
          .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*("\s*\/>)/, `$1${escapeHtml(seo.description)}$2`);
        writeFileSync(resolve(directory, "index.html"), html);
      }
    },
  };
}

function getLanAddress(): string {
  const addresses = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);

  return (
    addresses.find((address) => address.startsWith("192.168.")) ??
    addresses.find((address) => address.startsWith("10.")) ??
    addresses.find((address) => address.startsWith("172.")) ??
    addresses[0] ??
    "localhost"
  );
}

export default defineConfig({
  base: "/",
  define: {
    __DEV_LAN_HOST__: JSON.stringify(getLanAddress()),
  },
  plugins: [react(), githubPagesRoutes()],
});
