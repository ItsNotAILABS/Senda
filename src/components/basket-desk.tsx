import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PACKS } from "@/lib/basket";
import { impactPct, quoteJup, type JupQuote } from "@/lib/jup-exec";
import { connectPhantom, PRESTOCK_MINTS } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { formatUsd, type HouseListing } from "@/lib/sol-house";

type Leg = {
  symbol: string;
  mint: string;
  target: number;
  live: number;
  usd: number;
  impact: number | null;
  route: string;
  ok: boolean;
  reason: string;
};

function mintFor(symbol: string, house: HouseListing[]): { mint: string; last: number } | null {
  const row = house.find((h) => h.symbol.toUpperCase() === symbol || h.symbol.replace(/[-_]/g, "").toUpperCase().includes(symbol));
  if (row?.mint && row.mint.length >= 32) return { mint: row.mint, last: row.last };
  const known = PRESTOCK_MINTS.find(([s]) => s === symbol);
  return known ? { mint: known[1], last: row?.last ?? 0 } : null;
}

export function BasketDesk({ house }: { house: HouseListing[] }) {
  const [raw, setRaw] = useState("100");
  const [packId, setPackId] = useState<string>(PACKS[0].id);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [busy, setBusy] = useState(false);
  const spend = Number(raw) || 0;
  const pre = house.filter((h) => h.venue === "prestocks");

  const bookKey = pre.map((h) => `${h.symbol}:${h.mint}`).join("|");

  useEffect(() => {
    const pack = PACKS.find((p) => p.id === packId) ?? PACKS[0];
    const found: { symbol: string; mint: string }[] = [];
    for (const symbol of pack.symbols) {
      const hit = mintFor(symbol, pre);
      if (hit) found.push({ symbol, mint: hit.mint });
    }
    if (found.length < 2 || !(spend > 0)) {
      setLegs([]);
      return;
    }
    let live = true;
    const handle = window.setTimeout(() => {
      const target = 1 / found.length;
      const each = Math.round((spend / found.length) * 100) / 100;
      setLegs(
        found.map((f) => ({
          symbol: f.symbol,
          mint: f.mint,
          target,
          live: target,
          usd: each,
          impact: null,
          route: "",
          ok: false,
          reason: "Asking Jupiter…",
        })),
      );
      void Promise.all(
        found.map(async (f) => {
          if (!(each >= 1)) return { symbol: f.symbol, mint: f.mint, q: { error: "Each name needs at least $1." } as { error: string } };
          try {
            return { symbol: f.symbol, mint: f.mint, q: await quoteJup({ data: { mint: f.mint, usd: each, side: "buy" } }) };
          } catch {
            return { symbol: f.symbol, mint: f.mint, q: { error: "No quote." } as { error: string } };
          }
        }),
      ).then((rows) => {
        if (!live) return;
        const judged = rows.map((row) => {
          const q = row.q;
          if ("error" in q) {
            return { symbol: row.symbol, mint: row.mint, target, impact: null as number | null, route: "", ok: false, reason: q.error };
          }
          const impact = impactPct(q as JupQuote);
          const ok = impact <= 1;
          return {
            symbol: row.symbol,
            mint: row.mint,
            target,
            impact,
            route: (q as JupQuote).route.join(" → ") || "Jupiter",
            ok,
            reason: ok ? "Fills" : `Impact ${impact.toFixed(2)}%`,
          };
        });
        const survivors = judged.filter((j) => j.ok).length;
        const liveW = survivors > 0 ? 1 / survivors : 0;
        const liveUsd = survivors > 0 ? Math.round((spend / survivors) * 100) / 100 : 0;
        setLegs(
          judged.map((j) => ({
            ...j,
            live: j.ok ? liveW : 0,
            usd: j.ok ? liveUsd : 0,
          })),
        );
      });
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
    // bookKey is the house identity. `pre` is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId, spend, bookKey]);

  async function buy() {
    const ready = legs.filter((l) => l.ok && l.usd >= 1);
    if (!ready.length) {
      toast.error("No leg quoted inside 1% impact.");
      return;
    }
    setBusy(true);
    try {
      const owner = await connectPhantom();
      const sigs: string[] = [];
      for (const leg of ready) {
        const last = pre.find((h) => h.mint === leg.mint)?.last;
        const done = await runPrestock({ owner, mint: leg.mint, side: "buy", usd: leg.usd, price: last });
        sigs.push(done.signature);
      }
      toast.success(`${sigs.length} signatures. Tokens are in the wallet.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A leg did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pb-8">
      <p className="pt-3 text-sm text-muted">
        Pick a pack and a size. Each name is quoted live. A leg that cannot fill at 1% impact is dropped, and the dollars move onto the names that can. You sign once per name. Jupiter will not pack these into one transaction.
      </p>
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Dollars"
        className="mt-4 min-h-12 w-full rounded-2xl bg-elevated px-4 font-mono text-lg outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPackId(p.id)}
            className={p.id === packId ? "min-h-10 rounded-full bg-fg px-4 text-xs font-semibold text-bg" : "min-h-10 rounded-full bg-elevated px-4 text-xs font-semibold text-muted"}
          >
            {p.name}
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {legs.map((leg) => (
          <li key={leg.mint} className="rounded-2xl bg-elevated px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">{leg.symbol}</p>
              <p className="font-mono text-xs text-subtle">{leg.ok ? `$${leg.usd.toFixed(2)}` : "Dropped"}</p>
            </div>
            <p className="mt-1 font-mono text-[11px] text-subtle">
              Target {(leg.target * 100).toFixed(1)}% · live {(leg.live * 100).toFixed(1)}%
              {leg.impact != null ? ` · impact ${leg.impact.toFixed(2)}%` : ""} · {leg.route || leg.reason}
            </p>
          </li>
        ))}
      </ul>
      {legs.length === 0 ? <p className="mt-4 text-sm text-muted">Enter at least $2 so two names can quote.</p> : null}
      <button type="button" disabled={busy || !legs.some((l) => l.ok)} onClick={() => void buy()} className="mt-4 min-h-12 w-full rounded-full bg-fg text-sm font-semibold text-bg disabled:opacity-50">
        {busy ? "Waiting for signatures…" : `Sign ${legs.filter((l) => l.ok).length} legs`}
      </button>
      <p className="mt-3 text-[11px] text-subtle">
        {pre.filter((h) => h.last > 0).slice(0, 3).map((h) => `${h.symbol} ${formatUsd(h.last)}`).join(" · ")}
      </p>
    </div>
  );
}
