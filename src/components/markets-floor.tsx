import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeskAudit } from "@/components/money-flow";
import { WalletPicker } from "@/components/wallet-picker";
import { confirmFlight, loadClearing, postPred, postRace, settlePred, settleRace } from "@/lib/clearing";
import { signClearing } from "@/lib/clearing-sign";
import {
  buildPerpDecrease,
  buildPerpIncrease,
  buildPredOrder,
  executePerpTx,
  loadPerpBoard,
  loadPerpPositions,
  loadPredEvents,
  loadPredPositions,
  USDC_MINT,
  type PerpBoardRow,
  type PerpPosition,
  type PredEvent,
  type PredPosition,
} from "@/lib/jup-venues";
import { IssuerBoard } from "@/components/issuer-board";
import { RayBoard } from "@/components/ray-board";
import { UsBoard } from "@/components/us-board";
import { SOL, CASH, signRoute } from "@/lib/jup-sign";
import { connectPhantom, sendVersioned, signSerializedTx, splHolding } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { loadPulse, UNIVERSE, type BoardGroup, type TapeRow } from "@/lib/universe";
import { loadBackpack } from "@/lib/backpack";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { CommodityBook, CommodityStrip } from "@/components/commodity-book";
import { JumpStrip } from "@/components/jump-strip";
import { PackShelf } from "@/components/pack-shelf";
import { TradeTools } from "@/components/trade-tools";
import { PrintChart } from "@/components/print-chart";
import { PrintTape } from "@/components/print-tape";
import { BuyingPower } from "@/components/buying-power";
import { bumpClears, ClearStrip } from "@/components/clear-strip";
import { rememberClear } from "@/lib/clear-tape";
import { cn } from "@/lib/utils";

const COIN_DECIMALS: Record<string, number> = {
  SOL: 9, ETH: 8, BTC: 8, JUP: 6, JitoSOL: 9, JLP: 6, PYTH: 6, WIF: 6, BONK: 5,
};
const PURSE = ["USDC", "CASH", "SOL", "ETH", "BTC", "JUP", "BONK", "WIF", "PYTH"] as const;
const TENORS = ["15m", "1h", "4h", "1d"] as const;
type Tenor = (typeof TENORS)[number];
type Leg = { owner: string; usd: number };
type Contract = {
  id: string;
  symbol: string;
  mint: string;
  tenor: Tenor;
  windowEnd: number;
  openPrice: number;
  strike?: number;
  style?: "line" | "band" | "swing";
  hi?: number;
  yes: Leg[];
  no: Leg[];
  status: string;
};
type Race = {
  id: string;
  left: string;
  right: string;
  tenor: Tenor;
  windowEnd: number;
  status: string;
  leftLegs: Leg[];
  rightLegs: Leg[];
};
type House = { pubkey: string; usdc: number; preds: Contract[]; races: Race[]; perps: Array<{ id: string; owner: string; symbol: string; side: string; notional: number; margin: number; entry?: number }> };

