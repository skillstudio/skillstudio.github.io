import type { Tool } from "../data/tools";
import { useLanguage } from "../i18n/LanguageContext";

type ToolCardProps = {
  tool: Tool;
};

export function ToolCard({ tool }: ToolCardProps) {
  const { t } = useLanguage();
  const Icon = tool.icon;
  const isAvailable = tool.status === "available";

  return (
    <a
      href={isAvailable ? tool.path : "#tools"}
      className="group relative flex min-h-44 overflow-hidden flex-col justify-between rounded-2xl border border-slate-700 bg-slate-800/70 p-5 shadow-sm transition hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-slate-800 hover:shadow-[0_22px_60px_rgba(2,6,23,0.35)]"
      aria-disabled={!isAvailable}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/10 transition group-hover:bg-cyan-300 group-hover:text-slate-950">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
          {isAvailable ? t("live") : t("soon")}
        </span>
      </div>
      <div>
        <h3 className="mt-5 text-base font-semibold text-white">{t(tool.nameKey)}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{t(tool.descriptionKey)}</p>
      </div>
    </a>
  );
}
