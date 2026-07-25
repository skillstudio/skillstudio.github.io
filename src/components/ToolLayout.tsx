import { ChevronRight, LockKeyhole, ShieldCheck, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  controls: ReactNode;
  children: ReactNode;
};

export function ToolLayout({ icon: Icon, title, description, controls, children }: Props) {
  const { t } = useLanguage();
  return (
    <section className="min-h-[calc(100vh-5rem)] bg-[radial-gradient(circle_at_75%_0%,rgba(8,145,178,0.09),transparent_28%),#0f172a] py-8 sm:py-10">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center gap-2 text-xs font-medium text-slate-500"><a className="transition hover:text-cyan-300" href="/#tools">{t("navTools")}</a><ChevronRight className="size-3" /><span className="text-slate-300">{title}</span></div>
      </div>
      <div className="mx-auto grid w-full max-w-6xl items-start gap-6 px-4 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
        <aside className="space-y-4 lg:sticky lg:top-28">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-[0_24px_70px_rgba(2,6,23,0.22)]">
            <div className="border-b border-slate-200 bg-white/80 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
              </div>
            </div>
            </div>
            <div className="tool-controls space-y-5 p-5">{controls}</div>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.07] p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden="true" />
              <div><p className="text-sm font-semibold text-emerald-100">{t("privacy")}</p><p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-400"><LockKeyhole className="size-3" /> {t("localFirst")}</p></div>
            </div>
          </div>
        </aside>
        <div className="space-y-4 lg:min-h-[30rem]">{children}</div>
      </div>
    </section>
  );
}
