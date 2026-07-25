import JSZip from "jszip";
import { commercePresets } from "../data/commercePresets";
import type {
  BrandKit, CommerceAsset, CommerceManifest, CommerceProgress, CommerceProject,
  CommerceCompressionSettings, MarketplacePreset, PhotoQualityReport, ProductPhoto, QualityWarning,
} from "../types/commerce";
import { canvasToBlob, createCanvas, decodeImage } from "./imageProcessing";

export function safeName(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "untitled";
}

export function suggestedGroupName(fileName: string): string {
  const stem = fileName.replace(/\.[^/.]+$/, "");
  const prefix = stem.split(/[-_\s]/)[0];
  return prefix || "SKU";
}

export function effectiveOutputQuality(
  format: MarketplacePreset["format"],
  presetQuality: number,
  compression: CommerceCompressionSettings,
): number {
  if (format === "image/png") return 100;
  return compression.enabled ? Math.min(100, Math.max(40, compression.quality)) : presetQuality;
}

async function encodeCommerceCanvas(
  canvas: HTMLCanvasElement,
  preset: MarketplacePreset,
  compression: CommerceCompressionSettings,
) {
  const outputQuality = effectiveOutputQuality(preset.format, preset.quality, compression);
  if (!compression.enabled || preset.format === "image/png") {
    const blob = await canvasToBlob(canvas, {
      format: preset.format,
      quality: outputQuality,
      backgroundColor: "#ffffff",
    });
    return { blob, outputQuality, uncompressedSize: blob.size };
  }

  // Compare compression against an identical canvas encoded at maximum
  // quality, never against the uploaded source with different dimensions.
  const baseline = await canvasToBlob(canvas, {
    format: preset.format,
    quality: 100,
    backgroundColor: "#ffffff",
  });
  const compressed = await canvasToBlob(canvas, {
    format: preset.format,
    quality: outputQuality,
    backgroundColor: "#ffffff",
  });
  if (compressed.size <= baseline.size) {
    return { blob: compressed, outputQuality, uncompressedSize: baseline.size };
  }
  return { blob: baseline, outputQuality: 100, uncompressedSize: baseline.size };
}

export function logoStatusFor(
  preset: MarketplacePreset,
  enabled: boolean,
  hasLogo: boolean,
): CommerceAsset["logoStatus"] {
  if (!enabled) return "disabled";
  return hasLogo && preset.allowOverlays !== false && preset.background !== "transparent" ? "applied" : "excluded";
}

export function logoPlacement(
  canvasWidth: number,
  canvasHeight: number,
  logoWidth: number,
  logoHeight: number,
  settings: BrandKit["logoWatermark"],
): { x: number; y: number; width: number; height: number } {
  const width = canvasWidth * settings.scale / 100;
  const height = width * logoHeight / logoWidth;
  const margin = Math.min(canvasWidth, canvasHeight) * settings.margin / 100;
  return {
    x: settings.position.endsWith("left") ? margin : canvasWidth - width - margin,
    y: settings.position.startsWith("top") ? margin : canvasHeight - height - margin,
    width, height,
  };
}

export function qualityWarnings(width: number, height: number, brightness: number, sharpness: number): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  if (Math.min(width, height) < 800) warnings.push("low-resolution");
  if (sharpness < 12) warnings.push("soft-focus");
  if (brightness < 55) warnings.push("underexposed");
  if (brightness > 220) warnings.push("overexposed");
  return warnings;
}

