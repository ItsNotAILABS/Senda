import { useState } from "react";
import { toast } from "sonner";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { rememberTrade } from "@/lib/trade-log";
import { CCYS, CCY_META, formatMoney, type Ccy } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const CARDS = "senda.cardfund.v2";
const BANK = "bitso.deposit.v1";

function readAddr(key: string, field?: string): string {
  try {
    const raw = localStorage.getItem(key) || "";
    if (!field) return raw.trim();
    const parsed = JSON.parse(raw) as Record<string, string>;
    return (parsed[field] || "").trim();
  } catch {
    return "";
  }
}

/** Move a browser lane, or match it to a Phantom USDC send onto a saved card or bank address. */
export function BrowserBook() {
  const wallet = useWallet();
  const [from, setFrom] = useState<Ccy>("USD");
  const [to, setTo] = useState<Ccy>("MXN");
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState("");
  const rows = CCYS.filter((c) => wallet.w.opened.includes(c) || (wallet.w.balances[c] || 0) > 0 || c === "USD" || c === "MXN");
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";

  function dollars(n: number, ccy: Ccy): number {
    if (ccy === "USD" || ccy === "USDC") return n;
    const px = wallet.usdPer[ccy] || 0;
    return px > 0 ? n * px : 0;
  }

  function move() {
    const n = Number(amt);
    if (!(n > 0)) {
      toast.error("Enter an amount.");
      return;
    }
    const r = wallet.convert(from, to, n);
    if (!r.ok) {
      toast.error(r.error || "That lane did not move.");
      return;
    }
    setAmt("");
    toast.success(`${formatMoney(n, from)} is now ${CCY_META[to].name}. Still in this browser.`);
  }

  async function leave(kind: "card" | "bank") {
    const n = Number(amt);
    if (!(n > 0)) {
      toast.error("Enter an amount.");
      return;
    }
    const usd = Math.round(dollars(n, from) * 100) / 100;
    if (!(usd >= 0.01)) {
      toast.error("No dollar price for that lane.");
      return;
    }
    const dest = kind === "card" ? readAddr(CARDS, "jupiter") : readAddr(BANK);
    if (!dest) {
      toast.error(kind === "card" ? "Paste the Jupiter address once under Cards. It stays." : "Paste the Bitso Solana address once on Send. It stays.");
      return;
    }
    setBusy(kind);
    try {
      const who = owner || (await connectPhantom());
      const paid = await payUsdc({ owner: who, to: dest, usd, memo: kind === "card" ? "Jupiter" : "Bitso" });
      const booked = wallet.match(n, from, kind === "card" ? "Jupiter" : "Bitso", paid.signature);
      if (!booked.ok) toast.error(booked.error || "Phantom signed. The browser book did not move.");
      rememberTrade({ symbol: "USDC", side: "send", usd, mint: USDC, signature: paid.signature });
      setAmt("");
      toast.success(kind === "card" ? `On the Jupiter card. ${paid.signature.slice(0, 8)}…` : `At Bitso. They credit the dollars. ${paid.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nothing left the wallet.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Browser book</p>
      <h2 className="mt-1 font-display text-2xl tracking-tight">Move it, or send it out.</h2>
      <p className="mt-1 max-w-lg text-sm text-muted">Between lanes, it stays in this browser. Onto the card or toward the bank, Phantom sends the same dollars in USDC, then this book drops by that amount. No address, no send.</p>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((c) => (
          <li key={c}>
            <button type="button" onClick={() => setFrom(c)} className={cn("w-full rounded-2xl px-3 py-3 text-left", from === c ? "bg-white text-black" : "bg-black/40")}>
              <span className="block text-xs">{CCY_META[c].name}</span>
              <span className="mt-1 block font-mono text-lg tabular-nums">{formatMoney(wallet.w.balances[c] || 0, c)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <label className="text-xs text-muted">
          From
          <select value={from} onChange={(e) => setFrom(e.target.value as Ccy)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white">
            {rows.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => { setFrom(to); setTo(from); }} className="mt-5 min-h-11 rounded-full border border-white/10 px-4 text-xs font-semibold">Swap</button>
        <label className="text-xs text-muted">
          Into
          <select value={to} onChange={(e) => setTo(e.target.value as Ccy)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white">
            {rows.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Amount" aria-label="Amount to move" className="mt-3 w-full bg-transparent font-mono text-4xl outline-none" />
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button type="button" disabled={busy !== ""} onClick={move} className="min-h-12 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">Move into {to}</button>
        <button type="button" disabled={busy !== ""} onClick={() => void leave("card")} className="min-h-12 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">{busy === "card" ? "Waiting on Phantom" : "Onto Jupiter"}</button>
        <button type="button" disabled={busy !== ""} onClick={() => void leave("bank")} className="min-h-12 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">{busy === "bank" ? "Waiting on Phantom" : "Toward Bitso"}</button>
      </div>
    </section>
  );
}