function money(n: number): string {
  if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function dollars(legs: Leg[]): number {
  return legs.reduce((s, l) => s + l.usd, 0);
}
function centsOf(yes: number, no: number): number {
  const t = yes + no;
  if (t <= 0) return 50;
  return Math.round((yes / t) * 100);
}
function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function nice(s: number): number {
  if (s >= 100) return Math.round(s);
  if (s >= 1) return Math.round(s * 100) / 100;
  return Math.round(s * 10000) / 10000;
}
function strikesFor(mark: number): number[] {
  if (!(mark > 0)) return [];
  const step = mark >= 100 ? Math.max(1, Math.round(mark * 0.01)) : mark >= 1 ? Math.round(mark * 0.01 * 100) / 100 : Math.round(mark * 0.02 * 10000) / 10000;
  const mid = nice(mark);
  return [-3, -2, -1, 0, 1, 2, 3].map((i) => nice(mid + i * step)).filter((n, i, a) => n > 0 && a.indexOf(n) === i);
}
function periodLabel(period: string): string {
  if (!period) return "";
  if (period.startsWith("TB")) return `Tiebreak ${period.slice(2)}`.trim();
  if (period.startsWith("S")) return `Set ${period.slice(1)}`;
  return period;
}

export function MarketsFloor({
  initialEvents = [],
  initialCoins = [],
  initialPerps = [],
}: {
  initialEvents?: PredEvent[];
  initialCoins?: PredEvent[];
  initialPerps?: PerpBoardRow[];
}) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [symbol, setSymbol] = useState("OPENAI");
  const [group, setGroup] = useState<BoardGroup>("company");
  const [tenor, setTenor] = useState<Tenor>("1h");
  const [stake, setStake] = useState(1);
  const [stakeText, setStakeText] = useState("");
  const [purse, setPurse] = useState<(typeof PURSE)[number]>("USDC");
  const [house, setHouse] = useState<House | null>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [tape, setTape] = useState<TapeRow[]>([]);
  const [shares, setShares] = useState<TapeRow[]>([]);
  const [usdcBal, setUsdcBal] = useState(0);
  const [cashBal, setCashBal] = useState(0);
  const [board, setBoard] = useState<PerpBoardRow[]>(initialPerps);
  const [liveMargin, setLiveMargin] = useState(25);
  const [liveLev, setLiveLev] = useState(2);
  const [listed, setListed] = useState<PerpPosition[]>([]);
  const [cat, setCat] = useState<"crypto" | "sports" | "politics">("sports");
  const [view, setView] = useState<"packs" | "print" | "metals" | "sports" | "coins" | "perps" | "mix" | "us" | "pools" | "issuers">("print");
  const [metal, setMetal] = useState("xau");
  const [events, setEvents] = useState<PredEvent[]>(initialEvents);
  const [coins, setCoins] = useState<PredEvent[]>(initialCoins);
  const [eventUsd, setEventUsd] = useState(5);
  const [mixA, setMixA] = useState("");
  const [mixB, setMixB] = useState("");
  const [yesA, setYesA] = useState(true);
  const [yesB, setYesB] = useState(true);
  const [pairs, setPairs] = useState<Array<{ id: string; left: string; right: string; usd: number; sigs: string[] }>>([]);
  const [eventPos, setEventPos] = useState<PredPosition[]>([]);
  const [raceLeft, setRaceLeft] = useState("OPENAI");
  const [raceRight, setRaceRight] = useState("SPACEX");
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [sig, setSig] = useState("");

  const names = useMemo(() => {
    const base = tape.filter((n) => n.group === group);
    if (group !== "listed") return base;
    const seen = new Set(base.map((n) => n.symbol));
    const extra = shares.filter((n) => !seen.has(n.symbol));
    return [...base, ...extra].sort((a, b) => b.change - a.change);
  }, [tape, shares, group]);
  const mark = marks[symbol] || shares.find((n) => n.symbol === symbol)?.price || 0;
  const mint = UNIVERSE.find((n) => n.symbol === symbol)?.mint || shares.find((n) => n.symbol === symbol)?.mint || "";
  const live = tape.find((n) => n.symbol === symbol) || shares.find((n) => n.symbol === symbol);

  useEffect(() => {
    let on = true;
    const pull = () => {
      loadClearing().then((h) => on && setHouse(h as House)).catch((e) => on && setErr(e instanceof Error ? e.message : "The book did not load."));
      loadPerpBoard().then((rows) => on && setBoard(rows)).catch(() => undefined);
    };
    pull();
    const id = window.setInterval(() => {
      setNow(Date.now());
      pull();
    }, 15_000);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let on = true;
    const pull = () => {
      loadPulse()
        .then((p) => {
          if (!on) return;
          setTape(p.rows);
          const next: Record<string, number> = {};
          for (const row of p.rows) next[row.symbol] = row.price;
          setMarks(next);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, []);

  const liveIds = names.map((row) => row.mint).filter((mint) => mint.length >= 32).slice(0, 40).join(",");
  useEffect(() => {
    const ids = liveIds.split(",").filter((mint) => mint.length >= 32);
    if (!ids.length) return;
    let on = true;
    const pull = () => {
      void fetch(`https://lite-api.jup.ag/price/v3?ids=${ids.join(",")}`, { headers: { accept: "application/json" } })
        .then((res) => res.json())
        .then((body: Record<string, { usdPrice?: number }>) => {
          if (!on || !body) return;
          setTape((cur) => cur.map((row) => {
            const price = Number(body[row.mint]?.usdPrice) || 0;
            return price > 0 ? { ...row, price } : row;
          }));
          setMarks((cur) => {
            const next = { ...cur };
            for (const [mint, row] of Object.entries(body)) {
              const price = Number(row?.usdPrice) || 0;
              const hit = names.find((n) => n.mint === mint);
              if (hit && price > 0) next[hit.symbol] = price;
            }
            return next;
          });
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 2_000);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, [liveIds]);

  useEffect(() => {
    let on = true;
    loadBackpack()
      .then((rows) => {
        if (!on) return;
        setShares(
          rows
            .filter((row) => row.price > 0)
            .map((row) => ({ symbol: row.symbol, mint: row.mint, group: "listed" as const, price: row.price, change: row.change })),
        );
      })
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, []);

  useEffect(() => {
    if (!owner) {
      setUsdcBal(0);
      setCashBal(0);
      setListed([]);
      setEventPos([]);
      return;
    }
    splHolding(owner, USDC_MINT).then((h) => setUsdcBal(h.ui)).catch(() => setUsdcBal(0));
    splHolding(owner, CASH).then((h) => setCashBal(h.ui)).catch(() => setCashBal(0));
    loadPerpPositions({ data: { owner } }).then(setListed).catch(() => setListed([]));
    loadPredPositions({ data: { owner } }).then(setEventPos).catch(() => setEventPos([]));
  }, [owner, busy]);

  useEffect(() => {
    try {
      const rows = JSON.parse(window.localStorage.getItem("senda.pred.pair.v1") || "[]") as Array<{ id: string; left: string; right: string; usd: number; sigs: string[] }>;
      if (Array.isArray(rows)) setPairs(rows.slice(0, 12));
    } catch {
      /* empty */
    }
  }, []);

  useEffect(() => {
    if (view !== "sports" && view !== "mix") return;
    let on = true;
    const pull = () => {
      loadPredEvents({ data: { category: cat } })
        .then((rows) => on && setEvents(rows))
        .catch((e) => on && setErr(e instanceof Error ? e.message : "Events did not load."));
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, [cat, view]);

  useEffect(() => {
    if (view !== "coins" && view !== "mix") return;
    let on = true;
    const pull = () => {
      loadPredEvents({ data: { category: "crypto" } })
        .then((rows) => on && setCoins(rows))
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, [view]);

  async function who(): Promise<string> {
    const id = owner || (await connectPhantom());
    if (!owner) {
      const linked = wallet.linkChain(id, "Phantom", "phantom");
      if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
    }
    return id;
  }

  async function run(key: string, job: () => Promise<void>) {
    setBusy(key);
    try {
      await job();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "It did not send.");
    } finally {
      setBusy("");
    }
  }

  async function fund(id: string) {
    if (purse === "USDC") {
      if (usdcBal + 1e-6 < stake) {
        throw new Error(
          `This account has $${usdcBal.toFixed(2)} USDC and $${cashBal.toFixed(2)} CASH. Pick CASH if that is where the dollars are. Phantom Cash is a separate account.`,
        );
      }
      return;
    }
    if (purse === "CASH") {
      if (cashBal + 1e-6 < stake) {
        throw new Error(
          `This account has $${cashBal.toFixed(2)} CASH. Phantom Cash is a different account from the main wallet. Switch to it in Phantom, then connect.`,
        );
      }
      await signRoute({
        owner: id,
        inputMint: CASH,
        outputMint: USDC_MINT,
        amountRaw: Math.max(1, Math.round(stake * 1.02 * 1e6)),
        outDecimals: 6,
        usd: stake,
      });
      return;
    }
    const coin = UNIVERSE.find((n) => n.symbol === purse);
    const px = marks[purse] || 0;
    const dec = COIN_DECIMALS[purse] ?? 6;
    if (!coin || !(px > 0)) throw new Error(`No ${purse} price, so it cannot be the stake.`);
    await signRoute({
      owner: id,
      inputMint: coin.mint,
      outputMint: USDC_MINT,
      amountRaw: Math.max(1, Math.floor(((stake * 1.02) / px) * 10 ** dec)),
      outDecimals: 6,
      usd: stake,
    });
  }

  function stakePrint(side: "yes" | "no", strike: number) {
    if (!house?.pubkey || !mint) {
      toast.error(!mint ? "That name has no print." : "The book is still loading. Try again in a second.");
      return;
    }
    if (purse === "USDC" && usdcBal + 1e-6 < stake && cashBal + 1e-6 >= stake) {
      toast.error(`You have $${cashBal.toFixed(2)} CASH, not USDC. Tap CASH, then stake.`);
      return;
    }
    if (purse === "USDC" && usdcBal + 1e-6 < stake) {
      toast.error(`You have $${usdcBal.toFixed(2)} USDC and $${cashBal.toFixed(2)} CASH on this account.`);
      return;
    }
    void run(`${symbol}-${strike}-${side}`, async () => {
      const id = await who();
      await fund(id);
      const tag = strike > 0 ? String(strike) : "open";
      const memo = `Senda clear pred ${symbol} ${tenor} ${side} ${tag}`;
      const paid = await payUsdc({ owner: id, to: house.pubkey, usd: stake, memo });
      rememberClear({ sig: paid.signature, from: id, to: house.pubkey, usd: stake, memo, kind: "predict", status: "pending" });
      bumpClears();
      const opened = await postPred({ data: { owner: id, sig: paid.signature, symbol, mint, tenor, side, usd: stake, strike } });
      setSig(paid.signature);
      toast.success(`${symbol} ${side === "yes" ? "above" : "below"} ${strike > 0 ? money(strike) : money(opened.openPrice)} is in.`);
    });
  }

  function stakeMore(style: "band" | "swing", side: "yes" | "no", strike: number, hi: number) {
    if (!house?.pubkey || !mint) {
      toast.error(!mint ? "That name has no print." : "The book is still loading. Try again in a second.");
      return;
    }
    if (purse === "USDC" && usdcBal + 1e-6 < stake && cashBal + 1e-6 >= stake) {
      toast.error(`You have $${cashBal.toFixed(2)} CASH, not USDC. Tap CASH, then stake.`);
      return;
    }
    if (purse === "USDC" && usdcBal + 1e-6 < stake) {
      toast.error(`You have $${usdcBal.toFixed(2)} USDC and $${cashBal.toFixed(2)} CASH on this account.`);
      return;
    }
    void run(`${style}-${side}`, async () => {
      const id = await who();
      await fund(id);
      const memo = style === "band"
        ? `Senda clear pred ${symbol} ${tenor} ${side} band ${strike}-${hi}`
        : `Senda clear pred ${symbol} ${tenor} ${side} swing ${hi}`;
      const paid = await payUsdc({ owner: id, to: house.pubkey, usd: stake, memo });
      rememberClear({ sig: paid.signature, from: id, to: house.pubkey, usd: stake, memo, kind: "predict", status: "pending" });
      bumpClears();
      await postPred({ data: { owner: id, sig: paid.signature, symbol, mint, tenor, side, usd: stake, strike, style, hi } });
      setSig(paid.signature);
      toast.success(style === "band" ? `${symbol} band is in.` : `${symbol} has to move ${hi}%.`);
    });
  }

  function jumpRace(side: "left" | "right") {
    if (!house?.pubkey) {
      toast.error("The book is still loading. Try again in a second.");
      return;
    }
    const left = UNIVERSE.find((n) => n.symbol === raceLeft);
    const right = UNIVERSE.find((n) => n.symbol === raceRight);
    if (!left || !right) return;
    void run(`race-${side}`, async () => {
      const id = await who();
      await fund(id);
      const memo = `Senda clear race ${raceLeft} ${raceRight} ${tenor} ${side}`;
      const paid = await payUsdc({
        owner: id,
        to: house.pubkey,
        usd: stake,
        memo,
      });
      rememberClear({ sig: paid.signature, from: id, to: house.pubkey, usd: stake, memo, kind: "predict", status: "pending" });
      bumpClears();
      await postRace({
        data: { owner: id, sig: paid.signature, left: raceLeft, leftMint: left.mint, right: raceRight, rightMint: right.mint, tenor, side, usd: stake },
      });
      setSig(paid.signature);
      toast.success(`${side === "left" ? raceLeft : raceRight} is in the race.`);
    });
  }

  function settle(id: string) {
    void run(id, async () => {
      const whoId = await who();
      const built = await settlePred({ data: { owner: whoId, id } });
      const paid = await signClearing(built.tx);
      await confirmFlight({ data: { sig: paid } });
      setSig(paid);
      toast.success(built.up ? "Above took the pot." : "Below took the pot.");
    });
  }

  function payRace(id: string) {
    void run(id, async () => {
      const whoId = await who();
      const built = await settleRace({ data: { owner: whoId, id } });
      const paid = await signClearing(built.tx);
      await confirmFlight({ data: { sig: paid } });
      setSig(paid);
      toast.success("The race paid.");
    });
  }

  function openLive(side: "long" | "short", name: string) {
    void run(`live-${name}-${side}`, async () => {
      const id = await who();
      const built = await buildPerpIncrease({ data: { owner: id, asset: name as "SOL" | "ETH" | "BTC", side, usd: liveMargin, leverage: liveLev } });
      const signed = await signSerializedTx(built.tx);
      const done = await executePerpTx({ data: { action: "increase-position", serializedTxBase64: signed } });
      setSig(done.txid);
      toast.success(`${name} ${side} is open.`);
    });
  }

  function shutLive(row: PerpPosition) {
    void run(row.positionPubkey, async () => {
      const built = await buildPerpDecrease({ data: { positionPubkey: row.positionPubkey } });
      const signed = await signSerializedTx(built.tx);
      const done = await executePerpTx({ data: { action: "decrease-position", serializedTxBase64: signed } });
      setSig(done.txid);
      toast.success(`Closed ${row.asset}.`);
    });
  }

  function buyEvent(marketId: string, isYes: boolean, title: string) {
    void run(marketId, async () => {
      const id = await who();
      const built = await buildPredOrder({ data: { owner: id, marketId, isYes, usd: eventUsd } });
      const { Buffer } = await import("buffer");
      const { VersionedTransaction } = await import("@solana/web3.js");
      const tx = VersionedTransaction.deserialize(Buffer.from(built.tx, "base64"));
      const done = await sendVersioned(tx);
      setSig(done);
      toast.success(`${title} filled.`);
    });
  }

  function buyPair(left: string, right: string, leftYes: boolean, rightYes: boolean) {
    void run("pair", async () => {
      const id = await who();
      const legs = [
        { marketId: mixA, isYes: leftYes, title: left },
        { marketId: mixB, isYes: rightYes, title: right },
      ];
      const sigs: string[] = [];
      try {
        for (const leg of legs) {
          const built = await buildPredOrder({ data: { owner: id, marketId: leg.marketId, isYes: leg.isYes, usd: eventUsd } });
          const { Buffer } = await import("buffer");
          const { VersionedTransaction } = await import("@solana/web3.js");
          const tx = VersionedTransaction.deserialize(Buffer.from(built.tx, "base64"));
          sigs.push(await sendVersioned(tx));
        }
      } catch (err) {
        const why = err instanceof Error ? err.message : "The order did not sign.";
        if (sigs.length === 1) throw new Error(`The first order signed (${sigs[0].slice(0, 8)}). The second did not. ${why}`);
        throw err;
      }
      const row = { id: sigs[0], left, right, usd: eventUsd, sigs };
      const next = [row, ...pairs].slice(0, 12);
      setPairs(next);
      window.localStorage.setItem("senda.pred.pair.v1", JSON.stringify(next));
      setSig(sigs[1]);
      toast.success("Both orders signed. Each market pays on its own.");
    });
  }

  const end = useMemo(() => {
    const ms = tenor === "15m" ? 900_000 : tenor === "1h" ? 3_600_000 : tenor === "4h" ? 14_400_000 : 86_400_000;
    let at = Math.ceil(now / ms) * ms;
    if (at - now < 60_000) at += ms;
    return at;
  }, [tenor, now]);
  const ladder = useMemo(() => strikesFor(mark), [mark]);
  const fromLock = (house?.preds || []).find((c) => c.symbol === symbol && c.tenor === tenor && c.windowEnd === end && !(c.strike && c.strike > 0) && (c.style || "line") === "line");
  const due = (house?.preds || []).filter((c) => c.windowEnd <= now);
  const dueRaces = (house?.races || []).filter((r) => r.windowEnd <= now);
  void sig;

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col">
      <div className="px-3 pt-3"><JumpStrip /></div>
      <div className="px-3 pt-3"><DeskAudit live="Print is a stake on the next window. Packs buy the token. Sports and coins sign a Jupiter order." hold="A price here is not a share, and a stake is not a fill until it settles." /></div>
      <div className="flex gap-1 border-b border-white/10 px-3 py-2">
        {(
          [
            ["packs", "Packs"],
            ["print", "Print"],
            ["metals", "Metals"],
            ["us", "US"],
            ["pools", "Pools"],
            ["issuers", "Issuers"],
            ["sports", "Sports"],
            ["coins", "Coins"],
            ["mix", "Mix"],
            ["perps", "Perps"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setView(id)} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", view === id ? "bg-white text-black" : "bg-white/10")}>
            {label}
          </button>
        ))}
      </div>
      <CommodityStrip onPick={(id) => { setMetal(id); setView("metals"); }} />
      {view === "packs" ? <PackShelf /> : null}
      {view === "us" ? <UsBoard /> : null}
      {view === "pools" ? <RayBoard /> : null}
      {view === "issuers" ? <IssuerBoard /> : null}
      {view === "sports" ? (
        <SportsBook cat={cat} setCat={setCat} events={events} err={err} usd={eventUsd} setUsd={setEventUsd} busy={busy} owner={owner} onBuy={buyEvent} />
      ) : null}
      {view === "coins" ? <CoinBook events={coins} usd={eventUsd} busy={busy} owner={owner} onBuy={buyEvent} /> : null}
      {view === "mix" ? (
        <MixBook
          events={[...events, ...coins]}
          usd={eventUsd}
          setUsd={setEventUsd}
          busy={busy}
          owner={owner}
          a={mixA}
          b={mixB}
          yesA={yesA}
          yesB={yesB}
          setA={setMixA}
          setB={setMixB}
          setYesA={setYesA}
          setYesB={setYesB}
          pairs={pairs}
          onPair={buyPair}
        />
      ) : null}
      {view === "perps" ? (
        <>
          <CommodityBook mode="trade" focus={metal} onFocus={setMetal} />
          <PerpStrip rows={board} busy={busy} owner={owner} margin={liveMargin} lev={liveLev} setMargin={setLiveMargin} setLev={setLiveLev} onOpen={openLive} />
        </>
      ) : null}
      {view === "print" ? (
      <>
      <section className="border-b border-white/10 bg-[#07090d]">
        <div className="flex items-center gap-2 overflow-x-auto px-3 py-2">
          <p className="shrink-0 font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Watchlist</p>
          {(["company", "crypto", "stake", "listed"] as const).map((id) => (
            <button key={id} type="button" onClick={() => {
              setGroup(id);
              if (id === "listed") {
                const first = [...shares].sort((a, b) => b.change - a.change)[0] || UNIVERSE.find((n) => n.group === "listed");
                if (first) setSymbol(first.symbol);
                return;
              }
              const first = UNIVERSE.find((n) => n.group === id);
              if (first) setSymbol(first.symbol);
            }} className={cn("min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold", group === id ? "bg-accent text-accent-fg" : "bg-white/10")}>
              {id === "company" ? "Companies" : id === "crypto" ? "Crypto" : id === "stake" ? "Stakes" : "Listed"}
            </button>
          ))}
        </div>
        <div className="border-t border-white/10 lg:grid lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
          <div className="flex overflow-x-auto bg-black lg:block lg:max-h-72 lg:overflow-x-hidden lg:overflow-y-auto">
            {names.map((n) => {
              const down = n.change < 0;
              const flat = !(n.change > 0) && !down;
              return (
                <button
                  key={n.symbol}
                  type="button"
                  onClick={() => setSymbol(n.symbol)}
                  className={cn(
                    "flex min-h-11 w-[12.5rem] shrink-0 items-center justify-between gap-3 border-white/10 px-3 text-left lg:w-full lg:border-b",
                    n.symbol === symbol ? "bg-white/10" : "hover:bg-white/[0.04]",
                  )}
                >
                  <span className="font-mono text-xs font-semibold">{n.symbol}</span>
                  <span className="text-right">
                    <span className="block font-mono text-xs tabular-nums">{n.price > 0 ? money(n.price) : "—"}</span>
                    <span className={cn("block font-mono text-[11px] tabular-nums", flat ? "text-subtle" : down ? "text-down" : "text-up")}>
                      {flat ? "Flat" : down ? "Down" : "Up"} {n.change > 0 ? "+" : ""}{n.change.toFixed(2)}%
                    </span>
                  </span>
                </button>
              );
            })}
            {names.length === 0 ? <p className="flex min-h-11 items-center px-3 text-xs text-subtle">Reading the tape.</p> : null}
          </div>
          <div className="border-t border-white/10 px-4 py-4 lg:border-t-0 lg:border-l">
            <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">{symbol} · finishes {clock(end)}</p>
            <h1 className={cn("mt-1 font-mono text-4xl tabular-nums tracking-tight sm:text-5xl", live && live.change < 0 ? "text-down" : live && live.change > 0 ? "text-up" : "text-fg")}>
              {mark > 0 ? money(mark) : "No print"}
            </h1>
            <p className={cn("mt-1 font-mono text-sm tabular-nums", live && live.change < 0 ? "text-down" : live && live.change > 0 ? "text-up" : "text-subtle")}>
              {live ? `${live.change < 0 ? "Down" : live.change > 0 ? "Up" : "Flat"} ${live.change > 0 ? "+" : ""}${live.change.toFixed(2)}%` : "Waiting on the print."}
            </p>
            {mint && mark > 0 ? <TradeTools symbol={symbol} mint={mint} price={mark} change={live?.change} /> : null}
          </div>
        </div>
      </section>

      {mint ? (
        <div className="grid border-b border-white/10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="px-3 pt-3"><PrintChart mint={mint} symbol={symbol} className="h-[420px]" /></div>
          <PrintTape mint={mint} symbol={symbol} />
        </div>
      ) : null}

      <section className="border-b border-white/10 px-4 py-4">
        <p className="max-w-xl text-[13px] leading-relaxed text-muted">
          Pick above or below. Sign in Phantom. You need USDC in that wallet.
        </p>
        <div className="mt-3"><BuyingPower owner={owner} /></div>
        <div className="mt-3 flex flex-wrap gap-1">
          {TENORS.map((t) => (
            <button key={t} type="button" onClick={() => setTenor(t)} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", tenor === t ? "bg-accent text-accent-fg" : "bg-white/10")}>{t}</button>
          ))}
          {[0.01, 0.1, 1, 10, 100].map((n) => (
            <button key={n} type="button" onClick={() => { setStake(n); setStakeText(""); }} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", stake === n && !stakeText ? "bg-white text-black" : "bg-white/10")}>{n < 1 ? `${n * 100}¢` : `$${n}`}</button>
          ))}
          <input
            value={stakeText}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, "");
              setStakeText(raw);
              const n = Number(raw);
              if (n >= 0.001 && n <= 1_000_000) setStake(Math.round(n * 1_000_000) / 1_000_000);
            }}
            placeholder="0.001"
            inputMode="decimal"
            className="min-h-9 w-24 rounded-full border border-white/10 bg-black/40 px-3 font-mono text-xs outline-none"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {PURSE.map((c) => (
            <button key={c} type="button" onClick={() => setPurse(c)} className={cn("min-h-8 rounded-full px-3 font-mono text-[11px]", purse === c ? "bg-white text-black" : "bg-white/10")}>{c}</button>
          ))}
        </div>
        <p className="mt-2 font-mono text-[11px] text-subtle">
          {purse === "USDC" ? `${money(usdcBal)} USDC ready.` : purse === "CASH" ? `${money(cashBal)} CASH ready.` : `${purse} is the stake.`}
        </p>
        {!owner ? <div className="mt-3"><WalletPicker /></div> : null}
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] px-2 pb-1 text-[10px] font-semibold tracking-wide text-subtle uppercase">
          <span>Above</span><span>Strike</span><span className="text-right">Below</span>
        </div>
        <LadderRow label={fromLock?.openPrice ? `From ${money(fromLock.openPrice)}` : "From the print"} yes={dollars(fromLock?.yes || [])} no={dollars(fromLock?.no || [])} busy={busy} stake={stake} onYes={() => stakePrint("yes", 0)} onNo={() => stakePrint("no", 0)} yesKey={`${symbol}-0-yes`} noKey={`${symbol}-0-no`} />
        {ladder.map((k) => {
          const row = (house?.preds || []).find((c) => c.symbol === symbol && c.tenor === tenor && c.windowEnd === end && (c.strike || 0) === k && (c.style || "line") === "line");
          return <LadderRow key={k} label={money(k)} yes={dollars(row?.yes || [])} no={dollars(row?.no || [])} busy={busy} stake={stake} onYes={() => stakePrint("yes", k)} onNo={() => stakePrint("no", k)} yesKey={`${symbol}-${k}-yes`} noKey={`${symbol}-${k}-no`} />;
        })}
        <SamePot symbol={symbol} mark={mark} tenor={tenor} stake={stake} busy={busy} preds={house?.preds || []} end={end} onBand={(side, lo, hi) => stakeMore("band", side, lo, hi)} onSwing={(side, pct) => stakeMore("swing", side, 0, pct)} />
        <RaceBand names={tape.length ? tape : UNIVERSE.map((n) => ({ ...n, price: marks[n.symbol] || 0, change: 0 }))} left={raceLeft} right={raceRight} onLeft={setRaceLeft} onRight={setRaceRight} stake={stake} busy={busy} onJump={jumpRace} />
      </section>
      </>
      ) : null}

      <section className="px-4 py-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">Open on this wallet</p>
        <ul className="mt-2 divide-y divide-white/10 text-sm">
          {due.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span>{c.symbol} {c.style || "line"} · {c.tenor}</span>
              <button type="button" disabled={!!busy} onClick={() => settle(c.id)} className="min-h-8 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg">Settle</button>
            </li>
          ))}
          {dueRaces.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span>{r.left} vs {r.right}</span>
              <button type="button" disabled={!!busy} onClick={() => payRace(r.id)} className="min-h-8 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg">Settle</button>
            </li>
          ))}
          {listed.map((row) => (
            <li key={row.positionPubkey} className="flex items-center justify-between py-2">
              <span>{row.asset} {row.side} · {money(row.sizeUsd)}</span>
              <button type="button" disabled={!!busy} onClick={() => shutLive(row)} className="min-h-8 rounded-full border border-white/15 px-3 text-xs">Close</button>
            </li>
          ))}
          {eventPos.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2">
              <span className="truncate">{row.title} · {row.side}{row.size ? ` · ${row.size}` : ""}</span>
            </li>
          ))}
          {due.length + dueRaces.length + listed.length + eventPos.length === 0 ? <li className="py-2 text-subtle">Nothing open on this address.</li> : null}
        </ul>
      </section>
      <div className="px-4 pb-4">
        <ClearStrip />
      </div>
    </div>
  );
}

