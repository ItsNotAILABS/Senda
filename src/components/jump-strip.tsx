import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { loadClearing } from "@/lib/clearing";
import { buildPicture, quoteHeld, type Picture } from "@/lib/money-picture";
import { readChain, pickOwner } from "@/lib/phantom";
import { loadPulse, type TapeRow } from "@/lib/universe";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const EMPTY: Picture = {
  total: 0, sol: 0, solUsd: 0, usdc: 0, phantomCash: 0, cash: 0, companies: 0, crypto: 0, listed: 0, posted: 0, lines: [], open: [],
};

/** The same money count as the home, on every desk. */
export function JumpStrip() {
  const wallet = useWallet();
  const owner = pickOwner(wallet.w.links);
  const [pic, setPic] = useState<Picture>(EMPTY);
  const [pulse, setPulse] = useState<{ ms: number; slot: number } | null>(null);
  const [tape, setTape] = useState<TapeRow[]>([]);

  useEffect(() => {
    let live = true;
    const cash =
      (wallet.w.balances.USD || 0) +
      (wallet.w.balances.EUR || 0) * (wallet.usdPer.EUR || 0) +
      (wallet.w.balances.GBP || 0) * (wallet.usdPer.GBP || 0) +
      (wallet.w.balances.MXN || 0) * (wallet.usdPer.MXN || 0) +
      (wallet.w.vaults || []).reduce((s, v) => s + v.balance * (wallet.usdPer[v.ccy] || 0), 0);
    Promise.all([
      owner ? readChain(owner) : Promise.resolve(null),
      loadClearing().catch(() => null),
    ]).then(async ([chain, house]) => {
      if (!live) return;
      const tapeNow = await quoteHeld((chain?.tokens || []).map((t) => t.mint), tape).catch(() => tape);
      if (!live) return;
      setPic(
        buildPicture({
          owner,
          sol: chain?.sol || 0,
          tokens: chain?.tokens || [],
          tape: tapeNow,
          cash,
          house: house as Parameters<typeof buildPicture>[0]["house"],
        }),
      );
    });
    return () => {
      live = false;
    };
  }, [owner, wallet.w.balances, wallet.w.vaults, wallet.usdPer, tape]);

  useEffect(() => {
    let live = true;
    const pull = () => {
      loadPulse()
        .then((p) => {
          if (!live) return;
          setTape(p.rows);
          setPulse({ ms: p.ms, slot: p.slot });
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 8000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  const cell = (k: string, v: string) => (
    <span className="px-3 py-2">
      <span className="block text-[10px] tracking-wide text-subtle uppercase">{k}</span>
      <span className="font-mono text-sm tabular-nums">{v}</span>
    </span>
  );

  return (
    <div className="flex items-stretch overflow-x-auto rounded-2xl border border-white/10 bg-[#10131c]">
      <Link to="/" className="shrink-0 px-4 py-2">
        <span className="block text-[10px] tracking-wide text-subtle uppercase">Your money</span>
        <span className="font-mono text-lg tabular-nums">${pic.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        {pulse ? <span className="block font-mono text-[10px] text-subtle">{pulse.ms}ms · slot {pulse.slot.toLocaleString("en-US")}</span> : null}
      </Link>
      {cell("SOL", pic.sol > 0 ? `${pic.sol.toFixed(4)}${pic.solUsd > 0 ? ` · $${pic.solUsd.toFixed(0)}` : ""}` : "—")}
      {cell("USDC", pic.usdc ? `$${pic.usdc.toFixed(2)}` : "—")}
      {cell("CASH", pic.phantomCash ? `$${pic.phantomCash.toFixed(2)}` : "—")}
      {cell("Book", pic.cash ? `$${pic.cash.toFixed(0)}` : "—")}
      {cell("Companies", pic.companies ? `$${pic.companies.toFixed(0)}` : "—")}
      {cell("Crypto", pic.crypto ? `$${pic.crypto.toFixed(0)}` : "—")}
      {cell("Listed", pic.listed ? `$${pic.listed.toFixed(0)}` : "—")}
      {cell("In a pot", pic.posted ? `$${pic.posted.toFixed(0)}` : "—")}
    </div>
  );
}
