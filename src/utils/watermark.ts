import type { ExportOptions, ProcessedAsset } from "../types/media";
import { canvasToBlob, createCanvas, decodeImage, fillExportBackground, outputName } from "./imageProcessing";

export type WatermarkSettings = {
  kind: "text" | "logo";
  text: string;
  color: string;
  opacity: number;
  scale: number;
  rotation: number;
  position: string;
  margin: number;
  shadow: boolean;
  tiled: boolean;
  gapX: number;
  gapY: number;
  staggered: boolean;
};

function positionPoint(position: string, width: number, height: number, markWidth: number, markHeight: number, margin: number) {
  const horizontal = position.endsWith("left") ? margin : position.endsWith("right") ? width - markWidth - margin : (width - markWidth) / 2;
  const vertical = position.startsWith("top") ? margin : position.startsWith("bottom") ? height - markHeight - margin : (height - markHeight) / 2;
  return { x: horizontal, y: vertical };
}

export async function applyWatermark(
  file: File,
  logoFile: File | null,
  settings: WatermarkSettings,
  options: ExportOptions,
): Promise<ProcessedAsset> {
  const image = await decodeImage(file);
  const logo = settings.kind === "logo" && logoFile ? await decodeImage(logoFile) : null;
  try {
    const { canvas, context } = createCanvas(image.width, image.height);
    fillExportBackground(context, canvas.width, canvas.height, options);
    context.drawImage(image, 0, 0);
    context.globalAlpha = settings.opacity / 100;
    if (settings.shadow) {
      context.shadowColor = "rgba(0,0,0,.5)";
      context.shadowBlur = Math.max(2, image.width * 0.004);
      context.shadowOffsetY = Math.max(1, image.width * 0.002);
    }

    const fontSize = Math.max(12, image.width * settings.scale / 100);
    context.font = `600 ${fontSize}px Inter, sans-serif`;
    context.fillStyle = settings.color;
    context.textBaseline = "top";
    const markWidth = logo ? image.width * settings.scale / 100 : context.measureText(settings.text || "ImgSkills").width;
    const markHeight = logo ? markWidth * logo.height / logo.width : fontSize * 1.2;

    const draw = (x: number, y: number) => {
      context.save();
      context.translate(x + markWidth / 2, y + markHeight / 2);
      context.rotate(settings.rotation * Math.PI / 180);
      if (logo) context.drawImage(logo, -markWidth / 2, -markHeight / 2, markWidth, markHeight);
      else context.fillText(settings.text || "ImgSkills", -markWidth / 2, -markHeight / 2);
      context.restore();
    };

    if (settings.tiled) {
      const stepX = markWidth + settings.gapX;
      const stepY = markHeight + settings.gapY;
      let row = 0;
      for (let y = -markHeight; y < image.height + markHeight; y += stepY) {
        const offset = settings.staggered && row % 2 ? stepX / 2 : 0;
        for (let x = -markWidth + offset; x < image.width + markWidth; x += stepX) draw(x, y);
        row += 1;
      }
    } else {
      const point = positionPoint(settings.position, image.width, image.height, markWidth, markHeight, settings.margin);
      draw(point.x, point.y);
    }
    context.globalAlpha = 1;
    const blob = await canvasToBlob(canvas, options);
    return {
      blob,
      fileName: outputName(file.name, "watermarked", options.format),
      mimeType: options.format,
      width: canvas.width,
      height: canvas.height,
      originalSize: file.size,
      outputSize: blob.size,
    };
  } finally {
    image.close();
    logo?.close();
  }
}
