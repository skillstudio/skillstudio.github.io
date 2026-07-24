import type { Tool } from "../data/tools";

type ToolCardProps = {
  tool: Tool;
};

export function ToolCard({ tool }: ToolCardProps) {
  const Icon = tool.icon;
  const isAvailable = tool.status === "available";

  return (
    <a
      href={isAvailable ? `/imgskills${tool.path}` : "#tools"}
      className="group flex min-h-40 flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-soft"
      aria-disabled={!isAvailable}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-11 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
          {isAvailable ? "Live" : "Soon"}
        </span>
      </div>
      <div>
        <h3 className="mt-5 text-base font-semibold text-slate-950">{tool.name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{tool.description}</p>
      </div>
    </a>
  );
}
