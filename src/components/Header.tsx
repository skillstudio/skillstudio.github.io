import { useEffect, useState } from "react";
import { ChevronDown, Languages, LayoutGrid, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import { useLanguage } from "../i18n/LanguageContext";
import { tools } from "../data/tools";

export function Header() {
  const { language, t, toggleLanguage } = useLanguage();
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const siteAddress = new URL("/", window.location.origin);

  if (siteAddress.hostname === "localhost" || siteAddress.hostname === "127.0.0.1") {
    siteAddress.hostname = __DEV_LAN_HOST__;
  }

  const siteUrl = siteAddress.toString();

  useEffect(() => {
    if (!isQrOpen || qrCodeUrl) {
      return;
    }

    void QRCode.toDataURL(siteUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240,
      color: {
        dark: "#020617",
        light: "#ffffff",
      },
    }).then(setQrCodeUrl);
  }, [isQrOpen, qrCodeUrl, siteUrl]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsQrOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95 text-white shadow-[0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl">
      <div className="relative mx-auto flex min-h-20 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="/" className="group flex items-center gap-3.5" aria-label="ImgSkills home">
          <span className="flex size-11 items-center justify-center overflow-hidden rounded-xl shadow-[0_8px_28px_rgba(34,211,238,0.18)] ring-1 ring-white/15 transition-transform group-hover:-translate-y-0.5">
            <svg
              viewBox="0 0 44 44"
              className="size-full"
              role="img"
              aria-label="ImgSkills logo"
            >
              <defs>
                <linearGradient id="imgskills-mark" x1="5" y1="4" x2="39" y2="40">
                  <stop offset="0" stopColor="#22d3ee" />
                  <stop offset="0.52" stopColor="#0ea5e9" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
              <rect width="44" height="44" rx="12" fill="url(#imgskills-mark)" />
              <path
                d="M13.5 16.5v-3h7M30.5 16.5v-3h-4M13.5 27.5v3h7M30.5 27.5v3h-4"
                fill="none"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.4"
              />
              <path
                d="m16 27 5.2-5.4 3.4 3.2 3.4-4 3 3.4"
                fill="none"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
              />
              <circle cx="27.8" cy="17.7" r="1.8" fill="white" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="text-[1.15rem] font-semibold leading-tight tracking-[-0.025em] text-white">
              ImgSkills
            </span>
            <span className="mt-0.5 hidden text-[0.65rem] font-medium uppercase leading-none tracking-[0.18em] text-slate-400 sm:block">
              {language === "zh" ? "私密图像工作室" : "Private Image Studio"}
            </span>
          </span>
        </a>
        <nav className="relative flex items-center gap-2 text-sm text-slate-300">
          <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/70 px-3.5 font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800" aria-expanded={isToolsOpen} onClick={() => setIsToolsOpen((value) => !value)}>
            <LayoutGrid className="size-4 text-cyan-300" />
            <span className="hidden sm:inline">{t("navTools")}</span>
            <ChevronDown className={`size-3.5 transition ${isToolsOpen ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300 transition hover:border-cyan-500/60 hover:bg-slate-800 hover:text-cyan-300"
            aria-label={language === "zh" ? "切换语言" : "Switch language"}
            title={language === "zh" ? "切换语言" : "Switch language"}
            onClick={toggleLanguage}
          >
            <Languages className="size-[1.05rem]" aria-hidden="true" />
            <span className="sr-only">{t("language")}</span>
          </button>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-500/60 hover:bg-slate-800 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label={t("mobileAccess")}
            title={t("mobileAccess")}
            aria-expanded={isQrOpen}
            aria-controls="mobile-access-qr"
            onClick={() => setIsQrOpen((current) => !current)}
          >
            <QrCode className="size-[1.15rem]" strokeWidth={1.9} aria-hidden="true" />
          </button>
        </nav>

        {isToolsOpen && (
          <>
            <button type="button" className="fixed inset-0 z-30 cursor-default" aria-label={language === "zh" ? "关闭工具菜单" : "Close tools menu"} onClick={() => setIsToolsOpen(false)} />
            <div className="absolute right-4 top-[calc(100%+0.65rem)] z-40 w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-[0_28px_90px_rgba(2,6,23,0.6)] sm:right-6 lg:right-8">
              <div className="grid gap-1 sm:grid-cols-2">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  const active = window.location.pathname.replace(/\/+$/, "") === tool.path;
                  return <a key={tool.path} href={tool.path} className={`group flex items-center gap-3 rounded-xl p-3 transition ${active ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-300/20" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`} onClick={() => setIsToolsOpen(false)}>
                    <span className={`flex size-9 items-center justify-center rounded-lg ${active ? "bg-cyan-300 text-slate-950" : "bg-slate-800 text-cyan-300 group-hover:bg-slate-700"}`}><Icon className="size-4" /></span>
                    <span><span className="block text-sm font-semibold">{t(tool.nameKey)}</span><span className="mt-0.5 block text-[11px] text-slate-500">{t(tool.descriptionKey)}</span></span>
                  </a>;
                })}
              </div>
            </div>
          </>
        )}

        {isQrOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default bg-slate-950/20"
              aria-label="Close QR code"
              onClick={() => setIsQrOpen(false)}
            />
            <div
              id="mobile-access-qr"
              className="absolute right-4 top-[calc(100%+0.75rem)] z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-[0_24px_80px_rgba(2,6,23,0.35)] sm:right-6 lg:right-8"
              role="dialog"
              aria-label={t("scanTitle")}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">{t("scanTitle")}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{t("scanBody")}</p>
                </div>
                <button
                  type="button"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                  aria-label="Close"
                  onClick={() => setIsQrOpen(false)}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="mx-auto mt-4 flex size-60 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                {qrCodeUrl ? (
                  <img className="size-full" src={qrCodeUrl} alt={`QR code for ${siteUrl}`} />
                ) : (
                  <span className="text-sm text-slate-500">{t("processing")}…</span>
                )}
              </div>

              <p className="mt-3 truncate rounded-lg bg-slate-100 px-3 py-2 text-center text-xs text-slate-600">
                {siteUrl}
              </p>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