export async function analyzePhoto(photo: ProductPhoto, signal?: AbortSignal): Promise<PhotoQualityReport> {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const image = await decodeImage(photo.file);
  try {
    const sampleWidth = Math.min(160, image.width);
    const sampleHeight = Math.max(1, Math.round(image.height * sampleWidth / image.width));
    const { canvas, context } = createCanvas(sampleWidth, sampleHeight);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let brightnessSum = 0;
    let edgeSum = 0;
    let previous = 0;
    for (let index = 0; index < data.length; index += 4) {
      const luminance = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      brightnessSum += luminance;
      if (index > 0) edgeSum += Math.abs(luminance - previous);
      previous = luminance;
    }
    const pixels = data.length / 4;
    const brightness = brightnessSum / pixels;
    const sharpness = edgeSum / Math.max(1, pixels - 1);
    const warnings = qualityWarnings(image.width, image.height, brightness, sharpness);
    const score = Math.max(0, Math.min(100, 100 - warnings.length * 18 + Math.min(12, sharpness)));
    return { width: image.width, height: image.height, brightness, sharpness, score, warnings };
  } finally {
    image.close();
  }
}

let backgroundPipeline: ((input: string) => Promise<unknown>) | null = null;
type DetectionBox = { xmin: number; ymin: number; xmax: number; ymax: number };
type ProductDetection = { score: number; label: string; box: DetectionBox };

async function getBackgroundPipeline(onProgress?: (progress: number) => void) {
  if (backgroundPipeline) return backgroundPipeline;
  const transformers = await import("@huggingface/transformers");
  if (transformers.env.backends.onnx?.wasm) {
    transformers.env.backends.onnx.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
  }
  const device = "gpu" in navigator ? "webgpu" : "wasm";
  backgroundPipeline = await transformers.pipeline("background-removal", "onnx-community/MVANet-ONNX", {
    device,
    dtype: "q4",
    progress_callback: (event) => {
      if ("progress" in event && typeof event.progress === "number") onProgress?.(Math.round(event.progress));
    },
  }) as unknown as (input: string) => Promise<unknown>;
  return backgroundPipeline;
}

export function chooseProductBox(
  detections: ProductDetection[],
  imageWidth: number,
  imageHeight: number,
): DetectionBox | null {
  const imageArea = imageWidth * imageHeight;
  const candidates = detections.map((item) => {
    const width = Math.max(0, item.box.xmax - item.box.xmin);
    const height = Math.max(0, item.box.ymax - item.box.ymin);
    const coverage = width * height / imageArea;
    const centerX = (item.box.xmin + item.box.xmax) / 2 / imageWidth;
    const centerY = (item.box.ymin + item.box.ymax) / 2 / imageHeight;
    const centerAffinity = 1 - Math.min(1, Math.hypot(centerX - 0.5, centerY - 0.5));
    const plausibleSize = coverage >= 0.04 && coverage <= 0.92 ? 1 : 0.25;
    return { ...item, rank: item.score * (0.65 + centerAffinity * 0.35) * plausibleSize };
  }).sort((a, b) => b.rank - a.rank);
  return candidates[0]?.box ?? null;
}

async function extractPreciseProduct(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; detected: boolean }> {
  const foreground = await removeBackground(file, true, onProgress);
  return refineProductForeground(foreground);
}

