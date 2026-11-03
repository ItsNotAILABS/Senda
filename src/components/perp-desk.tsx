import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  PERP_MARKETS,
  connectPerpWallet,
  loadPerpBook,
  loadPerpPositions,
  quoteClose,
  quoteIncrease,
  signPerpRequest,
  type PerpAsset,
  type PerpPool,
  type PerpPosition,
  type PerpQuote,
  type PerpStats,
} from "@/lib/jup-perps";
import { spendCap } from "@/lib/spend-cap";
import { cn } from "@/lib/utils";

const LEVS = [2, 5, 10, 20] as const;

type Book = { stats: PerpStats; pool: PerpPool };

function money(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function PerpDesk() {
  const [asset, setAsset] = useState<PerpAsset>("SOL");
  const [books, setBooks] = useState<Partial<Record<PerpAsset, Book>>>({});
  const [bookError, setBookError] = useState("");
  const [owner, setOwner] = useState("");
  const [collateral, setCollateral] = useState(50);
  const [lev, setLev] = useState(5);
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState<PerpQuote | null>(null);
  const [positions, setPositions] = useState<PerpPosition[]>([]);
  const market = PERP_MARKETS.find((m) => m.asset === asset) ?? PERP_MARKETS[0];
  const book = books[asset];

  useEffect(() => {
    let live = true;
    void Promise.all(
      PERP_MARKETS.map(async (m) => {
        const row = await loadPerpBook(m.mint);
        return [m.asset, row] as const;
      }),
    )
      .then((rows) => {
        if (!live) return;
        const next: Partial<Record<PerpAsset, Book>> = {};
        for (const [k, v] of rows) next[k] = v;
        setBooks(next);
        setBookError("");
      })
      .catch((e: unknown) => {
        if (live) setBookError(e instanceof Error ? e.message : "The perp book did not load.");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!owner) return;
    let live = true;
    const pull = () => {
      void loadPerpPositions(owner)
        .then((rows) => {
          if (live) setPositions(rows);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  useEffect(() => {
    setDraft(null);
  }, [asset, collateral, lev]);

  async function wallet(): Promise<string> {
    if (owner) return owner;
    const addr = await connectPerpWallet();
    setOwner(addr);
    return addr;
  }

  async function review(side: "long" | "short") {
    setBusy(side);
    try {
      const cap = spendCap();
      if (collateral > cap) throw new Error(`Collateral is $${collateral.toFixed(0)}. Your send cap is $${cap}. Raise it on Your money.`);
      const who = await wallet();
      const q = await quoteIncrease({
        walletAddress: who,
        asset,
        collateralUsd: collateral,
        leverage: lev,
        side,
      });
      setDraft(q);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Jupiter did not quote.");
    } finally {
      setBusy("");
    }
  }

  async function signOpen() {
    if (!draft) return;
    setBusy("sign");
    try {
      const sig = await signPerpRequest(draft.tx, "increase-position");
      toast.success(`Request signed. ${sig.slice(0, 8)}… Jupiter’s keeper fills it.`);
      setDraft(null);
      if (owner) setPositions(await loadPerpPositions(owner));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy("");
    }
  }

  async function close(p: PerpPosition) {
    setBusy(p.pubkey);
    try {
      await wallet();
      const tx = await quoteClose(p.pubkey);
      const sig = await signPerpRequest(tx, "decrease-position");
      toast.success(`Close signed. ${sig.slice(0, 8)}…`);
      if (owner) setPositions(await loadPerpPositions(owner));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The close did not sign.");
    } finally {
      setBusy("");
    }
  }

  const size = collateral * lev;

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl tracking-tight">Perps</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          SOL, ETH, and BTC against Jupiter’s pool. Collateral is USDC in your wallet. You sign the request. Their keeper fills it. Senda never holds the position. PreStock names are not on this book. Those are tokens. Buy them on the ticket.
        </p>
      </header>

      {bookError ? <p className="mb-3 text-sm text-down">{bookError}</p> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        {PERP_MARKETS.map((m) => {
          const row = books[m.asset];
          const on = m.asset === asset;
          const chg = row?.stats.change24h ?? 0;
          return (
            <button
              key={m.asset}
              type="button"
              onClick={() => setAsset(m.asset)}
              className={cn("rounded-2xl border px-4 py-3 text-left", on ? "border-white/30 bg-white/10" : "border-white/10 bg-[#10131c]")}
            >
              <p className="text-sm font-semibold">{m.asset}-PERP</p>
              <p className="mt-1 font-mono text-lg tabular-nums">{row ? money(row.stats.price, row.stats.price >= 1000 ? 0 : 2) : "…"}</p>
              <p className={cn("font-mono text-xs", chg < 0 ? "text-[#ff8fa0]" : "text-[#3dd68c]")}>
                {row ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%` : ""}
              </p>
            </button>
          );
        })}
      </div>

      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-white/10 bg-[#10131c] p-4">
          <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">{market.name}</p>
          <p className="mt-1 font-mono text-4xl tabular-nums">{book ? money(book.stats.price, book.stats.price >= 1000 ? 1 : 2) : "—"}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Stat k="24h volume" v={book ? money(book.stats.volume, 0) : "—"} />
            <Stat k="High" v={book ? money(book.stats.high, 2) : "—"} />
            <Stat k="Low" v={book ? money(book.stats.low, 2) : "—"} />
            <Stat k="Long borrow" v={book ? `${book.pool.longBorrow.toFixed(4)}%` : "—"} />
            <Stat k="Short borrow" v={book ? `${book.pool.shortBorrow.toFixed(4)}%` : "—"} />
            <Stat k="Open fee" v={book ? `${book.pool.openFee.toFixed(2)}%` : "—"} />
          </dl>
          <p className="mt-3 text-xs text-subtle">
            Long liquidity {book ? money(book.pool.longLiquidity, 0) : "—"}. Short liquidity {book ? money(book.pool.shortLiquidity, 0) : "—"}.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] text-subtle">USDC collateral</p>
          <input
            inputMode="decimal"
            value={collateral ? String(collateral) : ""}
            onChange={(e) => setCollateral(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 min-h-12 w-full rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-lg outline-none"
          />
          <div className="mt-2 flex gap-1">
            {[20, 50, 100, 250].map((n) => (
              <button key={n} type="button" onClick={() => setCollateral(n)} className={cn("min-h-8 flex-1 rounded-full text-xs", collateral === n ? "bg-white/15" : "bg-black/30 text-muted")}>
                ${n}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-subtle">Leverage</p>
          <div className="mt-1 flex gap-1">
            {LEVS.map((n) => (
              <button key={n} type="button" onClick={() => setLev(n)} className={cn("min-h-9 flex-1 rounded-full text-sm font-semibold", lev === n ? "bg-accent text-accent-fg" : "bg-black/30 text-muted")}>
                {n}×
              </button>
            ))}
          </div>
          <p className="mt-3 font-mono text-sm">Size about {money(size, 0)}. Cap on this desk is 50×.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={!!busy} onClick={() => void review("long")} className="min-h-11 rounded-full bg-[#3dd68c] text-sm font-semibold text-black disabled:opacity-40">
              {busy === "long" ? "…" : "Review long"}
            </button>
            <button type="button" disabled={!!busy} onClick={() => void review("short")} className="min-h-11 rounded-full bg-[#ff5d73] text-sm font-semibold text-white disabled:opacity-40">
              {busy === "short" ? "…" : "Review short"}
            </button>
          </div>
          {!owner ? (
            <button type="button" onClick={() => void wallet().catch((e: unknown) => toast.error(e instanceof Error ? e.message : "No wallet."))} className="mt-3 text-xs text-muted">
              Connect the wallet that holds the USDC
            </button>
          ) : (
            <p className="mt-3 font-mono text-[11px] text-subtle">{owner.slice(0, 4)}…{owner.slice(-4)}</p>
          )}
        </div>
      </section>

      {draft ? (
        <section className="mt-4 rounded-2xl border border-white/15 bg-[#141820] p-4">
          <p className="text-sm font-semibold">
            {draft.side === "long" ? "Long" : "Short"} {asset}-PERP · {draft.leverage.toFixed(1)}×
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <Stat k="Entry" v={money(draft.entry, draft.entry >= 1000 ? 1 : 2)} />
            <Stat k="Size" v={money(draft.sizeUsd, 2)} />
            <Stat k="Collateral" v={money(draft.collateralUsd, 2)} />
            <Stat k="Open fee" v={money(draft.feeUsd, 2)} />
            <Stat k="Liquidation" v={money(draft.liq, draft.liq >= 1000 ? 1 : 2)} />
          </dl>
          <p className="mt-3 text-xs text-muted">This quote is the request, not the fill. The keeper has about 45 seconds. If it expires, review again.</p>
          <button type="button" disabled={!!busy} onClick={() => void signOpen()} className="mt-3 min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-40">
            {busy === "sign" ? "Waiting for the wallet…" : `Sign ${draft.side}`}
          </button>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Open on Jupiter</h2>
        {positions.length === 0 ? (
          <p className="mt-2 text-sm text-subtle">{owner ? "No open perp on this wallet." : "Connect a wallet to read positions."}</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] text-subtle uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Market</th>
                  <th className="px-2 py-2 font-medium">Side</th>
                  <th className="px-2 py-2 text-right font-medium">Size</th>
                  <th className="px-2 py-2 text-right font-medium">Entry</th>
                  <th className="px-2 py-2 text-right font-medium">Mark</th>
                  <th className="px-2 py-2 text-right font-medium">Liq</th>
                  <th className="px-2 py-2 text-right font-medium">PnL</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.pubkey} className="border-t border-white/10">
                    <td className="px-3 py-2 font-mono text-xs font-semibold">{p.asset}-PERP</td>
                    <td className="px-2 py-2 text-xs">{p.side} {p.leverage.toFixed(1)}×</td>
                    <td className="px-2 py-2 text-right font-mono text-xs">{money(p.sizeUsd)}</td>
                    <td className="px-2 py-2 text-right font-mono text-xs">{money(p.entry)}</td>
                    <td className="px-2 py-2 text-right font-mono text-xs">{money(p.mark)}</td>
                    <td className="px-2 py-2 text-right font-mono text-xs">{money(p.liq)}</td>
                    <td className={cn("px-2 py-2 text-right font-mono text-xs", p.pnl < 0 ? "text-[#ff8fa0]" : "text-[#3dd68c]")}>
                      {p.pnl >= 0 ? "+" : ""}
                      {p.pnl.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" disabled={!!busy} onClick={() => void close(p)} className="text-xs text-muted disabled:opacity-40">
                        {busy === p.pubkey ? "…" : "Close"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] text-subtle">{k}</dt>
      <dd className="font-mono text-sm tabular-nums">{v}</dd>
    </div>
  );
}
