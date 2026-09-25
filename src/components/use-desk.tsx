import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { WalletPicker } from "@/components/wallet-picker";
import {
  bookOf,
  crossed,
  labs,
  loadDrip,
  loadOrders,
  saveDrip,
  saveOrders,
  splitLegs,
  todayKey,
  underMark,
  type Armed,
  type Leg,
} from "@/lib/instruments";
import { connectPhantom, readChain } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { formatPremium, formatUsd, getHouse, type HouseListing } from "@/lib/sol-house";
import { writeUsing } from "@/lib/using";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Hold = { symbol: string; mint: string; ui: number; value: number; price: number };

export function UseDesk({ names }: { names: HouseListing[] }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [live, setLive] = useState(names);
  const book = useMemo(() => bookOf(live), [live]);
  const [usd, setUsd] = useState(50);
  const [custom, setCustom] = useState<string[]>([]);
  const [longSym, setLongSym] = useState("");
  const [shortSym, setShortSym] = useState("");
  const [holds, setHolds] = useState<Hold[]>([]);
  const [raiseSym, setRaiseSym] = useState("");
  const [raiseUsd, setRaiseUsd] = useState(25);
  const [orders, setOrders] = useState<Armed[]>([]);
  const [armSym, setArmSym] = useState("");
  const [armSide, setArmSide] = useState<"buy" | "sell">("buy");
  const [armAt, setArmAt] = useState("");
  const [step, setStep] = useState("");
  const [busy, setBusy] = useState(false);
  const [cap, setCap] = useState(100);
  const [dripOn, setDripOn] = useState(false);

  const cheap = [...book].sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0))[0];
  const rich = [...book].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))[0];
  const long = book.find((n) => n.symbol === longSym) ?? cheap;
  const short = book.find((n) => n.symbol === shortSym) ?? rich;
  const ai = labs(book);
  const cheapBasket = underMark(book);
  const own = book.filter((n) => custom.includes(n.symbol));
  const raise = holds.find((h) => h.symbol === raiseSym) ?? holds[0];
  const drip = typeof window !== "undefined" ? loadDrip() : null;
  const dueToday = dripOn && drip && drip.lastDay !== todayKey();

  useEffect(() => {
    setOrders(loadOrders());
    setCap(spendCap());
    setDripOn(Boolean(loadDrip()));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void getHouse()
        .then(setLive)
        .catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!owner) return;
    let on = true;
    readChain(owner)
      .then((snap) => {
        if (!on) return;
        const rows: Hold[] = [];
        for (const t of snap.tokens) {
          const name = book.find((n) => n.mint === t.mint);
          if (!name || !(t.ui > 0)) continue;
          rows.push({ symbol: name.symbol, mint: name.mint, ui: t.ui, price: name.last, value: t.ui * name.last });
        }
        setHolds(rows);
      })
      .catch(() => on && setHolds([]));
    return () => {
      on = false;
    };
  }, [owner, book]);

  async function who(): Promise<string> {
    const next = owner || (await connectPhantom());
    if (!owner) {
      const linked = wallet.linkChain(next, "Phantom", "phantom");
      if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
    }
    return next;
  }

  async function signLegs(legs: Leg[], label: string) {
    if (!legs.length) throw new Error("Nothing in this one.");
    const over = legs.find((l) => l.usd > spendCap());
    if (over) throw new Error(`${over.symbol} is $${over.usd}. The cap is $${spendCap()}. Raise it, then sign.`);
    setBusy(true);
    const sigs: string[] = [];
    try {
      const pubkey = await who();
      for (let i = 0; i < legs.length; i += 1) {
        const leg = legs[i];
        setStep(`${label} · ${i + 1} of ${legs.length} · ${leg.side} ${leg.symbol}`);
        const done = await runPrestock({
          owner: pubkey,
          mint: leg.mint,
          side: leg.side,
          usd: leg.usd,
          price: leg.price,
        });
        sigs.push(done.signature);
        writeUsing({ symbol: leg.symbol, name: leg.symbol, last: leg.price, premium: null, mint: leg.mint });
      }
      toast.success(`${label} signed. ${sigs.length} swap${sigs.length === 1 ? "" : "s"}.`);
      return sigs;
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  async function runBasket(rows: HouseListing[], title: string) {
    try {
      await signLegs(splitLegs(rows, usd, "buy"), title);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The basket stopped.");
    }
  }

  async function runRaise() {
    if (!raise) {
      toast.error("This wallet holds no PreStock to sell.");
      return;
    }
    if (raiseUsd > raise.value + 0.5) {
      toast.error(`${raise.symbol} is only about $${raise.value.toFixed(0)}.`);
      return;
    }
    try {
      await signLegs([{ symbol: raise.symbol, mint: raise.mint, side: "sell", usd: raiseUsd, price: raise.price }], `Raise $${raiseUsd}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The sale did not send.");
    }
  }

  function arm() {
    const name = book.find((n) => n.symbol === armSym) ?? book[0];
    if (!name) return;
    const price = Number(armAt) || (armSide === "buy" ? name.last * 0.95 : name.last * 1.05);
    const row: Armed = {
      id: crypto.randomUUID(),
      symbol: name.symbol,
      mint: name.mint,
      side: armSide,
      usd: Math.min(usd, spendCap()),
      trigger: armSide === "buy" ? "below" : "above",
      price,
      status: "armed",
    };
    const next = [row, ...orders];
    setOrders(next);
    saveOrders(next);
    toast.success(`${name.symbol} is armed at ${formatUsd(price)}. It will not sign itself.`);
  }

  async function fire(order: Armed) {
    try {
      const sigs = await signLegs(
        [{ symbol: order.symbol, mint: order.mint, side: order.side, usd: order.usd, price: order.price }],
        `${order.side} ${order.symbol}`,
      );
      const next = orders.map((o) => (o.id === order.id ? { ...o, status: "done" as const, sig: sigs?.[0] } : o));
      setOrders(next);
      saveOrders(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The order did not send.");
    }
  }

  function saveDaily() {
    const symbols = (own.length ? own : ai).map((n) => n.symbol);
    if (!symbols.length) {
      toast.error("Pick names first.");
      return;
    }
    saveDrip({ usd, symbols, lastDay: "" });
    setDripOn(true);
    toast.success(`Every day: $${usd} across ${symbols.join(", ")}. You still sign it.`);
  }

  async function signDaily() {
    const saved = loadDrip();
    if (!saved) return;
    const rows = book.filter((n) => saved.symbols.includes(n.symbol));
    try {
      await signLegs(splitLegs(rows, saved.usd, "buy"), "Today");
      saveDrip({ ...saved, lastDay: todayKey() });
      setDripOn(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Today did not send.");
    }
  }

  const rebalance: Leg[] = useMemo(() => {
    if (holds.length < 2) return [];
    const sum = holds.reduce((s, h) => s + h.value, 0);
    const target = sum / holds.length;
    const legs: Leg[] = [];
    for (const h of holds) {
      const gap = h.value - target;
      if (gap > 1) legs.push({ symbol: h.symbol, mint: h.mint, side: "sell", usd: Math.round(gap), price: h.price });
      if (gap < -1) legs.push({ symbol: h.symbol, mint: h.mint, side: "buy", usd: Math.round(-gap), price: h.price });
    }
    return legs.sort((a, b) => (a.side === "sell" ? -1 : 1) - (b.side === "sell" ? -1 : 1));
  }, [holds]);

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <section className="rounded-[28px] border border-white/10 bg-[#0c0c14] p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Use</p>
            <h1 className="mt-2 max-w-3xl text-4xl leading-[1.05] tracking-tight lg:text-5xl">
              Trade the book the way a brokerage can't.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted">
              A basket, a pair, a slice sold into USDC, and an order that waits on the 24/7 print. Each one is a Jupiter swap. Phantom asks. Senda never holds the key.
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs text-subtle">Send cap ${cap}</p>
            <button
              type="button"
              onClick={() => setCap(setSpendCap(Math.min(5000, cap + 100)))}
              className="mt-2 min-h-10 rounded-full bg-white/10 px-4 text-xs font-semibold"
            >
              Raise the cap $100
            </button>
          </div>
        </div>
        {!owner ? <div className="mt-5 max-w-sm"><WalletPicker /></div> : null}
        {step ? <p className="mt-4 font-mono text-sm text-accent">{step}</p> : null}
        <div className="mt-5 flex gap-2 overflow-x-auto">
          {book.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => writeUsing({ symbol: n.symbol, name: n.name, last: n.last, premium: n.premium, mint: n.mint })}
              className="min-w-28 shrink-0 rounded-2xl bg-[#101018] px-3 py-2 text-left"
            >
              <span className="block text-xs font-semibold">{n.symbol}</span>
              <span className="block font-mono text-[11px] text-muted">{formatUsd(n.last)}</span>
              <span className={cn("block font-mono text-[11px]", (n.premium ?? 0) < 0 ? "text-accent" : "text-down")}>{formatPremium(n.premium)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <Basket
          title="AI labs"
          line={ai.map((n) => n.symbol).join(" · ") || "No AI names on the book."}
          usd={usd}
          count={ai.length}
          busy={busy}
          onUsd={setUsd}
          onRun={() => void runBasket(ai, "AI labs")}
        />
        <Basket
          title="Under the mark"
          line={cheapBasket.map((n) => `${n.symbol} ${formatPremium(n.premium)}`).join(" · ") || "Nothing is under its mark."}
          usd={usd}
          count={cheapBasket.length}
          busy={busy}
          onUsd={setUsd}
          onRun={() => void runBasket(cheapBasket, "Under the mark")}
        />
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-4">
          <p className="text-sm font-semibold">Your basket</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {book.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setCustom((cur) => (cur.includes(n.symbol) ? cur.filter((s) => s !== n.symbol) : [...cur, n.symbol]))}
                className={cn("min-h-8 rounded-full px-2 font-mono text-[11px]", custom.includes(n.symbol) ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}
              >
                {n.symbol}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">{own.length ? `$${usd} split across ${own.length}.` : "Pick at least two."}</p>
          <button type="button" disabled={busy || own.length < 2} onClick={() => void runBasket(own, "Your basket")} className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            Sign your basket
          </button>
          <button type="button" onClick={saveDaily} className="mt-2 min-h-10 w-full rounded-full bg-white/10 text-sm font-semibold">
            Repeat this every day
          </button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Pair</p>
          <h2 className="mt-2 text-2xl">Buy the cheap one. Sell the rich one.</h2>
          <p className="mt-2 text-sm text-muted">Two swaps. The long is under its mark. The short only sells if the wallet holds it.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <label className="text-xs text-subtle">
              Long
              <select value={long?.symbol ?? ""} onChange={(e) => setLongSym(e.target.value)} className="mt-1 min-h-11 w-full rounded-2xl bg-black/40 px-3 text-sm outline-none">
                {book.map((n) => <option key={n.id} value={n.symbol}>{n.symbol} {formatPremium(n.premium)}</option>)}
              </select>
            </label>
            <label className="text-xs text-subtle">
              Short
              <select value={short?.symbol ?? ""} onChange={(e) => setShortSym(e.target.value)} className="mt-1 min-h-11 w-full rounded-2xl bg-black/40 px-3 text-sm outline-none">
                {book.map((n) => <option key={n.id} value={n.symbol}>{n.symbol} {formatPremium(n.premium)}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !long}
              onClick={() => long && void signLegs([{ symbol: long.symbol, mint: long.mint, side: "buy", usd, price: long.last }], `Long ${long.symbol}`).catch((e) => toast.error(e instanceof Error ? e.message : "No"))}
              className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40"
            >
              Buy {long?.symbol} · ${usd}
            </button>
            <button
              type="button"
              disabled={busy || !short}
              onClick={() => short && void signLegs([{ symbol: short.symbol, mint: short.mint, side: "sell", usd, price: short.last }], `Short ${short.symbol}`).catch((e) => toast.error(e instanceof Error ? e.message : "No"))}
              className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold disabled:opacity-40"
            >
              Sell {short?.symbol} · ${usd}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Raise cash</p>
          <h2 className="mt-2 text-2xl">Sell a slice. USDC lands in Phantom.</h2>
          {holds.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{owner ? "This wallet holds none of the book." : "Connect the wallet that holds them."}</p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-1">
                {holds.map((h) => (
                  <button key={h.mint} type="button" onClick={() => setRaiseSym(h.symbol)} className={cn("rounded-full px-3 py-2 text-left text-xs", raise?.symbol === h.symbol ? "bg-accent text-accent-fg" : "bg-black/40")}>
                    {h.symbol} · ${h.value.toFixed(0)}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-xs text-subtle">
                Dollars to raise
                <input value={raiseUsd} onChange={(e) => setRaiseUsd(Math.max(1, Number(e.target.value) || 0))} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-2xl bg-black/40 px-3 font-mono outline-none" />
              </label>
              <button type="button" disabled={busy} onClick={() => void runRaise()} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
                Sell ${raiseUsd} of {raise?.symbol}
              </button>
            </>
          )}
          {rebalance.length > 0 ? (
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-sm font-semibold">Even out what you hold</p>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {rebalance.map((l) => (
                  <li key={`${l.side}-${l.symbol}`}>{l.side} ${l.usd} {l.symbol}</li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busy}
                onClick={() => void signLegs(rebalance, "Rebalance").catch((e) => toast.error(e instanceof Error ? e.message : "No"))}
                className="mt-3 min-h-10 rounded-full bg-white/10 px-4 text-sm font-semibold"
              >
                Sign the rebalance
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Orders</p>
          <h2 className="mt-2 text-2xl">Arm it. The print is live all night.</h2>
          <p className="mt-2 text-sm text-muted">When the token price crosses, the swap is ready. You still sign it. It does not fire while the tab is closed.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <select value={armSym || book[0]?.symbol || ""} onChange={(e) => setArmSym(e.target.value)} className="min-h-11 rounded-2xl bg-black/40 px-3 text-sm outline-none">
              {book.map((n) => <option key={n.id} value={n.symbol}>{n.symbol} · {formatUsd(n.last)}</option>)}
            </select>
            <select value={armSide} onChange={(e) => setArmSide(e.target.value as "buy" | "sell")} className="min-h-11 rounded-2xl bg-black/40 px-3 text-sm outline-none">
              <option value="buy">Buy if it falls under</option>
              <option value="sell">Sell if it rises over</option>
            </select>
            <input value={armAt} onChange={(e) => setArmAt(e.target.value)} placeholder="Price, or leave blank for 5%" className="col-span-2 min-h-11 rounded-2xl bg-black/40 px-3 text-sm outline-none" />
          </div>
          <button type="button" onClick={arm} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
            Arm ${Math.min(usd, cap)}
          </button>
          <ul className="mt-4 space-y-2">
            {orders.map((o) => {
              const now = book.find((n) => n.symbol === o.symbol)?.last ?? 0;
              const hit = crossed(o, now);
              return (
                <li key={o.id} className="flex items-center justify-between gap-3 rounded-2xl bg-black/30 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold">{o.side} {o.symbol} · ${o.usd}</p>
                    <p className="text-[11px] text-muted">
                      {o.status === "done" ? `Signed ${o.sig?.slice(0, 8) ?? ""}` : `${o.trigger} ${formatUsd(o.price)} · now ${formatUsd(now)}`}
                    </p>
                  </div>
                  {o.status === "armed" && hit ? (
                    <button type="button" disabled={busy} onClick={() => void fire(o)} className="min-h-10 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg">
                      Sign it
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Every day</p>
          <h2 className="mt-2 text-2xl">{dueToday ? "Today's buy is unsigned." : "A buy that comes back tomorrow."}</h2>
          <p className="mt-2 text-sm text-muted">
            {drip
              ? `$${drip.usd} across ${drip.symbols.join(", ")}. Last signed ${drip.lastDay || "never"}.`
              : "Save a basket and this is the button you press once a day. It does not sign while you are away."}
          </p>
          {dueToday ? (
            <button type="button" disabled={busy} onClick={() => void signDaily()} className="mt-4 min-h-12 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
              Sign today's buy
            </button>
          ) : (
            <button type="button" onClick={saveDaily} className="mt-4 min-h-12 rounded-full bg-white/10 px-5 text-sm font-semibold">
              Save today's basket as the daily
            </button>
          )}
          <p className="mt-6 text-xs text-subtle">
            Size is ${usd}. Change it on a basket card. A leg bigger than the cap will not be offered to the wallet.
          </p>
        </div>
      </section>
    </div>
  );
}

function Basket({
  title,
  line,
  usd,
  count,
  busy,
  onUsd,
  onRun,
}: {
  title: string;
  line: string;
  usd: number;
  count: number;
  busy: boolean;
  onUsd: (n: number) => void;
  onRun: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#101018] p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 min-h-10 text-xs text-muted">{line}</p>
      <div className="mt-3 flex gap-1">
        {[25, 50, 100].map((n) => (
          <button key={n} type="button" onClick={() => onUsd(n)} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", usd === n ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}>
            ${n}
          </button>
        ))}
      </div>
      <button type="button" disabled={busy || count === 0} onClick={onRun} className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        Sign {count} swap{count === 1 ? "" : "s"}
      </button>
    </div>
  );
}
