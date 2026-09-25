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
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 lg:p-6">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">{kicker}</p>
      <h1 className="mt-2 max-w-3xl text-4xl leading-[1.05] tracking-tight lg:text-5xl">
        {title} <span className="text-accent">{accent}</span>
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{line}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-black/30 px-4 py-3">
          <p className="text-[11px] tracking-[0.14em] text-accent uppercase">Working now</p>
          <ul className="mt-2 space-y-1 text-sm">
            {live.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-black/30 px-4 py-3">
          <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">Still coming</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {coming.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
