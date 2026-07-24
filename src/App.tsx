import { Header } from "./components/Header";
import { CompressorPage } from "./pages/CompressorPage";
import { HomePage } from "./pages/HomePage";

export default function App() {
  const path = window.location.pathname.replace("/img-skills", "") || "/";

  return (
    <div className="min-h-screen bg-stone-50 text-slate-950">
      <Header />
      <main>{path === "/compress" ? <CompressorPage /> : <HomePage />}</main>
    </div>
  );
}