function LadderRow({ label, yes, no, busy, stake, onYes, onNo, yesKey, noKey }: { label: string; yes: number; no: number; busy: string; stake: number; onYes: () => void; onNo: () => void; yesKey: string; noKey: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-white/10 py-1.5">
      <button type="button" disabled={!!busy} onClick={onYes} className="min-h-12 rounded-xl bg-up/15 px-3 text-left text-up disabled:opacity-50">
        <span className="font-mono text-lg">{centsOf(yes, no)}¢</span>
        <span className="block font-mono text-[10px]">{busy === yesKey ? "Signing…" : yes > 0 ? money(yes) : money(stake)}</span>
      </button>
      <span className="px-2 text-center font-mono text-[11px] text-subtle">{label}</span>
      <button type="button" disabled={!!busy} onClick={onNo} className="min-h-12 rounded-xl bg-down/15 px-3 text-right text-down disabled:opacity-50">
        <span className="font-mono text-lg">{100 - centsOf(yes, no)}¢</span>
        <span className="block font-mono text-[10px]">{busy === noKey ? "Signing…" : no > 0 ? money(no) : money(stake)}</span>
      </button>
    </div>
  );
}

function SamePot({ symbol, mark, tenor, stake, busy, preds, end, onBand, onSwing }: { symbol: string; mark: number; tenor: string; stake: number; busy: string; preds: Contract[]; end: number; onBand: (side: "yes" | "no", lo: number, hi: number) => void; onSwing: (side: "yes" | "no", pct: number) => void }) {
  const [pct, setPct] = useState(1);
  const lo = mark > 0 ? nice(mark * 0.97) : 0;
  const hi = mark > 0 ? nice(mark * 1.03) : 0;
  const band = preds.find((c) => c.symbol === symbol && c.tenor === tenor && c.windowEnd === end && c.style === "band" && (c.strike || 0) === lo && (c.hi || 0) === hi);
  const swing = preds.find((c) => c.symbol === symbol && c.tenor === tenor && c.windowEnd === end && c.style === "swing" && (c.hi || 0) === pct);
  const bandYes = dollars(band?.yes || []);
  const bandNo = dollars(band?.no || []);
  const swingYes = dollars(swing?.yes || []);
  const swingNo = dollars(swing?.no || []);
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 px-3 py-3">
        <p className="text-sm font-semibold">Inside the band</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Yes if {symbol} finishes between {lo > 0 ? money(lo) : "—"} and {hi > 0 ? money(hi) : "—"}. No if it finishes outside.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={!!busy || !(mark > 0)} onClick={() => onBand("yes", lo, hi)} className="min-h-14 rounded-2xl bg-up/15 px-3 text-left text-up disabled:opacity-50"><span className="block text-xs font-semibold">Inside</span><span className="font-mono text-2xl">{centsOf(bandYes, bandNo)}¢</span><span className="block font-mono text-[10px]">{money(stake)}</span></button>
          <button type="button" disabled={!!busy || !(mark > 0)} onClick={() => onBand("no", lo, hi)} className="min-h-14 rounded-2xl bg-down/15 px-3 text-right text-down disabled:opacity-50"><span className="block text-xs font-semibold">Outside</span><span className="font-mono text-2xl">{100 - centsOf(bandYes, bandNo)}¢</span><span className="block font-mono text-[10px]">{money(stake)}</span></button>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 px-3 py-3">
        <p className="text-sm font-semibold">It has to move</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Yes if {symbol} moves at least {pct}% either way. No if it stays inside that.</p>
        <div className="mt-2 flex gap-1">{[1, 3, 5].map((n) => <button key={n} type="button" onClick={() => setPct(n)} className={cn("min-h-8 rounded-full px-3 font-mono text-xs", pct === n ? "bg-white text-black" : "bg-white/10")}>{n}%</button>)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={!!busy || !(mark > 0)} onClick={() => onSwing("yes", pct)} className="min-h-14 rounded-2xl bg-up/15 px-3 text-left text-up disabled:opacity-50"><span className="block text-xs font-semibold">It moves</span><span className="font-mono text-2xl">{centsOf(swingYes, swingNo)}¢</span></button>
          <button type="button" disabled={!!busy || !(mark > 0)} onClick={() => onSwing("no", pct)} className="min-h-14 rounded-2xl bg-down/15 px-3 text-right text-down disabled:opacity-50"><span className="block text-xs font-semibold">It stays</span><span className="font-mono text-2xl">{100 - centsOf(swingYes, swingNo)}¢</span></button>
        </div>
      </div>
    </div>
  );
}

