/** One sentence from the quote check. A clear quote is the one a signature may use. */

export function BookLine({ ok, line, warn }: { ok: boolean; line: string; warn?: string }) {
  return (
    <div className="mt-2">
      <p className={ok ? "text-sm leading-snug text-accent" : "text-sm leading-snug text-down"}>{line}</p>
      {warn ? <p className="mt-1 text-xs leading-snug text-white/50">{warn}</p> : null}
    </div>
  );
}
