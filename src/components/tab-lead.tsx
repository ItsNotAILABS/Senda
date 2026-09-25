export function TabLead({
  kicker,
  title,
  accent,
  line,
  live,
  coming,
}: {
  kicker: string;
  title: string;
  accent: string;
  line: string;
  live: string[];
  coming: string[];
}) {
  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">{kicker}</p>
          <h1 className="mt-1 text-2xl tracking-tight lg:text-3xl">
            {title} <span className="text-accent">{accent}</span>
          </h1>
        </div>
        <p className="max-w-md text-sm text-muted">{line}</p>
      </div>
      <p className="mt-3 text-xs text-muted">
        <span className="text-accent">Live</span> {live.join(" · ")}
        <span className="mx-2 text-subtle">/</span>
        <span className="text-subtle">Coming</span> {coming.join(" · ")}
      </p>
    </section>
  );
}
