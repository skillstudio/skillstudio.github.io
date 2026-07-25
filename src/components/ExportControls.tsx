import { useLanguage } from "../i18n/LanguageContext";
import type { ExportOptions, ImageFormat } from "../types/media";

type Props = {
  value: ExportOptions;
  onChange: (value: ExportOptions) => void;
  formats?: ImageFormat[];
};

const labels: Record<ImageFormat, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
};

export function ExportControls({
  value,
  onChange,
  formats = ["image/jpeg", "image/png", "image/webp"],
}: Props) {
  const { t } = useLanguage();
  return (
    <>
      <div>
        <div className="text-sm font-medium text-slate-800">{t("outputFormat")}</div>
        <div className={`mt-3 grid gap-2 ${formats.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {formats.map((format) => (
            <button
              key={format}
              type="button"
              className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${
                value.format === format
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
              onClick={() => onChange({ ...value, format })}
            >
              {labels[format]}
            </button>
          ))}
        </div>
      </div>
      {value.format !== "image/png" && (
        <label className="block">
          <span className="flex items-center justify-between text-sm font-medium text-slate-800">
            {t("quality")} <span className="rounded bg-slate-100 px-2 py-1">{value.quality}%</span>
          </span>
          <input
            className="mt-3 w-full accent-cyan-700"
            type="range"
            min="10"
            max="100"
            step="5"
            value={value.quality}
            onChange={(event) => onChange({ ...value, quality: Number(event.target.value) })}
          />
        </label>
      )}
      {value.format === "image/jpeg" && (
        <label className="flex items-center justify-between gap-4 text-sm font-medium text-slate-800">
          {t("background")}
          <input
            className="size-10 rounded border border-slate-300"
            type="color"
            value={value.backgroundColor || "#ffffff"}
            onChange={(event) => onChange({ ...value, backgroundColor: event.target.value })}
          />
        </label>
      )}
    </>
  );
}
