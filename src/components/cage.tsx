import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ACCOUNT_LABEL, type AccountCode } from "@/lib/ledger";
import { loadGuest } from "@/lib/guest-stack";
import { BUY_IN_CHIPS, formatChips } from "@/lib/markets";
import { getJournal, type JournalLine } from "@/lib/pit";
import type { PitModel } from "@/lib/use-pit";
import { cn } from "@/lib/utils";

type Posting = {
  ref: string;
  createdAt: string;
  legs: JournalLine[];
};

function groupPostings(lines: JournalLine[]): Posting[] {
  const map = new Map<string, Posting>();
  const order: string[] = [];
  for (const line of lines) {
    let post = map.get(line.ref);
    if (!post) {
      post = { ref: line.ref, createdAt: line.createdAt, legs: [] };
      map.set(line.ref, post);
      order.push(line.ref);
    }
    post.legs.push(line);
  }
  return order.map((r) => map.get(r)!).slice(0, 8);
}

function refKind(ref: string): string {
  if (ref.startsWith("buyin")) return "Buy-in";
  if (ref.startsWith("cashout")) return "Cash-out";
  if (ref.startsWith("house")) return "House";
  if (ref.startsWith("trade")) {
    const bits = ref.split(":");
    return `Trade ${bits[1] ?? ""} ${(bits[2] ?? "").toUpperCase()}`.trim();
  }
  return ref.split(":")[0] ?? "Post";
}

function accountName(code: string): string {
  return ACCOUNT_LABEL[code as AccountCode] ?? code;
}

export function Cage({ pit }: { pit: PitModel }) {
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [busy, setBusy] = useState<"in" | "out" | null>(null);

  useEffect(() => {
    void getJournal()
      .then((j) => setLines(j.lines))
      .catch(() => setLines([]));
  }, [pit.chips, pit.variance, pit.signedIn]);

  const postings = useMemo(() => {
    if (pit.signedIn) return groupPostings(lines);
    const guest = loadGuest();
    const asLines: JournalLine[] = guest.journal
      .slice()
      .reverse()
      .map((g, i) => ({
        id: i,
        userId: "guest",
        account: g.account,
        dr: g.dr,
        cr: g.cr,
        ref: g.ref,
        createdAt: g.createdAt,
      }));
    return groupPostings(asLines);
  }, [pit.signedIn, lines, pit.chips]);

  async function onBuyIn() {
    setBusy("in");
    const res = await pit.buyIn();
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error ?? "Buy-in failed.");
      return;
    }
    toast.success(`Bought in ${formatChips(BUY_IN_CHIPS)} simulated chips.`);
    void getJournal().then((j) => setLines(j.lines)).catch(() => undefined);
  }

  async function onCashOut() {
    setBusy("out");
    const res = await pit.cashOut();
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error ?? "Cash-out failed.");
      return;
    }
    toast.success(`Cashed out ${formatChips(res.cashed ?? 0)} simulated chips.`);
    void getJournal().then((j) => setLines(j.lines)).catch(() => undefined);
  }

  const plaqueOk = !pit.frozen;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg"
          aria-label="Back to pit floor"
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </Link>
        <div>
          <p className="font-mono text-[0.65rem] tracking-[0.2em] text-subtle uppercase">
            Window
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Cage</h1>
        </div>
      </div>

      <section
        className={cn(
          "rounded-xl p-5 shadow-panel",
          plaqueOk ? "bg-elevated" : "bg-accent text-accent-fg",
        )}
      >
        <p
          className={cn(
            "font-mono text-[0.65rem] tracking-[0.2em] uppercase",
            plaqueOk ? "text-muted" : "text-accent-fg/80",
          )}
        >
          House plaque
        </p>
        <p className="mt-2 font-display text-2xl font-semibold">
          {plaqueOk ? "Variance 0.00" : `Variance ${pit.variance.toFixed(2)}`}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-sm sm:grid-cols-3">
          <div>
            <dt className={plaqueOk ? "text-subtle" : "text-accent-fg/70"}>Σ Dr</dt>
            <dd>{pit.totals.dr.toFixed(2)}</dd>
          </div>
          <div>
            <dt className={plaqueOk ? "text-subtle" : "text-accent-fg/70"}>Σ Cr</dt>
            <dd>{pit.totals.cr.toFixed(2)}</dd>
          </div>
          <div>
            <dt className={plaqueOk ? "text-subtle" : "text-accent-fg/70"}>Status</dt>
            <dd>{plaqueOk ? "OPEN" : "FROZEN"}</dd>
          </div>
        </dl>
        {!plaqueOk ? (
          <p className="mt-3 text-sm">
            Tables are frozen until the book balances. Σ Dr must equal Σ Cr.
          </p>
        ) : null}
      </section>

      <section className="rounded-xl bg-elevated p-5 shadow-panel">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-muted uppercase">
          Stack
        </p>
        <p className="mt-1 font-display text-4xl font-semibold">
          {formatChips(pit.chips)}
          <span className="ml-2 font-sans text-base font-normal text-muted">chips</span>
        </p>
        <p className="mt-2 text-sm text-muted">
          {pit.signedIn
            ? "Signed in — stack is persisted to the cage ledger."
            : "Guest session — stack lives in this browser until you sign in."}
        </p>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            className="min-h-11 w-full"
            disabled={busy !== null || pit.frozen}
            onClick={() => void onBuyIn()}
          >
            {busy === "in" ? "Posting…" : `Buy-in ${formatChips(BUY_IN_CHIPS)}`}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full"
            disabled={busy !== null || pit.frozen || pit.chips <= 0}
            onClick={() => void onCashOut()}
          >
            {busy === "out" ? "Posting…" : "Cash out"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-subtle">
          Simulated chips only. No deposits, no withdrawals, no real money.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Journal</h2>
        <p className="mt-1 text-sm text-muted">
          Last eight balanced postings
          {pit.signedIn ? " from the house book." : " from this guest session."}
        </p>
        {postings.length === 0 ? (
          <p className="mt-6 text-sm text-subtle">No posts yet. Buy in to open a stack.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {postings.map((p) => (
              <li key={p.ref} className="rounded-lg bg-elevated p-3 shadow-panel">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-xs tracking-wide text-fg uppercase">
                    {refKind(p.ref)}
                  </span>
                  <span className="font-mono text-[0.65rem] text-subtle">
                    {p.createdAt.slice(11, 19)}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
                  {p.legs.map((leg, i) => (
                    <li key={`${p.ref}-${i}`} className="flex justify-between gap-3">
                      <span>
                        {leg.dr > 0 ? "Dr" : "Cr"} {leg.account} {accountName(leg.account)}
                      </span>
                      <span className="text-fg">
                        {(leg.dr > 0 ? leg.dr : leg.cr).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
