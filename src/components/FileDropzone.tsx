import { FileImage, Upload } from "lucide-react";
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

  function receive(files: FileList | null) {
    if (files?.length) onFiles(Array.from(files));
  }

  return (
    <div
      className={`rounded-xl border-2 border-dashed bg-white p-7 text-center shadow-sm transition sm:p-10 ${
        dragging ? "border-cyan-500 bg-cyan-50" : "border-slate-300"
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
      <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-slate-950 text-white">
        <Upload className="size-6" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-slate-950">{t("dropImages")}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
      <button
        type="button"
        className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-800"
        onClick={() => inputRef.current?.click()}
      >
        <FileImage className="size-4" aria-hidden="true" />
        {t("chooseFiles")}
      </button>
    </div>
  );
}