function isLikelySkin(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return r > 70 && g > 30 && b > 15 && max - min > 12 && r > g && r > b
    && cb >= 72 && cb <= 132 && cr >= 128 && cr <= 180;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function repairRectangularProductEdges(data: Uint8ClampedArray, width: number, height: number) {
  const rows: Array<{ y: number; left: number; right: number; span: number }> = [];
  for (let y = 0; y < height; y += 1) {
    let left = width;
    let right = -1;
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 96) {
        left = Math.min(left, x);
        right = x;
      }
    }
    if (right >= left) rows.push({ y, left, right, span: right - left + 1 });
  }
  if (rows.length < height * 0.3) return;

  const typicalSpan = median(rows.map((row) => row.span));
  const bodyRows = rows.filter((row) => row.span >= typicalSpan * 0.72);
  if (bodyRows.length < height * 0.28) return;
  const typicalLeft = median(bodyRows.map((row) => row.left));
  const typicalRight = median(bodyRows.map((row) => row.right));
  const typicalWidth = typicalRight - typicalLeft + 1;
  const leftDeviation = median(bodyRows.map((row) => Math.abs(row.left - typicalLeft)));
  const rightDeviation = median(bodyRows.map((row) => Math.abs(row.right - typicalRight)));
  if (typicalWidth < width * 0.18 || leftDeviation + rightDeviation > typicalWidth * 0.12) return;

  const minY = Math.min(...bodyRows.map((row) => row.y));
  const maxY = Math.max(...bodyRows.map((row) => row.y));
  const repairLimit = Math.max(3, Math.round(typicalWidth * 0.08));
  for (const row of bodyRows) {
    if (row.y < minY || row.y > maxY) continue;
    const expectedLeft = Math.round(typicalLeft);
    const expectedRight = Math.round(typicalRight);
    const missingLeft = row.left - expectedLeft;
    const missingRight = expectedRight - row.right;
    if (missingLeft > 0 && missingLeft <= repairLimit) {
      const source = (row.y * width + row.left) * 4;
      for (let x = expectedLeft; x < row.left; x += 1) {
        const target = (row.y * width + x) * 4;
        data[target] = data[source];
        data[target + 1] = data[source + 1];
        data[target + 2] = data[source + 2];
        data[target + 3] = 255;
      }
    }
    if (missingRight > 0 && missingRight <= repairLimit) {
      const source = (row.y * width + row.right) * 4;
      for (let x = row.right + 1; x <= expectedRight; x += 1) {
        const target = (row.y * width + x) * 4;
        data[target] = data[source];
        data[target + 1] = data[source + 1];
        data[target + 2] = data[source + 2];
        data[target + 3] = 255;
      }
    }
  }
}

function refineAlphaEdge(data: Uint8ClampedArray, width: number, height: number) {
  const total = width * height;
  const sourceAlpha = new Uint8Array(total);
  for (let index = 0; index < total; index += 1) sourceAlpha[index] = data[index * 4 + 3];
  const weights = [1, 2, 1, 2, 4, 2, 1, 2, 1];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      let minAlpha = 255;
      let maxAlpha = 0;
      let alphaSum = 0;
      let weightSum = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      let colorWeight = 0;
      let position = 0;

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          const weight = weights[position++];
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighbor = ny * width + nx;
          const alpha = sourceAlpha[neighbor];
          minAlpha = Math.min(minAlpha, alpha);
          maxAlpha = Math.max(maxAlpha, alpha);
          alphaSum += alpha * weight;
          weightSum += weight;
          if (alpha >= 160) {
            const offset = neighbor * 4;
            const opaqueWeight = weight * alpha / 255;
            red += data[offset] * opaqueWeight;
            green += data[offset + 1] * opaqueWeight;
            blue += data[offset + 2] * opaqueWeight;
            colorWeight += opaqueWeight;
          }
        }
      }

      // Interior pixels stay untouched. Only the one-pixel transition around
      // the silhouette receives sub-pixel coverage and color decontamination.
      if (minAlpha >= 250 || maxAlpha <= 5) continue;
      const offset = index * 4;
      const coverage = Math.round(alphaSum / Math.max(1, weightSum));
      data[offset + 3] = coverage <= 6 ? 0 : coverage >= 249 ? 255 : coverage;
      if (colorWeight > 0 && data[offset + 3] < 250) {
        data[offset] = Math.round(red / colorWeight);
        data[offset + 1] = Math.round(green / colorWeight);
        data[offset + 2] = Math.round(blue / colorWeight);
      }
    }
  }
}

