import { lazy, Suspense, type ComponentType } from "react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { useLanguage } from "./i18n/LanguageContext";
import { HomePage } from "./pages/HomePage";

const CompressorPage = lazy(() => import("./pages/CompressorPage").then((module) => ({ default: module.CompressorPage })));
const ConverterPage = lazy(() => import("./pages/ConverterPage").then((module) => ({ default: module.ConverterPage })));
const CropPage = lazy(() => import("./pages/CropPage").then((module) => ({ default: module.CropPage })));
const PdfToImagePage = lazy(() => import("./pages/PdfToImagePage").then((module) => ({ default: module.PdfToImagePage })));
const ResizePage = lazy(() => import("./pages/ResizePage").then((module) => ({ default: module.ResizePage })));
const WatermarkPage = lazy(() => import("./pages/WatermarkPage").then((module) => ({ default: module.WatermarkPage })));
const CommerceStudioPage = lazy(() => import("./pages/CommerceStudioPage").then((module) => ({ default: module.CommerceStudioPage })));

const routes: Record<string, ComponentType> = {
  "/": HomePage,
  "/compress": CompressorPage,
  "/pdf-to-image": PdfToImagePage,
  "/image-resize": ResizePage,
  "/image-converter": ConverterPage,
  "/image-crop": CropPage,
  "/image-watermark": WatermarkPage,
  "/commerce-studio": CommerceStudioPage,
};

function NotFoundPage() {
  const { language } = useLanguage();
  const zh = language === "zh";
  return (
    <section className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-950 px-4 text-center text-white">
      <div><p className="text-sm font-semibold text-cyan-300">404</p><h1 className="mt-3 text-3xl font-semibold">{zh ? "页面未找到" : "Page not found"}</h1><a className="mt-6 inline-flex rounded-lg bg-white px-5 py-3 font-semibold text-slate-950" href="/">{zh ? "返回首页" : "Back home"}</a></div>
    </section>
  );
}

export default function App() {
  const { language } = useLanguage();
  const pathname = window.location.pathname.length > 1
    ? window.location.pathname.replace(/\/+$/, "")
    : "/";
  const Page = routes[pathname] || NotFoundPage;
  return (
    <div className="min-h-screen bg-slate-950 text-slate-950">
      <Header wide={pathname === "/commerce-studio"} />
      <main>
        <Suspense fallback={<div className="min-h-[calc(100vh-5rem)] bg-slate-900 px-4 py-10"><div className="mx-auto grid max-w-6xl animate-pulse gap-6 lg:grid-cols-[0.78fr_1.22fr]"><div className="h-[28rem] rounded-2xl border border-slate-700 bg-slate-800/70" /><div className="h-72 rounded-2xl border border-slate-700 bg-slate-800/50" /></div><p className="mx-auto mt-6 max-w-6xl text-center text-sm text-slate-400">{language === "zh" ? "正在准备本地处理引擎…" : "Preparing the local processing engine…"}</p></div>}>
          <Page />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
