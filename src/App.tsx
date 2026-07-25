import { lazy, Suspense, type ComponentType } from "react";
import { Header } from "./components/Header";
import { useLanguage } from "./i18n/LanguageContext";
import { HomePage } from "./pages/HomePage";

const CompressorPage = lazy(() => import("./pages/CompressorPage").then((module) => ({ default: module.CompressorPage })));
const ConverterPage = lazy(() => import("./pages/ConverterPage").then((module) => ({ default: module.ConverterPage })));
const CropPage = lazy(() => import("./pages/CropPage").then((module) => ({ default: module.CropPage })));
const PdfToImagePage = lazy(() => import("./pages/PdfToImagePage").then((module) => ({ default: module.PdfToImagePage })));
const ResizePage = lazy(() => import("./pages/ResizePage").then((module) => ({ default: module.ResizePage })));
const WatermarkPage = lazy(() => import("./pages/WatermarkPage").then((module) => ({ default: module.WatermarkPage })));

const routes: Record<string, ComponentType> = {
  "/": HomePage,
  "/compress": CompressorPage,
  "/pdf-to-image": PdfToImagePage,
  "/image-resize": ResizePage,
  "/image-converter": ConverterPage,
  "/image-crop": CropPage,
  "/image-watermark": WatermarkPage,
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
  const Page = routes[window.location.pathname] || NotFoundPage;
  return (
    <div className="min-h-screen bg-slate-950 text-slate-950">
      <Header />
      <main>
        <Suspense fallback={<div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-900 text-sm text-slate-300">{language === "zh" ? "正在加载工具…" : "Loading tool…"}</div>}>
          <Page />
        </Suspense>
      </main>
    </div>
  );
}
