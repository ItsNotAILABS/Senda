import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TradeTerminal } from "@/components/backpack-desk";
import { JumpStrip } from "@/components/jump-strip";
import { DeskAudit } from "@/components/money-flow";
import { WalletPicker } from "@/components/wallet-picker";
import { impactPct, outUi, quoteJup } from "@/lib/jup-exec";
import { PRESTOCK_MINTS, connectPhantom, readChain, type ChainWallet } from "@/lib/phantom";
import { pre8 } from "@/lib/pre8";
import { runPrestock } from "@/lib/prestock";
import { rememberTrade } from "@/lib/trade-log";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const SIZES = [1, 10, 25, 100] as const;

export function SolanaFloor({ house }: { house: HouseListing[] }) {
  const idx = pre8(house);
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const mints = liveMints(house);
  const [pick, setPick] = useState(mints[0]?.mint ?? "");
  const [usd, setUsd] = useState(1);
  const [route, setRoute] = useState("");
  const [busy, setBusy] = useState<"quote" | "buy" | "sell" | null>(null);
  const [chain, setChain] = useState<ChainWallet | null>(null);
  const [view, setView] = useState<"names" | "markets">("markets");
  const chosen = mints.find((m) => m.mint === pick) ?? mints[0];
  const owner = link?.address ?? "";
  const usdc = chain?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;

  useEffect(() => {
    if (!owner) {
      setChain(null);
      return;
    }
    let live = true;
    readChain(owner)
      .then((s) => live && setChain(s))
      .catch(() => live && setChain(null));
    return () => {
      live = false;
    };
  }, [owner]);

  function copyMint(symbol: string, mint: string) {
    void navigator.clipboard?.writeText(mint).then(
      () => toast.success(`${symbol} mint copied.`),
      () => toast.error("Could not copy that mint."),
    );
  }

  async function quoteOne() {
    if (!chosen) return;
    setBusy("quote");
    try {
      const q = await quoteJup({ data: { mint: chosen.mint, usd, side: "buy" } });
      if ("error" in q) {
        setRoute(q.error);
        return;
      }
      setRoute(
        `$${usd} → ${outUi(q, 6).toFixed(4)} ${chosen.symbol} · ${q.route.join(" → ") || "Jupiter"} · impact ${impactPct(q).toFixed(2)}%`,
      );
    } catch (e) {
      setRoute(e instanceof Error ? e.message : "Jupiter did not answer.");
    } finally {
      setBusy(null);
    }
  }

  async function buyOne() {
    if (!chosen) return;
    setBusy("buy");
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const done = await runPrestock({
        owner: who,
        mint: chosen.mint,
        side: "buy",
        usd,
        price: chosen.last ?? undefined,
      });
      toast.success(`${chosen.symbol} is in the wallet. ${done.signature.slice(0, 8)}…`);
      rememberTrade({ symbol: chosen.symbol, side: "buy", usd, mint: chosen.mint, signature: done.signature });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The buy did not send.");
    } finally {
      setBusy(null);
    }
  }

  async function sellOne() {
    if (!chosen?.last || !(chosen.last > 0)) return;
    const have = chain?.tokens.find((t) => t.mint === chosen.mint)?.ui ?? 0;
    if (!(have > 0)) {
      toast.error("This wallet holds none of that mint.");
      return;
    }
    setBusy("sell");
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const done = await runPrestock({
        owner: who,
        mint: chosen.mint,
        side: "sell",
        usd: have * chosen.last,
        price: chosen.last,
      });
      toast.success(`Sold ${chosen.symbol}. ${done.signature.slice(0, 8)}…`);
      rememberTrade({ symbol: chosen.symbol, side: "sell", usd: have * chosen.last, mint: chosen.mint, signature: done.signature });
      setRoute("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The sell did not send.");
    } finally {
      setBusy(null);
    }
  }

  const balances = chain
    ? `${chain.sol.toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL · ${usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`
    : "— SOL · — USDC";

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col bg-[#0b0d14]">
      <div className="px-3 pt-3 lg:px-4">
        <JumpStrip />
        <div className="mt-3"><DeskAudit live="A buy here quotes Jupiter, then you sign. The mint lands in this wallet." hold="There is no Senda program id on this path." /></div>
      </div>
      <header className="flex flex-wrap items-end justify-between gap-3 px-3 py-3 lg:px-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-[#c4b5fd] uppercase">Solana</p>
          <h1 className="mt-1 text-2xl tracking-tight">{view === "markets" ? "The book" : "The mints"}</h1>
          <p className="mt-2 text-sm text-white/55">Same book as Trade. A signature shows on Portfolio.</p>
          <div className="mt-2 flex gap-1">
            {([["markets", "Markets"], ["names", "Names"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setView(id)} className={`min-h-9 rounded-full px-3 text-sm font-semibold ${view === id ? "bg-white text-black" : "border border-white/15 text-white/70"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="font-mono text-xs tabular-nums text-white/70">
          PRE8 {idx.n > 0 ? idx.level.toFixed(1) : "—"}
          <span className="text-white/35"> · </span>
          {balances}
          {link ? (
            <span className="text-white/45">
              {" "}
              · {link.address.slice(0, 4)}…{link.address.slice(-4)}
            </span>
          ) : null}
        </p>
      </header>
      <div className="grid min-h-0 flex-1 border-t border-white/10 lg:grid-cols-[minmax(0,1fr)_320px]">
        {view === "markets" ? (
          <div className="min-h-0 lg:col-span-2">
            <TradeTerminal names={house} />
          </div>
        ) : (
        <>
        <div className="min-h-0 overflow-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-[#0b0d14] font-mono text-[10px] tracking-[0.14em] text-white/35 uppercase">
              <tr>
                <th className="px-3 py-2 font-medium lg:px-4">Symbol</th>
                <th className="px-3 py-2 text-right font-medium">Last</th>
                <th className="px-3 py-2 text-right font-medium">Mark</th>
                <th className="px-3 py-2 text-right font-medium lg:pr-4">Held</th>
              </tr>
            </thead>
            <tbody>
              {mints.map((row) => {
                const on = row.mint === chosen?.mint;
                const have = chain?.tokens.find((t) => t.mint === row.mint)?.ui ?? 0;
                return (
                  <tr
                    key={row.mint}
                    onClick={() => {
                      setPick(row.mint);
                      setRoute("");
                    }}
                    className={`cursor-pointer border-t border-white/5 ${on ? "bg-white/10" : "hover:bg-white/[0.04]"}`}
                  >
                    <td className="px-3 py-2 font-semibold lg:px-4">{row.symbol}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {row.last == null ? "—" : formatUsd(row.last)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-white/70">
                      {row.mark == null ? "—" : formatUsd(row.mark)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-white/70 lg:pr-4">
                      {have > 0 ? have.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {mints.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">No live mint.</p>
          ) : null}
        </div>
        <aside className="border-t border-white/10 p-4 lg:border-t-0 lg:border-l">
          <p className="text-4xl tracking-tight">{chosen?.symbol || "—"}</p>
          <p className="mt-2 font-mono text-sm tabular-nums text-white/70">
            Last {chosen?.last == null ? "—" : formatUsd(chosen.last)}
            <span className="text-white/30"> · </span>
            Mark {chosen?.mark == null ? "—" : formatUsd(chosen.mark)}
          </p>
          <p className="mt-1 font-mono text-xs text-white/50">
            Held {chosen ? (chain?.tokens.find((t) => t.mint === chosen.mint)?.ui ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}
          </p>
          <p className="mt-2 break-all font-mono text-[11px] text-white/40">
            {chosen?.mint || "No live mint."}
          </p>
          <div className="mt-4 flex gap-2">
            {SIZES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setUsd(n);
                  setRoute("");
                }}
                className={`min-h-10 flex-1 rounded-full text-sm font-semibold ${usd === n ? "bg-white text-black" : "border border-white/15 text-white/70"}`}
              >
                ${n}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!chosen || busy !== null}
              onClick={() => void quoteOne()}
              className="min-h-12 flex-1 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-50"
            >
              {busy === "quote" ? "Asking Jupiter…" : `Quote $${usd}`}
            </button>
            <button
              type="button"
              disabled={!chosen || busy !== null}
              onClick={() => {
                if (!route.includes("→")) {
                  toast.error("Quote it first. That line is the review.");
                  return;
                }
                void buyOne();
              }}
              className="min-h-12 flex-1 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              {busy === "buy" ? "Waiting for the wallet…" : route.includes("→") ? `Sign $${usd}` : `Buy $${usd}`}
            </button>
          </div>
          <button
            type="button"
            disabled={!chosen || busy !== null || !((chain?.tokens.find((t) => t.mint === chosen.mint)?.ui ?? 0) > 0)}
            onClick={() => void sellOne()}
            className="mt-2 min-h-12 w-full rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40"
          >
            {busy === "sell" ? "Waiting for the wallet…" : "Sell what this wallet holds"}
          </button>
          <button
            type="button"
            disabled={!chosen}
            onClick={() => chosen && copyMint(chosen.symbol, chosen.mint)}
            className="mt-2 min-h-10 w-full rounded-full border border-white/15 text-sm font-semibold disabled:opacity-50"
          >
            Copy mint
          </button>
          {route ? <p className="mt-3 font-mono text-xs text-white/70">{route}</p> : null}
          {link ? null : (
            <div className="mt-4">
              <WalletPicker />
            </div>
          )}
        </aside>
        </>
        )}
      </div>
    </div>
  );
}

function liveMints(house: HouseListing[]) {
  const byMint = new Map<
    string,
    { symbol: string; mint: string; last: number | null; mark: number | null }
  >();
  for (const [symbol, mint] of PRESTOCK_MINTS)
    byMint.set(mint, { symbol, mint, last: null, mark: null });
  for (const row of house) {
    if (row.venue !== "prestocks" || !row.mint) continue;
    byMint.set(row.mint, {
      symbol: row.symbol,
      mint: row.mint,
      last: row.last > 0 ? row.last : null,
      mark: row.mark > 0 ? row.mark : null,
    });
  }
  return [...byMint.values()];
}
