import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FillButton } from "@/components/fill-button";
import { LiveChart } from "@/components/price-chart";
import { OptionChain } from "@/components/option-chain";
import { getEquityBook, listedMarks, type ListedStock, type StockReserve } from "@/lib/equities";
import { openChainCover } from "@/lib/cover-chain";
import { listPositions, parkShares, returnShares, sendShares, type SharePosition } from "@/lib/pocket-contract";
import { runPrestock } from "@/lib/prestock";
import { connectPhantom, phantomProvider, splHolding } from "@/lib/phantom";
import { type OptContract, type OptTenor } from "@/lib/option-chain";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const ETF = new Set(["SPY", "QQQ", "IWM", "DIA", "GLD", "SLV", "TLT", "HYG", "XLE", "XLF", "XLK", "URA", "USO", "UNG", "VTI", "VOO", "ARKK", "EEM", "EFA", "IBIT", "GDX", "GDXJ", "SMH", "SOXX", "IYR", "XBI", "KWEB", "EWZ", "EWJ", "FXI", "TIP", "LQD", "BND", "VNQ", "XOP", "COPX", "SIL", "PPLT", "CPER", "GLDX"]);

function isEtf(row: ListedStock) {
  const bare = row.symbol.replace(/x$/i, "").toUpperCase();
  return ETF.has(bare) || /etf|trust|fund/i.test(row.name);
}

