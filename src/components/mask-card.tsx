import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { sendBaseUsdc } from "@/lib/base-usdc";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { connectWallet } from "@/lib/wallets";
import { shortPk } from "@/lib/senda-keys";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

/** MetaMask on Base, and a merchant payment this wallet can actually sign. */
export function MaskCard() {
  const wallet = useWallet();
  const evm = wallet.w.links.find((l) => l.kind === "evm");
  const sol = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const [busy, setBusy] = useState("");
  const [baseTo, setBaseTo] = useState("");
  const [solTo, setSolTo] = useState("");
  const [usd, setUsd] = useState("10");

  async function connect() {
    setBusy("mask");
    try {
      const got = await connectWallet("metamask");
      const linked = wallet.linkChain(got.address, "MetaMask", "evm");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
      toast.success(`MetaMask · ${shortPk(got.address)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MetaMask did not connect.");
    } finally {
      setBusy("");
    }
  }

  async function payBase() {
    setBusy("base");
    try {
      const from = evm?.address || (await connectWallet("metamask")).address;
      if (!evm) {
        const linked = wallet.linkChain(from, "MetaMask", "evm");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
      }
      const hash = await sendBaseUsdc(from, baseTo.trim(), Number(usd));
      toast.success(`Base USDC sent. ${hash.slice(0, 10)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MetaMask did not send it.");
    } finally {
      setBusy("");
    }
  }

  async function paySol() {
    setBusy("sol");
    try {
      const owner = sol?.address || (await connectPhantom());
      if (!sol) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
      }
      const paid = await payUsdc({ owner, to: solTo.trim(), usd: Number(usd) });
      toast.success(`USDC sent. ${paid.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Phantom did not send it.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="font-mono text-[11px] tracking-[0.14em] text-[#c4b5fd] uppercase">MetaMask · Base</p>
      <h2 className="mt-1 text-xl">The other wallet.</h2>
      <p className="mt-2 text-sm text-muted">Gold, oil, and FX sign here. So does USDC on Base. It does not buy a PreStock. Chipotle, Sheetz, and Regal take USDC in the Flexa app, not at an address this page can pay.</p>
      <p className="mt-2 font-mono text-xs text-white/70">{evm ? `MetaMask · ${shortPk(evm.address)}` : "Not connected."}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy !== ""} onClick={() => void connect()} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">{busy === "mask" ? "Waiting…" : evm ? "MetaMask again" : "Connect MetaMask"}</button>
        <Link to="/invest" search={{ desk: "world" }} className="inline-flex min-h-10 items-center rounded-full bg-white/10 px-4 text-sm font-semibold">Gold, oil, FX</Link>
      </div>
      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        <label className="block text-xs text-subtle">
          Base address a merchant gave you
          <input value={baseTo} onChange={(e) => setBaseTo(e.target.value.trim())} placeholder="0x…" spellCheck={false} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
          <button type="button" disabled={busy !== ""} onClick={() => void payBase()} className="mt-2 min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">{busy === "base" ? "Waiting on MetaMask" : `Send $${usd || "0"} USDC on Base`}</button>
        </label>
        <label className="block text-xs text-subtle">
          Solana address a merchant gave you
          <input value={solTo} onChange={(e) => setSolTo(e.target.value.trim())} placeholder="Solana address" spellCheck={false} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
          <button type="button" disabled={busy !== ""} onClick={() => void paySol()} className="mt-2 min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">{busy === "sol" ? "Waiting on Phantom" : `Send $${usd || "0"} USDC on Solana`}</button>
        </label>
      </div>
      <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="USDC to the merchant" className="mt-3 w-28 bg-transparent font-mono text-2xl outline-none" />
    </section>
  );
}
