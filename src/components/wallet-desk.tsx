import { useEffect, useMemo, useState } from "react";
import { TabLead } from "@/components/tab-lead";
import { coinPage } from "@/lib/coin-pages";
import { useCoins } from "@/components/coin-ticker";
import type { LiveCoin } from "@/lib/coin-tape";
import { JumpStrip } from "@/components/jump-strip";
import { FastLane } from "@/components/fast-lane";
import { StakeBoard } from "@/components/stake-board";
import { SwapDesk } from "@/components/swap-desk";
import { WalletsDesk } from "@/components/wallets-desk";
import { AttachedAccounts, CousinPesos } from "@/components/attached-accounts";
import { BitsoDesk } from "@/components/bitso-desk";
import { CardFund } from "@/components/card-fund";
import { SpendCards } from "@/components/spend-cards";
import { TillDesk } from "@/components/till-desk";
import { SignedReceipt } from "@/components/money-flow";
import { toast } from "sonner";
import { quoteRoute, signRoute, SOL, type RouteQuote } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { payMint as sendMint, paySol, payUsdc } from "@/lib/solana-pay";
import { rememberTrade, onTrades } from "@/lib/trade-log";
import { listTills, onTills } from "@/lib/tills";
import { connectPhantom, mintDecimals, readChain, type ChainWallet } from "@/lib/phantom";
import { getStockFlow, type FlowName } from "@/lib/stock-flow";
import { loadTape } from "@/lib/universe";
import { UNIVERSE } from "@/lib/universe";
import { getHouse, formatUsd, type HouseListing } from "@/lib/sol-house";
import { runPrestock, spendable } from "@/lib/prestock";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Pay = "SOL" | "USDC" | string;

type Lane = "swap" | "wallets" | "chains" | "pesos" | "stake";

