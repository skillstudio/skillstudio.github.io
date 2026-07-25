import { Download, Loader2, Package, XCircle } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import type { ProcessingJob } from "../types/media";
import { downloadAssetsZip, downloadBlob } from "../utils/download";
import { formatBytes } from "../utils/imageProcessing";

export function BatchResults({ jobs, zipName, onCancel }: { jobs: ProcessingJob[]; zipName: string; onCancel?: () => void }) {
  const { t } = useLanguage();
  const results = jobs.flatMap((job) => job.result ? [job.result] : []);
  if (!jobs.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(2,6,23,0.16)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">{t("after")}</h2>
        {jobs.some((job) => job.status === "processing" || job.status === "pending") && onCancel ? (
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold" onClick={onCancel}>
            <XCircle className="size-4" /> {t("reset")}
          </button>
        ) : results.length > 1 && (
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800"
            onClick={() => void downloadAssetsZip(results, zipName)}
          >
            <Package className="size-4" /> {t("downloadZip")}
          </button>
        )}
      </div>
      <div className="mt-4 grid gap-3">
        {jobs.map((job) => (
          <article key={job.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{job.file.name}</p>
                {job.status === "processing" && (
                  <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="size-4 animate-spin" /> {t("processing")}
                  </p>
                )}
                {job.error && <p className="mt-2 text-sm text-red-700">{job.error}</p>}
                {job.result && (
                  <p className="mt-2 text-sm text-slate-600">
                    {job.result.width}×{job.result.height} · {formatBytes(job.file.size)} → {formatBytes(job.result.outputSize)}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-40"
                disabled={!job.result}
                onClick={() => job.result && downloadBlob(job.result.blob, job.result.fileName)}
              >
                <Download className="size-4" /> {t("download")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
