import { useMemo, useState } from "react";
import { toast } from "sonner";
import { loadJobs, saveJobs, todayKey, type AgentJobs } from "@/lib/agents";
import { connectPhantom, readChain } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Id = "cheap" | "rich" | "daily";

export function AgentsDesk({ names }: { names: HouseListing[] }) {
  const book = useMemo(
    () => names.filter((n) => n.venue === "prestocks" && n.last > 0 && n.mark > 0),
    [names],
  );
  const cheap = [...book].sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0))[0];
  const rich = [...book].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))[0];
  const [id, setId] = useState<Id>("cheap");
  const [jobs, setJobs] = useState<AgentJobs>(() => loadJobs());
  const [usd, setUsd] = useState(25);
  const [symbol, setSymbol] = useState(book[0]?.symbol ?? "");
  const [busy, setBusy] = useState(false);
  const wallet = useWallet();
  const picked = book.find((n) => n.symbol === symbol) ?? book[0];

  function put(next: AgentJobs) {
    setJobs(saveJobs(next));
  }

  async function owner(): Promise<string> {
    const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
    const who = existing || (await connectPhantom());
    if (!existing) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
    }
    return who;
  }

  async function run() {
    setBusy(true);
    try {
      const who = await owner();
      if (id === "cheap") {
        if (!cheap) throw new Error("No names on the book.");
        const done = await runPrestock({ owner: who, mint: cheap.mint, side: "buy", usd, price: cheap.last });
        put({ ...jobs, cheap: { usd, under: cheap.premium ?? 0 } });
        toast.success(`Bought ${cheap.symbol}. ${done.signature.slice(0, 8)}…`);
      } else if (id === "rich") {
        const snap = await readChain(who);
        const held = book.find((n) => (snap.tokens.find((t) => t.mint === n.mint)?.ui ?? 0) > 0 && (n.premium ?? 0) > 0);
        const target = held ?? null;
        if (!target) throw new Error("Nothing you hold is above its mark.");
        const done = await runPrestock({ owner: who, mint: target.mint, side: "sell", usd, price: target.last });
        put({ ...jobs, rich: { usd } });
        toast.success(`Sold ${target.symbol}. ${done.signature.slice(0, 8)}…`);
      } else {
        if (!picked) throw new Error("Pick a name.");
        if (jobs.daily?.mint === picked.mint && jobs.daily.lastDay === todayKey()) {
          throw new Error(`Today's buy of ${picked.symbol} already went out.`);
        }
        const done = await runPrestock({ owner: who, mint: picked.mint, side: "buy", usd, price: picked.last });
        put({ ...jobs, daily: { symbol: picked.symbol, mint: picked.mint, usd, lastDay: todayKey() } });
        toast.success(`Bought ${picked.symbol}. ${done.signature.slice(0, 8)}…`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "It did not send.");
    } finally {
      setBusy(false);
    }
  }

  const rows: { id: Id; title: string; line: string }[] = [
    {
      id: "cheap",
      title: "Buy what's cheap",
      line: cheap ? `${cheap.symbol} is ${formatPremium(cheap.premium)} versus its mark.` : "Waiting on the book.",
    },
    {
      id: "rich",
      title: "Sell what got rich",
      line: rich && (rich.premium ?? 0) > 0 ? `${rich.symbol} is ${formatPremium(rich.premium)} over its mark.` : "Nothing on the book is over its mark.",
    },
    {
      id: "daily",
      title: "Buy one every day",
      line: jobs.daily ? `${jobs.daily.symbol} · $${jobs.daily.usd} · last ${jobs.daily.lastDay || "never"}` : "Pick a name. One buy a day.",
    },
  ];

  return (
    <div className="grid min-h-[70vh] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="border-b border-border lg:border-r lg:border-b-0">
        <header className="px-5 pt-6 pb-3">
          <h1 className="font-display text-4xl">Agents</h1>
          <p className="mt-2 text-sm text-muted">They use your wallet. You approve every send.</p>
        </header>
        <ul>
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setId(r.id)}
                className={cn("w-full px-5 py-4 text-left", id === r.id ? "bg-elevated" : "hover:bg-surface")}
              >
                <span className="block text-sm font-semibold">{r.title}</span>
                <span className="mt-1 block text-xs text-muted">{r.line}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="px-5 py-6 lg:px-10">
        <h2 className="font-display text-4xl">{rows.find((r) => r.id === id)?.title}</h2>
        <p className="mt-3 max-w-lg text-sm text-muted">{rows.find((r) => r.id === id)?.line}</p>
        {id === "daily" ? (
          <select
            value={picked?.symbol ?? ""}
            onChange={(e) => setSymbol(e.target.value)}
            className="mt-4 min-h-11 rounded-lg bg-elevated px-3 text-sm"
          >
            {book.map((n) => (
              <option key={n.id} value={n.symbol}>
                {n.symbol} · {formatUsd(n.last)}
              </option>
            ))}
          </select>
        ) : null}
        {id === "cheap" && cheap ? (
          <p className="mt-4 font-mono text-sm">
            {formatUsd(cheap.last)} token · {formatUsd(cheap.mark)} mark
          </p>
        ) : null}
        <div className="mt-4 flex gap-1">
          {[10, 25, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setUsd(n)}
              className={cn("min-h-9 rounded-lg px-3 font-mono text-xs", usd === n ? "bg-fg text-bg" : "bg-elevated text-muted")}
            >
              ${n}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || book.length === 0}
          onClick={() => void run()}
          className="mt-6 min-h-12 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? "Waiting for the wallet…" : `Run · $${usd}`}
        </button>
        {book.length === 0 ? <p className="mt-4 text-sm text-muted">PreStocks did not answer. Nothing to run.</p> : null}
      </section>
    </div>
  );
}