export function WalletDesk({ buy, lane: laneSeed }: { buy?: string; lane?: Lane }) {
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const owner = link?.address ?? "";
  const [snap, setSnap] = useState<ChainWallet | null>(null);
  const [house, setHouse] = useState<HouseListing[]>([]);
  const [tapePx, setTapePx] = useState<Map<string, number>>(new Map());
  const [solPx, setSolPx] = useState(0);
  const [err, setErr] = useState("");
  const [pay, setPay] = useState<Pay>("SOL");
  const [recv, setRecv] = useState(buy || "JitoSOL");
  const [raw, setRaw] = useState("0.1");
  const [quote, setQuote] = useState<RouteQuote | null>(null);
  const [quoteMs, setQuoteMs] = useState<number | null>(null);
  const [arm, setArm] = useState(false);
  const [swapSig, setSwapSig] = useState("");
  const [qErr, setQErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sellMint, setSellMint] = useState("");
  const [sellUsd, setSellUsd] = useState(1);
  const [sellBusy, setSellBusy] = useState(false);
  const [sellSig, setSellSig] = useState<string | null>(null);
  const [sellOut, setSellOut] = useState<number | null>(null);
  const [sellErr, setSellErr] = useState("");
  const [coinQ, setCoinQ] = useState("");
  const [recvGroup, setRecvGroup] = useState<"stake" | "crypto" | "company" | "listed">("stake");
  const [moveAsset, setMoveAsset] = useState<"USDC" | "SOL">("USDC");
  const [moveAmt, setMoveAmt] = useState("1");
  const [moveTo, setMoveTo] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);
  const [lane, setLane] = useState<Lane>(laneSeed || "swap");
  const [pesoUsd, setPesoUsd] = useState("5");
  const [pesoPay, setPesoPay] = useState<"USDC" | "SOL">("USDC");
  const [pesoOut, setPesoOut] = useState<number | null>(null);
  const [pesoPx, setPesoPx] = useState(0);
  const [pesoTo, setPesoTo] = useState("");
  const [pesoSend, setPesoSend] = useState("");
  const [pesoBusy, setPesoBusy] = useState("");
  const [tills, setTills] = useState(listTills);
  const MXNE = "6zYgzrT7X2wi9a9NeMtUvUWLLmf2a8vBsbYkocYdB9wa";
  useEffect(() => onTills(() => setTills(listTills())), []);
  useEffect(() => {
    if (lane !== "pesos") return;
    let live = true;
    void fetch(`https://lite-api.jup.ag/price/v3?ids=${MXNE}`, { headers: { accept: "application/json" } })
      .then((r) => r.json() as Promise<Record<string, { usdPrice?: number }>>)
      .then((body) => {
        if (live) setPesoPx(Number(body[MXNE]?.usdPrice) || 0);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [lane, MXNE]);
  const coins = useCoins();
  const [flow, setFlow] = useState<FlowName[]>([]);

  useEffect(() => {
    if (buy) setRecv(buy);
  }, [buy]);
  useEffect(() => {
    if (laneSeed) setLane(laneSeed);
  }, [laneSeed]);

  useEffect(() => {
    let live = true;
    getHouse()
      .then((h) => live && setHouse(h))
      .catch(() => undefined);
    getStockFlow()
      .then((rows) => live && setFlow(rows))
      .catch(() => undefined);
    quoteRoute({ inputMint: SOL, outputMint: USDC, amountRaw: 1e9, outDecimals: 6 })
      .then((q) => live && setSolPx(q.outUi))
      .catch(() => undefined);
    loadTape()
      .then((rows) => {
        if (!live) return;
        const m = new Map<string, number>();
        for (const row of rows) m.set(row.mint, row.price);
        setTapePx(m);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!owner) {
      setSnap(null);
      return;
    }
    let live = true;
    const pull = () => {
      readChain(owner)
        .then((s) => {
          if (!live) return;
          setSnap(s);
          setErr("");
        })
        .catch((e: unknown) => live && setErr(e instanceof Error ? e.message : "Could not read the wallet."));
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    const stop = onTrades(pull);
    return () => {
      live = false;
      window.clearInterval(id);
      stop();
    };
  }, [owner]);

  const marks = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of house) if (n.venue === "prestocks" && n.last > 0) m.set(n.mint, n.last);
    return m;
  }, [house]);

  const heldNames = useMemo(() => {
    if (!snap) return [];
    const out: Array<{ symbol: string; mint: string; ui: number; decimals: number; price: number }> = [];
    for (const name of UNIVERSE) {
      if (name.symbol === "SOL") continue;
      const token = snap.tokens.find((t) => t.mint === name.mint);
      if (!token || !(token.ui > 0)) continue;
      out.push({
        symbol: name.symbol,
        mint: name.mint,
        ui: token.ui,
        decimals: token.decimals,
        price: tapePx.get(name.mint) ?? marks.get(name.mint) ?? 0,
      });
    }
    return out;
  }, [snap, marks, tapePx]);

  const picked = coins.find((c) => c.id === recv);
  const payMint = pay === "SOL" ? SOL : pay === "USDC" ? USDC : pay;
  const bookName = [...flow.map((row) => ({ symbol: row.symbol, mint: row.mint })), ...house.filter((n) => n.venue === "prestocks" && n.mint).map((n) => ({ symbol: n.symbol, mint: n.mint }))];
  const recvMint = recv === "USDC" ? USDC : recv === "SOL" ? SOL : picked?.id || UNIVERSE.find((n) => n.symbol === recv)?.mint || bookName.find((n) => n.symbol === recv || n.mint === recv)?.mint || "";
  const amount = Number(raw) || 0;
  const payUsd = pay === "SOL" ? amount * solPx : pay === "USDC" ? amount : amount * (tapePx.get(payMint) ?? marks.get(payMint) ?? 0);

  useEffect(() => {
    if (!(amount > 0) || !recvMint || payMint === recvMint) {
      setQuote(null);
      setQuoteMs(null);
      return;
    }
    let live = true;
    setArm(false);
    const t = window.setTimeout(() => {
      const started = performance.now();
      const inDec = pay === "SOL" ? Promise.resolve(9) : pay === "USDC" ? Promise.resolve(6) : mintDecimals(payMint);
      const outDec = recv === "USDC" || recv === "SOL" ? Promise.resolve(recv === "SOL" ? 9 : 6) : mintDecimals(recvMint);
      Promise.all([inDec, outDec])
        .then(([dIn, dOut]) =>
          quoteRoute({
            inputMint: payMint,
            outputMint: recvMint,
            amountRaw: Math.floor(amount * 10 ** dIn),
            outDecimals: dOut,
          }),
        )
        .then((q) => {
          if (!live) return;
          setQuote(q);
          setQuoteMs(Math.max(1, Math.round(performance.now() - started)));
          setQErr("");
        })
        .catch((e: unknown) => {
          if (!live) return;
          setQuote(null);
          setQErr(e instanceof Error ? e.message : "No route.");
        });
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [amount, pay, payMint, recv, recvMint]);

  useEffect(() => {
    if (heldNames.length === 0) return;
    if (heldNames.some((h) => h.mint === sellMint)) return;
    setSellMint(heldNames[0].mint);
  }, [heldNames, sellMint]);

  async function go() {
    if (!quote || !recvMint) return;
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
      }
      const dIn = pay === "SOL" ? 9 : pay === "USDC" ? 6 : await mintDecimals(payMint);
      const dOut = recv === "USDC" ? 6 : recv === "SOL" ? 9 : picked?.decimals ?? (await mintDecimals(recvMint));
      const done = await signRoute({
        owner: who,
        inputMint: payMint,
        outputMint: recvMint,
        amountRaw: Math.floor(amount * 10 ** dIn),
        outDecimals: dOut,
        usd: payUsd || amount,
      });
      toast.success(`Sent ${done.signature.slice(0, 8)}…`);
      setSwapSig(done.signature);
      setArm(false);
      readChain(who)
        .then((s) => setSnap(s))
        .catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The swap did not send.");
    } finally {
      setBusy(false);
    }
  }

  async function sellBack() {
    const row = heldNames.find((h) => h.mint === sellMint) ?? heldNames[0];
    if (!row) return;
    if (!(row.price > 0)) {
      setSellErr("No live price. Nothing was sent.");
      setSellSig(null);
      setSellOut(null);
      return;
    }
    const worth = row.ui * row.price;
    const slice = Math.min(sellUsd, worth);
    if (!(slice > 0)) {
      setSellErr("Enter a size.");
      setSellSig(null);
      setSellOut(null);
      return;
    }
    setSellBusy(true);
    setSellErr("");
    setSellSig(null);
    setSellOut(null);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
      }
      const done = await runPrestock({
        owner: who,
        mint: row.mint,
        usd: slice,
        side: "sell",
        price: row.price,
      });
      setSellSig(done.signature);
      setSellOut(done.outUi);
      toast.success(`Sold ${row.symbol}. ${done.signature.slice(0, 8)}…`);
      readChain(who)
        .then((s) => setSnap(s))
        .catch(() => undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The swap did not send.";
      setSellErr(msg);
      toast.error(msg);
    } finally {
      setSellBusy(false);
    }
  }

  async function moveFunds() {
    const n = Number(moveAmt);
    if (!(n > 0) || !moveTo) return;
    setMoveBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
      }
      const sig = moveAsset === "USDC" ? (await payUsdc({ owner: who, to: moveTo, usd: n, memo: "between wallets", deskFee: true })).signature : await paySol({ owner: who, to: moveTo, sol: n });
      toast.success(`Sent ${n} ${moveAsset}. ${sig.slice(0, 8)}…`);
      readChain(who).then((s) => setSnap(s)).catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not send.");
    } finally {
      setMoveBusy(false);
    }
  }

  async function buyPesos() {
    const usd = Number(pesoUsd);
    if (!(usd > 0)) return;
    setPesoBusy("buy");
    try {
      const addr = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(addr, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
      }
      const amountRaw = pesoPay === "USDC" ? Math.round(usd * 1_000_000) : Math.round((usd / (solPx || 1)) * 1e9);
      if (pesoPay === "SOL" && !(solPx > 0)) throw new Error("No SOL price. Pay with USDC.");
      const quote = await quoteRoute({ inputMint: pesoPay === "USDC" ? USDC : SOL, outputMint: MXNE, amountRaw, outDecimals: 9 });
      setPesoOut(quote.outUi);
      if (quote.impact > 5) throw new Error(`Price impact is ${quote.impact.toFixed(1)}%. Nothing was sent.`);
      const done = await signRoute({
        owner: addr,
        inputMint: pesoPay === "USDC" ? USDC : SOL,
        outputMint: MXNE,
        amountRaw,
        outDecimals: 9,
        usd,
      });
      rememberTrade({ symbol: "MXNe", side: "buy", usd, mint: MXNE, signature: done.signature });
      toast.success(`Pesos signed. ${done.signature.slice(0, 8)}…`);
      readChain(addr).then(setSnap).catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setPesoBusy("");
    }
  }

  async function sendPesos() {
    const ui = Number(pesoSend);
    if (!(ui > 0) || !pesoTo) return;
    setPesoBusy("send");
    try {
      const addr = owner || (await connectPhantom());
      const px = pesoPx > 0 ? pesoPx : 0.055;
      const sig = await sendMint({ owner: addr, to: pesoTo, mint: MXNE, ui, decimals: 9, usd: ui * px });
      rememberTrade({ symbol: "MXNe", side: "send", usd: ui * px, mint: MXNE, signature: sig });
      toast.success(`Sent ${ui} MXNe. ${sig.slice(0, 8)}…`);
      readChain(addr).then(setSnap).catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not send.");
    } finally {
      setPesoBusy("");
    }
  }

  const [bookPage, setBookPage] = useState(0);
  const [namePage, setNamePage] = useState(0);
  const [coinBook, setCoinBook] = useState<LiveCoin[]>([]);
  const [coinPages, setCoinPages] = useState(1);
  const [coinTotal, setCoinTotal] = useState(0);
  const [findPage, setFindPage] = useState(0);
  const [foundAll, setFoundAll] = useState<LiveCoin[]>([]);
  const [foundPages, setFoundPages] = useState(1);
  const others = wallet.w.links.filter((l) => (l.kind === "phantom" || l.kind === "solana") && l.address !== owner);
  useEffect(() => {
    if (!coinQ.trim()) {
      setFoundAll([]);
      setFoundPages(1);
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      coinPage({ data: { page: findPage, q: coinQ } })
        .then((book) => {
          if (!live) return;
          setFoundAll(book.rows);
          setFoundPages(book.pages);
        })
        .catch(() => live && setFoundAll([]));
    }, 180);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [coinQ, findPage]);

  useEffect(() => {
    let live = true;
    coinPage({ data: { page: bookPage, q: "" } })
      .then((book) => {
        if (!live) return;
        setCoinBook(book.rows);
        setCoinPages(book.pages);
        setCoinTotal(book.total);
      })
      .catch(() => live && setCoinBook([]));
    return () => {
      live = false;
    };
  }, [bookPage]);

  const found = foundAll;
  const names = [
    ...house.filter((n) => n.venue === "prestocks" && n.last > 0).map((n) => ({ key: n.mint, label: n.symbol, on: recv === n.symbol, pick: n.symbol })),
    ...flow.map((n) => ({ key: `f:${n.mint}`, label: n.symbol, on: recv === n.symbol, pick: n.symbol })),
  ];
  const namePages = Math.max(1, Math.ceil(names.length / 18));
  const nameShown = names.slice((namePage % namePages) * 18, (namePage % namePages) * 18 + 18);

  const payLabel = pay === "SOL" ? "SOL" : pay === "USDC" ? "USDC" : UNIVERSE.find((n) => n.mint === pay)?.symbol || coins.find((c) => c.id === pay)?.symbol || "Token";
  const payBal = pay === "SOL"
    ? snap?.sol ?? 0
    : snap?.tokens.find((t) => (pay === "USDC" ? t.symbol === "USDC" : t.mint === pay))?.ui ?? 0;
  function slicePay(part: number): string {
    const room = pay === "SOL" ? Math.max(0, payBal - 0.01) : payBal;
    const n = room * part;
    if (!(n > 0)) return "0";
    return String(Number(n.toFixed(pay === "SOL" ? 4 : 2)));
  }
  const recvLabel = recv === "USDC" ? "USDC" : recv === "SOL" ? "SOL" : picked?.symbol || recv;
  const sellRow = heldNames.find((h) => h.mint === sellMint) ?? heldNames[0] ?? null;
  const sellWorth = sellRow && sellRow.price > 0 ? sellRow.ui * sellRow.price : 0;
  const sellSlice = sellWorth > 0 ? Math.min(sellUsd, sellWorth) : 0;
  const chip = (on: boolean) =>
    cn("min-h-9 rounded-full px-3 text-xs font-semibold", on ? "bg-accent text-accent-fg" : "border border-white/10");

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <JumpStrip />
      <TabLead
        kicker="Swap"
        title="One desk."
        accent="Swap, send, or cross a chain."
        line="Jupiter swaps any coin in this wallet. A send moves USDC or SOL to another wallet you linked. Across chains, deBridge builds the order and the source wallet signs."
        live={["Jupiter quote", "Wallets", "Stake", "Pesos", "deBridge"]}
        coming={["A fiat ramp that isn’t a card"]}
        audit={{
          live: "Each lane asks the wallet to sign. Nothing moves before that.",
          hold: "Senda does not hold the key or the tokens.",
        }}
      />
      <div className="flex gap-1 overflow-x-auto">
        {([
          ["swap", "Swap"],
          ["wallets", "Wallets"],
          ["stake", "Stake"],
          ["pesos", "Pesos"],
          ["chains", "Chains"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setLane(id)} className={cn("min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold", lane === id ? "bg-white text-black" : "border border-white/10 text-muted")}>
            {label}
          </button>
        ))}
      </div>

      <section className="flex flex-wrap items-end justify-between gap-3 rounded-[22px] border border-white/10 bg-[#10131c] px-5 py-4">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">In Phantom</p>
          <p className="mt-1 font-mono text-sm text-muted">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Not connected"}</p>
        </div>
        <div className="flex flex-wrap gap-6">
          <p className="font-mono text-2xl tabular-nums">{snap ? snap.sol.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"} <span className="text-sm text-muted">SOL</span></p>
          <p className="font-mono text-2xl tabular-nums">{snap ? (snap.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"} <span className="text-sm text-muted">USDC</span></p>
        </div>
        {err ? <p className="w-full text-sm text-down">{err}</p> : null}
      </section>

      {lane === "wallets" ? (
      <>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Already linked</p>
        <h2 className="mt-1 font-display text-2xl tracking-tight">The wallets on this desk.</h2>
        {wallet.w.links.length === 0 ? <p className="mt-2 text-sm text-muted">None yet. The scan below connects one. It stays linked after that.</p> : (
          <ul className="mt-3 space-y-2">
            {wallet.w.links.map((l) => (
              <li key={l.address} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold">{l.label}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-subtle">{l.address}</span>
                </span>
                <span className="text-xs font-semibold text-subtle">{l.kind === "evm" ? "Base" : l.address === owner ? "Signs" : "Linked"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Between wallets</p>
        <h2 className="mt-1 font-display text-2xl tracking-tight">Send it to another wallet.</h2>
        <p className="mt-1 max-w-lg text-sm text-muted">USDC or SOL leaves this Phantom. It lands on a wallet you already linked, or on an address you paste. One signature.</p>
        <div className="mt-4 flex gap-1">
          {(["USDC", "SOL"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setMoveAsset(id)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", moveAsset === id ? "bg-white text-black" : "border border-white/10 text-muted")}>{id}</button>
          ))}
        </div>
        <input value={moveAmt} onChange={(e) => setMoveAmt(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Amount to send" className="mt-3 w-full bg-transparent font-mono text-5xl tabular-nums outline-none" />
        <div className="mt-2 flex gap-2">
          {["1", "5", "25"].map((n) => (
            <button key={n} type="button" onClick={() => setMoveAmt(n)} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", moveAmt === n ? "bg-accent text-accent-fg" : "border border-white/10 text-muted")}>${n}</button>
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {tills.map((row) => (
            <li key={row.address}>
              <button type="button" onClick={() => setMoveTo(row.address)} className={cn("flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left", moveTo === row.address ? "border-white bg-white text-black" : "border-white/10")}>
                <span>
                  <span className="block text-sm font-semibold">{row.name}</span>
                  <span className="mt-0.5 block font-mono text-[11px] opacity-70">{row.address.slice(0, 4)}…{row.address.slice(-4)}</span>
                </span>
                <span className="text-xs font-semibold">{moveTo === row.address ? "Selected" : "Send here"}</span>
              </button>
            </li>
          ))}
          {others.map((l) => (
            <li key={l.address}>
              <button type="button" onClick={() => setMoveTo(l.address)} className={cn("flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left", moveTo === l.address ? "border-white bg-white text-black" : "border-white/10")}>
                <span>
                  <span className="block text-sm font-semibold">{l.label}</span>
                  <span className="mt-0.5 block font-mono text-[11px] opacity-70">{l.address.slice(0, 4)}…{l.address.slice(-4)}</span>
                </span>
                <span className="text-xs font-semibold">{moveTo === l.address ? "Selected" : "Send here"}</span>
              </button>
            </li>
          ))}
        </ul>
        <input value={moveTo} onChange={(e) => setMoveTo(e.target.value.trim())} placeholder="Or paste a Solana address" className="mt-3 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
        <button type="button" disabled={moveBusy || !moveTo} onClick={() => void moveFunds()} className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
          {moveBusy ? "Waiting on the wallet" : `Send ${moveAmt || "0"} ${moveAsset}`}
        </button>
        {others.length === 0 ? <p className="mt-2 text-xs text-subtle">Link one in the scan below, or paste the address.</p> : null}
      </section>
      <WalletsDesk embedded />
      <StakeBoard owner={owner} />
      <AttachedAccounts owner={owner} />
      <TillDesk owner={owner} />
      <SpendCards owner={owner} />
      </>
      ) : null}

      {lane === "stake" ? <StakeBoard owner={owner} /> : null}

      {lane === "chains" ? <SwapDesk /> : null}

      {lane === "pesos" ? (
        <section className="space-y-3 rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Pesos</p>
          <h2 className="font-display text-2xl tracking-tight">Crypto in. Pesos out.</h2>
          <p className="max-w-lg text-sm text-muted">USDC or SOL becomes MXNe, the peso token. About one token is one peso. Then send those pesos to someone else’s Solana address. A bank CLABE is not this signature.</p>
          <div className="flex gap-1">
            {(["USDC", "SOL"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setPesoPay(id)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", pesoPay === id ? "bg-white text-black" : "border border-white/10 text-muted")}>{id}</button>
            ))}
          </div>
          <input value={pesoUsd} onChange={(e) => { setPesoUsd(e.target.value.replace(/[^0-9.]/g, "")); setPesoOut(null); }} inputMode="decimal" aria-label="Dollars to turn into pesos" className="w-full bg-transparent font-mono text-5xl tabular-nums outline-none" />
          <p className="font-mono text-sm text-muted">{pesoOut != null ? `${pesoOut.toLocaleString("en-US", { maximumFractionDigits: 2 })} MXNe` : pesoPx > 0 ? `About ${(Number(pesoUsd) / pesoPx).toLocaleString("en-US", { maximumFractionDigits: 0 })} pesos` : "Jupiter names the pesos when you sign."}</p>
          <p className="font-mono text-xs text-subtle">You hold {(snap?.tokens.find((t) => t.mint === MXNE)?.ui ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} MXNe</p>
          <button type="button" disabled={pesoBusy !== ""} onClick={() => void buyPesos()} className="min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            {pesoBusy === "buy" ? "Waiting on Phantom" : `Buy pesos with $${pesoUsd || "0"}`}
          </button>
          <div className="border-t border-white/10 pt-4">
            <p className="text-sm font-semibold">Send pesos to someone else</p>
            <input value={pesoSend} onChange={(e) => setPesoSend(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Pesos" aria-label="Pesos to send" className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
            <input value={pesoTo} onChange={(e) => setPesoTo(e.target.value.trim())} placeholder="Their Solana address" className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
            <button type="button" disabled={pesoBusy !== "" || !pesoTo} onClick={() => void sendPesos()} className="mt-2 min-h-11 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
              {pesoBusy === "send" ? "Waiting on Phantom" : "Send MXNe"}
            </button>
          </div>
          <div className="border-t border-white/10 pt-4">
            <CousinPesos />
          </div>
          <div className="border-t border-white/10 pt-4">
            <BitsoDesk owner={owner} />
          </div>
        </section>
      ) : null}

      {lane === "swap" ? (
      <>
      <FastLane chartMint={recvMint || SOL} chartSymbol={recvLabel} />
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0c0e14] shadow-[0_20px_60px_rgb(0_0_0/0.35)]">
        <div className="border-b border-white/10 px-4 py-4 sm:px-6">
          <p className="text-[11px] tracking-[0.18em] text-subtle uppercase">You pay</p>
          <input
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            inputMode="decimal"
            aria-label="Amount to pay"
            className="mt-1 w-full bg-transparent font-mono text-5xl tabular-nums tracking-tight outline-none sm:text-6xl"
          />
          <p className="font-mono text-sm text-muted tabular-nums">
            {payLabel}
            {payUsd > 0 ? ` · $${payUsd.toFixed(2)}` : ""}
            {payBal > 0 ? ` · ${payBal.toLocaleString("en-US", { maximumFractionDigits: 4 })} in the wallet` : ""}
          </p>
          <div className="mt-2 flex gap-2">
            {([0.1, 0.25, 0.5, 1] as const).map((part) => (
              <button key={part} type="button" onClick={() => setRaw(slicePay(part))} className="min-h-11 flex-1 rounded-full bg-white/10 px-3 font-mono text-xs">
                {part === 1 ? "Max" : part === 0.5 ? "50%" : part === 0.25 ? "25%" : "10%"}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {(["SOL", "USDC"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setPay(id)} className={cn(chip(pay === id), "min-h-11 shrink-0 px-4")}>
                {id}
              </button>
            ))}
            {heldNames.map((h) => (
              <button key={h.mint} type="button" onClick={() => setPay(h.mint)} className={cn(chip(pay === h.mint), "min-h-11 shrink-0 px-4")}>
                {h.symbol}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-end justify-between gap-3">
            <p className="text-[11px] tracking-[0.18em] text-subtle uppercase">You receive</p>
            <div className="flex gap-1 overflow-x-auto">
              {([
                ["stake", "Stakes"],
                ["crypto", "Crypto"],
                ["company", "Names"],
                ["listed", "Listed"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setRecvGroup(id);
                    const first = UNIVERSE.find((n) => n.group === id);
                    if (first) setRecv(first.symbol);
                  }}
                  className={cn("min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold", recvGroup === id ? "bg-white text-black" : "text-muted")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p key={quote?.outUi ?? "empty"} className="senda-rise mt-1 font-mono text-5xl tabular-nums tracking-tight sm:text-6xl">
            {quote ? quote.outUi.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}
          </p>
          <p className="font-mono text-sm text-muted">
            {recvLabel}
            {recv === "SOL" && snap ? ` · ${snap.sol.toLocaleString("en-US", { maximumFractionDigits: 4 })} in the wallet` : ""}
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => setRecv("SOL")} className={cn(chip(recv === "SOL"), "min-h-11 shrink-0 px-4")}>SOL</button>
            <button type="button" onClick={() => setRecv("USDC")} className={cn(chip(recv === "USDC"), "min-h-11 shrink-0 px-4")}>USDC</button>
            {coinBook.map((c) => (
              <button key={c.id} type="button" onClick={() => setRecv(c.id)} className={cn(chip(recv === c.id), "inline-flex min-h-11 shrink-0 items-center gap-1 px-3")}>
                {c.icon ? <img src={c.icon} alt="" className="size-4 rounded-full" /> : null}
                {c.symbol}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <button type="button" disabled={bookPage <= 0} onClick={() => setBookPage((n) => Math.max(0, n - 1))} className="min-h-9 rounded-full bg-white/10 px-3 disabled:opacity-40">Back</button>
            <span className="font-mono">{coinTotal ? `${bookPage + 1} / ${coinPages} · ${coinTotal}` : "…"}</span>
            <button type="button" disabled={bookPage + 1 >= coinPages} onClick={() => setBookPage((n) => n + 1)} className="min-h-9 rounded-full bg-white/10 px-3 disabled:opacity-40">Next</button>
          </div>
          {nameShown.length > 0 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {nameShown.map((row) => (
                <button key={row.key} type="button" onClick={() => setRecv(row.pick)} className={cn(chip(row.on), "min-h-11 shrink-0 px-3")}>{row.label}</button>
              ))}
            </div>
          ) : null}
          {namePages > 1 ? (
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <button type="button" onClick={() => setNamePage((n) => (n - 1 + namePages) % namePages)} className="min-h-9 rounded-full bg-white/10 px-3">Names back</button>
              <span className="font-mono">{(namePage % namePages) + 1} / {namePages}</span>
              <button type="button" onClick={() => setNamePage((n) => (n + 1) % namePages)} className="min-h-9 rounded-full bg-white/10 px-3">Names next</button>
            </div>
          ) : null}
          {qErr && amount > 0 && payMint !== recvMint ? <p className="mt-1 text-sm text-down">{qErr}</p> : null}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {recvGroup !== "stake" ? (
              <button type="button" onClick={() => setRecv("USDC")} className={cn(chip(recv === "USDC"), "min-h-11 shrink-0 px-4")}>USDC</button>
            ) : null}
            <button type="button" onClick={() => setRecv("SOL")} className={cn(chip(recv === "SOL"), "min-h-11 shrink-0 px-4")}>SOL</button>
            {UNIVERSE.filter((n) => n.group === recvGroup && n.symbol !== "SOL").map((n) => (
              <button key={n.symbol} type="button" onClick={() => setRecv(n.symbol)} className={cn(chip(recv === n.symbol), "min-h-11 shrink-0 px-4")}>
                {n.symbol}
              </button>
            ))}
          </div>
          <input value={coinQ} onChange={(e) => { setCoinQ(e.target.value); setFindPage(0); }} placeholder="Any other Jupiter coin" className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base outline-none" />
          {found.length > 0 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {found.map((c) => (
                <button key={c.id} type="button" onClick={() => { setRecv(c.id); setCoinQ(""); }} className={cn(chip(recv === c.id), "min-h-11 shrink-0")}>
                  {c.symbol}
                </button>
              ))}
            </div>
          ) : null}
          {foundPages > 1 && coinQ.trim() ? (
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <button type="button" disabled={findPage <= 0} onClick={() => setFindPage((n) => n - 1)} className="min-h-9 rounded-full bg-white/10 px-3 disabled:opacity-40">Back</button>
              <span className="font-mono">{findPage + 1} / {foundPages}</span>
              <button type="button" disabled={findPage + 1 >= foundPages} onClick={() => setFindPage((n) => n + 1)} className="min-h-9 rounded-full bg-white/10 px-3 disabled:opacity-40">Next</button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-6">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Route</p>
          <p className="text-right font-mono text-sm tabular-nums">
            {quote ? `${quoteMs ? `${quoteMs}ms · ` : ""}${quote.route} · ${quote.impact.toFixed(2)}% · min ${quote.minUi.toLocaleString("en-US", { maximumFractionDigits: 4 })}` : "—"}
          </p>
        </div>
        {err ? <p className="px-4 pb-2 text-sm text-down sm:px-6">{err}</p> : null}
        <div className="sticky bottom-3 z-10 px-3 pb-3 sm:px-6">
          <button
            type="button"
            disabled={busy || sellBusy || !quote}
            onClick={() => {
              if (!arm) {
                setArm(true);
                return;
              }
              void go();
            }}
            className="min-h-14 w-full rounded-full bg-accent text-base font-semibold text-accent-fg shadow-[0_10px_30px_rgb(0_0_0/0.45)] disabled:opacity-50"
          >
            {busy ? "Waiting on Phantom" : arm && quote ? `Sign ${amount} ${pay}` : "Review"}
          </button>
          <button
            type="button"
            onClick={() => {
              const payload = { pay, amount, receive: recvLabel, mint: recvMint };
              void navigator.clipboard.writeText(JSON.stringify(payload)).then(
                () => toast.success("Copied. An agent can hand this back. You still sign."),
                () => toast.error("Could not copy."),
              );
            }}
            className="mt-2 w-full text-center text-xs font-semibold text-muted"
          >
            Copy for an agent
          </button>
        </div>
        {swapSig ? <div className="px-4 pb-4 sm:px-6"><SignedReceipt title="Filled" amount={`${amount} ${pay}`} detail={`${recvLabel} is in this wallet.`} sig={swapSig} /></div> : null}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Sell back</p>
          {sellRow && sellRow.price > 0 ? (
            <p className="font-mono text-sm tabular-nums text-muted">Raise ${spendable(sellRow.ui, sellRow.price).toFixed(2)}</p>
          ) : null}
        </div>
        {!owner ? (
          <p className="mt-3 text-sm text-muted">Connect Phantom.</p>
        ) : !snap && !err ? (
          <p className="mt-3 text-sm text-muted">Reading the wallet…</p>
        ) : heldNames.length === 0 ? (
          <p className="mt-3 text-sm text-muted">This wallet holds no PreStock.</p>
        ) : sellRow ? (
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              {heldNames.map((h) => (
                <button
                  key={h.mint}
                  type="button"
                  onClick={() => {
                    setSellMint(h.mint);
                    setSellSig(null);
                    setSellOut(null);
                    setSellErr("");
                  }}
                  className={cn(chip(sellRow.mint === h.mint), "min-h-11")}
                >
                  {h.symbol}
                  <span className="ml-2 font-mono tabular-nums">{h.ui.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={sellUsd}
                onChange={(e) => {
                  setSellUsd(Math.max(0, Number(e.target.value) || 0));
                  setSellSig(null);
                  setSellOut(null);
                  setSellErr("");
                }}
                inputMode="decimal"
                aria-label="Dollars of the PreStock to sell back"
                className="min-h-11 w-28 rounded-2xl border border-white/10 bg-black/30 px-3 font-mono text-lg tabular-nums outline-none"
              />
              {[1, 10, 25, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setSellUsd(n);
                    setSellSig(null);
                    setSellOut(null);
                    setSellErr("");
                  }}
                  className={cn(
                    "min-h-9 rounded-full px-3 font-mono text-xs tabular-nums",
                    sellUsd === n ? "bg-accent text-accent-fg" : "border border-white/10 text-muted",
                  )}
                >
                  ${n}
                </button>
              ))}
              {sellWorth > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSellUsd(spendable(sellRow.ui, sellRow.price) || sellWorth);
                    setSellSig(null);
                    setSellOut(null);
                    setSellErr("");
                  }}
                  className="min-h-9 rounded-full border border-white/10 px-3 font-mono text-xs text-muted"
                >
                  Max
                </button>
              ) : null}
            </div>
            <button
              type="button"
              disabled={sellBusy || busy || !(sellSlice > 0)}
              onClick={() => void sellBack()}
              className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-60 lg:shrink-0"
            >
              {sellBusy ? "Waiting for the wallet…" : `Sell $${sellSlice.toFixed(2)}`}
            </button>
          </div>
        ) : null}
        {sellRow && sellRow.price > 0 ? (
          <p className="mt-2 font-mono text-xs tabular-nums text-subtle">{formatUsd(sellRow.price)} live</p>
        ) : sellRow && !(sellRow.price > 0) ? (
          <p className="mt-2 text-sm text-down">No live print for {sellRow.symbol}. Nothing will be sent.</p>
        ) : null}
        {sellSig ? (
          <div className="mt-3">
            {sellOut != null ? (
              <p className="font-mono text-sm tabular-nums">Jupiter out {sellOut.toLocaleString("en-US", { maximumFractionDigits: 4 })} USDC</p>
            ) : null}
            <a href={`https://solscan.io/tx/${sellSig}`} target="_blank" rel="noreferrer" className="mt-1 block font-mono text-xs break-all text-accent">
              {sellSig}
            </a>
          </div>
        ) : null}
        {sellErr ? <p className="mt-2 text-sm text-down">{sellErr}</p> : null}
      </section>
      <CardFund owner={owner} />
      </>
      ) : null}
    </div>
  );
}
