import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Languages, LayoutGrid, Link2, Loader2, QrCode, RefreshCw, ShieldCheck, Smartphone, TriangleAlert, X } from "lucide-react";
import QRCode from "qrcode";
import { useLanguage } from "../i18n/LanguageContext";
import { tools } from "../data/tools";

type HeaderProps = {
  wide?: boolean;
};

export function Header({ wide = false }: HeaderProps) {
  const { language, t, toggleLanguage } = useLanguage();
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrError, setQrError] = useState(false);
  const [qrAttempt, setQrAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const qrTriggerRef = useRef<HTMLButtonElement>(null);
  const qrCloseRef = useRef<HTMLButtonElement>(null);
  const siteAddress = new URL("/", window.location.origin);

  if (siteAddress.hostname === "localhost" || siteAddress.hostname === "127.0.0.1") {
    siteAddress.hostname = __DEV_LAN_HOST__;
  }

  const siteUrl = siteAddress.toString();

  useEffect(() => {
    if (!isQrOpen || qrCodeUrl) {
      return;
    }

    setQrError(false);
    void QRCode.toDataURL(siteUrl, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 208,
      color: {
        dark: "#a5f3fc",
        light: "#00000000",
      },
    }).then(setQrCodeUrl).catch(() => setQrError(true));
  }, [isQrOpen, qrCodeUrl, qrAttempt, siteUrl]);

  useEffect(() => {
    if (!isQrOpen) return;
    const frame = window.requestAnimationFrame(() => qrCloseRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isQrOpen]);

  function closeQr() {
    setIsQrOpen(false);
    setCopied(false);
    window.requestAnimationFrame(() => qrTriggerRef.current?.focus());
  }

  function toggleQr() {
    if (isQrOpen) {
      closeQr();
      return;
    }
    setIsToolsOpen(false);
    setIsQrOpen(true);
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(siteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function retryQr() {
    setQrCodeUrl("");
    setQrError(false);
    setQrAttempt((value) => value + 1);
  }

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeQr();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95 text-white shadow-[0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl">
      <div className={`relative mx-auto flex min-h-20 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 ${wide ? "max-w-[82rem]" : "max-w-6xl"}`}>
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
          <span className="text-[1.05rem] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[1.1rem]">
            {language === "zh" ? "图像技能平台" : "Image Skills Platform"}
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
            ref={qrTriggerRef}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-500/60 hover:bg-slate-800 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label={t("mobileAccess")}
            title={t("mobileAccess")}
            aria-expanded={isQrOpen}
            aria-controls="mobile-access-qr"
            onClick={toggleQr}
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
              className="fixed inset-0 z-40 cursor-default bg-slate-950/45 backdrop-blur-[2px]"
              aria-label={language === "zh" ? "关闭手机访问窗口" : "Close mobile access"}
              onClick={closeQr}
            />
            <div
              id="mobile-access-qr"
              className="qr-popover fixed left-3 right-3 top-24 z-50 mx-auto w-auto max-w-[20rem] rounded-[1.25rem] border border-slate-700 bg-slate-900 p-5 text-white shadow-[0_28px_90px_rgba(2,6,23,0.72),0_0_42px_rgba(34,211,238,0.08)] sm:absolute sm:left-auto sm:right-6 sm:top-[calc(100%+0.7rem)] sm:mx-0 sm:w-[19.5rem] lg:right-8"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-access-title"
              aria-label={t("scanTitle")}
            >
              <span className="absolute -top-1.5 right-5 hidden size-3 rotate-45 border-l border-t border-slate-700 bg-slate-900 sm:block" />
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/15">
                    <Smartphone className="size-[1.05rem]" aria-hidden="true" />
                  </span>
                  <h2 id="mobile-access-title" className="text-[0.95rem] font-semibold tracking-tight">{language === "zh" ? "手机访问" : "Open on mobile"}</h2>
                </div>
                <button
                  ref={qrCloseRef}
                  type="button"
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  aria-label={language === "zh" ? "关闭" : "Close"}
                  title={language === "zh" ? "关闭" : "Close"}
                  onClick={closeQr}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="relative mx-auto mt-5 flex size-[13.5rem] items-center justify-center rounded-2xl border border-cyan-300/15 bg-slate-950 shadow-[inset_0_0_28px_rgba(34,211,238,0.035),0_0_30px_rgba(34,211,238,0.035)]">
                {qrCodeUrl ? (
                  <img className="size-52" src={qrCodeUrl} alt={`QR code for ${siteUrl}`} />
                ) : qrError ? (
                  <div className="flex flex-col items-center text-center">
                    <TriangleAlert className="size-6 text-amber-300" />
                    <button type="button" className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800" onClick={retryQr}>
                      <RefreshCw className="size-3.5" /> {language === "zh" ? "重试" : "Retry"}
                    </button>
                  </div>
                ) : (
                  <Loader2 className="size-5 animate-spin text-cyan-200" aria-label={t("processing")} />
                )}
              </div>

              <div className="mt-4 flex min-h-12 items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/80 p-1.5 pl-3">
                <Link2 className="size-4 shrink-0 text-cyan-300" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-300">{siteAddress.host}</span>
                <span className="group relative flex">
                  <button type="button" className="flex size-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-700 hover:text-cyan-200" aria-label={copied ? (language === "zh" ? "已复制" : "Copied") : (language === "zh" ? "复制地址" : "Copy address")} title={copied ? (language === "zh" ? "已复制" : "Copied") : (language === "zh" ? "复制地址" : "Copy address")} onClick={() => void copyAddress()}>
                    {copied ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4" />}
                  </button>
                </span>
                <span className="flex size-8 items-center justify-center text-emerald-300" title={t("privacy")}><ShieldCheck className="size-4" aria-label={t("privacy")} /></span>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
