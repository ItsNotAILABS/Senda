import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FillButton } from "@/components/fill-button";
import { WalletPicker } from "@/components/wallet-picker";
import { PRESTOCK_MINTS, readChain, type ChainWallet } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export function WalletDesk() {
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const owner = link?.address ?? "";
  const [snap, setSnap] = useState<ChainWallet | null>(null);
  const [err, setErr] = useState("");

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
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  const usdc = snap?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;
  const held = new Map(snap?.tokens.map((t) => [t.mint, t.ui]) ?? []);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="border-b border-border px-5 py-6 lg:px-8 xl:border-r xl:border-b-0">
        <h1 className="font-display text-4xl">Wallet</h1>
        {owner ? (
          <>
            <p className="mt-2 font-mono text-sm">{owner}</p>
            <p className="mt-1 text-sm text-muted">{link?.label}. Read from Solana. The key stays in the extension.</p>
            <p className="mt-6 font-display text-6xl tabular-nums">${usdc.toFixed(2)}</p>
            <p className="text-sm text-muted">USDC in this wallet{snap ? ` · ${snap.sol.toFixed(4)} SOL` : ""}</p>
            {err ? <p className="mt-3 text-sm text-down">{err}</p> : null}
            <h2 className="mt-8 text-sm font-semibold">Tokens</h2>
            <ul className="mt-2 divide-y divide-border">
              {(snap?.tokens ?? []).map((t) => (
                <li key={t.mint} className="flex items-baseline justify-between py-2 text-sm">
                  <span>
                    {t.symbol}
                    <span className="ml-2 font-mono text-[11px] text-subtle">{t.mint.slice(0, 4)}…{t.mint.slice(-4)}</span>
                  </span>
                  <span className="font-mono tabular-nums">{t.ui.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>
                </li>
              ))}
              {snap && snap.tokens.length === 0 ? <li className="py-3 text-sm text-muted">No tokens in this account.</li> : null}
              {!snap && !err ? <li className="py-3 text-sm text-muted">Reading the chain…</li> : null}
            </ul>
            <h2 className="mt-8 text-sm font-semibold">Recent</h2>
            <ul className="mt-2 divide-y divide-border">
              {(snap?.txs ?? []).map((t) => (
                <li key={t.signature} className="py-2">
                  <a href={`https://solscan.io/tx/${t.signature}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent">
                    {t.signature.slice(0, 8)}…{t.signature.slice(-6)}
                  </a>
                  <span className="ml-2 text-xs text-subtle">{t.err ? "failed" : "ok"}</span>
                </li>
              ))}
            </ul>
            <a href={`https://solscan.io/account/${owner}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm text-muted">
              Open the account
            </a>
          </>
        ) : (
          <p className="mt-2 max-w-md text-sm text-muted">
            Connect the wallet you already fund. Senda reads it. Swaps sign there.
          </p>
        )}
        <div className="mt-6 max-w-xl">
          <WalletPicker />
        </div>
      </section>
      <aside className="px-5 py-6 lg:px-6">
        <h2 className="text-sm font-semibold">PreStocks in this wallet</h2>
        <ul className="mt-3 divide-y divide-border">
          {PRESTOCK_MINTS.map(([symbol, mint]) => {
            const n = held.get(mint) ?? 0;
            return (
              <li key={mint} className="py-3">
                <div className="flex items-baseline justify-between">
                  <Link to="/pre" className="text-sm font-semibold">
                    {symbol}
                  </Link>
                  <span className="font-mono text-sm tabular-nums">{n > 0 ? n.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "0"}</span>
                </div>
                {owner ? (
                  <FillButton mint={mint} usd={10} label={n > 0 ? "Buy $10 more" : "Buy $10"} className="mt-2 text-xs font-semibold text-accent" />
                ) : null}
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
