import { Download, FileImage, Loader2, Package } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ExportControls } from "../components/ExportControls";
import { FileDropzone } from "../components/FileDropzone";
import { ToolLayout } from "../components/ToolLayout";
import { useLanguage } from "../i18n/LanguageContext";
import type { ExportOptions, ProcessedAsset } from "../types/media";
import type { CompositeEstimate } from "../types/streaming";
import { downloadAssetsZip, downloadBlob } from "../utils/download";
import { createDownloadSink } from "../utils/fileSink";
import { formatBytes } from "../utils/imageProcessing";
import { composePdfPages, pdfPageCount, renderPdfPages, type PdfOutputMode } from "../utils/pdf";
import { estimatePdfComposite, streamPdfComposite } from "../utils/pdfStreaming";
import { PngStreamingEncoder } from "../utils/pngStream";
import { parsePageRange } from "../utils/pageRange";

export function PdfToImagePage() {
  const { language, t } = useLanguage();
  const zh = language === "zh";
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [range, setRange] = useState("");
  const [scale, setScale] = useState(2);
  const [outputMode, setOutputMode] = useState<PdfOutputMode>("pages");
  const [gridColumns, setGridColumns] = useState(2);
  const [options, setOptions] = useState<ExportOptions>({ format: "image/png", quality: 90, backgroundColor: "#ffffff" });
  const [results, setResults] = useState<ProcessedAsset[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [estimate, setEstimate] = useState<CompositeEstimate | null>(null);
  const [streamedResult, setStreamedResult] = useState(false);
  const [stage, setStage] = useState<"render" | "encode" | "preview">("render");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const urls = results.map((asset) => URL.createObjectURL(asset.blob));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [results]);

  useEffect(() => {
    let active = true;
    setEstimate(null);
    if (!file || !pageCount || outputMode === "pages") return () => { active = false; };
    const timer = window.setTimeout(() => {
      try {
        const pages = parsePageRange(range, pageCount);
        void estimatePdfComposite(file, pages, scale, outputMode, gridColumns, options.format)
          .then((value) => { if (active) setEstimate(value); })
          .catch(() => {});
      } catch { /* validation is shown when processing */ }
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [file, pageCount, range, scale, outputMode, gridColumns, options.format]);

  async function choose(files: File[]) {
    const next = files[0];
    if (!next || next.type !== "application/pdf") return;
    setFile(next); setResults([]); setError(""); setRange("");
    try {
      setPageCount(await pdfPageCount(next));
    } catch {
      setError(zh ? "无法打开此 PDF，文件可能已加密或损坏。" : "Unable to open this PDF. It may be encrypted or damaged.");
    }
  }

  async function process() {
    if (!file || !pageCount) return;
    setError(""); setProcessing(true); setResults([]); setStreamedResult(false); setStage("render");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const pages = parsePageRange(range, pageCount);
      const compositeEstimate = outputMode === "pages" ? null
        : estimate || await estimatePdfComposite(file, pages, scale, outputMode, gridColumns, options.format);
      if (compositeEstimate?.formatError === "jpeg-dimension-limit") {
        throw new Error(zh ? "JPEG 的单边尺寸不能超过 65,535 像素，请改用 PNG 导出原始分辨率。" : "JPEG dimensions cannot exceed 65,535 pixels. Use PNG to preserve the original resolution.");
      }
      if (compositeEstimate?.strategy === "stream") {
        if (outputMode === "pages") throw new Error("Invalid streaming output mode");
        const hasStreamingStorage = typeof CompressionStream !== "undefined"
          && (typeof (window as typeof window & { showSaveFilePicker?: unknown }).showSaveFilePicker === "function"
            || typeof navigator.storage?.getDirectory === "function");
        if (!hasStreamingStorage) {
          throw new Error(zh ? "当前浏览器不支持超大图片流式保存，请使用最新版 Chrome、Edge、Firefox 或 Safari。" : "This browser cannot stream very large image files. Use the latest Chrome, Edge, Firefox, or Safari.");
        }
        if (options.format !== "image/png") {
          throw new Error(zh ? "此 JPEG 尺寸超过浏览器安全编码范围，请改用 PNG 进行无损流式导出。" : "This JPEG exceeds the browser's safe encoding range. Use PNG for lossless streaming export.");
        }
        const stem = file.name.replace(/\.pdf$/i, "");
        const fileName = `${stem}-${outputMode === "long" ? "long-image" : "grid"}.png`;
        const target = await createDownloadSink(fileName);
        const encoder = new PngStreamingEncoder(target.sink);
        setStage("encode");
        setProgress({ done: 0, total: compositeEstimate.height });
        await streamPdfComposite(file, pages, scale, outputMode, gridColumns, encoder, (done, total) => setProgress({ done, total }), controller.signal);
        await target.complete();

        setStage("preview");
        const previewScale = Math.max(0.001, scale * Math.min(1, 2048 / Math.max(compositeEstimate.width, compositeEstimate.height)));
        const previewPages = await renderPdfPages(file, pages, previewScale, { ...options, format: "image/png" }, () => {}, controller.signal);
        const preview = await composePdfPages(previewPages, file.name, outputMode, gridColumns, { ...options, format: "image/png" }, controller.signal);
        setResults([{ ...preview, fileName, width: compositeEstimate.width, height: compositeEstimate.height, outputSize: 0 }]);
        setStreamedResult(true);
        return;
      }
      const total = pages.length + (outputMode === "pages" ? 0 : 1);
      setProgress({ done: 0, total });
      const pageAssets = await renderPdfPages(file, pages, scale, options, (done) => setProgress({ done, total }), controller.signal);
      if (outputMode === "pages") {
        setResults(pageAssets);
      } else {
        const composite = await composePdfPages(pageAssets, file.name, outputMode, gridColumns, options, controller.signal);
        setProgress({ done: total, total });
        setResults([composite]);
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      const message = reason instanceof Error ? reason.message : "";
      setError(message === "Invalid page range" ? (zh ? "页面范围无效，请输入如 1-3,5。" : "Invalid page range. Try 1-3,5.") : message || (zh ? "PDF 导出失败" : "PDF export failed"));
    } finally {
      controllerRef.current = null;
      setProcessing(false);
    }
  }

  const controls = (
    <>
      <label className="block text-sm font-medium">{zh ? "页面范围" : "Pages"}
        <input className="mt-2 w-full rounded-lg border p-2" placeholder={pageCount ? (zh ? `共 ${pageCount} 页，留空导出全部，或输入 1-3,5` : `All ${pageCount} pages, or 1-3,5`) : (zh ? "请先选择 PDF" : "Choose a PDF first")} value={range} disabled={!pageCount} onChange={(e) => setRange(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">{zh ? "渲染倍率" : "Render scale"}
        <select className="mt-2 w-full rounded-lg border p-2" value={scale} onChange={(e) => setScale(Number(e.target.value))}>
          <option value="1">1× · {zh ? "标准" : "Standard"}</option><option value="1.5">1.5× · {zh ? "清晰" : "Sharp"}</option><option value="2">2× · {zh ? "高清" : "High"}</option><option value="3">3× · {zh ? "超清" : "Ultra"}</option>
        </select>
      </label>
      <label className="block text-sm font-medium">{zh ? "输出方式" : "Output layout"}
        <select className="mt-2 w-full rounded-lg border p-2" value={outputMode} onChange={(e) => setOutputMode(e.target.value as PdfOutputMode)}>
          <option value="pages">{zh ? "逐页图片" : "Separate pages"}</option>
          <option value="long">{zh ? "合成一张纵向长图" : "One vertical long image"}</option>
          <option value="grid">{zh ? "合成一张宫格图" : "One grid image"}</option>
        </select>
      </label>
      {outputMode === "grid" && (
        <label className="block text-sm font-medium">{zh ? "宫格列数" : "Grid columns"}
          <select className="mt-2 w-full rounded-lg border p-2" value={gridColumns} onChange={(e) => setGridColumns(Number(e.target.value))}>
            <option value="2">2 {zh ? "列" : "columns"}</option>
            <option value="3">3 {zh ? "列" : "columns"}</option>
            <option value="4">4 {zh ? "列" : "columns"}</option>
          </select>
        </label>
      )}
      <ExportControls value={options} onChange={setOptions} formats={["image/png", "image/jpeg"]} />
      {estimate && outputMode !== "pages" && (
        <div className={`rounded-lg border p-3 text-xs ${estimate.strategy === "stream" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
          <p className="font-semibold">{estimate.width.toLocaleString()} × {estimate.height.toLocaleString()} px</p>
          <p className="mt-1">{zh ? "常规画布预计内存" : "Estimated canvas memory"}：{formatBytes(estimate.estimatedCanvasBytes)}</p>
          {estimate.strategy === "stream" && <p className="mt-1">{zh ? "将使用无损分块流式导出，不降低下载分辨率。" : "Lossless tiled streaming will preserve download resolution."}</p>}
        </div>
      )}
      <button className="min-h-11 w-full rounded-lg bg-cyan-700 font-semibold text-white disabled:opacity-40" disabled={!file || processing || !pageCount} onClick={() => void process()}>
        {processing ? `${t("processing")} ${progress.done}/${progress.total}` : t("process")}
      </button>
      {processing && <button className="min-h-11 w-full rounded-lg border border-slate-300 font-semibold text-slate-700" onClick={() => controllerRef.current?.abort()}>{zh ? "取消处理" : "Cancel"}</button>}
    </>
  );

  return (
    <ToolLayout icon={FileImage} title={t("pdf")} description={t("pdfDesc")} controls={controls}>
      <FileDropzone accept="application/pdf" multiple={false} detail={file ? `${file.name} · ${pageCount} ${zh ? "页" : "pages"}` : (zh ? "PDF · 本地处理" : "PDF · processed locally")} onFiles={(files) => void choose(files)} />
      {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {processing && <div className="flex items-center gap-3 rounded-xl bg-white p-4 text-sm"><Loader2 className="size-5 animate-spin" /> {stage === "render" ? (zh ? "正在渲染" : "Rendering") : stage === "encode" ? (zh ? "正在编码并写入文件" : "Encoding and writing") : (zh ? "正在生成低清预览" : "Generating preview")} · {progress.done}/{progress.total}</div>}
      {results.length > 0 && (
        <div className="rounded-xl bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{outputMode === "pages" ? `${results.length} ${zh ? "页" : "pages"}` : (zh ? "合成结果" : "Combined result")}</h2>
            {results.length > 1 && <button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-700 px-3 text-sm font-semibold text-white" onClick={() => void downloadAssetsZip(results, "imgskills-pdf-pages.zip")}><Package className="size-4" /> {t("downloadZip")}</button>}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {results.map((asset, index) => (
              <article key={asset.fileName} className="overflow-hidden rounded-lg border border-slate-200">
                <img className="aspect-[4/3] w-full bg-slate-100 object-contain" src={previews[index]} alt={asset.fileName} />
                <div className="flex items-center justify-between gap-2 p-3">
                  <p className="truncate text-xs font-medium">{asset.fileName}</p>
                  {streamedResult
                    ? <span className="text-xs font-semibold text-emerald-700">{zh ? "原图已保存" : "Original saved"}</span>
                    : <button aria-label={`Download ${asset.fileName}`} onClick={() => downloadBlob(asset.blob, asset.fileName)}><Download className="size-4" /></button>}
                </div>
                {streamedResult && <p className="border-t border-slate-100 p-3 text-xs text-slate-500">{zh ? "预览已缩小；下载文件保持所选渲染倍率与原始分辨率。" : "Preview is reduced; the downloaded file preserves the selected scale and full resolution."}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
