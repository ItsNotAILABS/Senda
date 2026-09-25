import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { WalletPicker } from "@/components/wallet-picker";
import { connectPhantom, readChain } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { writeUsing } from "@/lib/using";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const LOGO: Record<string, string> = {
  SPACEX: "/logos/spacex.png",
  OPENAI: "/logos/openai.png",
  ANTHROPIC: "/logos/anthropic.png",
  ANDURIL: "/logos/anduril.png",
  NEURALINK: "/logos/neuralink.png",
  FIGUREAI: "/logos/figureai.png",
  KALSHI: "/logos/kalshi.png",
  POLYMARKET: "/logos/polymarket.png",
  XAI: "/logos/xai.png",
};

export function HomeDesk({ names }: { names: HouseListing[] }) {
  const pre = names.filter((n) => n.venue === "prestocks" && n.last > 0);
  const featured = [...pre].sort((a, b) => Math.abs(b.premium ?? 0) - Math.abs(a.premium ?? 0));
  const lead = featured[0];
  const cheap = [...pre].sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0))[0];
  const rich = [...pre].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))[0];
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [sol, setSol] = useState(0);
  const [usdc, setUsdc] = useState(0);
  const [held, setHeld] = useState(0);
  const [cap, setCap] = useState(100);
  const [merchant, setMerchant] = useState("");
  const [spend, setSpend] = useState("40");
  const [reveal, setReveal] = useState<{ pan: string; cvv: string; expiry: string } | null>(null);
  const [pick, setPick] = useState("");
  const [buyUsd, setBuyUsd] = useState(25);
  const [buying, setBuying] = useState(false);
  const chosen = pre.find((n) => n.symbol === pick) ?? featured[0];

  useEffect(() => setCap(spendCap()), []);
  useEffect(() => {
    if (!owner) return;
    let live = true;
    readChain(owner)
      .then((s) => {
        if (!live) return;
        setSol(s.sol);
        setUsdc(s.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
        setHeld(
          s.tokens.reduce((sum, t) => {
            const name = pre.find((n) => n.mint === t.mint);
            return name ? sum + t.ui * name.last : sum;
          }, 0),
        );
      })
      .catch(() => live && setUsdc(0));
    return () => {
      live = false;
    };
  }, [owner, names]);

  function mintNumber() {
    const n = Number(spend);
    const room = Math.max(held * 0.25, wallet.w.balances.USD);
    if (!(n > 0)) return toast.error("Set what this purchase can cost.");
    if (!(room > 0)) return toast.error("Buy or wrap something first. The number is a slice of what you already have.");
    if (n - room > 0.01) return toast.error(`That cap is above $${room.toFixed(0)}.`);
    const r = wallet.issueCheckout(n, merchant || "Checkout", "SENDA");
    if (!r.ok) return toast.error(r.error || "Could not mint the number.");
    setReveal({ pan: r.reveal.pan, cvv: r.reveal.cvv, expiry: r.reveal.expiry });
    toast.success("One number. This screen is the only place it is shown.");
  }

  function choose(n: HouseListing) {
    setPick(n.symbol);
    writeUsing({ symbol: n.symbol, name: n.name, last: n.last, premium: n.premium, mint: n.mint });
  }

  async function buyChosen() {
    if (!chosen) return;
    setBuying(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      choose(chosen);
      const done = await runPrestock({ owner: who, mint: chosen.mint, side: "buy", usd: buyUsd, price: chosen.last });
      toast.success(`${chosen.symbol} is in the wallet. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The buy did not send.");
    } finally {
      setBuying(false);
    }
  }

  const activity = wallet.w.txs.slice(0, 4);

  return (
    <main className="space-y-3 px-3 py-3 lg:px-4">
      <section className="senda-rise grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col justify-center rounded-[28px] border border-white/10 bg-[#0c0c14] p-6 lg:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Senda</p>
          <h1 className="mt-3 max-w-lg text-4xl leading-[1.05] tracking-tight lg:text-5xl">
            Your money. <span className="text-accent">Held here. Spent from here.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted">
            {owner
              ? `${sol.toFixed(2)} SOL and ${usdc.toFixed(2)} USDC are already in Phantom. Senda cash is what you send, put on a card, and hold in another currency. A company you hold stays in the wallet.`
              : "Connect Phantom. The money already in it shows up here. Senda cash is what you send, put on a card, and hold in another currency."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/payments" className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">Send</Link>
            <Link to="/cards" search={{ spend: 0 }} className="inline-flex min-h-12 items-center rounded-full border border-white/15 px-5 text-sm font-semibold">Card</Link>
            <Link to="/wallet" className="inline-flex min-h-12 items-center rounded-full border border-white/15 px-5 text-sm font-semibold">Exchange</Link>
          </div>
          {!owner ? <div className="mt-5 max-w-sm"><WalletPicker /></div> : null}
        </div>
        <div className="relative min-h-80 overflow-hidden rounded-[28px] border border-white/10">
          <video
            src="/video/desk.mp4"
            poster="/images/orbit.jpg"
            autoPlay
            muted
            loop
            playsInline
            className="senda-film h-full min-h-80 w-full object-cover"
          />
          <p className="absolute right-4 bottom-4 max-w-48 text-right text-xs tracking-[0.18em] text-white/80 uppercase">
            Same money. More uses.
          </p>
        </div>
      </section>
      <section className="senda-rise grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {(
            [
              ["/payments", "Send", "To a person, or nearby", "bg-[#14f195]/15"],
              ["/cards", "Card", "A number for a store", "bg-[#eab308]/15"],
              ["/wallet", "Exchange", "Dollars, euros, pesos, USDC", "bg-[#3b82f6]/15"],
              ["/vault", "Vault", "Wrap the wallet you have", "bg-[#9945ff]/20"],
              ["/cover", "Cover", "A drop, or a life event", "bg-[#ff5d73]/15"],
              ["/pre", "Holdings", "A company you can spend from", "bg-white/10"],
            ] as const
          ).map(([to, label, hint, tint]) => (
            <Link key={label} to={to === "/cards" ? "/cards" : to} search={to === "/cards" ? { spend: 0 } : undefined} className="rounded-2xl border border-white/10 bg-[#101018] px-3 py-3">
              <span className={cn("mb-2 grid size-8 place-items-center rounded-lg text-[10px] font-semibold", tint)}>{label.slice(0, 1)}</span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-[11px] text-muted">{hint}</span>
            </Link>
          ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#101018]">
          <div className="flex items-center justify-between px-4 pt-4">
            <p className="text-sm font-semibold">Card</p>
            <Link to="/cards" search={{ spend: 0 }} className="text-xs text-accent">
              Open
            </Link>
          </div>
          <div className="relative mt-3 h-56 overflow-hidden">
            <video src="/video/card.mp4" poster="/images/metal-card.jpg" autoPlay muted loop playsInline className="h-full w-full object-cover" />
          </div>
          <div className="flex gap-3 overflow-x-auto p-4">
            {wallet.w.cards.filter((c) => c.status !== "terminated").length === 0 ? (
              <Link to="/cards" search={{ spend: 0 }} className="text-sm">
                <span className="block font-semibold">No card yet</span>
                <span className="block text-xs text-muted">Make one. A store charges this cash, not the token.</span>
              </Link>
            ) : (
              wallet.w.cards
                .filter((c) => c.status !== "terminated")
                .slice(0, 3)
                .map((c) => (
                  <Link key={c.id} to="/cards" search={{ spend: 0 }} className="min-w-40">
                    <p className="text-[11px] text-subtle">{c.label}</p>
                    <p className="mt-1 font-mono text-sm">•••• {c.last4}</p>
                  </Link>
                ))
            )}
          </div>
        </div>
        <div className="relative min-h-72 overflow-hidden rounded-[28px] border border-white/10">
          <video src="/video/desk.mp4" poster="/images/orbit.jpg" autoPlay muted loop playsInline className="h-full min-h-72 w-full object-cover" />
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Your wallet</p>
            <Link to="/wallet" className="rounded-full border border-white/10 px-3 py-1 text-xs">
              {owner ? "Open" : "Connect Phantom"}
            </Link>
          </div>
          <p className="mt-3 font-mono text-4xl tracking-tight">${(usdc + held).toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-subtle">{owner ? "USDC plus PreStocks at the live price. SOL is separate." : "Connect a wallet. This stays zero until you do."}</p>
          <ul className="mt-4 space-y-2">
            <Bal k="SOL" v={sol.toFixed(3)} sub={owner ? "In Phantom" : "Not connected"} tint="bg-[#9945ff]" />
            <Bal k="USDC" v={usdc.toFixed(2)} sub="Spendable" tint="bg-[#2775ca]" />
            <Bal k="PreStocks" v={`$${held.toFixed(0)}`} sub="Still in the wallet" tint="bg-accent" />
          </ul>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Featured PreStocks</p>
            <Link to="/pre" className="text-xs text-accent">
              View all
            </Link>
          </div>
          {lead ? (
            <div className="mt-4 flex items-center gap-3">
              <Mark symbol={lead.symbol} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">{lead.symbol}</p>
                <p className="truncate text-xs text-subtle">{lead.name}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl">{formatUsd(lead.last)}</p>
                <p className={cn("font-mono text-xs", (lead.premium ?? 0) < 0 ? "text-accent" : "text-down")}>{formatPremium(lead.premium)} vs mark</p>
              </div>
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {featured.slice(1, 5).map((n) => (
              <Link key={n.id} to="/pre" className="rounded-2xl bg-black/40 px-2 py-2">
                <Mark symbol={n.symbol} />
                <p className="mt-2 text-xs font-semibold">{n.symbol}</p>
                <p className="font-mono text-[11px]">{formatUsd(n.last)}</p>
                <p className={cn("font-mono text-[11px]", (n.premium ?? 0) < 0 ? "text-accent" : "text-down")}>{formatPremium(n.premium)}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-4">
          <p className="text-sm font-semibold">The print, not a pool</p>
          <p className="mt-1 text-xs text-muted">Two names. No house odds. The one that moves is the one that moved.</p>
          <div className="mt-4 space-y-2">
            {cheap ? (
              <Link to="/pre" className="block rounded-2xl bg-[#14f195]/15 px-3 py-3">
                <p className="text-[11px] text-accent">Cheap versus the mark</p>
                <p className="text-sm font-semibold">{cheap.symbol}</p>
                <p className="font-mono text-xs">{formatPremium(cheap.premium)}</p>
              </Link>
            ) : null}
            {rich ? (
              <Link to="/social" className="block rounded-2xl bg-[#ff5d73]/15 px-3 py-3">
                <p className="text-[11px] text-down">Rich versus the mark</p>
                <p className="text-sm font-semibold">{rich.symbol}</p>
                <p className="font-mono text-xs">{formatPremium(rich.premium)}</p>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_280px]">
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-4">
          <p className="text-sm font-semibold">Spend it without selling it</p>
          <p className="mt-1 text-xs text-muted">
            One number for one store. The store sees the number. The token stays in the wallet. Cap is a quarter of what you hold, or the cash already here.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Store, or paste what you’re buying"
              className="min-h-11 flex-1 rounded-2xl bg-black/40 px-3 text-sm outline-none"
            />
            <input
              value={spend}
              onChange={(e) => setSpend(e.target.value)}
              inputMode="decimal"
              className="min-h-11 w-24 rounded-2xl bg-black/40 px-3 font-mono text-sm outline-none"
              aria-label="Cap"
            />
          </div>
          <button type="button" onClick={mintNumber} className="mt-3 min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
            Mint the number
          </button>
          {reveal ? (
            <p className="mt-3 font-mono text-xs text-accent">
              {reveal.pan} · {reveal.expiry} · {reveal.cvv}
            </p>
          ) : null}
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Agent budget</p>
            <Link to="/agents" className="text-xs text-accent">
              Open the computer
            </Link>
          </div>
          <p className="mt-1 text-xs text-muted">A send bigger than this is refused. The key never leaves the wallet.</p>
          <p className="mt-3 font-mono text-3xl">${cap}</p>
          <div className="mt-3 flex gap-2">
            {[25, 100, 500].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCap(setSpendCap(n))}
                className={cn("min-h-9 rounded-full px-3 font-mono text-xs", cap === n ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}
              >
                ${n}
              </button>
            ))}
          </div>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            <li>Signs only when you press run</li>
            <li>Cannot wrap more USDC than the wallet holds</li>
            <li>Stops if the book’s drawdown trips the gate</li>
          </ul>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-4">
          <p className="text-sm font-semibold">Recent</p>
          {activity.length === 0 ? <p className="mt-3 text-xs text-subtle">Nothing sent from this browser yet.</p> : null}
          <ul>
            {activity.map((t) => (
              <li key={t.id} className="border-t border-white/10 py-2 text-xs">
                <span className="block text-fg">{t.note || t.kind}</span>
                <span className="font-mono text-subtle">
                  {t.amount} {t.ccy}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function Mark({ symbol }: { symbol: string }) {
  const src = LOGO[symbol];
  if (!src) return <span className="grid size-8 place-items-center rounded-full bg-elevated text-[10px]">{symbol.slice(0, 2)}</span>;
  return <img src={src} alt="" className="size-8 rounded-full bg-white object-contain p-1" />;
}

function Bal({ k, v, sub, tint }: { k: string; v: string; sub: string; tint: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-black/30 px-3 py-2">
      <span className={cn("size-8 rounded-full", tint)} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{k}</span>
        <span className="block text-[11px] text-subtle">{sub}</span>
      </span>
      <span className="font-mono text-sm">{v}</span>
    </li>
  );
}
