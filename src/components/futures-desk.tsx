import { useEffect, useState } from "react";
import { toast } from "sonner";
import { closePerp, confirmFlight, loadClearing, postPerp } from "@/lib/clearing";
import { emptyBook } from "@/lib/liq-router";
import { connectPhantom, signSerializedTx } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { formatValuation, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type BookPerp = {
  id: string;
  owner: string;
  symbol: string;
  side: "long" | "short";
  notional: number;
  margin: number;
  limit: number;
  status: string;
};

const LEVS = [1, 2, 4] as const;

/** Valuation exposure. USDC margin. Not a share, and not a Jupiter swap. */
export function FuturesDesk({ names }: { names: HouseListing[] }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const book = names.filter((n) => n.venue === "prestocks" && n.valuation > 0);
  const [symbol, setSymbol] = useState(book[0]?.symbol ?? "");
  const [raw, setRaw] = useState("25");
  const [lev, setLev] = useState<(typeof LEVS)[number]>(1);
  const [limitOn, setLimitOn] = useState(false);
  const [limitRaw, setLimitRaw] = useState("");
  const [rows, setRows] = useState<BookPerp[]>([]);
  const [pool, setPool] = useState(0);
  const [pubkey, setPubkey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const name = book.find((n) => n.symbol === symbol) ?? book[0];
  const margin = Number(raw);
  const notional = (Number.isFinite(margin) ? margin : 0) * lev;
  const mine = rows.filter((p) => p.symbol === name?.symbol);
  const longs = mine.filter((p) => p.side === "long");
  const shorts = mine.filter((p) => p.side === "short");
  const longUsd = longs.reduce((s, p) => s + p.notional, 0);
  const shortUsd = shorts.reduce((s, p) => s + p.notional, 0);

  useEffect(() => {
    let live = true;
    loadClearing()
      .then((next) => {
        if (!live) return;
        setRows((next.perps || []) as BookPerp[]);
        setPool(next.usdc || 0);
        setPubkey(next.pubkey || "");
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  async function open(side: "long" | "short") {
    if (!name || !(margin >= 1) || notional > margin * 4 + 0.01) return;
    setBusy(side);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "The wallet did not stay.");
      }
      const house = pubkey || (await loadClearing()).pubkey;
      const paid = await payUsdc({
        owner: who,
        to: house,
        usd: margin,
        memo: `Senda clear perp ${name.symbol} ${side}`,
      });
      await postPerp({
        data: {
          owner: who,
          sig: paid.signature,
          symbol: name.symbol,
          mint: name.mint,
          side,
          notional,
          margin,
          limit: limitOn ? Number(limitRaw) || 0 : 0,
          index: "fdv",
        },
      });
      const next = await loadClearing();
      setRows((next.perps || []) as BookPerp[]);
      setPool(next.usdc || 0);
      toast.success(`${side === "long" ? "Long" : "Short"} posted. You did not receive a share.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The margin did not post.");
    } finally {
      setBusy(null);
    }
  }

  async function settle(id: string) {
    setBusy(id);
    try {
      const who = owner || (await connectPhantom());
      const built = await closePerp({ data: { owner: who, id } });
      const sig = await signSerializedTx(built.tx);
      await confirmFlight({ data: { sig } });
      const next = await loadClearing();
      setRows((next.perps || []) as BookPerp[]);
      setPool(next.usdc || 0);
      toast.success(`Settled $${built.usd.toFixed(2)} back to this wallet.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The contract did not settle.");
    } finally {
      setBusy(null);
    }
  }

  if (!name) return null;

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(120%_80%_at_100%_-20%,rgb(214_255_74/0.14),transparent_42%),linear-gradient(165deg,#141824,#0b0d14)]">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Pre-launch futures</p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">Trade the valuation</h2>
          <p className="mt-1 max-w-xl text-sm text-white/60">
            Long or short the implied FDV. You post USDC. You do not receive a share. It settles in USDC.
          </p>
        </div>
        <p className="font-mono text-xs text-white/45">{pool > 0 ? `$${pool.toFixed(2)} in the book` : "The book is empty until the first margin."}</p>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {book.slice(0, 12).map((n) => (
          <button
            key={n.mint}
            type="button"
            onClick={() => setSymbol(n.symbol)}
            className={cn("min-h-16 min-w-[128px] shrink-0 rounded-2xl border px-3 py-2 text-left", n.symbol === name.symbol ? "border-accent bg-white/10" : "border-white/10")}
          >
            <span className="block text-sm font-semibold">{n.symbol}</span>
            <span className="font-mono text-sm text-accent">{formatValuation(n.valuation)}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-px bg-white/10 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div className="bg-[#0c0e14] p-5">
          <div>
            <p className="text-sm text-white/50">{name.name}</p>
            <p className="font-display text-5xl tracking-tight">{formatValuation(name.valuation)}</p>
            <p className="mt-1 text-xs text-white/45">Implied FDV. The mark until a listing print exists. This is not a share of the company.</p>
          </div>
          <label className="mt-5 block">
            <span className="text-[11px] tracking-[0.14em] text-white/45 uppercase">USDC margin</span>
            <input value={raw} onChange={(e) => setRaw(e.target.value)} inputMode="decimal" aria-label="Margin" className="mt-2 min-h-14 w-full rounded-2xl bg-black/40 px-4 font-mono text-3xl outline-none" />
          </label>
          <div className="mt-3 flex gap-2">
            {LEVS.map((n) => (
              <button key={n} type="button" onClick={() => setLev(n)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", lev === n ? "bg-white text-black" : "border border-white/15 text-white/70")}>
                {n}×
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-xs text-white/45">Contract ${notional.toFixed(0)} · a 1% move is ${(notional * 0.01).toFixed(2)}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setLimitOn(false)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", !limitOn ? "bg-white text-black" : "border border-white/15 text-white/70")}>Market</button>
            <button type="button" onClick={() => { setLimitOn(true); if (!limitRaw) setLimitRaw(String(Math.round(name.valuation))); }} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", limitOn ? "bg-white text-black" : "border border-white/15 text-white/70")}>Limit</button>
          </div>
          {limitOn ? (
            <input value={limitRaw} onChange={(e) => setLimitRaw(e.target.value)} inputMode="decimal" aria-label="Limit FDV" placeholder="FDV" className="mt-2 min-h-12 w-full rounded-2xl bg-black/40 px-4 font-mono text-lg outline-none" />
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled={!!busy} onClick={() => void open("long")} className="min-h-14 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50">{busy === "long" ? "Signing…" : "Long"}</button>
            <button type="button" disabled={!!busy} onClick={() => void open("short")} className="min-h-14 rounded-full border border-white/20 text-sm font-semibold disabled:opacity-50">{busy === "short" ? "Signing…" : "Short"}</button>
          </div>
        </div>
        <div className="bg-[#0c0e14] p-5">
          <div className="flex justify-between text-[11px] tracking-[0.14em] text-white/45 uppercase">
            <span>Long ${longUsd.toFixed(0)}</span>
            <span>Short ${shortUsd.toFixed(0)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <ul className="space-y-1">
              {longs.length === 0 ? <li className="text-xs leading-relaxed text-white/45">{emptyBook("bids")}</li> : null}
              {longs.slice(0, 6).map((p) => (
                <li key={p.id} className="flex justify-between font-mono text-xs">
                  <span className="text-accent">${p.notional.toFixed(0)}</span>
                  <span className="text-white/40">{p.limit > 0 ? formatValuation(p.limit) : "at mark"}</span>
                </li>
              ))}
            </ul>
            <ul className="space-y-1 text-right">
              {shorts.length === 0 ? <li className="text-xs leading-relaxed text-white/45">{emptyBook("asks")}</li> : null}
              {shorts.slice(0, 6).map((p) => (
                <li key={p.id} className="flex justify-between font-mono text-xs">
                  <span className="text-white/40">{p.limit > 0 ? formatValuation(p.limit) : "at mark"}</span>
                  <span className="text-down">${p.notional.toFixed(0)}</span>
                </li>
              ))}
            </ul>
          </div>
          {owner ? (
            <ul className="mt-4 space-y-2">
              {mine.filter((p) => p.owner === owner).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{p.side} ${p.notional.toFixed(0)}</span>
                  <button type="button" disabled={busy === p.id} onClick={() => void settle(p.id)} className="min-h-10 rounded-full border border-white/15 px-3 text-xs">{busy === p.id ? "Signing…" : "Settle"}</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-xs text-white/40">Connect the wallet that will post the margin. Senda does not hold it after you settle.</p>
          )}
        </div>
      </div>
    </section>
  );
}
