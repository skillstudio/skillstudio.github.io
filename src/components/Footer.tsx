import { LockKeyhole } from "lucide-react";
import { tools } from "../data/tools";
import { useLanguage } from "../i18n/LanguageContext";

export function Footer() {
  const { language, t } = useLanguage();
  const zh = language === "zh";
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1.1fr_1.4fr] lg:px-8">
        <div>
          <div className="flex items-center gap-3 text-white">
            <span className="flex size-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/20"><LockKeyhole className="size-4" /></span>
            <span className="font-semibold tracking-tight">图像技能平台</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6">
            {zh ? "面向常用图像任务的浏览器端图像工作室，无需注册即可使用。" : "A browser-based image studio for common image tasks, available without registration."}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{zh ? "全部工具" : "All tools"}</p>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {tools.map((tool) => <a key={tool.path} className="transition hover:text-cyan-300" href={tool.path}>{t(tool.nameKey)}</a>)}
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 ImgSkills</p>
          <p>{zh ? "支持的图像任务在当前浏览器中处理" : "Supported image tasks are processed in the current browser"}</p>
        </div>
      </div>
    </footer>
  );
}
