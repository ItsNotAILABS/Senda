import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bot, Gamepad2, RefreshCw, Send, ShoppingBag, Sparkles } from "lucide-react";
import { PrintChart } from "@/components/print-chart";
import { HoldingCards, type HoldingRow } from "@/components/holding-cards";
import { WalletPicker } from "@/components/wallet-picker";
import { CompanyAccount } from "@/components/company-account";
import { PositionsBook } from "@/components/positions-book";
import { FuturesDesk } from "@/components/futures-desk";
import { loadClearing, postPred } from "@/lib/clearing";
import { buildPicture, quoteHeld, type Picture } from "@/lib/money-picture";
import { connectPhantom, readChain, pickOwner } from "@/lib/phantom";
import { holdTrade } from "@/lib/offline-rail";
import { runPrestock } from "@/lib/prestock";
import { payUsdc } from "@/lib/solana-pay";
import { SOL, signRoute } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { loadHoldTape, type HoldMove } from "@/lib/hold-tape";
import { readRevolut } from "@/lib/revolut-link";
import { writeUsing } from "@/lib/using";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { loadWide, type WideRow } from "@/lib/coin-tape";
import { loadHeadlines, type Headline } from "@/lib/wire";
import { loadPulse, type BoardGroup, type TapeRow } from "@/lib/universe";
import { onTrades } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Leg = { usd: number };
type GameRow = {
  kind?: "pred" | "race";
  id: string;
  status?: string;
  symbol?: string;
  mint?: string;
  tenor?: "15m" | "1h" | "4h" | "1d";
  strike?: number;
  style?: "line" | "band" | "swing";
  hi?: number;
  yes?: Leg[];
  no?: Leg[];
  left?: string;
  right?: string;
};

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
  const owner = pickOwner(wallet.w.links);
  const [cap, setCap] = useState(100);
  const [group, setGroup] = useState<BoardGroup>("company");
  const [tape, setTape] = useState<TapeRow[]>([]);
  const [wide, setWide] = useState<WideRow[]>([]);
  const [news, setNews] = useState<Headline[]>([]);
  const [moves, setMoves] = useState<Record<string, HoldMove>>({});
  const [pic, setPic] = useState<Picture | null>(null);
  const [clearing, setClearing] = useState("");
  const [games, setGames] = useState<GameRow[]>([]);
  const [purse, setPurse] = useState<"USDC" | "SOL">("USDC");
  const [playing, setPlaying] = useState("");
  const [merchant, setMerchant] = useState("");
  const [spend, setSpend] = useState("40");
  const [reveal, setReveal] = useState<{ pan: string; cvv: string; expiry: string } | null>(null);
  const [pick, setPick] = useState("");
  const [buyUsd, setBuyUsd] = useState(1);
  const [buying, setBuying] = useState(false);
  const [arm, setArm] = useState<"" | "yes" | "no" | "buy">("");
  const board = tape.filter((n) => n.group === group);
  const wideHit = wide.find((w) => w.mint === pick);
  const chosen: TapeRow | undefined =
    tape.find((n) => n.mint === pick) ??
    (wideHit ? { symbol: wideHit.symbol, mint: wideHit.mint, group: "crypto", price: wideHit.price, change: wideHit.change } : undefined) ??
    tape.find((n) => n.symbol === "SOL") ??
    tape[0];

  useEffect(() => setCap(spendCap()), []);
  useEffect(() => {
    let live = true;
    const pull = () => {
      Promise.all([
        owner ? readChain(owner) : Promise.resolve(null),
        loadPulse().catch(() => null),
        loadWide().catch(() => [] as WideRow[]),
        loadClearing().catch(() => null),
      ]).then(async ([chain, pulseRow, wideRows, house]) => {
        if (!live) return;
        const priced = pulseRow?.rows || [];
        const tape = await quoteHeld((chain?.tokens || []).map((t) => t.mint), priced).catch(() => priced);
        if (!live) return;
        setTape(priced);
        setWide(wideRows);
        const book = house as { pubkey?: string; preds?: GameRow[]; races?: GameRow[] } | null;
        setClearing(book?.pubkey || "");
        setGames([
          ...(book?.preds || []).filter((c) => c.status === "open").map((c) => ({ ...c, kind: "pred" as const })),
          ...(book?.races || []).filter((c) => c.status === "open").map((c) => ({ ...c, kind: "race" as const })),
        ]);
        setPic(
          buildPicture({
            owner,
            sol: chain?.sol || 0,
            tokens: chain?.tokens || [],
            tape,
            cash: 0,
            house: house as Parameters<typeof buildPicture>[0]["house"],
          }),
        );
      });
    };
    pull();
    const id = window.setInterval(pull, 8000);
    const stop = onTrades(pull);
    return () => {
      live = false;
      window.clearInterval(id);
      stop();
    };
  }, [owner]);

  useEffect(() => {
    let live = true;
    loadHeadlines()
      .then((rows) => {
        if (live) setNews(rows);
      })
      .catch(() => {
        if (live) setNews([]);
      });
    return () => {
      live = false;
    };
  }, []);

  function mintNumber() {
    const n = Number(spend);
    const room = pic?.usdc || 0;
    if (!(n > 0)) return toast.error("Set what this purchase can cost.");
    if (!(room > 0)) return toast.error("USDC has to be on the wallet. The number is a cap on that.");
    if (n - room > 0.01) return toast.error(`That cap is above $${room.toFixed(0)}.`);
    const r = wallet.issueCheckout(n, merchant || "Checkout", "SENDA");
    if (!r.ok) return toast.error(r.error || "Could not mint the number.");
    setReveal({ pan: r.reveal.pan, cvv: r.reveal.cvv, expiry: r.reveal.expiry });
    toast.success("One number. This screen is the only place it is shown.");
  }

  async function playSide(side: "yes" | "no") {
    if (!chosen || !clearing) return;
    setPlaying(side);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      if (purse === "SOL") {
        const px = tape.find((t) => t.symbol === "SOL")?.price || 0;
        if (!(px > 0)) throw new Error("No SOL price, so it cannot be the stake.");
        await signRoute({
          owner: who,
          inputMint: SOL,
          outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          amountRaw: Math.floor(((buyUsd * 1.02) / px) * 1e9),
          outDecimals: 6,
          usd: buyUsd,
        });
      }
      const paid = await payUsdc({
        owner: who,
        to: clearing,
        usd: buyUsd,
        memo: `Senda clear pred ${chosen.symbol} 1h ${side} open`,
      });
      await postPred({
        data: { owner: who, sig: paid.signature, symbol: chosen.symbol, mint: chosen.mint, tenor: "1h", side, usd: buyUsd, strike: 0 },
      });
      toast.success(`${chosen.symbol} ${side === "yes" ? "above" : "below"} the print. ${paid.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The stake did not land.");
    } finally {
      setPlaying("");
    }
  }

  async function takeSide(game: GameRow, side: "yes" | "no") {
    if (!clearing || !game.symbol || !game.mint || !game.tenor) return;
    setPlaying(game.id + side);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      if (purse === "SOL") {
        const px = tape.find((t) => t.symbol === "SOL")?.price || 0;
        if (!(px > 0)) throw new Error("No SOL price, so it cannot be the stake.");
        await signRoute({
          owner: who,
          inputMint: SOL,
          outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          amountRaw: Math.floor(((buyUsd * 1.02) / px) * 1e9),
          outDecimals: 6,
          usd: buyUsd,
        });
      }
      const style = game.style || "line";
      const strike = game.strike || 0;
      const hi = game.hi || 0;
      const memo =
        style === "band"
          ? `Senda clear pred ${game.symbol} ${game.tenor} ${side} band ${strike}-${hi}`
          : style === "swing"
            ? `Senda clear pred ${game.symbol} ${game.tenor} ${side} swing ${hi}`
            : `Senda clear pred ${game.symbol} ${game.tenor} ${side} ${strike || "open"}`;
      const paid = await payUsdc({ owner: who, to: clearing, usd: buyUsd, memo });
      await postPred({
        data: { owner: who, sig: paid.signature, symbol: game.symbol, mint: game.mint, tenor: game.tenor, side, usd: buyUsd, strike, style, hi },
      });
      toast.success(`You took ${side === "yes" ? "yes" : "no"} on ${game.symbol}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That side did not land.");
    } finally {
      setPlaying("");
    }
  }

  function choose(row: TapeRow) {
    setPick(row.mint);
    writeUsing({ symbol: row.symbol, name: row.symbol, last: row.price, premium: null, mint: row.mint });
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
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const held = holdTrade({
          kind: "spot",
          mint: chosen.mint,
          symbol: chosen.symbol,
          side: "buy",
          usd: buyUsd,
          sol: 0,
          pool: "auto",
          price: chosen.price,
          decimals: 6,
        });
        if ("error" in held) throw new Error(held.error);
        toast.success(`${chosen.symbol} is held on this phone. It signs when the network is back.`);
        return;
      }
      const done = await runPrestock({ owner: who, mint: chosen.mint, side: "buy", usd: buyUsd, price: chosen.price });
      toast.success(`${chosen.symbol} is in the wallet. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The buy did not send.");
    } finally {
      setBuying(false);
    }
  }

  const activity = wallet.w.txs.slice(0, 4);
  const mask = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
  const rev = typeof window === "undefined" ? null : readRevolut();
  const held = (pic?.lines ?? []).filter((l) => l.usd > 0.005 || l.ui > 0);
  const rows: HoldingRow[] = [
    ...(pic && pic.usdc > 0 ? [{ mint: USDC, symbol: "USDC", name: "Spendable", qty: pic.usdc, value: pic.usdc, where: "cash" as const }] : []),
    ...(pic && pic.sol > 0 ? [{ mint: SOL, symbol: "SOL", name: "Network fees", qty: pic.sol, value: pic.solUsd, where: "coin" as const }] : []),
    ...held.map((line) => ({
      mint: line.mint,
      symbol: line.symbol,
      name: line.group === "company" ? "PreStock" : line.group === "listed" ? "Listed" : line.group === "stake" ? "Stake" : "Coin",
      qty: line.ui,
      value: line.usd > 0 ? line.usd : (moves[line.mint]?.price || 0) * line.ui,
      where: line.group === "company" ? "pre" as const : line.group === "listed" ? "share" as const : "coin" as const,
    })),
  ];
  const dayUsd = rows.reduce((sum, row) => {
    const day = moves[row.mint]?.day;
    if (day == null || !(row.value > 0)) return sum;
    return sum + (row.value * day) / 100;
  }, 0);
  const holdKey = rows.map((row) => row.mint).join(",");
  useEffect(() => {
    const mints = holdKey.split(",").filter((mint) => mint.length >= 32).slice(0, 30);
    if (!mints.length) return;
    let live = true;
    loadHoldTape({ data: { mints } })
      .then((list) => {
        if (!live) return;
        const next: Record<string, HoldMove> = {};
        for (const row of list) next[row.mint] = row;
        setMoves(next);
      })
      .catch(() => {
        if (live) setMoves({});
      });
    return () => {
      live = false;
    };
  }, [holdKey]);
  const focus = held.map((l) => l.symbol);
  const have = new Set(tape.map((row) => row.mint));
  const screen = [
    ...tape.map((row) => ({
      mint: row.mint,
      symbol: row.symbol,
      price: row.price,
      change: row.change,
      liq: 0,
      venue: row.group === "company" ? "PreStocks" : row.group === "listed" ? "xStocks" : row.group === "stake" ? "Stake" : "Spot",
    })),
    ...wide.filter((row) => !have.has(row.mint)),
  ];
  const leadNews = news.find((row) => focus.some((s) => s.length > 2 && row.title.toLowerCase().includes(s.toLowerCase()))) ?? news[0];
  const wallets = [
    { name: "Phantom", on: !!owner, hint: owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Not connected", to: "/phantom" as const },
    { name: "MetaMask", on: !!mask, hint: mask ? `${mask.slice(0, 4)}…${mask.slice(-4)}` : "Not connected", to: "/metamask" as const },
    { name: "Revolut", on: !!rev?.tag, hint: rev?.tag ? `@${rev.tag}` : "No Revtag", to: "/revolut" as const },
    { name: "Backpack", on: wallet.w.links.some((l) => /backpack/i.test(l.label)), hint: wallet.w.links.find((l) => /backpack/i.test(l.label))?.address.slice(0, 4) || "Not connected", to: "/backpack" as const },
  ];

  return (
    <main className="px-3 py-3 lg:px-5">
      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0c0f16]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex items-end gap-6">
            <div>
              <p className="text-[11px] text-white/40">Portfolio</p>
              <p className="font-mono text-3xl leading-none tabular-nums">{pic ? `$${pic.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : owner ? "…" : "$0.00"}</p>
            </div>
            <p className={cn("pb-1 font-mono text-sm tabular-nums", dayUsd < 0 ? "text-down" : "text-accent")}>
              {held.length === 0 ? "No holdings yet" : `${dayUsd >= 0 ? "+" : "−"}$${Math.abs(dayUsd).toFixed(2)} today`}
            </p>
            {pic ? <p className="pb-1 font-mono text-[11px] text-white/40">USDC ${pic.usdc.toFixed(2)} · {pic.sol.toFixed(3)} SOL</p> : null}
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {wallets.map((w) => (
              <li key={w.name}>
                <Link to={w.to} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                  <span className={cn("size-1.5 rounded-full", w.on ? "bg-accent" : "bg-white/25")} />
                  <span className="text-xs font-semibold">{w.name}</span>
                  <span className="font-mono text-[10px] text-white/40">{w.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </header>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="border-b border-white/10 lg:border-r lg:border-b-0">
            <div className="flex items-end justify-between gap-3 px-4 pt-4">
              <div>
                <p className="font-display text-4xl tracking-tight">{chosen?.symbol || "—"}</p>
                <p className="mt-1 font-mono text-sm text-white/45">{chosen ? chosen.group : "Waiting on Jupiter"}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-3xl tabular-nums">{chosen ? formatUsd(chosen.price) : "—"}</p>
                <p className={cn("font-mono text-sm tabular-nums", (chosen?.change ?? 0) < 0 ? "text-down" : "text-accent")}>
                  {chosen ? `${chosen.change >= 0 ? "+" : ""}${chosen.change.toFixed(2)}%` : ""}
                </p>
              </div>
            </div>
            <div className="px-2 pt-2">
              {chosen?.mint ? <PrintChart mint={chosen.mint} symbol={chosen.symbol} className="h-[300px]" /> : <p className="px-2 py-16 text-sm text-white/40">Waiting on a Jupiter price.</p>}
            </div>
          </div>
          <div className="flex flex-col">
            <div className="border-b border-white/10 p-4">
              <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Quick trade</p>
              <p className="mt-1 text-xs text-white/45">USDC in. The wallet signs. Same route as the book.</p>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {[1, 5, 25, 100].map((n) => (
                  <button key={n} type="button" onClick={() => { setBuyUsd(n); setArm(""); }} className={cn("min-h-10 rounded-xl font-mono text-sm", buyUsd === n ? "bg-white text-black" : "bg-white/5 text-white/70")}>
                    ${n}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={buying || !chosen}
                onClick={() => { if (arm !== "buy") { setArm("buy"); return; } setArm(""); void buyChosen(); }}
                className="mt-3 min-h-12 w-full rounded-xl bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
              >
                {buying ? "Waiting for the wallet…" : arm === "buy" && chosen ? `Sign $${buyUsd} ${chosen.symbol}` : chosen ? `Buy $${buyUsd} ${chosen.symbol}` : "Buy"}
              </button>
              {!owner ? <div className="mt-3"><WalletPicker /></div> : null}
            </div>
            <div className="max-h-[460px] overflow-auto p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Holdings</p>
                <Link to="/vault" className="text-[11px] text-accent">Portfolio</Link>
              </div>
              <p className="mt-1 text-xs text-white/40">{rows.length ? `${rows.length} on this address · hour, day, week` : owner ? "Reading this address." : "Phantom reconnects if this browser already trusted it."}</p>
              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-white/40">Nothing priced on this address yet.</p>
              ) : (
                <HoldingCards rows={rows} moves={moves} className="mt-2 grid-cols-1" />
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="flex items-baseline justify-between px-4 py-2.5">
            <p className="text-sm font-semibold">Markets</p>
            <p className="font-mono text-[11px] text-white/35">{screen.length} · house book, Jupiter traded, trending, organic</p>
          </div>
          <div className="grid max-h-[232px] grid-cols-2 overflow-auto border-t border-white/10 sm:grid-cols-3 xl:grid-cols-6">
            {screen.slice(0, 48).map((row) => (
              <button
                key={row.mint}
                type="button"
                onClick={() => { const hit = tape.find((t) => t.mint === row.mint); if (hit) { choose(hit); return; } choose({ symbol: row.symbol, mint: row.mint, group: "crypto", price: row.price, change: row.change }); }}
                className={cn("border-r border-b border-white/10 px-3 py-2.5 text-left", chosen?.mint === row.mint ? "bg-white/[0.06]" : "hover:bg-white/[0.03]")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{row.symbol}</span>
                  <span className={cn("font-mono text-[11px] tabular-nums", row.change < 0 ? "text-down" : "text-accent")}>{row.change >= 0 ? "+" : ""}{row.change.toFixed(1)}%</span>
                </span>
                <span className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-white/40">
                  <span>{formatUsd(row.price)}</span>
                  <span className="truncate">{row.venue}{row.liq > 0 ? ` · $${row.liq >= 1_000_000 ? `${(row.liq / 1_000_000).toFixed(1)}M` : `${Math.round(row.liq / 1000)}k`}` : ""}</span>
                </span>
              </button>
            ))}
          </div>
          {leadNews ? (
            <a href={leadNews.link} target="_blank" rel="noreferrer" className="flex items-baseline justify-between gap-3 border-t border-white/10 px-4 py-2.5">
              <span className="truncate text-sm">{leadNews.title}</span>
              <span className="shrink-0 font-mono text-[10px] tracking-wide text-white/35 uppercase">{leadNews.source}</span>
            </a>
          ) : null}
        </div>
      </section>
      <details className="mt-2 rounded-[22px] border border-white/10 bg-[#10131c]">
        <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold">The rest of the desk</summary>
        <div className="space-y-3 px-3 pb-4">
      <CompanyAccount compact />
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["Quotes", "spot"],
            ["PreStocks", "pre"],
            ["xStocks", "xstock"],
            ["Metals", "world"],
            ["Commodities", "comms"],
            ["Options", "options"],
            ["Perps", "perps"],
            ["Coins", "tape"],
          ] as const
        ).map(([label, desk]) => (
          <Link key={desk} to="/invest" search={{ desk }} className="flex min-h-14 items-center rounded-2xl bg-[#141824] px-4 text-sm font-semibold">
            {label}
          </Link>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {(
          [
            ["Solana", "vault"],
            ["Programs", "prog"],
            ["Protect", "book"],
            ["Index", "basket"],
            ["Borrow", "lend"],
            ["Launch", "minty"],
            ["Curve", "curve"],
            ["Radar", "wrap"],
            ["Rails", "eco"],
            ["Futures", "futures"],
            ["Loans", "loans"],
            ["Bridge", "bridge"],
            ["Hedge", "hedge"],
            ["Cover", "cover"],
          ] as const
        ).map(([label, desk]) => (
          <Link key={desk} to="/invest" search={{ desk }} className="shrink-0 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold">
            {label}
          </Link>
        ))}
      </div>
      <section className="hidden gap-2 sm:grid-cols-3 lg:grid">
        <Link to="/phantom" className="rounded-2xl border border-white/10 bg-[#10131c] px-4 py-3">
          <p className="text-[11px] tracking-[0.14em] text-accent uppercase">Phantom</p>
          <p className="mt-1 text-sm font-semibold">{owner ? "Solana account on" : "Connect the Solana account"}</p>
        </Link>
        <Link to="/metamask" className="rounded-2xl border border-white/10 bg-[#10131c] px-4 py-3">
          <p className="text-[11px] tracking-[0.14em] text-accent uppercase">MetaMask</p>
          <p className="mt-1 text-sm font-semibold">{mask ? "Base account on" : "Connect the Base account"}</p>
        </Link>
        <Link to="/revolut" className="rounded-2xl border border-white/10 bg-[#10131c] px-4 py-3">
          <p className="text-[11px] tracking-[0.14em] text-accent uppercase">Revolut</p>
          <p className="mt-1 text-sm font-semibold">{rev?.tag ? `@${rev.tag}` : "Add a Revtag"}</p>
        </Link>
      </section>
      {lead ? (
        <Link to="/wire" className="hidden rounded-2xl border border-white/10 bg-[#10131c] px-4 py-3 text-sm lg:block">
          <span className="text-subtle">Radar · </span>
          {lead.symbol} is the widest gap to its mark, {formatPremium(lead.premium ?? 0)}.
        </Link>
      ) : null}
      {owner && pic ? <AccountBook pic={pic} /> : null}
      <PositionsBook owner={owner} names={names} />
      <FuturesDesk names={names} />
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-sm font-semibold">{group === "company" ? "Companies" : group === "crypto" ? "Crypto" : group === "stake" ? "Stakes" : "Listed stocks"}</p>
          <Link to={group === "company" ? "/pre" : "/social"} className="text-xs text-accent">{group === "company" ? "All names" : "All markets"}</Link>
        </div>
        {board.length === 0 ? (
          <p className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-6 text-sm text-subtle">Prices have not come back yet.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto">
            {board.map((n) => (
              <button
                key={n.mint}
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
                <span className="mt-3 font-mono text-lg tabular-nums">{formatUsd(n.price)}</span>
                <span className={cn("font-mono text-xs tabular-nums", n.change < 0 ? "text-down" : "text-up")}>{n.change >= 0 ? "+" : ""}{n.change.toFixed(2)}%</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="hidden overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(120%_80%_at_100%_-20%,rgb(214_255_74/0.16),transparent_42%),linear-gradient(165deg,#1a1f2e,#0b0d14)] lg:block">
        <div className="grid sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="p-5">
            <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Predict</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(
                [
                  ["company", "Companies"],
                  ["crypto", "Crypto"],
                  ["stake", "Stakes"],
                  ["listed", "Listed"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" onClick={() => { setGroup(id); setPick(""); }} className={cn("min-h-8 rounded-full px-3 text-xs", group === id ? "bg-white text-black" : "border border-white/15 text-white/70")}>
                  {label}
                </button>
              ))}
            </div>
            {chosen ? (
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="font-display text-4xl tracking-tight">{chosen.symbol}</p>
                  <p className="mt-1 text-sm text-white/60">Above or below this print, for the next hour.</p>
                </div>
                <p className="font-mono text-3xl tabular-nums">{formatUsd(chosen.price)}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/60">No live price yet.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setPurse("USDC")} className={cn("min-h-10 rounded-full px-3 text-xs font-semibold", purse === "USDC" ? "bg-white text-black" : "border border-white/15 text-white/70")}>USDC</button>
              <button type="button" onClick={() => setPurse("SOL")} className={cn("min-h-10 rounded-full px-3 text-xs font-semibold", purse === "SOL" ? "bg-white text-black" : "border border-white/15 text-white/70")}>SOL</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={!!playing || !chosen || !clearing} onClick={() => { if (arm !== "yes") { setArm("yes"); return; } setArm(""); void playSide("yes"); }} className="min-h-14 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50">
                {playing === "yes" ? "Signing…" : arm === "yes" ? `Sign $${buyUsd} above` : "Stake above"}
              </button>
              <button type="button" disabled={!!playing || !chosen || !clearing} onClick={() => { if (arm !== "no") { setArm("no"); return; } setArm(""); void playSide("no"); }} className="min-h-14 rounded-full border border-white/20 text-sm font-semibold disabled:opacity-50">
                {playing === "no" ? "Signing…" : arm === "no" ? `Sign $${buyUsd} below` : "Stake below"}
              </button>
            </div>
            {arm ? <p className="mt-2 text-xs text-white/70">Review the amount, then tap the same button again. The wallet has to sign. Senda does not hold the stake.</p> : null}
            <p className="mt-3 text-xs text-white/45">
              {purse === "SOL" ? "SOL is swapped to USDC, then the USDC is the stake. Two signatures." : "USDC leaves the wallet and sits in the pot until the hour ends."} One side only, it comes back. The full ladder is on Predict.
            </p>
          </div>
          <div className="relative min-h-36 overflow-hidden">
            <video src="/video/desk.mp4" poster="/images/orbit.jpg" autoPlay muted loop playsInline className="h-full min-h-36 w-full object-cover" />
          </div>
        </div>
      </section>

      <section className="hidden rounded-[22px] border border-white/10 bg-[#10131c] p-4 lg:block">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Open games</p>
            <p className="mt-1 text-xs text-muted">Someone staked. Take the other side with {purse === "SOL" ? "SOL" : "USDC"}. Same pot, same clock.</p>
          </div>
          <Link to="/social" className="text-xs text-accent">The full ladder</Link>
        </div>
        {games.filter((g) => g.kind !== "race" && g.symbol).length === 0 ? (
          <p className="mt-3 text-sm text-subtle">No one is in a pot yet. Stake the card above and you are the first side.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10">
            {games.filter((g) => g.kind !== "race" && g.symbol).slice(0, 8).map((g) => {
              const y = (g.yes || []).reduce((s, l) => s + l.usd, 0);
              const n = (g.no || []).reduce((s, l) => s + l.usd, 0);
              const thin = y <= n ? "yes" : "no";
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="block text-sm font-semibold">{g.symbol} · {gameLabel(g)}</span>
                    <span className="font-mono text-[11px] text-subtle">{g.tenor} · yes ${y.toFixed(0)} · no ${n.toFixed(0)}</span>
                  </span>
                  <button type="button" disabled={!!playing || !clearing} onClick={() => void takeSide(g, thin)} className="min-h-9 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-50">
                    {playing === g.id + thin ? "Signing…" : `Take ${thin === "yes" ? "yes" : "no"} · $${buyUsd}`}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="hidden grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6 lg:grid">
        <Tile to="/pre" icon={Sparkles} tint="bg-[#14f195]/15 text-[#7dffa8]" title="Companies" hint="Buy a pre-IPO name" />
        <Tile to="/wallet" icon={RefreshCw} tint="bg-[#9945ff]/20 text-[#d8b4fe]" title="Convert" hint="Swap what you already hold" />
        <Tile to="/social" icon={Gamepad2} tint="bg-[#3b82f6]/15 text-[#93c5fd]" title="Predict" hint="Above or below the print" />
        <Tile to="/cards" search={{ spend: 0 }} icon={ShoppingBag} tint="bg-[#eab308]/15 text-[#fde047]" title="Pay" hint="The card on this computer, then USDC" />
        <Tile to="/payments" icon={Send} tint="bg-[#22d3ee]/15 text-[#67e8f9]" title="Send" hint="Send USDC to someone" />
        <Tile to="/agents" icon={Bot} tint="bg-[#a855f7]/20 text-[#e9d5ff]" title="Agents" hint="Make one, or hire a trader" />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_280px]">
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c]">
          <div className="grid sm:grid-cols-[160px_minmax(0,1fr)]">
            <video src="/video/card.mp4" poster="/images/metal-card.jpg" autoPlay muted loop playsInline className="h-full min-h-40 w-full object-cover" />
            <div className="p-4">
              <p className="text-sm font-semibold">Shop with the cash</p>
              <p className="mt-1 text-xs text-muted">The number is a cap on the USDC in the wallet. It is not a charge a store can run.</p>
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
              <button key={n} type="button" onClick={() => setCap(setSpendCap(n))} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", cap === n ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}>
                ${n}
              </button>
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
        </div>
      </details>
    </main>
  );
}

function AccountBook({ pic }: { pic: Picture }) {
  const held = pic.lines.filter((l) => l.usd > 0.005 || l.ui > 0);
  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">This address</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">${pic.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <p className="text-right text-[11px] text-subtle">
          USDC ${pic.usdc.toFixed(2)}
          <span className="block">CASH ${pic.phantomCash.toFixed(2)}</span>
          <span className="block">{pic.sol > 0 ? `${pic.sol.toFixed(4)} SOL${pic.solUsd > 0 ? ` · $${pic.solUsd.toFixed(2)}` : ""}` : "0 SOL"}</span>
          <span className="block">In pots ${pic.posted.toFixed(2)}</span>
        </p>
      </div>
      {held.length ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto">
          {held.map((l) => (
            <li key={l.symbol} className="min-w-[120px] rounded-2xl bg-black/30 px-3 py-2">
              <p className="text-sm font-semibold">{l.symbol}</p>
              <p className="font-mono text-xs text-subtle">{l.ui < 1 ? l.ui.toFixed(4) : l.ui.toFixed(2)}</p>
              <p className="font-mono text-xs">${l.usd.toFixed(2)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-subtle">No names in the wallet yet. Buying one puts the token here.</p>
      )}
      {pic.open.length ? (
        <ul className="mt-3 divide-y divide-white/10">
          {pic.open.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{o.label}</span>
              <span className="font-mono">${o.usd.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-subtle">A future or a prediction posts USDC from this address into the pot. It shows here while it is open.</p>
      )}
    </section>
  );
}

function gameLabel(g: GameRow): string {
  if (g.style === "band") return `inside $${g.strike}–$${g.hi}`;
  if (g.style === "swing") return `moves ${g.hi}%`;
  if (g.strike && g.strike > 0) return `above $${g.strike}`;
  return "above the print";
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
