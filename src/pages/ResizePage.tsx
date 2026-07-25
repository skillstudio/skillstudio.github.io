import { Maximize } from "lucide-react";
import { useCallback, useState } from "react";
import { BatchResults } from "../components/BatchResults";
import { ExportControls } from "../components/ExportControls";
import { FileDropzone } from "../components/FileDropzone";
import { ToolLayout } from "../components/ToolLayout";
import { useBatchProcessing } from "../hooks/useBatchProcessing";
import { useLanguage } from "../i18n/LanguageContext";
import type { ExportOptions } from "../types/media";
import { decodeImage, isSupportedImage, renderImage } from "../utils/imageProcessing";

const presets = [
  ["Instagram", 1080, 1080],
  ["Story", 1080, 1920],
  ["YouTube", 1280, 720],
  ["App Store", 1242, 2688],
] as const;

export function ResizePage() {
  const { language, t } = useLanguage();
  const zh = language === "zh";
  const [mode, setMode] = useState<"pixels" | "percent">("pixels");
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(1200);
  const [percent, setPercent] = useState(50);
  const [lockRatio, setLockRatio] = useState(true);
  const [options, setOptions] = useState<ExportOptions>({
    format: "image/webp", quality: 85, backgroundColor: "#ffffff",
  });

  const processor = useCallback(async (file: File) => {
    if (!isSupportedImage(file)) throw new Error("JPG, PNG, and WEBP only");
    const image = await decodeImage(file);
    let targetWidth = mode === "percent" ? image.width * percent / 100 : width;
    let targetHeight = mode === "percent" ? image.height * percent / 100 : height;
    if (mode === "pixels" && lockRatio) targetHeight = targetWidth * image.height / image.width;
    image.close();
    return renderImage(file, targetWidth, targetHeight, options, "resized");
  }, [height, lockRatio, mode, options, percent, width]);
  const batch = useBatchProcessing(processor);

  const controls = (
    <>
      <div className="grid grid-cols-2 gap-2">
        {(["pixels", "percent"] as const).map((item) => (
          <button key={item} className={`min-h-10 rounded-lg border text-sm font-semibold ${mode === item ? "bg-slate-950 text-white" : "border-slate-300"}`} onClick={() => setMode(item)}>
            {item === "pixels" ? (zh ? "像素" : "Pixels") : (zh ? "百分比" : "Percent")}
          </button>
        ))}
      </div>
      {mode === "pixels" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium">{zh ? "宽度" : "Width"}<input className="mt-2 w-full rounded-lg border p-2" type="number" min="1" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
          <label className="text-sm font-medium">{zh ? "高度" : "Height"}<input className="mt-2 w-full rounded-lg border p-2 disabled:bg-slate-100" type="number" min="1" value={height} disabled={lockRatio} onChange={(e) => setHeight(Number(e.target.value))} /></label>
        </div>
      ) : (
        <label className="block text-sm font-medium">{zh ? "缩放" : "Scale"}: {percent}%<input className="mt-3 w-full accent-cyan-700" type="range" min="10" max="200" step="5" value={percent} onChange={(e) => setPercent(Number(e.target.value))} /></label>
      )}
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} /> {zh ? "锁定宽高比" : "Lock aspect ratio"}
      </label>
      <div>
        <div className="text-sm font-medium">{zh ? "尺寸预设" : "Presets"}</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {presets.map(([name, presetWidth, presetHeight]) => (
            <button key={name} className="rounded-lg border border-slate-300 p-2 text-xs hover:bg-slate-100" onClick={() => {
              setMode("pixels"); setWidth(presetWidth); setHeight(presetHeight); setLockRatio(false);
            }}>{name}<span className="block text-slate-500">{presetWidth}×{presetHeight}</span></button>
          ))}
        </div>
      </div>
      <ExportControls value={options} onChange={setOptions} />
    </>
  );

  return (
    <ToolLayout icon={Maximize} title={t("resize")} description={t("resizeDesc")} controls={controls}>
      <FileDropzone accept="image/jpeg,image/png,image/webp" detail={zh ? "JPG、PNG、WEBP · 支持批量缩放" : "JPG, PNG, WEBP · batch resize"} onFiles={(files) => void batch.processFiles(files)} />
      <BatchResults jobs={batch.jobs} zipName="imgskills-resized.zip" onCancel={batch.cancel} />
    </ToolLayout>
  );
}
