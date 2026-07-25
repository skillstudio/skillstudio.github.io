import type { ProcessedAsset } from "../types/media";

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function downloadAssetsZip(
  assets: ProcessedAsset[],
  fileName = "imgskills-results.zip",
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const asset of assets) zip.file(asset.fileName, asset.blob);
  downloadBlob(await zip.generateAsync({ type: "blob" }), fileName);
}