function RaceBand({ names, left, right, onLeft, onRight, stake, busy, onJump }: { names: TapeRow[]; left: string; right: string; onLeft: (s: string) => void; onRight: (s: string) => void; stake: number; busy: string; onJump: (side: "left" | "right") => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 px-3 py-3">
      <p className="text-sm font-semibold">Or play two names against each other</p>
      <p className="mt-1 text-[13px] text-muted">Same stake. The name that moves more, in percent, takes the pot. A tie sends it back.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[["left", left, onLeft], ["right", right, onRight]].map(([side, value, set]) => (
          <label key={side as string} className="text-[11px] text-subtle">
            {side as string}
            <select value={value as string} onChange={(e) => (set as (s: string) => void)(e.target.value)} className="mt-1 block min-h-10 w-full rounded-xl bg-black/40 px-2 text-sm text-fg">
              {names.map((n) => <option key={n.symbol}>{n.symbol}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={!!busy} onClick={() => onJump("left")} className="min-h-11 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50">{left} · {money(stake)}</button>
        <button type="button" disabled={!!busy} onClick={() => onJump("right")} className="min-h-11 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-50">{right} · {money(stake)}</button>
      </div>
    </div>
  );
}

function SideMark({ market, usd, busy, owner, onBuy }: { market: PredEvent["markets"][number]; usd: number; busy: string; owner: boolean; onBuy: (id: string, yes: boolean, title: string) => void }) {
  const cents = market.yesCents == null ? 0 : Math.round(market.yesCents * 100);
  const wash = market.color || "#3b82f6";
  return (
    <button type="button" disabled={!!busy || !owner} onClick={() => onBuy(market.marketId, true, market.title)} className="flex min-h-[7.5rem] flex-col justify-between rounded-2xl border border-white/10 p-3 text-left disabled:opacity-50" style={{ background: `linear-gradient(160deg, ${wash}33, transparent 70%)` }}>
      <span className="flex items-center gap-2">
        {market.image ? <img src={market.image} alt="" className="size-8 rounded-full bg-white object-cover" /> : <span className="grid size-8 place-items-center rounded-full font-mono text-[10px]" style={{ background: wash }}>{(market.abbr || market.title).slice(0, 3)}</span>}
        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{market.title}</span></span>
      </span>
      <span>
        <span className="font-mono text-3xl tabular-nums">{cents}¢</span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full" style={{ width: `${Math.max(4, cents)}%`, background: wash }} /></span>
        <span className="mt-1 block font-mono text-[10px] text-white/55">{busy === market.marketId ? "Signing…" : `Buy $${usd}`}</span>
      </span>
    </button>
  );
}

function MatchCard({ ev, usd, busy, owner, onBuy }: { ev: PredEvent; usd: number; busy: string; owner: boolean; onBuy: (id: string, yes: boolean, title: string) => void }) {
  const [a, b] = ev.markets;
  return (
    <article className="overflow-hidden rounded-[22px] border border-white/10 bg-[radial-gradient(80%_60%_at_50%_0%,rgb(255_255_255/0.06),transparent_60%),#10131c] p-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-subtle">{ev.league || ev.category}</p>
        {ev.live ? <span className="flex items-center gap-1.5 text-[10px] font-semibold text-down"><span className="size-1.5 animate-pulse rounded-full bg-down" />Live</span> : null}
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        {a ? <SideMark market={a} usd={usd} busy={busy} owner={owner} onBuy={onBuy} /> : <div />}
        <div className="px-1 text-center">
          <p className="font-mono text-xl leading-tight tabular-nums">{ev.score || "vs"}</p>
          <p className="mt-1 font-mono text-[10px] text-subtle">{periodLabel(ev.period) || "Moneyline"}</p>
        </div>
        {b ? <SideMark market={b} usd={usd} busy={busy} owner={owner} onBuy={onBuy} /> : <div />}
      </div>
      <p className="mt-2 truncate px-1 text-[11px] text-subtle">{ev.title}{ev.volumeUsd >= 1 ? ` · $${Math.round(ev.volumeUsd).toLocaleString("en-US")} traded` : ""}</p>
    </article>
  );
}

function SportsBook({ cat, setCat, events, err, usd, setUsd, busy, owner, onBuy }: { cat: "crypto" | "sports" | "politics"; setCat: (c: "crypto" | "sports" | "politics") => void; events: PredEvent[]; err: string; usd: number; setUsd: (n: number) => void; busy: string; owner: string; onBuy: (marketId: string, isYes: boolean, title: string) => void }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(events.length / 12));
  const safe = Math.min(page, pages - 1);
  const shown = events.slice(safe * 12, safe * 12 + 12);
  return (
    <section className="border-b border-white/10 px-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xl">
          <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">{cat} · the live book</p>
          <h2 className="mt-1 text-lg font-semibold">{cat === "sports" ? "Live matches" : "Contracts already trading"}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{cat === "sports" ? "Live. The number next to a name is the price. It pays a dollar if that side wins." : "The number is the price."}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(["sports", "crypto", "politics"] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={cn("min-h-8 rounded-full px-3 text-xs capitalize", cat === c ? "bg-white text-black" : "bg-white/10")}>{c}</button>
          ))}
          {[1, 5, 10, 25].map((n) => (
            <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-8 rounded-full px-3 font-mono text-xs", usd === n ? "bg-accent text-accent-fg" : "bg-white/10")}>${n}</button>
          ))}
        </div>
      </div>
      {err ? <p className="mt-3 text-sm text-down">{err}</p> : null}
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        {shown.map((ev) => <MatchCard key={ev.eventId} ev={ev} usd={usd} busy={busy} owner={!!owner} onBuy={onBuy} />)}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button type="button" disabled={safe <= 0} onClick={() => setPage((n) => Math.max(0, n - 1))} className="min-h-10 rounded-full bg-white/10 px-4 disabled:opacity-40">Back</button>
        <span className="font-mono text-xs text-subtle">{events.length ? `${safe + 1} / ${pages} · ${events.length}` : ""}</span>
        <button type="button" disabled={safe + 1 >= pages} onClick={() => setPage(safe + 1)} className="min-h-10 rounded-full bg-white px-4 text-black disabled:opacity-40">Next</button>
      </div>
      {events.length === 0 && !err ? <p className="mt-3 text-sm text-subtle">Reading the book.</p> : null}
    </section>
  );
}

function MixBook({
  events, usd, setUsd, busy, owner, a, b, yesA, yesB, setA, setB, setYesA, setYesB, pairs, onPair,
}: {
  events: PredEvent[];
  usd: number;
  setUsd: (n: number) => void;
  busy: string;
  owner: string;
  a: string;
  b: string;
  yesA: boolean;
  yesB: boolean;
  setA: (id: string) => void;
  setB: (id: string) => void;
  setYesA: (v: boolean) => void;
  setYesB: (v: boolean) => void;
  pairs: Array<{ id: string; left: string; right: string; usd: number; sigs: string[] }>;
  onPair: (left: string, right: string, leftYes: boolean, rightYes: boolean) => void;
}) {
  const seen = new Set<string>();
  const book = events.flatMap((ev) =>
    ev.markets.flatMap((m) => {
      if (m.yesCents == null || seen.has(m.marketId)) return [];
      seen.add(m.marketId);
      return [{ id: m.marketId, label: `${ev.title} · ${m.title}` }];
    }),
  );
  const left = book.find((row) => row.id === a);
  const right = book.find((row) => row.id === b);
  return (
    <section className="border-b border-white/10 px-4 py-4">
      <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Two live contracts</p>
      <h2 className="mt-1 text-lg font-semibold">Sign both. Each one pays on its own.</h2>
      <p className="mt-1 max-w-xl text-[13px] text-muted">A pair is two Jupiter orders. Senda does not merge the payout. If the second signature fails, the first one already happened.</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {[1, 5, 10, 25].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-8 rounded-full px-3 font-mono text-xs", usd === n ? "bg-accent text-accent-fg" : "bg-white/10")}>${n} each</button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <label className="block text-xs text-subtle">
          First
          <select value={a} onChange={(e) => setA(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm">
            <option value="">Pick a contract</option>
            {book.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
          </select>
          <span className="mt-2 flex gap-1">
            <button type="button" onClick={() => setYesA(true)} className={cn("min-h-8 flex-1 rounded-full text-xs", yesA ? "bg-white text-black" : "bg-white/10")}>Yes</button>
            <button type="button" onClick={() => setYesA(false)} className={cn("min-h-8 flex-1 rounded-full text-xs", !yesA ? "bg-white text-black" : "bg-white/10")}>No</button>
          </span>
        </label>
        <label className="block text-xs text-subtle">
          Second
          <select value={b} onChange={(e) => setB(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm">
            <option value="">Pick a contract</option>
            {book.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
          </select>
          <span className="mt-2 flex gap-1">
            <button type="button" onClick={() => setYesB(true)} className={cn("min-h-8 flex-1 rounded-full text-xs", yesB ? "bg-white text-black" : "bg-white/10")}>Yes</button>
            <button type="button" onClick={() => setYesB(false)} className={cn("min-h-8 flex-1 rounded-full text-xs", !yesB ? "bg-white text-black" : "bg-white/10")}>No</button>
          </span>
        </label>
      </div>
      <button
        type="button"
        disabled={!!busy || !owner || !left || !right || a === b}
        onClick={() => left && right && onPair(left.label, right.label, yesA, yesB)}
        className="mt-3 min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-40"
      >
        {busy === "pair" ? "Waiting on Phantom" : `Sign both · $${usd} each`}
      </button>
      {book.length === 0 ? <p className="mt-3 text-sm text-subtle">Open Sports or Coins once so the live contracts load, then come back.</p> : null}
      {pairs.length > 0 ? (
        <ul className="mt-4 divide-y divide-white/10 text-sm">
          {pairs.map((row) => (
            <li key={row.id} className="py-2">
              <p>{row.left} and {row.right}</p>
              <p className="font-mono text-[11px] text-subtle">${row.usd} each · {row.sigs.map((sig) => sig.slice(0, 8)).join(" · ")}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CoinBook({ events, usd, busy, owner, onBuy }: { events: PredEvent[]; usd: number; busy: string; owner: string; onBuy: (id: string, yes: boolean, title: string) => void }) {
  const [page, setPage] = useState(0);
  if (events.length === 0) return null;
  const pages = Math.max(1, Math.ceil(events.length / 12));
  const safe = Math.min(page, pages - 1);
  const shown = events.slice(safe * 12, safe * 12 + 12);
  return (
    <section className="border-b border-white/10 px-4 py-4">
      <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Crypto · Jupiter’s contracts</p>
      <h2 className="mt-1 text-lg font-semibold">The coins people already trade</h2>
      <p className="mt-1 max-w-xl text-[13px] text-muted">Bitcoin, Solana, and the rest that are live. The bar is the price.</p>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {shown.map((ev) => {
          const m = ev.markets[0];
          if (!m || m.yesCents == null) return null;
          const cents = Math.round(m.yesCents * 100);
          return (
            <div key={ev.eventId} className="rounded-2xl border border-white/10 bg-[#10131c] p-3">
              <p className="text-sm font-semibold">{ev.title}</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-mono text-2xl tabular-nums">{cents}¢</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-[#14f195]" style={{ width: `${Math.max(4, cents)}%` }} /></span>
                <button type="button" disabled={!!busy || !owner} onClick={() => onBuy(m.marketId, true, m.title)} className="min-h-9 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40">{busy === m.marketId ? "Signing…" : `Yes $${usd}`}</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button type="button" disabled={safe <= 0} onClick={() => setPage((n) => Math.max(0, n - 1))} className="min-h-10 rounded-full bg-white/10 px-4 disabled:opacity-40">Back</button>
        <span className="font-mono text-xs text-subtle">{safe + 1} / {pages} · {events.length}</span>
        <button type="button" disabled={safe + 1 >= pages} onClick={() => setPage(safe + 1)} className="min-h-10 rounded-full bg-white px-4 text-black disabled:opacity-40">Next</button>
      </div>
    </section>
  );
}

function PerpStrip({ rows, busy, owner, margin, lev, setMargin, setLev, onOpen }: { rows: PerpBoardRow[]; busy: string; owner: string; margin: number; lev: number; setMargin: (n: number) => void; setLev: (n: number) => void; onOpen: (side: "long" | "short", name: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <section className="border-b border-white/10 px-4 py-4">
      <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Perps · the pool Jupiter lists</p>
      <h2 className="mt-1 text-lg font-semibold">SOL, ETH, BTC</h2>
      <p className="mt-1 max-w-xl text-[13px] text-muted">Long or short. Margin {money(margin)} at {lev}×.</p>
      <div className="mt-2 flex gap-1">
        {[10, 25, 100].map((n) => <button key={n} type="button" onClick={() => setMargin(n)} className={cn("min-h-8 rounded-full px-3 font-mono text-xs", margin === n ? "bg-white text-black" : "bg-white/10")}>${n}</button>)}
        {[2, 5, 10].map((n) => <button key={n} type="button" onClick={() => setLev(n)} className={cn("min-h-8 rounded-full px-3 font-mono text-xs", lev === n ? "bg-white text-black" : "bg-white/10")}>{n}×</button>)}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.asset} className="rounded-2xl border border-white/10 bg-[#10131c] p-3">
            <div className="flex items-end justify-between">
              <p className="font-display text-2xl">{r.asset}</p>
              <p className={cn("font-mono text-xs", r.change24h >= 0 ? "text-up" : "text-down")}>{r.change24h >= 0 ? "+" : ""}{r.change24h.toFixed(2)}%</p>
            </div>
            <p className="font-mono text-xl tabular-nums">{money(r.price)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={!!busy || !owner} onClick={() => onOpen("long", r.asset)} className="min-h-10 rounded-full bg-up/15 text-xs font-semibold text-up disabled:opacity-40">Long</button>
              <button type="button" disabled={!!busy || !owner} onClick={() => onOpen("short", r.asset)} className="min-h-10 rounded-full bg-down/15 text-xs font-semibold text-down disabled:opacity-40">Short</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
