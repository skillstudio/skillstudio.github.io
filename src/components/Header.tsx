import { ShieldCheck } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="/imgskills/" className="flex items-center gap-3" aria-label="img skills home">
          <span className="flex size-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
            is
          </span>
          <span className="text-lg font-semibold tracking-normal">img skills</span>
        </a>
        <nav className="flex items-center gap-2 text-sm text-slate-600">
          <a className="hidden rounded-lg px-3 py-2 hover:bg-slate-100 sm:inline-flex" href="/imgskills/#tools">
            Tools
          </a>
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 font-medium text-white hover:bg-slate-800"
            href="/imgskills/compress"
          >
            <ShieldCheck className="size-4" aria-hidden="true" />
            Compress
          </a>
        </nav>
      </div>
    </header>
  );
}
