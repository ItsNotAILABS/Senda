import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bot, Gamepad2, RefreshCw, Send, ShoppingBag, Sparkles } from "lucide-react";
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

  const total = usdc + held + (wallet.w.balances.USD || 0);
  const activity = wallet.w.txs.slice(0, 4);

  return (
    <main className="space-y-3 px-4 py-3 lg:px-5">
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4 lg:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Your wallet</p>
              <p className="font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">
                {owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Not connected"}
              </p>
            </div>
            <p className="mt-2 font-mono text-5xl tracking-tight tabular-nums">
              ${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="mt-1 text-xs text-subtle">
              {owner ? "Cash, USDC, and PreStocks at the live price." : "Connect a wallet. This stays zero until you do."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/wallet" className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
              {owner ? "Open" : "Connect Phantom"}
            </Link>
            <Link to="/pre" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
              Get started
            </Link>
            <Link to="/payments" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
              Send
            </Link>
          </div>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Bal k="SOL" v={sol.toFixed(3)} sub={owner ? "In Phantom" : "Not connected"} tint="bg-[#9945ff]" />
          <Bal k="USDC" v={usdc.toFixed(2)} sub="Spendable" tint="bg-[#2775ca]" />
          <Bal k="Cash" v={`$${(wallet.w.balances.USD || 0).toFixed(0)}`} sub="Send and shop" tint="bg-white/30" />
          <Bal k="PreStocks" v={`$${held.toFixed(0)}`} sub="Still in the wallet" tint="bg-accent" />
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-sm font-semibold">Live book</p>
          <Link to="/pre" className="text-xs text-accent">View all</Link>
        </div>
        {pre.length === 0 ? (
          <p className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-6 text-sm text-subtle">No live price on the book.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto">
            {pre.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => choose(n)}
                className={cn(
                  "flex min-w-[132px] flex-1 flex-col rounded-[22px] border border-white/10 bg-[#10131c] p-3 text-left",
                  chosen?.symbol === n.symbol && "border-accent",
                )}
              >
                <span className="flex items-center gap-2">
                  <Mark symbol={n.symbol} />
                  <span className="truncate text-sm font-semibold">{n.symbol}</span>
                </span>
                <span className="mt-3 font-mono text-lg tabular-nums">{formatUsd(n.last)}</span>
                <span className={cn("font-mono text-xs tabular-nums", (n.premium ?? 0) < 0 ? "text-accent" : "text-down")}>
                  {formatPremium(n.premium)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Tile to="/pre" icon={Sparkles} tint="bg-[#14f195]/15 text-[#7dffa8]" title="Buy a company" hint="The mint, not a brokerage" />
        <Tile to="/wallet" icon={RefreshCw} tint="bg-[#9945ff]/20 text-[#d8b4fe]" title="Convert money" hint="SOL or USDC into the name" />
        <Tile to="/social" icon={Gamepad2} tint="bg-[#3b82f6]/15 text-[#93c5fd]" title="Play" hint="The faces are the book" />
        <Tile to="/cards" search={{ spend: 0 }} icon={ShoppingBag} tint="bg-[#eab308]/15 text-[#fde047]" title="Shop" hint="A number. Not the token." />
        <Tile to="/payments" icon={Send} tint="bg-[#22d3ee]/15 text-[#67e8f9]" title="Send" hint="Same cash, to a person" />
        <Tile to="/agents" icon={Bot} tint="bg-[#a855f7]/20 text-[#e9d5ff]" title="Give an AI a budget" hint="It asks. You sign." />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c]">
          <div className="grid sm:grid-cols-[minmax(0,1fr)_240px]">
            <div className="p-4">
              <p className="text-sm font-semibold">Buy {chosen?.symbol || "a name"}</p>
              {chosen ? (
                <div className="mt-4 flex items-center gap-3">
                  <Mark symbol={chosen.symbol} />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold">{chosen.symbol}</p>
                    <p className="truncate text-xs text-subtle">{chosen.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl tabular-nums">{formatUsd(chosen.last)}</p>
                    <p className={cn("font-mono text-xs tabular-nums", (chosen.premium ?? 0) < 0 ? "text-accent" : "text-down")}>
                      {formatPremium(chosen.premium)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs text-subtle">No live name to buy.</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {[10, 25, 100].map((n) => (
                  <button key={n} type="button" onClick={() => setBuyUsd(n)} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", buyUsd === n ? "bg-white text-black" : "bg-black/40")}>${n}</button>
                ))}
                <button type="button" disabled={buying || !chosen} onClick={() => void buyChosen()} className="min-h-9 rounded-full bg-accent px-4 text-xs font-semibold text-accent-fg disabled:opacity-50">
                  {buying ? "Waiting…" : `Buy ${chosen?.symbol || ""}`}
                </button>
              </div>
            </div>
            <div className="relative min-h-40 overflow-hidden">
              <video src="/video/desk.mp4" poster="/images/orbit.jpg" autoPlay muted loop playsInline className="h-full min-h-40 w-full object-cover" />
              <p className="absolute top-4 right-4 max-w-32 text-right text-[11px] tracking-[0.18em] text-white/80 uppercase">Same money. More possibilities.</p>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">The print</p>
            <Link to="/social" className="text-xs text-muted">Play</Link>
          </div>
          <p className="mt-1 text-xs text-muted">Two names on the live book. No invented pool.</p>
          <div className="mt-4 space-y-2">
            {cheap ? (
              <Link to="/pre" className="block rounded-2xl bg-[#d6ff4a]/10 px-3 py-3">
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
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c]">
          <div className="grid sm:grid-cols-[160px_minmax(0,1fr)]">
            <video src="/video/card.mp4" poster="/images/metal-card.jpg" autoPlay muted loop playsInline className="h-full min-h-40 w-full object-cover" />
            <div className="p-4">
              <p className="text-sm font-semibold">Shop with the cash</p>
              <p className="mt-1 text-xs text-muted">One number for one store. The charge comes out of cash. The token stays put.</p>
              <div className="mt-3 flex gap-2">
                <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Store" className="min-h-11 flex-1 rounded-2xl bg-black/40 px-3 text-sm outline-none" />
                <input value={spend} onChange={(e) => setSpend(e.target.value)} inputMode="decimal" aria-label="Cap" className="min-h-11 w-20 rounded-2xl bg-black/40 px-3 font-mono text-sm outline-none" />
              </div>
              <button type="button" onClick={mintNumber} className="mt-3 min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">Mint the number</button>
              {reveal ? <p className="mt-3 font-mono text-xs text-accent">{reveal.pan} · {reveal.expiry} · {reveal.cvv}</p> : null}
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">AI agent budget</p>
            <Link to="/agents" className="text-xs text-accent">Open</Link>
          </div>
          <p className="mt-1 text-xs text-muted">A send bigger than this is refused. You still sign.</p>
          <p className="mt-3 font-mono text-3xl">${cap}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, cap / 5)}%` }} />
          </div>
          <div className="mt-3 flex gap-2">
            {[25, 100, 500].map((n) => (
              <button key={n} type="button" onClick={() => setCap(setSpendCap(n))} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", cap === n ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}>${n}</button>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-sm font-semibold">Recent</p>
          {activity.length === 0 ? <p className="mt-3 text-xs text-subtle">Nothing from this account yet.</p> : null}
          <ul>
            {activity.map((t) => (
              <li key={t.id} className="border-t border-white/10 py-2 text-xs">
                <span className="block">{t.note || t.kind}</span>
                <span className="font-mono text-subtle">{t.amount} {t.ccy}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function Tile({
  to,
  search,
  icon: Icon,
  tint,
  title,
  hint,
}: {
  to: "/" | "/pre" | "/wallet" | "/social" | "/cards" | "/payments" | "/agents";
  search?: { spend: number };
  icon: typeof Sparkles;
  tint: string;
  title: string;
  hint: string;
}) {
  return (
    <Link to={to} search={search} className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-[#10131c] px-3 py-3">
      <span className={cn("grid size-10 place-items-center rounded-xl", tint)}>
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[11px] text-muted">{hint}</span>
      </span>
    </Link>
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
