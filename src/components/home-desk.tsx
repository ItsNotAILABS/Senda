import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeftRight, Bot, ChevronRight, CircleDollarSign, Gamepad2, Plus, Send, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { connectPhantom, readChain } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { writeUsing } from "@/lib/using";
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
  const cards = wallet.w.cards.filter((c) => c.status !== "terminated").slice(0, 3);

  useEffect(() => setCap(spendCap()), []);
  useEffect(() => {
    if (!owner) return;
    let live = true;
    readChain(owner)
      .then((s) => {
        if (!live) return;
        setUsdc(s.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
        setHeld(
          s.tokens.reduce((sum, t) => {
            const name = pre.find((n) => n.mint === t.mint);
            return name ? sum + t.ui * name.last : sum;
          }, 0),
        );
      })
      .catch(() => {
        if (live) setUsdc(0);
      });
    return () => {
      live = false;
    };
  }, [owner, names]);

  const cash = usdc + (wallet.w.balances.USD || 0);

  function choose(n: HouseListing) {
    setPick(n.symbol);
    writeUsing({ symbol: n.symbol, name: n.name, last: n.last, premium: n.premium, mint: n.mint });
  }

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

  return (
    <main className="space-y-4 px-5 py-4 lg:px-8">
      <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(420px,0.86fr)_minmax(0,1.14fr)]">
        <div className="flex flex-col">
          <h1 className="font-display text-[40px] leading-[1.02] font-medium tracking-[-0.035em] text-white xl:text-[56px]">
            Your money shouldn’t stop working after you invest it.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/55">
            Hold a pre-IPO name on Solana. Pay anyone in USDC. The position stays in your wallet.
          </p>
          <section className="mt-6 overflow-hidden rounded-[28px] bg-[#14141c]">
            <Row to="/payments" kind="cash" k="Cash" sub="Available to spend" v={money(cash)} />
            <Row to="/vault" kind="invest" k="Investments" sub={owner ? "PreStocks in the wallet" : "Your portfolio"} v={money(held)} />
          </section>
        </div>
        <div className="relative min-h-[420px] overflow-hidden rounded-[28px]">
          <img src="/images/orbit.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Act to="/payments" search={{ act: "add" }} icon={Plus} label="Add" />
            <Act to="/payments" icon={Send} label="Send" />
            <Act to="/wallet" icon={ArrowLeftRight} label="Exchange" />
            <Act to="/vault" icon={Wallet} label="Details" />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between px-1">
          <h2 className="font-display text-2xl tracking-tight">The book</h2>
          <Link to="/pre" className="text-sm text-accent">
            All names
          </Link>
        </div>
        {pre.length === 0 ? (
          <p className="rounded-[28px] bg-[#14141c] px-5 py-8 text-sm text-white/50">No live price on the book.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {pre.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => choose(n)}
                className={cn(
                  "rounded-[24px] bg-[#14141c] p-4 text-left",
                  chosen?.symbol === n.symbol && "ring-1 ring-[#d6ff4a]",
                )}
              >
                <span className="flex items-center gap-2">
                  <Mark symbol={n.symbol} />
                  <span className="truncate text-sm font-medium">{n.symbol}</span>
                </span>
                <span className="mt-4 block font-mono text-2xl tabular-nums">{formatUsd(n.last)}</span>
                <span className={cn("mt-1 block font-mono text-xs tabular-nums", (n.premium ?? 0) < 0 ? "text-accent" : "text-down")}>
                  {formatPremium(n.premium)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-[28px] bg-[#14141c] p-6">
          <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Buy</p>
          {chosen ? (
            <div className="mt-4 flex items-center gap-4">
              <Mark symbol={chosen.symbol} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-3xl tracking-tight">{chosen.symbol}</p>
                <p className="truncate text-sm text-white/45">{chosen.name}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl tabular-nums">{formatUsd(chosen.last)}</p>
                <p className={cn("font-mono text-xs", (chosen.premium ?? 0) < 0 ? "text-accent" : "text-down")}>{formatPremium(chosen.premium)}</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/45">No live name to buy.</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {[10, 25, 100].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBuyUsd(n)}
                className={cn("min-h-11 rounded-full px-4 font-mono text-sm", buyUsd === n ? "bg-white text-black" : "bg-white/8")}
              >
                ${n}
              </button>
            ))}
            <button
              type="button"
              disabled={buying || !chosen}
              onClick={() => void buyChosen()}
              className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              {buying ? "Waiting on the wallet" : `Buy ${chosen?.symbol || ""}`}
            </button>
          </div>
          <p className="mt-4 text-sm text-white/40">Jupiter quotes it. You sign. The token lands in the wallet.</p>
        </div>

        <div className="grid overflow-hidden rounded-[28px] bg-[#14141c] sm:grid-cols-[200px_minmax(0,1fr)]">
          <img src="/images/metal-card.jpg" alt="" className="h-48 w-full object-cover sm:h-full" />
          <div className="flex flex-col justify-center p-5">
            <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Card</p>
            <h2 className="mt-1 font-display text-2xl tracking-tight">A number for a store. USDC for a person.</h2>
            <div className="mt-3 flex gap-2">
              <input
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="Store"
                className="min-h-11 flex-1 rounded-2xl bg-black/40 px-3 text-sm outline-none"
              />
              <input
                value={spend}
                onChange={(e) => setSpend(e.target.value)}
                inputMode="decimal"
                aria-label="Cap"
                className="min-h-11 w-20 rounded-2xl bg-black/40 px-3 font-mono text-sm outline-none"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={mintNumber} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
                Make the number
              </button>
              <Link to="/cards" search={{ spend: 0 }} className="inline-flex min-h-11 items-center rounded-full bg-white/10 px-4 text-sm font-medium">
                Pay USDC
              </Link>
            </div>
            {reveal ? <p className="mt-3 font-mono text-xs text-accent">{reveal.pan} · {reveal.expiry} · {reveal.cvv}</p> : null}
            {cards.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {cards.map((c) => (
                  <li key={c.id} className="font-mono text-xs text-white/55">
                    ···· {c.last4} · {c.frozen ? "frozen" : c.kind}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <Link to="/social" className="rounded-[28px] bg-[#14141c] p-5">
          <span className="grid size-10 place-items-center rounded-2xl bg-white/8">
            <Gamepad2 className="size-4" />
          </span>
          <p className="mt-4 font-display text-2xl tracking-tight">Play the print</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {cheap ? (
              <span className="rounded-2xl bg-[#d6ff4a]/10 px-3 py-3">
                <span className="block text-[11px] text-accent">Cheap</span>
                <span className="block text-sm font-medium">{cheap.symbol}</span>
                <span className="font-mono text-xs">{formatPremium(cheap.premium)}</span>
              </span>
            ) : null}
            {rich ? (
              <span className="rounded-2xl bg-[#ff5d73]/15 px-3 py-3">
                <span className="block text-[11px] text-down">Rich</span>
                <span className="block text-sm font-medium">{rich.symbol}</span>
                <span className="font-mono text-xs">{formatPremium(rich.premium)}</span>
              </span>
            ) : null}
          </div>
        </Link>

        <div className="rounded-[28px] bg-[#14141c] p-5">
          <span className="grid size-10 place-items-center rounded-2xl bg-white/8">
            <Bot className="size-4" />
          </span>
          <p className="mt-4 font-display text-2xl tracking-tight">An agent, with a cap</p>
          <p className="mt-1 text-sm text-white/45">A send bigger than this is refused. You still sign.</p>
          <p className="mt-4 font-mono text-4xl">${cap}</p>
          <div className="mt-3 flex gap-2">
            {[25, 100, 500].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCap(setSpendCap(n))}
                className={cn("min-h-10 rounded-full px-3 font-mono text-xs", cap === n ? "bg-accent text-accent-fg" : "bg-white/8 text-white/60")}
              >
                ${n}
              </button>
            ))}
            <Link to="/agents" className="inline-flex min-h-10 items-center px-2 text-sm text-accent">
              Open
            </Link>
          </div>
        </div>

        <Link to="/make" className="rounded-[28px] bg-[#14141c] p-5">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#d6ff4a] text-black">
            <Sparkles className="size-4" />
          </span>
          <p className="mt-4 font-display text-2xl tracking-tight">Make something people pay for</p>
          <p className="mt-2 text-sm text-white/45">A job, software, a service, hardware, a robot, or what a teacher needs. They pay you in USDC.</p>
        </Link>
      </section>
    </main>
  );
}

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function Act({
  to,
  search,
  icon: Icon,
  label,
}: {
  to: "/payments" | "/wallet" | "/vault";
  search?: { act: string };
  icon: typeof Plus;
  label: string;
}) {
  return (
    <Link
      to={to}
      search={search}
      className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-black/55 px-2 text-sm font-medium text-white backdrop-blur-md sm:justify-start sm:px-3"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10">
        <Icon className="size-3.5" />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function Row({
  to,
  kind,
  k,
  sub,
  v,
}: {
  to: "/payments" | "/vault";
  kind: "cash" | "invest";
  k: string;
  sub: string;
  v: string;
}) {
  const Icon = kind === "cash" ? CircleDollarSign : TrendingUp;
  return (
    <Link to={to} className="flex items-center gap-3 border-t border-white/8 px-4 py-4 first:border-t-0">
      <span className={cn("grid size-11 place-items-center rounded-full", kind === "cash" ? "bg-[#163226] text-[#3ddc84]" : "bg-[#2a2a14] text-[#d6ff4a]")}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{k}</span>
        <span className="block text-sm text-white/45">{sub}</span>
      </span>
      <span className="font-mono text-sm tabular-nums">{v}</span>
      <ChevronRight className="size-4 text-white/35" />
    </Link>
  );
}

function Mark({ symbol }: { symbol: string }) {
  const src = LOGO[symbol];
  if (!src) return <span className="grid size-9 place-items-center rounded-full bg-white/10 text-[10px]">{symbol.slice(0, 2)}</span>;
  return <img src={src} alt="" className="size-9 rounded-full bg-white object-contain p-1" />;
}
