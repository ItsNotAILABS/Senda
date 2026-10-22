import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bot, Gamepad2, RefreshCw, Send, ShoppingBag, Sparkles } from "lucide-react";
import { WalletPicker } from "@/components/wallet-picker";
import { FdvDesk } from "@/components/fdv-desk";
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
  const [pulse, setPulse] = useState(0);
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
    const on = () => {
      setPulse((n) => n + 1);
      window.setTimeout(() => setPulse((n) => n + 1), 7000);
    };
    window.addEventListener("senda-account", on);
    return () => window.removeEventListener("senda-account", on);
  }, []);
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
            const name = names.find((n) => n.mint === t.mint);
            return name ? sum + t.ui * name.last : sum;
          }, 0),
        );
      })
      .catch(() => live && setUsdc(0));
    return () => {
      live = false;
    };
  }, [owner, names, pulse]);

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
      const done = await runPrestock({ owner: who, mint: chosen.mint, side: "buy", usd: buyUsd, price: chosen.last, symbol: chosen.symbol, desk: "home" });
      toast.success(`${chosen.symbol} is in the wallet. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The buy did not send.");
    } finally {
      setBuying(false);
    }
  }

  const total = usdc + held + (wallet.w.balances.USD || 0);
  const widest = [...pre].sort((a, b) => Math.abs(b.premium ?? 0) - Math.abs(a.premium ?? 0))[0];

  return (
    <main className="space-y-6 px-4 py-3">
      <section>
        <Link to="/vault" className="text-sm text-white/50">
          Total wealth
        </Link>
        <p className="mt-1 font-mono text-5xl tracking-tight tabular-nums">${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p className="mt-1 text-sm text-white/45">Cash ${usdc.toFixed(2)} · SOL {sol.toLocaleString("en-US", { maximumFractionDigits: 4 })}</p>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Invest</h2>
          <Link to="/invest" className="text-sm text-white/50">
            Names, metals, and the rest ›
          </Link>
        </div>
        <ul className="mt-3 flex gap-3 overflow-x-auto rounded-[28px] border-2 border-[#d7e36a] p-2 pb-3">
          {pre.slice(0, 8).map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => choose(n)} className="w-64 rounded-[22px] bg-black px-3 py-3 text-left">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="grid size-10 place-items-center rounded-full bg-white text-xs font-semibold text-black">{n.symbol.slice(0, 2)}</span>
                    <span>
                      <span className="block text-sm font-semibold">{n.symbol}</span>
                      <span className={cn("font-mono text-xs", (n.change24h ?? 0) < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                        {n.change24h == null ? "—" : `${n.change24h >= 0 ? "+" : ""}${(Math.abs(n.change24h) <= 2 ? n.change24h * 100 : n.change24h).toFixed(2)}%`}
                      </span>
                    </span>
                  </span>
                  <span className="font-mono text-sm">{formatUsd(n.last)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[22px] bg-[#141418] p-4">
        <p className="text-sm text-white/45">Senda</p>
        <p className="mt-1 text-2xl font-semibold">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "—"}</p>
        <p className="mt-2 text-sm text-white/55">Connect a wallet. That address is the account.</p>
        <div className="mt-4">
          <WalletPicker />
        </div>
      </section>

      {widest ? (
        <Link to="/invest/radar" className="block text-sm text-[#c6f56a]">
          Radar · {widest.symbol} is the widest gap to its mark, {formatPremium(widest.premium)}.
        </Link>
      ) : null}

      <section>
        <h2 className="text-xl font-semibold">Positions</h2>
        <p className="mt-2 font-mono text-lg">{sol.toFixed(4)} SOL</p>
        <p className="text-sm text-white/50">{owner ? "In this Phantom." : "Connect Phantom."}</p>
      </section>

      <FdvDesk />

      <section>
        <h2 className="text-xl font-semibold">Buy a name</h2>
        {chosen ? (
          <div className="mt-3 rounded-[22px] bg-[#141418] p-4">
            <div className="flex items-center gap-3">
              <Mark symbol={chosen.symbol} />
              <div>
                <p className="font-semibold">{chosen.symbol}</p>
                <p className="font-mono text-sm">{formatUsd(chosen.last)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[0.01, 0.1, 1, 25, 100].map((n) => (
                <button key={n} type="button" onClick={() => setBuyUsd(n)} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", buyUsd === n ? "bg-white text-black" : "bg-black/40")}>
                  ${n}
                </button>
              ))}
            </div>
            <button type="button" disabled={buying} onClick={() => void buyChosen()} className="mt-3 min-h-11 rounded-full bg-[#d7e36a] px-5 text-sm font-semibold text-black disabled:opacity-50">
              {buying ? "Waiting on Phantom…" : `Buy $${buyUsd}`}
            </button>
          </div>
        ) : null}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Companies</h2>
          <Link to="/pre" className="text-sm text-white/50">
            All names
          </Link>
        </div>
        <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {pre.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => choose(n)} className="flex w-40 items-center gap-2 rounded-2xl bg-[#141418] px-3 py-3 text-left">
                <Mark symbol={n.symbol} />
                <span>
                  <span className="block text-sm font-semibold">{n.symbol}</span>
                  <span className="block font-mono text-xs">{formatUsd(n.last)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[22px] bg-[#141418] p-4">
        <h2 className="text-xl font-semibold">Predict</h2>
        <p className="mt-1 text-sm text-white/55">USDC leaves the wallet and sits in the pot until the hour ends. One side only, it comes back.</p>
        <div className="mt-3 flex gap-2">
          <Link to="/social" className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black">Stake above</Link>
          <Link to="/social" className="min-h-10 rounded-full bg-black/40 px-4 text-sm font-semibold">Stake below</Link>
        </div>
      </section>

      <section className="grid gap-2">
        <Tile to="/pre" icon={Sparkles} tint="bg-[#1c2a12] text-[#c6f56a]" title="Companies" hint="Buy a pre-IPO name" />
        <Tile to="/wallet" icon={RefreshCw} tint="bg-[#1a1c28] text-white" title="Convert" hint="Swap what you already hold" />
        <Tile to="/social" icon={Gamepad2} tint="bg-[#241818] text-[#ffb4a2]" title="Predict" hint="Above or below the print" />
        <Tile to="/cards" icon={ShoppingBag} tint="bg-[#1c2418] text-[#d7e36a]" title="Pay" hint="The card on this computer, then USDC" />
        <Tile to="/payments" icon={Send} tint="bg-[#181c24] text-white" title="Send" hint="Send USDC to someone" />
        <Tile to="/agents" icon={Bot} tint="bg-[#201c28] text-white" title="Agents" hint="Make one, or hire a trader" />
      </section>

      <section className="rounded-[22px] bg-[#141418] p-4">
        <h2 className="text-xl font-semibold">Shop with the cash</h2>
        <p className="mt-1 text-sm text-white/55">The number is a cap on the USDC in the wallet. It is not a charge a store can run.</p>
        <input value={spend} onChange={(e) => setSpend(e.target.value)} inputMode="decimal" className="mt-3 min-h-11 w-full rounded-full bg-black/40 px-4 font-mono outline-none" />
        <button type="button" onClick={mintNumber} className="mt-3 min-h-11 rounded-full bg-[#d7e36a] px-5 text-sm font-semibold text-black">
          Mint the number
        </button>
        {reveal ? <p className="mt-3 font-mono text-sm">{reveal.pan} · {reveal.expiry} · {reveal.cvv}</p> : null}
      </section>

      <section className="rounded-[22px] bg-[#141418] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">AI agent budget</h2>
          <Link to="/agents" className="text-sm text-white/50">Open</Link>
        </div>
        <p className="mt-1 text-sm text-white/55">A send bigger than this is refused. You still sign.</p>
        <p className="mt-3 font-mono text-3xl">${cap}</p>
        <div className="mt-3 flex gap-2">
          {[25, 100, 500].map((n) => (
            <button key={n} type="button" onClick={() => { setCap(setSpendCap(n)); }} className={cn("min-h-10 rounded-full px-4 text-sm font-semibold", cap === n ? "bg-white text-black" : "bg-black/40")}>
              ${n}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Recent</h2>
        <p className="mt-2 text-sm text-white/45">{owner ? "Fills land in Portfolio after the wallet signs." : "Nothing from this account yet."}</p>
        {lead && cheap && rich ? (
          <p className="mt-2 text-sm text-white/55">
            Widest {lead.symbol}. Cheapest gap {cheap.symbol}. Richest gap {rich.symbol}.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function Tile({
  to,
  icon: Icon,
  tint,
  title,
  hint,
}: {
  to: "/" | "/pre" | "/wallet" | "/social" | "/cards" | "/payments" | "/agents";
  icon: typeof Sparkles;
  tint: string;
  title: string;
  hint: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-[#10131c] px-3 py-3">
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