async function refineProductForeground(blob: Blob): Promise<{ blob: Blob; detected: boolean }> {
  const image = await decodeImage(blob);
  try {
    const { canvas, context } = createCanvas(image.width, image.height);
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = pixels;
    const total = width * height;
    const skin = new Uint8Array(total);
    const remove = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    for (let index = 0; index < total; index += 1) {
      const offset = index * 4;
      if (data[offset + 3] > 24 && isLikelySkin(data[offset], data[offset + 1], data[offset + 2])) skin[index] = 1;
    }

    const seed = (index: number) => {
      if (!skin[index] || remove[index]) return;
      remove[index] = 1;
      queue[tail++] = index;
    };
    // Background-removal models leave a transparent safety margin, so a hand
    // entering the photo may no longer touch the literal output edge. Seed
    // skin regions from an outer band and then follow only connected skin.
    const bandX = Math.max(1, Math.round(width * 0.12));
    const bandY = Math.max(1, Math.round(height * 0.12));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (x < bandX || x >= width - bandX || y < bandY || y >= height - bandY) {
          seed(y * width + x);
        }
      }
    }

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      if (x > 0) seed(index - 1);
      if (x + 1 < width) seed(index + 1);
      if (y > 0) seed(index - width);
      if (y + 1 < height) seed(index + width);
    }

    // A finger can be separated from the arm by the product itself, so it may
    // not join the first edge-connected component. Remove remaining skin
    // components only when they touch the transparent foreground silhouette;
    // printed warm colors inside an opaque package are therefore preserved.
    const visited = new Uint8Array(total);
    const component = new Int32Array(total);
    for (let start = 0; start < total; start += 1) {
      if (!skin[start] || remove[start] || visited[start]) continue;
      head = 0;
      tail = 0;
      let componentSize = 0;
      let touchesTransparency = false;
      visited[start] = 1;
      queue[tail++] = start;
      while (head < tail) {
        const index = queue[head++];
        component[componentSize++] = index;
        const x = index % width;
        const y = Math.floor(index / width);
        const neighbors = [
          x > 0 ? index - 1 : -1,
          x + 1 < width ? index + 1 : -1,
          y > 0 ? index - width : -1,
          y + 1 < height ? index + width : -1,
        ];
        for (const neighbor of neighbors) {
          if (neighbor < 0 || data[neighbor * 4 + 3] <= 24 || remove[neighbor]) {
            touchesTransparency = true;
            continue;
          }
          if (skin[neighbor] && !remove[neighbor] && !visited[neighbor]) {
            visited[neighbor] = 1;
            queue[tail++] = neighbor;
          }
        }
      }
      if (touchesTransparency && componentSize >= 4) {
        for (let index = 0; index < componentSize; index += 1) remove[component[index]] = 1;
      }
    }

    // Grow by one pixel only; larger erosion makes product edges look retouched.
    const expanded = remove.slice();
    for (let index = 0; index < total; index += 1) {
      if (!remove[index]) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) expanded[ny * width + nx] = 1;
        }
      }
    }

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let kept = 0;
    for (let index = 0; index < total; index += 1) {
      const offset = index * 4;
      if (expanded[index]) data[offset + 3] = 0;
    }
    repairRectangularProductEdges(data, width, height);
    refineAlphaEdge(data, width, height);
    for (let index = 0; index < total; index += 1) {
      const offset = index * 4;
      if (data[offset + 3] <= 24) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      kept += 1;
    }
    context.putImageData(pixels, 0, 0);

    if (kept < total * 0.01 || maxX < minX || maxY < minY) {
      return { blob, detected: false };
    }
    const padding = Math.max(2, Math.round(Math.min(width, height) * 0.01));
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropRight = Math.min(width, maxX + padding + 1);
    const cropBottom = Math.min(height, maxY + padding + 1);
    const { canvas: output, context: outputContext } = createCanvas(cropRight - cropX, cropBottom - cropY);
    outputContext.drawImage(canvas, cropX, cropY, output.width, output.height, 0, 0, output.width, output.height);
    return {
      blob: await canvasToBlob(output, { format: "image/png", quality: 100 }),
      detected: tail > 0,
    };
  } finally {
    image.close();
  }
}

