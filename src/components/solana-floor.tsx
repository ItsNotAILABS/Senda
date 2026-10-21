import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { FilmBand } from "@/components/film-band";
import { MoneyBar } from "@/components/money-bar";
import { TabLead } from "@/components/tab-lead";
import { WalletPicker } from "@/components/wallet-picker";
import { ChainTapeView } from "@/components/chain-tape";
import type { ChainTape } from "@/lib/chain-tape";
import { PRESTOCK_MINTS, connectPhantom, readChain } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { pre8 } from "@/lib/pre8";
import { formatUsd, formatValuation, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export function SolanaFloor({ house, tape }: { house: HouseListing[]; tape: ChainTape }) {
  const idx = pre8(house);
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const legs = [...idx.legs].sort((a, b) => b.valuation - a.valuation);
  const mints = liveMints(house);
  const [held, setHeld] = useState<Record<string, number>>({});
  const [sol, setSol] = useState<number | null>(null);
  const [usdc, setUsdc] = useState<number | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!link?.address) {
      setHeld({});
      setSol(null);
      setUsdc(null);
      return;
    }
    let live = true;
    readChain(link.address)
      .then((snap) => {
        if (!live) return;
        const next: Record<string, number> = {};
        for (const token of snap.tokens) next[token.mint] = token.ui;
        setHeld(next);
        setSol(snap.sol);
        setUsdc(snap.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [link?.address]);

  async function buy(row: { symbol: string; mint: string; last: number | null; mark: number | null }) {
    setBusy(row.symbol);
    try {
      const owner = link?.address || (await connectPhantom());
      const done = await runPrestock({ owner, mint: row.mint, side: "buy", usd: 1, price: row.last ?? undefined });
      toast.success(`Signed. ${done.outUi.toFixed(4)} ${row.symbol} lands in this wallet.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The buy did not sign.");
    } finally {
      setBusy("");
    }
  }

  function copyMint(symbol: string, mint: string) {
    void navigator.clipboard?.writeText(mint).then(
      () => toast.success(`${symbol} mint copied.`),
      () => toast.error("Could not copy that mint."),
    );
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Solana"
        title="The mints"
        accent="you sign."
        line="Pick a name. You sign. It lands in this wallet. A buy here quotes Jupiter, then you sign. There is no Senda program id on this path."
        live={["Jupiter quote, then your signature.", idx.n > 0 ? `PRE8 ${idx.level.toFixed(1)}` : "PRE8 when this book has marks."]}
        coming={["A Senda program id."]}
      />
      <MoneyBar />
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-3xl tracking-tight">Pick a name</h2>
            <p className="mt-1 text-sm text-muted">Last and mark are the live book. Held is this wallet. Sign buys $1 through Jupiter.</p>
          </div>
          <p className="font-mono text-sm tabular-nums text-subtle">
            {idx.n > 0 ? `PRE8 ${idx.level.toFixed(1)}` : "PRE8 —"}
            {" · "}
            {sol == null ? "— SOL" : `${sol.toFixed(3)} SOL`}
            {" · "}
            {usdc == null ? "— USDC" : `${usdc.toFixed(2)} USDC`}
          </p>
        </div>
        {mints.length === 0 ? (
          <p className="mt-5 text-sm text-subtle">None.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">
                  <th className="py-2 font-medium">Symbol</th>
                  <th className="py-2 text-right font-medium">Last</th>
                  <th className="py-2 text-right font-medium">Mark</th>
                  <th className="py-2 text-right font-medium">Held</th>
                  <th className="py-2 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {mints.map((row) => (
                  <tr key={row.mint} className="border-t border-white/10">
                    <td className="py-3 font-semibold">{row.symbol}</td>
                    <td className="py-3 text-right font-mono tabular-nums">{row.last == null ? "—" : formatUsd(row.last)}</td>
                    <td className="py-3 text-right font-mono tabular-nums text-muted">{row.mark == null ? "—" : formatUsd(row.mark)}</td>
                    <td className="py-3 text-right font-mono tabular-nums text-muted">{held[row.mint] ? held[row.mint].toFixed(4) : "—"}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        disabled={busy === row.symbol}
                        onClick={() => void buy(row)}
                        className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-60"
                      >
                        {busy === row.symbol ? "Signing…" : "Sign $1"}
                      </button>
                      <button type="button" onClick={() => copyMint(row.symbol, row.mint)} className="ml-2 min-h-11 rounded-full border border-white/10 px-3 text-sm">
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ChainTapeView tape={tape} />
      <section className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-6 lg:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Solana</p>
          <h1 className="mt-3 text-4xl leading-[1.05] tracking-tight lg:text-6xl">
            PRE8 <span className="font-mono text-accent">{idx.level.toFixed(1)}</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted">
            {idx.n} PreStocks, weighted by mark value. 1000 means the token price matches the mark. They are SPL tokens. You buy them here. Jupiter builds the route. You sign.
          </p>
          <p className="mt-4 font-mono text-sm text-muted">Mark value {formatValuation(idx.tv)}</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <p className="text-sm font-semibold">Your signer</p>
          <p className="mt-2 text-sm text-muted">
            {link ? `${link.label} · ${link.address.slice(0, 4)}…${link.address.slice(-4)}` : "No wallet yet. The index is live. A buy waits until you connect."}
          </p>
          <div className="mt-4">{link ? null : <WalletPicker />}</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link to="/pre" className="flex min-h-12 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg">Buy a name</Link>
            <Link to="/wallet" className="flex min-h-12 items-center justify-center rounded-full bg-[#9945ff]/20 text-sm font-semibold text-[#d8b4fe]">Convert SOL</Link>
          </div>
        </div>
      </section>
      <FilmBand poster="/images/orbit.jpg" label="SPL. On Solana." />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-lg">The names</h2>
          <ul className="mt-3 space-y-3">
            {legs.map((r) => {
              const ratio = r.mark > 0 ? r.last / r.mark : 1;
              const width = Math.max(8, Math.min(100, ratio * 50));
              return (
                <li key={r.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold">{r.symbol}</span>
                    <span className="font-mono text-xs text-muted">
                      {formatUsd(r.last)} token · {formatUsd(r.mark)} mark · {formatValuation(r.valuation)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-accent" style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-3">
          <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
            <h2 className="text-lg">What a buy actually does</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>Jupiter builds the route inside Senda.</li>
              <li>Only SOL, USDC, and these mints are allowed.</li>
              <li>The chain simulates it. A failing route never reaches the wallet.</li>
              <li>Impact over 5% is refused. You sign. The key never comes here.</li>
              <li>Minting or redeeming with the issuer is not this page.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function liveMints(house: HouseListing[]) {
  const byMint = new Map<string, { symbol: string; mint: string; last: number | null; mark: number | null }>();
  for (const [symbol, mint] of PRESTOCK_MINTS) byMint.set(mint, { symbol, mint, last: null, mark: null });
  for (const row of house) {
    if (row.venue !== "prestocks" || !row.mint) continue;
    byMint.set(row.mint, { symbol: row.symbol, mint: row.mint, last: row.last, mark: row.mark });
  }
  return [...byMint.values()];
}
