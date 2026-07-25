import { Crop, Download, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { ExportControls } from "../components/ExportControls";
import { FileDropzone } from "../components/FileDropzone";
import { ToolLayout } from "../components/ToolLayout";
import { useLanguage } from "../i18n/LanguageContext";
import type { CropArea, ExportOptions, ProcessedAsset } from "../types/media";
import { downloadBlob } from "../utils/download";
import { cropImage, isSupportedImage } from "../utils/imageProcessing";

const ratios = [
  ["Free", undefined],
  ["1:1", 1],
  ["4:3", 4 / 3],
  ["3:2", 3 / 2],
  ["16:9", 16 / 9],
  ["9:16", 9 / 16],
] as const;

export function CropPage() {
  const { language, t } = useLanguage();
  const zh = language === "zh";
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [area, setArea] = useState<CropArea | null>(null);
  const [result, setResult] = useState<ProcessedAsset | null>(null);
  const [options, setOptions] = useState<ExportOptions>({
    format: "image/png", quality: 90, backgroundColor: "#ffffff",
  });

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  function select(files: File[]) {
    const next = files[0];
    if (!next || !isSupportedImage(next)) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setFile(next);
    setSourceUrl(URL.createObjectURL(next));
    setResult(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }

  async function exportCrop() {
    if (!file || !area) return;
    setResult(await cropImage(file, area, rotation, options));
  }

  const controls = (
    <>
      <div>
        <div className="text-sm font-medium">{zh ? "裁剪比例" : "Aspect ratio"}</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {ratios.map(([label, value]) => (
            <button key={label} className={`rounded-lg border p-2 text-xs font-semibold ${aspect === value ? "bg-slate-950 text-white" : "border-slate-300"}`} onClick={() => setAspect(value)}>{label === "Free" && zh ? "自由比例" : label}</button>
          ))}
        </div>
      </div>
      <label className="block text-sm font-medium">{zh ? "缩放" : "Zoom"} {zoom.toFixed(1)}×<input className="mt-2 w-full accent-cyan-700" type="range" min="1" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
      <label className="block text-sm font-medium">{zh ? "旋转" : "Rotation"} {rotation}°<input className="mt-2 w-full accent-cyan-700" type="range" min="-180" max="180" value={rotation} onChange={(e) => setRotation(Number(e.target.value))} /></label>
      <button className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 text-sm font-semibold" onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); }}>
        <RotateCcw className="size-4" /> {t("reset")}
      </button>
      <ExportControls value={options} onChange={setOptions} />
      <button className="min-h-11 w-full rounded-lg bg-cyan-700 font-semibold text-white disabled:opacity-40" disabled={!area} onClick={() => void exportCrop()}>{t("process")}</button>
    </>
  );

  return (
    <ToolLayout icon={Crop} title={t("crop")} description={t("cropDesc")} controls={controls}>
      {!sourceUrl ? (
        <FileDropzone accept="image/jpeg,image/png,image/webp" multiple={false} detail={zh ? "JPG、PNG、WEBP · 每次处理一张" : "JPG, PNG, WEBP · one image at a time"} onFiles={select} />
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 shadow-sm">
          <div className="relative h-[28rem] overflow-hidden rounded-lg">
            <Cropper
              image={sourceUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_croppedArea: Area, pixels: Area) => setArea(pixels)}
            />
          </div>
          <button className="mt-3 text-sm font-medium text-cyan-300" onClick={() => { setFile(null); setSourceUrl(""); setResult(null); }}>{zh ? "选择其他图片" : "Choose another image"}</button>
        </div>
      )}
      {result && (
        <div className="rounded-xl bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{result.width}×{result.height}</p>
            <button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white" onClick={() => downloadBlob(result.blob, result.fileName)}>
              <Download className="size-4" /> {t("download")}
            </button>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
