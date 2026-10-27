export function TabLead({
  kicker,
  title,
  accent,
  line,
}: {
  kicker: string;
  title: string;
  accent: string;
  line: string;
  live?: string[];
  coming?: string[];
  audit?: { live: string; hold: string };
}) {
  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">{kicker}</p>
          <h1 className="mt-1 text-xl tracking-tight lg:text-2xl">
            {title} <span className="text-accent">{accent}</span>
          </h1>
        </div>
        <p className="max-w-md text-[13px] leading-snug text-muted">{line}</p>
      </div>
    </section>
  );
}
