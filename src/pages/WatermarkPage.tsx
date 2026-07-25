import { Stamp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BatchResults } from "../components/BatchResults";
import { ExportControls } from "../components/ExportControls";
import { FileDropzone } from "../components/FileDropzone";
import { ToolLayout } from "../components/ToolLayout";
import { useBatchProcessing } from "../hooks/useBatchProcessing";
import { useLanguage } from "../i18n/LanguageContext";
import type { ExportOptions } from "../types/media";
import { isSupportedImage } from "../utils/imageProcessing";
import { applyWatermark, type WatermarkSettings } from "../utils/watermark";

const positions = ["top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"];

export function WatermarkPage() {
  const { language, t } = useLanguage();
  const zh = language === "zh";
  const [files, setFiles] = useState<File[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [settings, setSettings] = useState<WatermarkSettings>({
    kind: "text", text: "ImgSkills", color: "#ffffff", opacity: 65, scale: 5,
    rotation: -15, position: "bottom-right", margin: 32, shadow: true,
    tiled: false, gapX: 120, gapY: 100, staggered: true,
  });
  const [options, setOptions] = useState<ExportOptions>({ format: "image/jpeg", quality: 90, backgroundColor: "#ffffff" });

  useEffect(() => {
    if (!files[0]) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(files[0]);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [files]);

  useEffect(() => {
    if (!logoFile) { setLogoUrl(""); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const processor = useCallback(async (file: File) => {
    if (!isSupportedImage(file)) throw new Error("JPG, PNG, and WEBP only");
    if (settings.kind === "logo" && !logoFile) throw new Error(zh ? "请先选择 Logo" : "Choose a logo first");
    return applyWatermark(file, logoFile, settings, options);
  }, [logoFile, options, settings]);
  const batch = useBatchProcessing(processor);
  const previewStyle = useMemo(() => ({
    opacity: settings.opacity / 100,
    transform: `rotate(${settings.rotation}deg)`,
    color: settings.color,
    fontSize: `${Math.max(14, settings.scale * 3)}px`,
    textShadow: settings.shadow ? "0 2px 8px rgba(0,0,0,.65)" : "none",
  }), [settings]);
  const previewMark = settings.kind === "logo" && logoUrl
    ? <img src={logoUrl} alt="" style={previewStyle} className="max-h-14 max-w-24 object-contain" />
    : <span style={previewStyle} className="whitespace-nowrap font-semibold">{settings.text}</span>;

  const controls = (
    <>
      <div className="grid grid-cols-2 gap-2">
        {(["text", "logo"] as const).map((kind) => (
          <button key={kind} className={`min-h-10 rounded-lg border text-sm font-semibold ${settings.kind === kind ? "bg-slate-950 text-white" : "border-slate-300"}`} onClick={() => setSettings({ ...settings, kind })}>{kind === "text" ? (zh ? "文字" : "Text") : "Logo"}</button>
        ))}
      </div>
      {settings.kind === "text" ? (
        <label className="block text-sm font-medium">{zh ? "水印文字" : "Watermark text"}<input className="mt-2 w-full rounded-lg border p-2" value={settings.text} onChange={(e) => setSettings({ ...settings, text: e.target.value })} /></label>
      ) : (
        <label className="block text-sm font-medium">{zh ? "Logo 图片" : "Logo image"}<input className="mt-2 block w-full text-xs" type="file" accept="image/png,image/webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} /></label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">{zh ? "颜色" : "Color"}<input className="mt-2 block size-10" type="color" value={settings.color} onChange={(e) => setSettings({ ...settings, color: e.target.value })} /></label>
        <label className="text-sm font-medium">{zh ? "边距" : "Margin"}<input className="mt-2 w-full rounded-lg border p-2" type="number" min="0" value={settings.margin} onChange={(e) => setSettings({ ...settings, margin: Number(e.target.value) })} /></label>
      </div>
      {[
        [zh ? "透明度" : "Opacity", "opacity", 10, 100, 5],
        [zh ? "缩放" : "Scale", "scale", 2, 25, 1],
        [zh ? "旋转" : "Rotation", "rotation", -180, 180, 1],
      ].map(([label, key, min, max, step]) => (
        <label key={String(key)} className="block text-sm font-medium">{label}: {settings[key as keyof WatermarkSettings] as number}
          <input className="mt-2 w-full accent-cyan-700" type="range" min={Number(min)} max={Number(max)} step={Number(step)} value={settings[key as "opacity" | "scale" | "rotation"]} onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })} />
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={settings.shadow} onChange={(e) => setSettings({ ...settings, shadow: e.target.checked })} /> {zh ? "阴影" : "Shadow"}</label>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={settings.tiled} onChange={(e) => setSettings({ ...settings, tiled: e.target.checked })} /> {zh ? "平铺水印" : "Tiled watermark"}</label>
      {settings.tiled ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium">{zh ? "横向间距" : "Horizontal gap"}<input className="mt-1 w-full rounded border p-2" type="number" value={settings.gapX} onChange={(e) => setSettings({ ...settings, gapX: Number(e.target.value) })} /></label>
          <label className="text-xs font-medium">{zh ? "纵向间距" : "Vertical gap"}<input className="mt-1 w-full rounded border p-2" type="number" value={settings.gapY} onChange={(e) => setSettings({ ...settings, gapY: Number(e.target.value) })} /></label>
          <label className="col-span-2 flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={settings.staggered} onChange={(e) => setSettings({ ...settings, staggered: e.target.checked })} /> {zh ? "错位排列" : "Stagger rows"}</label>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {positions.map((position) => <button key={position} aria-label={position} className={`h-8 rounded border ${settings.position === position ? "bg-slate-950" : "bg-slate-100"}`} onClick={() => setSettings({ ...settings, position })} />)}
        </div>
      )}
      <ExportControls value={options} onChange={setOptions} />
      <button className="min-h-11 w-full rounded-lg bg-cyan-700 font-semibold text-white disabled:opacity-40" disabled={!files.length} onClick={() => void batch.processFiles(files)}>{t("process")}</button>
    </>
  );

  return (
    <ToolLayout icon={Stamp} title={t("watermark")} description={t("watermarkDesc")} controls={controls}>
      <FileDropzone accept="image/jpeg,image/png,image/webp" detail={zh ? "JPG、PNG、WEBP · 支持批量水印" : "JPG, PNG, WEBP · batch watermark"} onFiles={setFiles} />
      {previewUrl && (
        <div className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-4">
          <img src={previewUrl} alt="Watermark preview" className="max-h-[32rem] max-w-full rounded object-contain" />
          {settings.tiled ? (
            <div className="pointer-events-none absolute inset-4 grid grid-cols-3 place-items-center gap-10 overflow-hidden">
              {Array.from({ length: 12 }, (_, index) => <div key={index} className={settings.staggered && Math.floor(index / 3) % 2 ? "translate-x-8" : ""}>{previewMark}</div>)}
            </div>
          ) : (
            <div className={`pointer-events-none absolute inset-6 flex ${settings.position.includes("top") ? "items-start" : settings.position.includes("bottom") ? "items-end" : "items-center"} ${settings.position.includes("left") ? "justify-start" : settings.position.includes("right") ? "justify-end" : "justify-center"}`}>
              {previewMark}
            </div>
          )}
        </div>
      )}
      <BatchResults jobs={batch.jobs} zipName="imgskills-watermarked.zip" onCancel={batch.cancel} />
    </ToolLayout>
  );
}
