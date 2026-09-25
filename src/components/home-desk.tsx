import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronRight, Gamepad2, RefreshCw, ShoppingBag, Sparkles } from "lucide-react";
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

  const activity = wallet.w.txs.slice(0, 4);

  return (
    <main className="space-y-4 px-4 py-4 lg:px-6">
      <section>
        <h1 className="max-w-3xl font-display text-4xl leading-[0.95] tracking-tight sm:text-6xl">
          Your pre-IPO shouldn’t sit still after you buy it.
        </h1>
        <p className="mt-4 max-w-md text-sm text-muted sm:text-base">
          The mint already trades. Pay anyone on Solana in USDC. Cover a drop. The wallet you have is the account.
        </p>
      </section>

      <section className="relative overflow-hidden rounded-[28px] border border-white/10">
        <video
          src="/video/desk.mp4"
          poster="/images/orbit.jpg"
          autoPlay
          muted
          loop
          playsInline
          className="h-[340px] w-full object-cover sm:h-[460px]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
        <div className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile to="/pre" icon={Sparkles} tint="bg-[#14f195] text-black" title="Buy" hint="The mint" />
          <Tile to="/cards" search={{ spend: 0 }} icon={ShoppingBag} tint="bg-white text-black" title="Pay USDC" hint="They receive it" />
          <Tile to="/social" icon={Gamepad2} tint="bg-white/15 text-white" title="Play" hint="The live print" />
          <Tile to="/wallet" icon={RefreshCw} tint="bg-white/15 text-white" title="Convert" hint="SOL into the name" />
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#10131c]">
        <MoneyRow to="/payments" k="Cash" sub={owner ? "This browser" : "Connect to see the wallet"} v={`$${(wallet.w.balances.USD || 0).toFixed(0)}`} tint="bg-[#14f195]" />
        <MoneyRow to="/vault" k="PreStocks" sub="Still in the wallet" v={`$${held.toFixed(0)}`} tint="bg-white" />
        <MoneyRow to="/wallet" k="USDC" sub={owner ? `${usdc.toFixed(2)} ready to send` : "Not connected"} v={owner ? `${sol.toFixed(2)} SOL` : "—"} tint="bg-[#2775ca]" />
      </section>

      <section className="grid overflow-hidden rounded-[28px] border border-white/10 bg-[#10131c] md:grid-cols-[220px_minmax(0,1fr)]">
        <video src="/video/card.mp4" poster="/images/metal-card.jpg" autoPlay muted loop playsInline className="h-52 w-full object-cover md:h-full" />
        <div className="flex flex-col justify-center p-6">
          <p className="text-[11px] tracking-[0.18em] text-accent uppercase">The card for this market</p>
          <h2 className="mt-2 max-w-lg font-display text-3xl leading-none tracking-tight">Anyone who can receive USDC can be paid from here.</h2>
          <p className="mt-3 max-w-md text-sm text-muted">No bank. No BIN. Their address, your signature, USDC on mainnet. The number on Shop is only a cap. The transfer is the card.</p>
          <Link to="/cards" search={{ spend: 0 }} className="mt-5 inline-flex w-fit min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
            Pay someone
          </Link>
        </div>
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
    <Link to={to} search={search} className="flex items-center gap-3 rounded-[20px] bg-[#10131c]/90 px-3 py-3 backdrop-blur-md">
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

function MoneyRow({ to, k, sub, v, tint }: { to: "/payments" | "/vault" | "/wallet"; k: string; sub: string; v: string; tint: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 border-t border-white/10 px-4 py-4 first:border-t-0">
      <span className={cn("size-10 rounded-full", tint)} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{k}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
      <span className="font-mono text-sm tabular-nums">{v}</span>
      <ChevronRight className="size-4 text-white/40" />
    </Link>
  );
}
