import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bot, Gamepad2, RefreshCw, Send, ShoppingBag, Sparkles } from "lucide-react";
import { PrintChart } from "@/components/print-chart";
import { PrintTape } from "@/components/print-tape";
import { PositionActions } from "@/components/position-actions";
import { DepthScreen } from "@/components/depth-screen";
import { HoldingCards, type HoldingRow, MarkFace } from "@/components/holding-cards";
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
import { loadMarks, type TokenMark } from "@/lib/token-mark";
import { readRevolut } from "@/lib/revolut-link";
import { writeUsing } from "@/lib/using";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { loadWide, type WideRow } from "@/lib/coin-tape";
import { loadHeadlines, type Headline } from "@/lib/wire";
import { loadPulse, type BoardGroup, type TapeRow } from "@/lib/universe";
import { listTrades, onTrades } from "@/lib/trade-log";
import { realizedDays, unrealizedToday } from "@/lib/day-pnl";
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
  const [marks, setMarks] = useState<Record<string, TokenMark>>({});
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
  const [pane, setPane] = useState<"book" | "depth">("book");
  const [fills, setFills] = useState<ReturnType<typeof listTrades>>([]);
  const board = tape.filter((n) => n.group === group);
  const wideHit = wide.find((w) => w.mint === pick);
  const chosen: TapeRow | undefined =
    tape.find((n) => n.mint === pick) ??
    (wideHit ? { symbol: wideHit.symbol, mint: wideHit.mint, group: "crypto", price: wideHit.price, change: wideHit.change } : undefined) ??
    tape.find((n) => n.symbol === "SOL") ??
    tape[0];

  useEffect(() => setCap(spendCap()), []);
  useEffect(() => {
    const pull = () => setFills(listTrades());
    pull();
    return onTrades(pull);
  }, []);
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
    ...(pic && pic.sol > 0 ? [{ mint: SOL, symbol: "SOL", name: "Network fees", qty: pic.sol, value: (moves[SOL]?.price || 0) > 0 ? pic.sol * (moves[SOL]?.price || 0) : pic.solUsd, where: "coin" as const }] : []),
    ...held.map((line) => ({
      mint: line.mint,
      symbol: line.symbol,
      name: line.group === "company" ? "PreStock" : line.group === "listed" ? "Listed" : line.group === "stake" ? "Stake" : "Coin",
      qty: line.ui,
      value: (moves[line.mint]?.price || 0) > 0 ? line.ui * (moves[line.mint]?.price || 0) : line.usd,
      where: line.group === "company" ? "pre" as const : line.group === "listed" ? "share" as const : "coin" as const,
    })),
  ];
  const closed = realizedDays(fills);
  const todayKey = new Date().toISOString().slice(0, 10);
  const closedToday = closed.find((row) => row.day === todayKey)?.realized ?? 0;
  const marksToday = unrealizedToday(rows.map((row) => ({ value: row.value, day: moves[row.mint]?.day ?? null })));
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
  const priceKey = [...rows.map((row) => row.mint), chosen?.mint || "", ...tape.slice(0, 24).map((row) => row.mint)]
    .filter((mint) => mint && mint.length >= 32)
    .slice(0, 40)
    .join(",");
  useEffect(() => {
    const ids = [...new Set(priceKey.split(",").filter((mint) => mint.length >= 32))];
    if (!ids.length) return;
    let on = true;
    const pull = () => {
      void fetch(`https://lite-api.jup.ag/price/v3?ids=${ids.join(",")}`, { headers: { accept: "application/json" } })
        .then((res) => res.json())
        .then((body: Record<string, { usdPrice?: number; priceChange24h?: number }>) => {
          if (!on || !body) return;
          setMoves((cur) => {
            const next = { ...cur };
            for (const mint of ids) {
              const price = Number(body[mint]?.usdPrice) || 0;
              if (!(price > 0)) continue;
              const prev = next[mint];
              next[mint] = prev
                ? { ...prev, price }
                : { mint, price, hour: null, day: Number(body[mint]?.priceChange24h) || null, week: null };
            }
            return next;
          });
          setTape((cur) => cur.map((row) => {
            const price = Number(body[row.mint]?.usdPrice) || 0;
            return price > 0 ? { ...row, price } : row;
          }));
          setWide((cur) => cur.map((row) => {
            const price = Number(body[row.mint]?.usdPrice) || 0;
            return price > 0 ? { ...row, price } : row;
          }));
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 2_000);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, [priceKey]);
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
  const markKey = rows.map((row) => row.mint).filter((mint, i, all) => mint.length >= 32 && all.indexOf(mint) === i).slice(0, 40).join(",");
  useEffect(() => {
    const mints = markKey.split(",").filter((mint) => mint.length >= 32);
    if (!mints.length) return;
    let live = true;
    loadMarks({ data: { mints, lines: true } })
      .then((list) => {
        if (!live) return;
        setMarks((cur) => {
          const next = { ...cur };
          for (const row of list) {
            const prev = next[row.mint];
            next[row.mint] = {
              mint: row.mint,
              icon: row.icon || prev?.icon || "",
              name: row.name || prev?.name || "",
              symbol: row.symbol || prev?.symbol || "",
              line: row.line?.length ? row.line : prev?.line || [],
              volume: row.volume?.length ? row.volume : prev?.volume || [],
              vol24: row.vol24 || prev?.vol24 || 0,
              poolVol: row.poolVol || prev?.poolVol || 0,
              poolDex: row.poolDex || prev?.poolDex || "",
            };
          }
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [markKey]);
  const iconKey = screen.slice(0, 24).map((row) => row.mint).filter((mint) => mint.length >= 32).join(",");
  useEffect(() => {
    const mints = iconKey.split(",").filter((mint) => mint.length >= 32);
    if (!mints.length) return;
    let live = true;
    loadMarks({ data: { mints, lines: false } })
      .then((list) => {
        if (!live) return;
        setMarks((cur) => {
          const next = { ...cur };
          for (const row of list) {
            const prev = next[row.mint];
            next[row.mint] = {
              mint: row.mint,
              icon: row.icon || prev?.icon || "",
              name: row.name || prev?.name || "",
              symbol: row.symbol || prev?.symbol || "",
              line: prev?.line?.length ? prev.line : row.line || [],
              volume: prev?.volume?.length ? prev.volume : row.volume || [],
              vol24: prev?.vol24 || row.vol24 || 0,
              poolVol: prev?.poolVol || row.poolVol || 0,
              poolDex: prev?.poolDex || row.poolDex || "",
            };
          }
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [iconKey]);
  const wallets = [
    { name: "Phantom", on: !!owner, hint: owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Not connected", to: "/phantom" as const },
    { name: "MetaMask", on: !!mask, hint: mask ? `${mask.slice(0, 4)}…${mask.slice(-4)}` : "Not connected", to: "/metamask" as const },
    { name: "Revolut", on: !!rev?.tag, hint: rev?.tag ? `@${rev.tag}` : "No Revtag", to: "/revolut" as const },
    { name: "Backpack", on: wallet.w.links.some((l) => /backpack/i.test(l.label)), hint: wallet.w.links.find((l) => /backpack/i.test(l.label))?.address.slice(0, 4) || "Not connected", to: "/backpack" as const },
  ];

  return (
    <main className="px-3 py-3 lg:px-5">
      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#08080c]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex items-end gap-6">
            <div>
              <p className="text-[11px] text-white/40">Portfolio</p>
              <p className="font-mono text-3xl leading-none tabular-nums">{pic ? `$${pic.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : owner ? "…" : "$0.00"}</p>
            </div>
            <p className={cn("pb-1 font-mono text-sm tabular-nums", marksToday < 0 ? "text-down" : "text-accent")}>
              {held.length === 0 ? "No holdings yet" : `${marksToday >= 0 ? "+" : "−"}$${Math.abs(marksToday).toFixed(2)} marks today`}
            </p>
            <p className={cn("pb-1 font-mono text-sm tabular-nums", closedToday < 0 ? "text-down" : "text-white/70")}>
              {closedToday >= 0 ? "+" : "−"}${Math.abs(closedToday).toFixed(2)} closed today
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
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">Holdings</p>
            <p className="text-[11px] text-white/40">{rows.length ? "Tap a holding. It opens on this page, then in the terminal." : owner ? "Reading this address." : "Connect Phantom to see this address."}</p>
          </div>
          {closed.length > 0 ? (
            <ul className="mt-2 flex gap-1.5 overflow-x-auto">
              {closed.map((row) => (
                <li key={row.day} className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[11px] tabular-nums">
                  <span className="text-white/40">{row.day.slice(5)} </span>
                  <span className={row.realized < 0 ? "text-down" : "text-accent"}>{row.realized >= 0 ? "+" : "−"}${Math.abs(row.realized).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-white/35">Closed days show up after a sell this browser signed. Marks are the open positions.</p>
          )}
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">Nothing priced here yet.</p>
          ) : (
            <div className="mt-3 -mx-1 overflow-x-auto px-1 pb-1 lg:overflow-visible">
              <HoldingCards
                rows={rows}
                moves={moves}
                marks={marks}
                activeMint={chosen?.mint}
                className="flex snap-x snap-mandatory lg:grid lg:grid-cols-4"
                onOpen={(row) => {
                  const hit = tape.find((t) => t.mint === row.mint);
                  if (hit) {
                    choose(hit);
                    return;
                  }
                  const px = moves[row.mint]?.price || (row.qty > 0 ? row.value / row.qty : 0);
                  const day = moves[row.mint]?.day ?? 0;
                  const group = row.where === "pre" ? "company" : row.where === "share" ? "listed" : "crypto";
                  choose({ symbol: row.symbol, mint: row.mint, group, price: px, change: day });
                }}
              />
            </div>
          )}
        </div>
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
              {chosen?.mint ? <PrintChart mint={chosen.mint} symbol={chosen.symbol} className="h-[260px] w-full sm:h-[300px]" /> : <p className="px-2 py-16 text-sm text-white/40">Waiting on a Jupiter price.</p>}
              {chosen ? (
                <Link to="/invest" search={{ desk: "spot" }} className="mx-2 mb-3 mt-1 inline-flex min-h-9 items-center text-xs font-semibold text-accent">
                  Open {chosen.symbol} in the terminal
                </Link>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col">
            <div className="border-b border-white/10 p-4">
              <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Quick trade</p>
              <p className="mt-1 text-xs text-white/45">{chosen?.price ? `${chosen.symbol} at ${formatUsd(chosen.price)} · about ${chosen.price > 0 ? (buyUsd / chosen.price).toPrecision(3) : "—"}` : "USDC in. The wallet signs."}</p>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {[1, 5, 25, 100].map((n) => (
                  <button key={n} type="button" onClick={() => setBuyUsd(n)} className={cn("min-h-10 rounded-xl font-mono text-sm", buyUsd === n ? "bg-white text-black" : "bg-white/5 text-white/70")}>
                    ${n}
                  </button>
                ))}
              </div>
              {chosen ? (
                <PositionActions
                  symbol={chosen.symbol}
                  mint={chosen.mint}
                  price={chosen.price}
                  qty={rows.find((row) => row.mint === chosen.mint)?.qty || 0}
                  usd={buyUsd}
                  owner={owner}
                />
              ) : (
                <p className="mt-3 text-xs text-white/40">Pick a holding or a market.</p>
              )}
              {!owner ? <div className="mt-3"><WalletPicker /></div> : null}
            </div>
            {chosen?.mint ? (
              <div>
                <div className="flex gap-1 px-2 pt-2">
                  <button type="button" onClick={() => setPane("book")} className={cn("min-h-8 rounded-full px-3 text-xs font-semibold", pane === "book" ? "bg-white text-black" : "bg-white/10")}>Book</button>
                  <button type="button" onClick={() => setPane("depth")} className={cn("min-h-8 rounded-full px-3 text-xs font-semibold", pane === "depth" ? "bg-white text-black" : "bg-white/10")}>Depth</button>
                </div>
                {pane === "depth" ? <DepthScreen mint={chosen.mint} symbol={chosen.symbol} /> : <PrintTape mint={chosen.mint} symbol={chosen.symbol} size={buyUsd} />}
              </div>
            ) : null}
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="flex items-baseline justify-between px-4 py-2.5">
            <p className="text-sm font-semibold">Markets</p>
            <p className="font-mono text-[11px] text-white/35">{screen.length} · house book, Jupiter traded, trending, organic</p>
          </div>
          <div className="grid max-h-[280px] grid-cols-2 overflow-auto border-t border-white/10 sm:grid-cols-3 xl:grid-cols-6">
            {screen.slice(0, 48).map((row) => (
              <Link
                key={row.mint}
                to="/invest"
                search={{ desk: "spot" }}
                className="border-r border-b border-white/10 px-3 py-2.5 text-left"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <MarkFace icon={marks[row.mint]?.icon} symbol={row.symbol} mint={row.mint} />
                    <span className="truncate text-sm font-semibold">{row.symbol}</span>
                  </span>
                  <span className={cn("font-mono text-[11px] tabular-nums", row.change < 0 ? "text-down" : "text-accent")}>{row.change >= 0 ? "+" : ""}{row.change.toFixed(1)}%</span>
                </span>
                <span className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-white/40">
                  <span>{formatUsd(row.price)}</span>
                  <span className="truncate">{row.venue}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="mt-3 overflow-hidden rounded-[22px] border border-white/10 bg-[#08080c]">
        <div className="flex items-baseline justify-between px-4 py-3">
          <p className="text-sm font-semibold">News</p>
          <Link to="/wire" className="text-[11px] text-accent">Wire</Link>
        </div>
        <ul>
          {news.slice(0, 5).map((row) => (
            <li key={row.link} className="border-t border-white/10">
              <a href={row.link} target="_blank" rel="noreferrer" className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <span className="text-sm">{row.title}</span>
                <span className="shrink-0 font-mono text-[10px] tracking-wide text-white/35 uppercase">{row.source}</span>
              </a>
            </li>
          ))}
          {news.length === 0 ? <li className="border-t border-white/10 px-4 py-3 text-sm text-white/40">The wire has not come back yet.</li> : null}
        </ul>
      </section>
      <nav className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["Trade", "Quotes", "/invest"],
            ["Markets", "The book", "/wire"],
            ["Send", "Move USDC", "/payments"],
            ["Portfolio", "The full book", "/vault"],
            ["Agents", "The kit", "/agents"],
            ["PreStocks", "Companies", "/pre"],
            ["xStocks", "Listed", "/xstocks"],
            ["Loans", "Borrow", "/loans"],
          ] as const
        ).map(([label, hint, to]) => (
          <Link key={to} to={to} className="rounded-2xl border border-white/10 bg-[#10131c] px-3 py-3">
            <span className="block text-sm font-semibold">{label}</span>
            <span className="mt-0.5 block text-[11px] text-white/40">{hint}</span>
          </Link>
        ))}
      </nav>
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
