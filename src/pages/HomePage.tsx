import { ArrowRight, CheckCircle2, FileImage, Files, Gauge, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { ToolCard } from "../components/ToolCard";
import { tools } from "../data/tools";
import { useLanguage } from "../i18n/LanguageContext";

export function HomePage() {
  const { language, t } = useLanguage();
  const benefits = language === "zh"
    ? [["浏览器端处理", "支持的图像任务在当前浏览器中完成。"], ["即时反馈", "处理进度和结果可在页面中查看。"], ["工作流支持", "支持批处理、预览和打包下载。"]]
    : [["Browser Processing", "Supported image tasks run in the current browser."], ["Immediate Feedback", "View processing progress and results on the page."], ["Workflow Support", "Batch processing, previews, and ZIP downloads."]];
  return (
    <>
      <section className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto grid min-h-[42rem] w-full max-w-6xl content-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-800 bg-cyan-950 px-3 py-1.5 text-sm font-medium text-cyan-200">
              <Lock className="size-4" aria-hidden="true" />
              {t("localFirst")}
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.6rem] lg:leading-[1.08]">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
              {t("heroLead")}
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
              {t("heroBody")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/commerce-studio"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-cyan-50"
              >
                {language === "zh" ? "进入电商图片工作室" : "Open Commerce Studio"}
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
              <a
                href="#tools"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                {t("viewTools")}
              </a>
            </div>
          </div>

          <div className="relative flex items-center">
            <div className="absolute inset-8 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-[0_35px_100px_rgba(2,6,23,0.6)]">
              <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-3">
                <div className="flex gap-1.5"><span className="size-2.5 rounded-full bg-rose-400/70" /><span className="size-2.5 rounded-full bg-amber-300/70" /><span className="size-2.5 rounded-full bg-emerald-400/70" /></div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{language === "zh" ? "本地工作区" : "Local workspace"}</span>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-3">
                  {benefits.map(([title, text], index) => {
                    const Icons = [ShieldCheck, Gauge, Files]; const ItemIcon = Icons[index];
                    return <div key={title} className="rounded-xl border border-slate-700 bg-slate-800/80 p-3.5"><div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300"><ItemIcon className="size-4" /></span><div><h2 className="text-xs font-semibold text-white">{title}</h2><p className="mt-1 text-[11px] leading-4 text-slate-400">{text}</p></div></div></div>;
                  })}
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold text-white">{language === "zh" ? "处理队列" : "Processing queue"}</span><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">3 / 3</span></div>
                  <div className="mt-5 space-y-3">
                    {[["campaign-cover.jpg", "4.8 MB", "1.2 MB"], ["product-shot.png", "8.1 MB", "2.6 MB"], ["brand-story.webp", "3.4 MB", "940 KB"]].map(([name, before, after]) => <div key={name} className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-slate-800 text-cyan-300"><FileImage className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-medium text-slate-200">{name}</p><p className="mt-0.5 text-[10px] text-slate-500">{before} → <span className="text-emerald-300">{after}</span></p></div><CheckCircle2 className="size-4 text-emerald-400" /></div>)}
                  </div>
                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-900 py-16" id="tools">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-fuchsia-300">
                <Sparkles className="size-4" aria-hidden="true" />
                {t("toolsEyebrow")}
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                {t("toolsTitle")}
              </h2>
            </div>
            <div className="flex max-w-xl items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm leading-6 text-slate-300">
              <Lock className="mt-0.5 size-5 shrink-0 text-cyan-300" aria-hidden="true" />
              <p>{t("toolsBody")}</p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard key={tool.path} tool={tool} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
