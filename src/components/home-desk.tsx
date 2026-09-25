import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Gamepad2, RefreshCw, Send, ShoppingBag, Sparkles } from "lucide-react";
import { readChain } from "@/lib/phantom";
import { spendCap } from "@/lib/spend-cap";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { to: "/pre", label: "Buy a company", hint: "PreStocks on Jupiter", icon: Sparkles, tint: "text-accent" },
  { to: "/wallet", label: "Convert", hint: "SOL, USDC, or a PreStock", icon: RefreshCw, tint: "text-[#c084fc]" },
  { to: "/social", label: "Play", hint: "Which name moves", icon: Gamepad2, tint: "text-[#60a5fa]" },
  { to: "/cards", label: "Spend", hint: "A number, not the share", icon: ShoppingBag, tint: "text-[#facc15]" },
  { to: "/payments", label: "Send", hint: "Same cash you trade", icon: Send, tint: "text-[#22d3ee]" },
  { to: "/agents", label: "Give an agent a cap", hint: "It can send. You sign.", icon: Bot, tint: "text-[#c084fc]" },
] as const;

export function HomeDesk({ names }: { names: HouseListing[] }) {
  const pre = names.filter((n) => n.venue === "prestocks" && n.last > 0).sort((a, b) => Math.abs(b.premium ?? 0) - Math.abs(a.premium ?? 0));
  const lead = pre[0];
  const rest = pre.slice(1, 5);
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [sol, setSol] = useState(0);
  const [usdc, setUsdc] = useState(0);
  const [held, setHeld] = useState(0);
  const [cap, setCap] = useState(100);

  useEffect(() => setCap(spendCap()), []);
  useEffect(() => {
    if (!owner) return;
    let live = true;
    readChain(owner)
      .then((s) => {
        if (!live) return;
        setSol(s.sol);
        setUsdc(s.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
        const v = s.tokens.reduce((sum, t) => {
          const name = pre.find((n) => n.mint === t.mint);
          return name ? sum + t.ui * name.last : sum;
        }, 0);
        setHeld(v);
      })
      .catch(() => live && setUsdc(0));
    return () => {
      live = false;
    };
  }, [owner, names]);

  const activity = wallet.w.txs.slice(0, 5);

  return (
    <main className="px-4 py-5 lg:px-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="rounded-3xl border border-border bg-surface p-6">
          <h1 className="max-w-xl text-4xl tracking-tight lg:text-5xl">
            Your money shouldn’t stop working{" "}
            <span className="text-accent">after you buy it.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted">
            Buy a PreStock. Convert what you already hold. Play the move. Hand an agent a cap. The wallet signs. Senda does not take the key.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/pre" className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
              Open the book
            </Link>
            <Link to="/vault" className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-semibold">
              Open the vault
            </Link>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-gradient-to-br from-[#14081f] via-[#07140f] to-[#05050a] p-6">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">On Solana, the mint does not close</p>
          <p className="mt-4 max-w-sm text-2xl">Same wallet. More things you can do with the token.</p>
          <div className="mt-6 grid grid-cols-2 gap-2 text-sm">
            {["Buy", "Convert", "Play", "Vault"].map((w) => (
              <div key={w} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                {w}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.to} to={a.to} className="rounded-2xl border border-border bg-surface px-3 py-3 hover:border-[#9945FF]">
              <Icon className={cn("size-4", a.tint)} />
              <p className="mt-2 text-sm font-semibold">{a.label}</p>
              <p className="text-xs text-muted">{a.hint}</p>
            </Link>
          );
        })}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_300px]">
        <div className="rounded-3xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Your wallet</p>
            <Link to="/wallet" className="text-xs text-accent">
              {owner ? "Open" : "Connect"}
            </Link>
          </div>
          <p className="mt-3 font-mono text-3xl">${(usdc + held).toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-subtle">{owner ? "USDC plus PreStocks in this wallet. SOL is shown apart." : "Nothing connected, so this is zero."}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <Row k="SOL" v={sol.toFixed(4)} sub={owner ? "In the wallet" : "—"} />
            <Row k="USDC" v={usdc.toFixed(2)} sub="Spendable" />
            <Row k="PreStocks" v={`$${held.toFixed(2)}`} sub="At the live token price" />
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Featured PreStocks</p>
            <Link to="/pre" className="text-xs text-accent">
              Full book
            </Link>
          </div>
          {lead ? (
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-xl font-semibold">{lead.symbol}</p>
                  <p className="text-xs text-subtle">{lead.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xl">{formatUsd(lead.last)}</p>
                  <p className={cn("font-mono text-xs", (lead.premium ?? 0) < 0 ? "text-up" : "text-down")}>{formatPremium(lead.premium)} vs mark</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full bg-gradient-to-r from-[#9945FF] to-[#14F195]"
                  style={{ width: `${Math.min(100, Math.max(8, (lead.last / Math.max(lead.mark, 0.01)) * 50))}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-subtle">Token versus the SPV mark. Not a price history.</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">PreStocks did not answer.</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {rest.map((n) => (
              <Link key={n.id} to="/pre" className="rounded-2xl bg-elevated px-3 py-2">
                <p className="text-sm font-semibold">{n.symbol}</p>
                <p className="font-mono text-xs">{formatUsd(n.last)}</p>
                <p className={cn("font-mono text-[11px]", (n.premium ?? 0) < 0 ? "text-up" : "text-down")}>{formatPremium(n.premium)}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Link to="/social" className="block rounded-3xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">The move</p>
            <p className="mt-2 text-sm text-muted">
              {lead ? `${lead.symbol} is ${formatPremium(lead.premium)} versus its mark. Play is that print, not a house number.` : "Waiting on the book."}
            </p>
          </Link>
          <Link to="/agents" className="block rounded-3xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">Agent cap</p>
            <p className="mt-2 font-mono text-2xl">${cap}</p>
            <p className="text-xs text-muted">A send above this is refused. Raised on the vault.</p>
          </Link>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold">Recent activity</p>
        {activity.length === 0 ? <p className="mt-3 text-sm text-subtle">No sends in this browser yet.</p> : null}
        <ul>
          {activity.map((t) => (
            <li key={t.id} className="flex items-baseline justify-between border-t border-border py-2 text-sm">
              <span>{t.note || t.kind}</span>
              <span className="font-mono text-xs text-muted">
                {t.amount} {t.ccy}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Row({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <li className="flex items-center justify-between rounded-2xl bg-elevated px-3 py-2">
      <span>
        <span className="block font-semibold">{k}</span>
        <span className="block text-[11px] text-subtle">{sub}</span>
      </span>
      <span className="font-mono">{v}</span>
    </li>
  );
}
