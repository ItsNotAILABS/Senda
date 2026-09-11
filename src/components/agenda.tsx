import { AGENDA } from "@/lib/event";

export function Agenda() {
  return (
    <section id="agenda" className="scroll-mt-16 border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="mb-12 max-w-2xl">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Schedule
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            One night. Two tracks. Zero drift.
          </h2>
          <p className="mt-3 text-muted">
            Main stage holds the keynotes. At 20:30 the floor splits — yield in
            A, mesh in B — then everyone returns for the panel.
          </p>
        </header>
        <ol className="relative space-y-0 border-l border-border pl-0">
          {AGENDA.map((item, i) => (
            <li
              key={`${item.time}-${item.title}`}
              className="grid grid-cols-[5.5rem_1fr] gap-4 border-b border-border py-5 sm:grid-cols-[7rem_1fr_auto] sm:gap-6"
            >
              <time className="font-mono text-sm tabular-nums text-accent">
                {item.time}
              </time>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-muted">{item.detail}</p>
              </div>
              <span className="col-start-2 mt-1 inline-flex h-7 w-fit items-center rounded-full bg-elevated px-2.5 text-xs tracking-widest text-muted uppercase sm:col-start-auto sm:mt-0">
                {item.track === "All"
                  ? "All"
                  : item.track === "Main"
                    ? "Main stage"
                    : `Track ${item.track}`}
                {i === 0 ? <span className="sr-only"> first</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
