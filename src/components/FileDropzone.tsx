import { FileImage, FileText, LockKeyhole, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

type Props = {
  accept: string;
  multiple?: boolean;
  detail: string;
  onFiles: (files: File[]) => void;
};

export function FileDropzone({ accept, multiple = true, detail, onFiles }: Props) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const isPdf = accept.includes("pdf");

  function receive(files: FileList | null) {
    if (files?.length) onFiles(Array.from(files));
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-dashed p-8 text-center shadow-[0_18px_60px_rgba(2,6,23,0.18)] transition sm:p-12 ${
        dragging ? "border-cyan-300 bg-cyan-50" : "border-slate-300 bg-gradient-to-br from-white via-white to-slate-50 hover:border-cyan-400"
      }`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        receive(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          receive(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-cyan-100/60 blur-3xl" />
      <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_14px_30px_rgba(2,6,23,0.25)] transition group-hover:-translate-y-1">
        {isPdf ? <FileText className="size-7" /> : <Upload className="size-7" aria-hidden="true" />}
      </div>
      <h2 className="relative mt-5 text-xl font-semibold tracking-tight text-slate-950">{t("dropImages")}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
      <button
        type="button"
        className="relative mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/15 transition hover:-translate-y-0.5 hover:bg-cyan-800"
        onClick={() => inputRef.current?.click()}
      >
        <FileImage className="size-4" aria-hidden="true" />
        {t("chooseFiles")}
      </button>
      <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3 text-[11px] font-medium text-slate-500">
        <span className="inline-flex items-center gap-1"><LockKeyhole className="size-3" /> {t("localFirst")}</span>
        <span className="inline-flex items-center gap-1"><Sparkles className="size-3" /> {multiple ? (t("downloadZip")) : (isPdf ? "PDF" : "JPG · PNG · WEBP")}</span>
      </div>
    </div>
  );
}
