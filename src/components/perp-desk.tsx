import { useEffect, useState } from "react";
import { toast } from "sonner";
import { noteAct, setIntent } from "@/lib/book";
import { closePerp, fundingRate, loadPerps, openPerp, perpPnl, type PerpPos } from "@/lib/perp";
import { connectPhantom, sendVersioned, splHolding } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import {
  JUP_PERPS,
  jupPerpBook,
  jupPerpClose,
  jupPerpOpen,
  jupPerpPositions,
  type JupAsset,
  type JupPerpMarket,
  type JupPosition,
} from "@/lib/jup-perps";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { PerpBooks } from "@/components/perp-books";
import { LiveChart } from "@/components/price-chart";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { formatMoney } from "@/lib/wallet";
import { cn } from "@/lib/utils";

export function PerpDesk({
  house,
}: {
  house: HouseListing[];
  cash?: number;
  onDebit?: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
  onCredit?: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const names = house.filter((h) => h.venue === "prestocks");
  const wallet = useWallet();
  const [stockId, setStockId] = useState(names[0]?.id ?? "");
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState(loadPerps);
  const [busy, setBusy] = useState(false);
  const [asset, setAsset] = useState<JupAsset>("SOL");
  const [markets, setMarkets] = useState<JupPerpMarket[]>([]);
  const [lev, setLev] = useState(2);
  const [margin, setMargin] = useState(10);
  const [livePos, setLivePos] = useState<JupPosition[]>([]);
  const notional = Number(raw) || 0;
  const stock = names.find((n) => n.id === stockId) ?? names[0];
  const fund = fundingRate(stock?.premium ?? 0);

  async function ownerOf() {
    const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
    const owner = existing || (await connectPhantom());
    if (!existing) {
      const linked = wallet.linkChain(owner, "Phantom", "phantom");
      if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
    }
    return owner;
  }

  useEffect(() => {
    let live = true;
    const pull = () =>
      jupPerpBook()
        .then((rows) => live && setMarkets(rows))
        .catch(() => undefined);
    void pull();
    const id = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
    if (!owner) return;
    let live = true;
    jupPerpPositions({ data: { owner } })
      .then((rows) => live && setLivePos(rows))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [wallet.w.links, busy]);

  async function signBuilt(b64: string) {
    const { Buffer } = await import("buffer");
    if (!globalThis.Buffer) globalThis.Buffer = Buffer;
    const { VersionedTransaction } = await import("@solana/web3.js");
    const tx = VersionedTransaction.deserialize(Buffer.from(b64, "base64"));
    return sendVersioned(tx);
  }

  async function openLev(side: "long" | "short") {
    if (margin < 10) {
      toast.error("Jupiter wants at least $10 of USDC collateral.");
      return;
    }
    setBusy(true);
    try {
      const owner = await ownerOf();
      const built = await jupPerpOpen({ data: { owner, asset, side, collateral: margin, leverage: lev } });
      const sig = await signBuilt(built.tx);
      noteAct({
        kind: "swap",
        title: `${side} ${asset}-USD ${lev}x`,
        detail: `$${margin.toFixed(0)} collateral · Jupiter Perps`,
        signature: sig,
      });
      const next = await jupPerpPositions({ data: { owner } }).catch(() => livePos);
      setLivePos(next);
      toast.success(`${asset}-USD ${side} ${lev}x. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The position did not send.");
    } finally {
      setBusy(false);
    }
  }

  async function closeLev(position: string, label: string) {
    setBusy(true);
    try {
      const built = await jupPerpClose({ data: { position } });
      const sig = await signBuilt(built.tx);
      noteAct({ kind: "swap", title: `Close ${label}`, detail: "Jupiter Perps", signature: sig });
      const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      if (owner) setLivePos(await jupPerpPositions({ data: { owner } }).catch(() => []));
      toast.success(`Closed. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The close did not send.");
    } finally {
      setBusy(false);
    }
  }

  const market = markets.find((m) => m.asset === asset) ?? markets[0];
  const levSize = margin * lev;

  async function open(side: "long" | "short") {
    if (!stock || !(notional >= 0.5)) {
      toast.error("Enter at least $0.50.");
      return;
    }
    setBusy(true);
    try {
      const owner = await ownerOf();
      setIntent("trade");
      if (side === "short") {
        const held = await splHolding(owner, stock.mint);
        const worth = held.ui * stock.last;
        if (worth + 0.01 < notional) {
          throw new Error(`A short sells ${stock.symbol} already in this wallet. You hold about $${worth.toFixed(2)}.`);
        }
      }
      const done = await runPrestock({
        owner,
        mint: stock.mint,
        side: side === "long" ? "buy" : "sell",
        usd: notional,
        price: stock.last,
      });
      setRows(openPerp(rows, stock.id, stock.symbol, side, notional, stock.last));
      toast.success(`${side === "long" ? "Bought" : "Sold"} ${stock.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The position did not send.");
    } finally {
      setBusy(false);
    }
  }

  async function close(p: PerpPos) {
    const name = names.find((n) => n.id === p.stockId);
    const last = name?.last ?? p.entry;
    if (!name) return;
    setBusy(true);
    try {
      const owner = await ownerOf();
      setIntent("trade");
      const done = await runPrestock({
        owner,
        mint: name.mint,
        side: p.side === "long" ? "sell" : "buy",
        usd: p.notional,
        price: last,
      });
      const pnl = perpPnl(p, last);
      setRows(closePerp(rows, p.id));
      toast.success(`Closed ${p.symbol}. ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} vs entry. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The close did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pb-8">
      <div className="pt-3">
        <PerpBooks />
      </div>
      {stock ? (
        <div className="pt-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {names.slice(0, 8).map((n) => (
              <button key={n.id} type="button" onClick={() => setStockId(n.id)} className={cn("min-w-[132px] shrink-0 rounded-2xl px-3 py-2 text-left", n.id === stock.id ? "bg-white/10" : "bg-black/20")}>
                <span className="block text-xs font-semibold">{n.symbol}</span>
                <span className="font-mono text-sm">{formatUsd(n.last)}</span>
                <span className={cn("block font-mono text-[11px]", (n.change24h ?? 0) < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>{formatPremium(n.change24h)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] tracking-[0.14em] text-white/40">{stock.symbol} · POOL · 1H</p>
          <p className="font-mono text-3xl text-[#d7e36a]">{formatUsd(stock.last)}</p>
          <LiveChart mint={stock.mint} symbol={stock.symbol} live={stock.last} />
        </div>
      ) : null}
      <p className="pt-3 text-sm text-muted">
        SOL, ETH, and BTC are Jupiter perps. Collateral is USDC. The slider sets leverage, 1.1× to 20×. Phantom signs. A name below is the token itself, at 1×.
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {(["SOL", "ETH", "BTC"] as const).map((id) => {
          const row = markets.find((m) => m.asset === id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setAsset(id)}
              className={cn("min-h-12 shrink-0 rounded-full px-4 text-left", asset === id ? "bg-white text-black" : "bg-black/40")}
            >
              <span className="block text-sm font-semibold">{id}-USD</span>
              <span className="block font-mono text-[11px]">{row?.price ? `$${row.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}</span>
            </button>
          );
        })}
      </div>
      {(() => {
        const mint = JUP_PERPS.find((p) => p.asset === asset)?.mint ?? "";
        return mint ? (
          <div className="mt-3">
            <LiveChart mint={mint} symbol={`${asset}-USD`} live={market?.price ?? undefined} />
          </div>
        ) : null;
      })()}
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="font-mono text-3xl tabular-nums">${levSize.toFixed(0)}</p>
        <p className="text-right text-xs text-subtle">
          ${margin} margin
          <span className="block">{lev.toFixed(1)}×</span>
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        {[10, 25, 50, 100].map((n) => (
          <button key={n} type="button" onClick={() => setMargin(n)} className={cn("min-h-9 flex-1 rounded-full font-mono text-xs", margin === n ? "bg-accent text-accent-fg" : "border border-white/10")}>
            ${n}
          </button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="text-[11px] tracking-[0.14em] text-subtle">LEVERAGE {lev.toFixed(1)}×</span>
        <input
          type="range"
          min={1.1}
          max={20}
          step={0.1}
          value={lev}
          onChange={(e) => setLev(Number(e.target.value))}
          className="mt-2 w-full accent-white"
        />
      </label>
      {market?.price ? (
        <p className="mt-1 font-mono text-[11px] text-subtle">
          About ${(market.price * (1 - 0.8 / lev)).toLocaleString("en-US", { maximumFractionDigits: 2 })} long liq · $
          {(market.price * (1 + 0.8 / lev)).toLocaleString("en-US", { maximumFractionDigits: 2 })} short. Jupiter sets the real price.
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => void openLev("long")} className="min-h-12 rounded-full bg-up text-sm font-semibold text-up-fg disabled:opacity-50">
          Long {asset}
        </button>
        <button type="button" disabled={busy} onClick={() => void openLev("short")} className="min-h-12 rounded-full bg-down text-sm font-semibold text-down-fg disabled:opacity-50">
          Short {asset}
        </button>
      </div>
      {livePos.length > 0 ? (
        <ul className="mt-4 divide-y divide-border">
          {livePos.map((p) => (
            <li key={p.pubkey} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold">
                  {p.asset}-USD {p.side} {p.leverage ? `${p.leverage.toFixed(1)}×` : ""}
                </p>
                <p className="font-mono text-xs text-subtle">
                  ${p.size.toFixed(0)} · liq {p.liq ? p.liq.toFixed(2) : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className={cn("font-mono text-sm", p.pnl < 0 ? "text-down" : "text-up")}>
                  {p.pnl >= 0 ? "+" : ""}
                  {p.pnl.toFixed(2)}
                </p>
                <button type="button" disabled={busy} onClick={() => void closeLev(p.pubkey, `${p.asset}-USD`)} className="text-xs text-muted">
                  Close
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-8 text-sm text-muted">
        A name is the token, at 1×. Long buys it. Short sells tokens already in this wallet.
      </p>
      <select
        value={stock?.id ?? ""}
        onChange={(e) => setStockId(e.target.value)}
        className="mt-4 min-h-12 w-full rounded-2xl bg-elevated px-4 text-sm outline-none"
      >
        {names.map((n) => (
          <option key={n.id} value={n.id}>
            {n.symbol} · {formatUsd(n.last)} · {formatPremium(n.premium)} mark
          </option>
        ))}
      </select>
      {stock ? (
        <p className="mt-2 font-mono text-xs text-subtle">
          Funding {fund >= 0 ? "+" : ""}
          {(fund * 100).toFixed(3)}% / h · mint {stock.mint.slice(0, 8)}…
        </p>
      ) : null}
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Notional USD"
        className="mt-3 min-h-12 w-full rounded-2xl bg-elevated px-4 font-mono text-lg outline-none"
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => void open("long")} className="min-h-12 rounded-full bg-up text-sm font-semibold text-up-fg disabled:opacity-50">
          Long
        </button>
        <button type="button" disabled={busy} onClick={() => void open("short")} className="min-h-12 rounded-full bg-down text-sm font-semibold text-down-fg disabled:opacity-50">
          Short
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-subtle">No perps open.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {rows.map((p) => {
            const last = names.find((n) => n.id === p.stockId)?.last ?? p.entry;
            const pnl = perpPnl(p, last);
            return (
              <li key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {p.symbol} {p.side}
                  </p>
                  <p className="font-mono text-xs text-subtle">{formatMoney(p.notional)} @ {formatUsd(p.entry)}</p>
                </div>
                <div className="text-right">
                  <p className={cn("font-mono text-sm font-semibold", pnl < 0 ? "text-down" : "text-up")}>
                    {pnl >= 0 ? "+" : ""}
                    {pnl.toFixed(2)}
                  </p>
                  <button type="button" disabled={busy} onClick={() => void close(p)} className="text-xs text-muted disabled:opacity-50">
                    Close
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
