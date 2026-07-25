import { useCallback, useMemo, useRef, useState } from "react";
import { Download, FileImage, ImageDown, Loader2, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import {
  compressImage,
  formatBytes,
  isSupportedImage,
  type CompressionResult,
  type OutputFormat,
} from "../utils/imageCompression";

type ImageJob = {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  result?: CompressionResult;
  error?: string;
};

function createJobId(file: File): string {
  const randomValue =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return file.name + "-" + file.size + "-" + file.lastModified + "-" + randomValue;
}

const outputFormats: Array<{ label: string; value: OutputFormat }> = [
  { label: "Original", value: "original" },
  { label: "JPG", value: "image/jpeg" },
  { label: "WEBP", value: "image/webp" },
];

export function CompressorPage() {
  const [quality, setQuality] = useState(80);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("original");
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    return jobs.reduce(
      (summary, job) => {
        summary.before += job.file.size;
        summary.after += job.result?.compressedSize ?? 0;
        return summary;
      },
      { before: 0, after: 0 },
    );
  }, [jobs]);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const acceptedFiles = Array.from(fileList).filter(isSupportedImage);
      const nextJobs: ImageJob[] = acceptedFiles.map((file) => ({
        id: createJobId(file),
        file,
        status: "pending",
      }));

      if (nextJobs.length === 0) {
        return;
      }

      setJobs((current) => [...nextJobs, ...current]);

      for (const job of nextJobs) {
        setJobs((current) =>
          current.map((item) => (item.id === job.id ? { ...item, status: "processing" } : item)),
        );

        try {
          const result = await compressImage(job.file, quality, outputFormat);
          setJobs((current) =>
            current.map((item) => (item.id === job.id ? { ...item, status: "done", result } : item)),
          );
        } catch (error) {
          setJobs((current) =>
            current.map((item) =>
              item.id === job.id
                ? {
                    ...item,
                    status: "error",
                    error: error instanceof Error ? error.message : "Compression failed",
                  }
                : item,
            ),
          );
        }

        await new Promise((resolve) => window.setTimeout(resolve, 16));
      }
    },
    [outputFormat, quality],
  );

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      void addFiles(event.target.files);
    }
    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void addFiles(event.dataTransfer.files);
  }

  function downloadResult(job: ImageJob) {
    if (!job.result) {
      return;
    }

    const url = URL.createObjectURL(job.result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = job.result.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function recompressAll() {
    const files = jobs.map((job) => job.file);
    setJobs([]);
    void addFiles(files);
  }

  return (
    <section className="min-h-[calc(100vh-5rem)] bg-slate-900 py-8 sm:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                <ImageDown className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl font-semibold text-slate-950">Image Compressor</h1>
                <p className="mt-1 text-sm text-slate-600">Batch compression, no uploads.</p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="flex items-center justify-between gap-4 text-sm font-medium text-slate-800">
                  Compression Quality
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">{quality}%</span>
                </span>
                <input
                  className="mt-3 w-full accent-cyan-700"
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={quality}
                  onChange={(event) => setQuality(Number(event.target.value))}
                />
              </label>

              <div>
                <div className="text-sm font-medium text-slate-800">Output Format</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {outputFormats.map((format) => (
                    <button
                      key={format.value}
                      type="button"
                      className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${
                        outputFormat === format.value
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                      onClick={() => setOutputFormat(format.value)}
                    >
                      {format.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={recompressAll}
                disabled={jobs.length === 0}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Recompress All
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
              <p className="text-sm leading-6 text-emerald-900">
                Images are processed with Canvas in this browser session. They are not uploaded,
                stored, tracked, or sent to an API.
              </p>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <div
            className={`rounded-lg border-2 border-dashed bg-white p-6 text-center shadow-sm transition sm:p-10 ${
              isDragging ? "border-cyan-500 bg-cyan-50" : "border-slate-300"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleInputChange}
            />
            <div className="mx-auto flex size-14 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Upload className="size-6" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-slate-950">Drag & Drop Images Here</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">JPG, PNG, and WEBP are supported.</p>
            <button
              type="button"
              className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-800"
              onClick={() => inputRef.current?.click()}
            >
              <FileImage className="size-4" aria-hidden="true" />
              Choose Files
            </button>
          </div>

          {jobs.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-slate-950">Compression Results</h2>
                <p className="text-sm text-slate-600">
                  {formatBytes(totals.before)} before
                  {totals.after > 0 ? ` -> ${formatBytes(totals.after)} after` : ""}
                </p>
              </div>
              <div className="mt-4 grid gap-3">
                {jobs.map((job) => (
                  <article key={job.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-950">{job.file.name}</h3>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-sm sm:w-[26rem]">
                          <Metric label="Before" value={formatBytes(job.file.size)} />
                          <Metric
                            label="After"
                            value={job.result ? formatBytes(job.result.compressedSize) : "-"}
                          />
                          <Metric
                            label="Saved"
                            value={job.result ? `${job.result.savedPercent}%` : "-"}
                          />
                        </div>
                        {job.status === "error" && (
                          <p className="mt-3 text-sm text-red-700">{job.error}</p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        {job.status === "processing" && (
                          <span className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700">
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            Processing
                          </span>
                        )}
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => downloadResult(job)}
                          disabled={!job.result}
                        >
                          <Download className="size-4" aria-hidden="true" />
                          Download
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-lg bg-slate-100 px-3 py-2">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