export function XStockDesk({
  rows,
  reserves,
  px,
  symbol,
  usd,
  onSymbol,
  onUsd,
  owner,
  signer,
  busy,
  tenor,
  onTenor,
  onBuyContract,
}: {
  rows: ListedStock[];
  reserves: StockReserve[];
  px: Record<string, number>;
  symbol: string;
  usd: number;
  onSymbol: (s: string) => void;
  onUsd: (n: number) => void;
  owner: string;
  signer: () => Promise<string>;
  busy: boolean;
  tenor: OptTenor;
  onTenor: (t: OptTenor) => void;
  onBuyContract: (c: OptContract, stock: HouseListing) => void;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "share" | "etf">("all");
  const [cap, setCap] = useState(40);
  const [title, setTitle] = useState("");
  const [to, setTo] = useState("");
  const [heldUi, setHeldUi] = useState(0);
  const [positions, setPositions] = useState<SharePosition[]>([]);
  const [working, setWorking] = useState(false);
  const stock = rows.find((s) => s.symbol === symbol) ?? rows[0];
  const last = stock ? px[stock.mint] ?? 0 : 0;
  const reserve = reserves.find((r) => r.symbol === stock?.symbol);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((s) => {
      if (kind === "etf" && !isEtf(s)) return false;
      if (kind === "share" && isEtf(s)) return false;
      if (!needle) return true;
      return [s.symbol, s.name, s.underlying, s.exchange].join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, kind]);
  const shown = filtered.slice(0, cap);

  useEffect(() => {
    setPositions(listPositions().filter((p) => p.status === "held"));
  }, [stock?.mint]);

  useEffect(() => {
    if (!owner || !stock) {
      setHeldUi(0);
      return;
    }
    let live = true;
    splHolding(owner, stock.mint)
      .then((h) => live && setHeldUi(h.ui))
      .catch(() => live && setHeldUi(0));
    return () => {
      live = false;
    };
  }, [owner, stock?.mint, positions.length]);

  async function sellWallet() {
    if (!stock || !(last > 0)) return;
    setWorking(true);
    try {
      const who = await signer();
      const done = await runPrestock({ owner: who, mint: stock.mint, side: "sell", usd: heldUi * last, price: last, symbol: stock.symbol });
      toast.success(`Sold. ${done.signature.slice(0, 8)}…`);
      const h = await splHolding(who, stock.mint);
      setHeldUi(h.ui);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The sale did not sign.");
    } finally {
      setWorking(false);
    }
  }

  async function park() {
    if (!stock) return;
    setWorking(true);
    try {
      const who = await signer();
      const row = await parkShares({ owner: who, mint: stock.mint, symbol: stock.symbol, title: title || stock.symbol });
      setPositions(listPositions().filter((p) => p.status === "held"));
      setHeldUi(0);
      toast.success(`${row.title} holds ${row.ui} ${row.symbol}. ${row.sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The shares stayed in Phantom.");
    } finally {
      setWorking(false);
    }
  }

  async function send(row: SharePosition) {
    setWorking(true);
    try {
      const who = await signer();
      const sig = await sendShares(row, to, who);
      setPositions(listPositions().filter((p) => p.status === "held"));
      toast.success(`Sent. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The send did not sign.");
    } finally {
      setWorking(false);
    }
  }

  async function takeBack(row: SharePosition) {
    setWorking(true);
    try {
      const who = await signer();
      const sig = await returnShares(row, who);
      setPositions(listPositions().filter((p) => p.status === "held"));
      toast.success(`Back in this Phantom. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The shares stayed in the contract.");
    } finally {
      setWorking(false);
    }
  }

  async function sellPosition(row: SharePosition) {
    setWorking(true);
    try {
      const who = await signer();
      await returnShares(row, who);
      const price = px[row.mint] || 0;
      if (!(price > 0)) throw new Error("The shares are back in Phantom. Jupiter has no last, so the sale did not start.");
      const done = await runPrestock({ owner: who, mint: row.mint, side: "sell", usd: row.ui * price, price, symbol: row.symbol });
      setPositions(listPositions().filter((p) => p.status === "held"));
      toast.success(`Sold from the contract. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The sale did not finish.");
    } finally {
      setWorking(false);
    }
  }

  if (!stock) return <p className="mt-4 text-sm text-muted">Loading the xStock book…</p>;
  const house: HouseListing | null = last > 0
    ? {
        id: stock.mint,
        venue: "prestocks",
        mint: stock.mint,
        symbol: stock.symbol,
        name: stock.name,
        question: "",
        description: "",
        last,
        mark: last,
        premium: null,
        valuation: 0,
        holders: 0,
        liquidity: 0,
        change24h: null,
        url: "",
        swapUrl: "",
        sector: stock.exchange || "Listed",
        image: stock.logo || "",
      }
    : null;
  const mine = positions.filter((p) => p.mint === stock.mint);

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="text-sm text-muted">
          Every Solana xStock. Buy and sell go through Jupiter. Phantom signs. Parking moves the shares this wallet holds into a contract you name. That contract can send them, give them back, or sell them.
        </p>
        <div className="mt-3 flex gap-1">
          {(
            [
              ["all", "All"],
              ["share", "Shares"],
              ["etf", "ETFs"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setKind(id); setCap(40); }} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", kind === id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
              {label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setCap(40); }}
          placeholder="Symbol, company, exchange"
          className="mt-3 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm"
        />
        <p className="mt-2 font-mono text-[11px] text-subtle">{filtered.length} in this book · {shown.length} open</p>
        <ul className="mt-2 max-h-[28rem] space-y-1 overflow-y-auto">
          {shown.map((s) => {
            const price = px[s.mint] ?? 0;
            return (
              <li key={s.mint}>
                <button
                  type="button"
                  onClick={() => onSymbol(s.symbol)}
                  className={cn("flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left", s.symbol === stock.symbol ? "bg-accent/10" : "hover:bg-white/[0.04]")}
                >
                  <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-[#2a2a2e] text-[10px] font-bold">
                    {s.symbol.slice(0, 2)}
                    {s.logo ? <img src={s.logo} alt="" className="absolute inset-0 size-8 rounded-full bg-white object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{s.symbol}</span>
                    <span className="block truncate text-[11px] text-subtle">
                      {s.underlying || "—"} · {s.exchange || "—"} · {s.halted ? "halted" : s.period || s.hours}
                    </span>
                  </span>
                  <span className="font-mono text-xs tabular-nums">{price > 0 ? formatUsd(price) : "—"}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {filtered.length > shown.length ? (
          <button type="button" onClick={() => setCap((n) => n + 40)} className="mt-2 min-h-10 w-full rounded-xl border border-white/10 text-sm">
            {shown.length} of {filtered.length}. Show more
          </button>
        ) : null}
      </div>
      <div>
        <p className="text-sm font-semibold">{stock.name}</p>
        <p className="mt-1 font-mono text-xs text-subtle">
          {stock.underlying || "—"} · {stock.exchange || "—"}
          {stock.isin ? ` · ${stock.isin}` : ""}
          {stock.halted ? " · halted" : stock.open ? ` · ${stock.period || "open"}` : " · closed"}
        </p>
        <p className="mt-2 font-mono text-2xl tabular-nums">{last > 0 ? formatUsd(last) : "No Jupiter last"}</p>
        <div className="mt-3 overflow-hidden rounded-2xl bg-black/30">
          <LiveChart mint={stock.mint} symbol={stock.symbol} live={last || undefined} />
        </div>
        <p className="mt-1 break-all font-mono text-[11px] text-subtle">{stock.mint}</p>
        {stock.minOrder ? (
          <p className="mt-2 text-xs text-muted">
            The issuer’s own mint starts at ${stock.minOrder.toLocaleString("en-US")}. A Jupiter buy here is not that order.
          </p>
        ) : null}
        {reserve ? (
          <p className="mt-2 text-xs text-muted">
            Kamino will lend up to {(reserve.maxLtv * 100).toFixed(0)}% against this share, borrow {(reserve.borrowApy * 100).toFixed(2)}%. That loan is not signed on this desk.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">Kamino does not lend against this one.</p>
        )}
        <p className="mt-3 text-sm">
          This Phantom holds {heldUi > 0 ? heldUi.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "none"}
          {heldUi > 0 && last > 0 ? ` · ${formatUsd(heldUi * last)}` : ""}.
        </p>
        <div className="mt-3 flex gap-1">
          {[5, 10, 25, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onUsd(n)}
              className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", usd === n ? "bg-white/15" : "border border-white/10 text-muted")}
            >
              ${n}
            </button>
          ))}
        </div>
        <FillButton
          mint={stock.mint}
          usd={usd}
          price={last}
          symbol={stock.symbol}
          label={last > 0 ? `Buy $${usd} of ${stock.symbol}` : "No price"}
          className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg"
        />
        <button
          type="button"
          disabled={working || busy || !(heldUi > 0) || !(last > 0)}
          onClick={() => void sellWallet()}
          className="mt-2 min-h-11 w-full rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40"
        >
          Sell what Phantom holds
        </button>
        <label className="mt-4 block text-xs text-muted">
          Contract name
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={stock.symbol} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
        </label>
        <button
          type="button"
          disabled={working || busy || !(heldUi > 0)}
          onClick={() => void park()}
          className="mt-2 min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold disabled:opacity-40"
        >
          Park these shares in a contract
        </button>
        <p className="mt-2 text-xs text-muted">Parking takes every {stock.symbol} in this Phantom. The contract then holds the position. Phantom pays the fee. The contract key stays in this browser.</p>
        {mine.length ? (
          <ul className="mt-4 space-y-2">
            {mine.map((row) => (
              <li key={row.id} className="rounded-2xl border border-white/10 px-3 py-3">
                <p className="text-sm font-semibold">{row.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {row.ui.toLocaleString("en-US", { maximumFractionDigits: 4 })} {row.symbol}
                  {px[row.mint] ? ` · ${formatUsd(row.ui * px[row.mint])}` : ""}
                </p>
                <div className="mt-2 flex gap-1">
                  <button type="button" disabled={working} onClick={() => void takeBack(row)} className="min-h-10 flex-1 rounded-full border border-white/15 text-xs font-semibold">
                    Take back
                  </button>
                  <button type="button" disabled={working || !(px[row.mint] > 0)} onClick={() => void sellPosition(row)} className="min-h-10 flex-1 rounded-full bg-accent text-xs font-semibold text-accent-fg disabled:opacity-40">
                    Sell
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <label className="mt-3 block text-xs text-muted">
          Send a parked position to
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana address" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
        </label>
        {mine[0] ? (
          <button type="button" disabled={working || to.trim().length < 32} onClick={() => void send(mine[0])} className="mt-2 min-h-11 w-full rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">
            Send {mine[0].title}
          </button>
        ) : null}
        {house ? (
          <div className="mt-4">
            <p className="text-sm font-semibold">Contract on the last</p>
            <OptionChain stock={house} tenor={tenor} onTenor={onTenor} busy={busy || working} onBuy={(c) => onBuyContract(c, house)} />
            <p className="mt-2 text-xs text-muted">A call or put still posts a USDC debit. It does not move these shares. Close returns the debit.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function XStockLane() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [rows, setRows] = useState<ListedStock[]>([]);
  const [reserves, setReserves] = useState<StockReserve[]>([]);
  const [px, setPx] = useState<Record<string, number>>({});
  const [symbol, setSymbol] = useState("");
  const [usd, setUsd] = useState(10);
  const [tenor, setTenor] = useState<OptTenor>("1d");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getEquityBook()
      .then(async (book) => {
        if (!live) return;
        setRows(book.stocks);
        setReserves(book.reserves);
        setSymbol((cur) => cur || book.stocks.find((s) => s.symbol === "AAPLx")?.symbol || book.stocks[0]?.symbol || "");
        const next: Record<string, number> = {};
        for (let i = 0; i < book.stocks.length; i += 30) {
          const part = book.stocks.slice(i, i + 30).map((s) => s.mint);
          const got = await listedMarks({ data: part }).catch(() => ({} as Record<string, number>));
          Object.assign(next, got);
          if (live) setPx({ ...next });
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  async function signer() {
    const live = phantomProvider()?.publicKey?.toString();
    const who = live || owner || (await connectPhantom());
    if (who !== owner) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
    }
    return who;
  }

  async function buyContract(c: OptContract, stock: HouseListing) {
    setBusy(true);
    try {
      const who = await signer();
      const premium = Math.max(1, Math.round(usd * c.ask));
      const row = await openChainCover({
        owner: who,
        kind: c.kind === "put" ? "drop" : "life",
        title: `${stock.symbol} ${c.kind}`,
        symbol: stock.symbol,
        mint: stock.mint,
        strike: c.strike,
        cover: usd,
        premium,
        days: c.tenor === "7d" ? 7 : 1,
      });
      toast.success(`Premium signed. ${row.sig.slice(0, 8)}… Close returns it until someone posts the payout.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The contract did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <XStockDesk
      rows={rows}
      reserves={reserves}
      px={px}
      symbol={symbol}
      usd={usd}
      onSymbol={setSymbol}
      onUsd={setUsd}
      owner={owner}
      signer={signer}
      busy={busy}
      tenor={tenor}
      onTenor={setTenor}
      onBuyContract={(c, stock) => void buyContract(c, stock)}
    />
  );
}
