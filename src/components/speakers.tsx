import { SPEAKERS } from "@/lib/event";

function KernelMark() {
  return (
    <svg viewBox="0 0 120 120" className="size-40 text-accent" aria-hidden>
      <path
        d="M60 12 L108 60 L60 108 L12 60 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M60 36 L84 60 L60 84 L36 60 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-fg/70"
      />
      <circle cx="60" cy="60" r="6" className="fill-fg" />
    </svg>
  );
}

export function Speakers() {
  return (
    <section
      id="speakers"
      className="scroll-mt-16 border-t border-border bg-surface py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="mb-12 max-w-2xl">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Speakers
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            The six cores, in person.
          </h2>
          <p className="mt-3 text-muted">
            Founder, substrate, and the principals who own XFIN, GRID, AURA, and
            NEXS. The other two cores sit in the workshop tracks.
          </p>
        </header>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SPEAKERS.map((s) => (
            <li
              key={s.id}
              className="overflow-hidden rounded-2xl bg-elevated shadow-panel"
            >
              <div className="relative aspect-portrait overflow-hidden bg-bg">
                {s.image ? (
                  <img
                    src={s.image}
                    alt={`Portrait of ${s.name}`}
                    className="size-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-4 bg-bg">
                    <KernelMark />
                    <span className="font-mono text-xs tracking-widest text-muted uppercase">
                      {s.initials}
                    </span>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-elevated to-transparent" />
                <p className="absolute top-3 left-3 rounded-full bg-bg/80 px-2.5 py-1 font-mono text-xs tracking-widest text-fg uppercase">
                  {s.core}
                </p>
              </div>
              <div className="space-y-2 p-5">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {s.name}
                </h3>
                <p className="text-sm text-accent">{s.role}</p>
                <p className="text-sm text-muted">{s.bio}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