async function removeBackground(
  file: File,
  enabled: boolean,
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  if (!enabled) return file;
  const pipeline = await getBackgroundPipeline(onProgress);
  const sourceUrl = URL.createObjectURL(file);
  try {
    const result = await pipeline(sourceUrl) as Array<{ toBlob?: () => Promise<Blob>; toCanvas?: () => HTMLCanvasElement }>;
    const output = Array.isArray(result) ? result[0] : result;
    if (output?.toBlob) return await output.toBlob();
    if (output?.toCanvas) return await canvasToBlob(output.toCanvas(), { format: "image/png", quality: 100 });
    throw new Error("Background model returned an unsupported result");
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function paintBackground(
  context: CanvasRenderingContext2D,
  preset: MarketplacePreset,
  brand: BrandKit,
): void {
  if (preset.background === "white") {
    context.fillStyle = "#ffffff";
  } else if (preset.background === "transparent") {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    return;
  } else if (preset.background === "brand") {
    const gradient = context.createLinearGradient(0, 0, context.canvas.width, context.canvas.height);
    gradient.addColorStop(0, brand.primaryColor);
    gradient.addColorStop(1, brand.secondaryColor);
    context.fillStyle = gradient;
  } else {
    const gradient = context.createRadialGradient(
      context.canvas.width * 0.5, context.canvas.height * 0.42, 0,
      context.canvas.width * 0.5, context.canvas.height * 0.5, context.canvas.width * 0.72,
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.68, "#eef2f6");
    gradient.addColorStop(1, brand.primaryColor);
    context.fillStyle = gradient;
  }
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
}

export async function composeAsset(
  source: Blob,
  photo: ProductPhoto,
  groupId: string,
  preset: MarketplacePreset,
  brand: BrandKit,
  warnings: QualityWarning[],
  compression: CommerceCompressionSettings,
  logo: ImageBitmap | null,
): Promise<CommerceAsset> {
  const image = await decodeImage(source);
  try {
    const { canvas, context } = createCanvas(preset.width, preset.height);
    paintBackground(context, preset, brand);
    const scale = Math.min(
      canvas.width * preset.subjectOccupancy / image.width,
      canvas.height * preset.subjectOccupancy / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;
    if (brand.shadowStrength > 0) {
      context.save();
      context.filter = `blur(${Math.max(8, canvas.width * 0.012)}px)`;
      context.globalAlpha = brand.shadowStrength / 150;
      context.fillStyle = "#020617";
      context.beginPath();
      context.ellipse(canvas.width / 2, y + height * 0.94, width * 0.33, height * 0.055, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, x, y, width, height);
    if (brand.badge && preset.allowOverlays !== false) {
      context.fillStyle = brand.primaryColor;
      context.beginPath();
      context.roundRect(canvas.width * 0.055, canvas.height * 0.055, canvas.width * 0.25, canvas.height * 0.085, canvas.width * 0.025);
      context.fill();
      context.fillStyle = "#ffffff";
      context.font = `600 ${Math.max(18, Math.round(canvas.width * 0.027))}px system-ui`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(brand.badge.slice(0, 16), canvas.width * 0.18, canvas.height * 0.097);
    }
    if (brand.watermark && preset.allowOverlays !== false) {
      context.save();
      context.globalAlpha = 0.42;
      context.fillStyle = preset.background === "white" ? "#0f172a" : "#ffffff";
      context.font = `600 ${Math.max(14, Math.round(canvas.width * 0.018))}px system-ui`;
      context.textAlign = "right";
      context.fillText(brand.watermark.slice(0, 32), canvas.width * 0.95, canvas.height * 0.95);
      context.restore();
    }
    const logoStatus = logoStatusFor(preset, brand.logoWatermark.enabled, Boolean(logo));
    if (logoStatus === "applied" && logo) {
      const settings = brand.logoWatermark;
      const placement = logoPlacement(canvas.width, canvas.height, logo.width, logo.height, settings);
      context.save();
      context.globalAlpha = settings.opacity / 100;
      context.drawImage(logo, placement.x, placement.y, placement.width, placement.height);
      context.restore();
    }
    const encoded = await encodeCommerceCanvas(canvas, preset, compression);
    const { blob, outputQuality, uncompressedSize } = encoded;
    const extension = preset.format === "image/png" ? "png" : preset.format === "image/webp" ? "webp" : "jpg";
    const fileName = `${preset.role}-${safeName(photo.file.name.replace(/\.[^/.]+$/, ""))}.${extension}`;
    return {
      id: `${groupId}-${photo.id}-${preset.id}`, groupId, photoId: photo.id,
      presetId: preset.id, marketplace: preset.marketplace, role: preset.role,
      fileName, blob, previewUrl: URL.createObjectURL(blob), width: preset.width,
      height: preset.height, warnings, outputQuality, sourceSize: photo.file.size, uncompressedSize, logoStatus,
    };
  } finally {
    image.close();
  }
}

export async function processCommerceProject(
  project: CommerceProject,
  onProgress: (progress: CommerceProgress) => void,
  signal: AbortSignal,
): Promise<CommerceAsset[]> {
  const presets = commercePresets.filter((preset) => project.presetIds.includes(preset.id));
  const total = project.groups.reduce((sum, group) => sum + group.photoIds.length * presets.length, 0);
  const assets: CommerceAsset[] = [];
  let current = 0;
  const preparedLogo = project.brandKit.logoWatermark.enabled && project.logoFile
    ? await decodeImage(project.logoFile)
    : null;
  try {
    for (const group of project.groups) {
      for (const photoId of group.photoIds) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const photo = project.photos.find((item) => item.id === photoId);
      if (!photo) continue;
      onProgress({ stage: "analyzing", current, total, message: photo.file.name });
      const quality = photo.quality ?? await analyzePhoto(photo, signal);
      onProgress({ stage: project.subjectMode === "original" ? "composing" : "preparing-model", current, total, message: photo.file.name });
      let source: Blob = photo.file;
      const outputWarnings = [...quality.warnings];
      try {
        if (project.subjectMode === "precise") {
          const precise = await extractPreciseProduct(photo.file, (modelProgress) => {
            onProgress({ stage: "preparing-model", current: modelProgress, total: 100, message: "Identifying product" });
          });
          source = precise.blob;
          if (!precise.detected) outputWarnings.push("subject-review");
        } else {
          source = await removeBackground(photo.file, project.subjectMode === "standard", (modelProgress) => {
            onProgress({ stage: "preparing-model", current: modelProgress, total: 100, message: "Preparing background processing" });
          });
        }
      } catch (error) {
        console.warn("Product subject extraction failed", error);
        source = photo.file;
        if (project.subjectMode !== "original") outputWarnings.push("subject-review");
      }
        for (const preset of presets) {
          if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
          onProgress({ stage: "composing", current, total, message: preset.label.en });
          assets.push(await composeAsset(source, photo, group.id, preset, project.brandKit, outputWarnings, project.compression, preparedLogo));
          current += 1;
          onProgress({ stage: "exporting", current, total, message: preset.label.en });
        }
      }
    }
  } finally {
    preparedLogo?.close();
  }
  onProgress({ stage: "done", current: total, total, message: "Done" });
  return assets;
}

export async function packageCommerceProject(project: CommerceProject, assets: CommerceAsset[]): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder(safeName(project.name))!;
  for (const asset of assets) {
    const group = project.groups.find((item) => item.id === asset.groupId);
    root.folder(safeName(group?.name || "SKU"))!
      .folder(safeName(asset.marketplace))!
      .file(asset.fileName, asset.blob);
  }
  const manifest: CommerceManifest = {
    version: "2.0.0", project: project.name, generatedAt: new Date().toISOString(),
    localProcessing: true,
    assets: assets.map(({ blob: _blob, previewUrl: _previewUrl, ...asset }) => asset),
  };
  root.file("manifest.json", JSON.stringify(manifest, null, 2));
  root.file("README.txt", "Created with ImgSkills Commerce Studio.\nProduct images were processed on this device and were not uploaded.");
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
