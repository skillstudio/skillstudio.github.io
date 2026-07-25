import { ShieldCheck, type LucideIcon } from "lucide-react";
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
    <section className="min-h-[calc(100vh-5rem)] bg-slate-900 py-8 sm:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
              </div>
            </div>
            <div className="mt-6 space-y-5">{controls}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
              <p className="text-sm leading-6 text-emerald-900">{t("privacy")}</p>
            </div>
          </div>
        </aside>
        <div className="space-y-4">{children}</div>
      </div>
    </section>
  );
}
