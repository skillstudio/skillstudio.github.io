import { ArrowRight, Cpu, Lock, Sparkles } from "lucide-react";
import { ToolCard } from "../components/ToolCard";
import { tools } from "../data/tools";

export function HomePage() {
  return (
    <>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl content-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm font-medium text-cyan-800">
              <Lock className="size-4" aria-hidden="true" />
              Local-first image processing
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              img skills
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700 sm:text-xl">
              Privacy-first professional image tools that run locally in your browser.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Compress, convert, resize, crop, and prepare production images without sending files
              to a server.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/img-skills/compress"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Upload Images
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
              <a
                href="#tools"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                View Tools
              </a>
            </div>
          </div>

          <div className="relative flex items-center">
            <div className="w-full rounded-lg border border-slate-200 bg-stone-50 p-4 shadow-soft sm:p-6">
              <div className="grid gap-3">
                {[
                  ["No Upload", "Files stay on your device."],
                  ["Fast Local Compute", "Browser APIs process images instantly."],
                  ["Professional Workflow", "Batch controls and reusable tool patterns."],
                ].map(([title, text], index) => (
                  <div key={title} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-semibold text-emerald-700">
                        {index + 1}
                      </span>
                      <div>
                        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
                        <p className="mt-1 text-sm text-slate-600">{text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-stone-50 py-14" id="tools">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-fuchsia-700">
                <Sparkles className="size-4" aria-hidden="true" />
                Built for private production work
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950 sm:text-3xl">
                Image tools that respect your files
              </h2>
            </div>
            <div className="flex max-w-xl items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
              <Cpu className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden="true" />
              <p>
                The first tool is live. The same local-compute foundation is ready for future PDF
                and image workflows.
              </p>
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
