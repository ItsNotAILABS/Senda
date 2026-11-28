import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PrepaidCard } from "@/components/prepaid-card";
import { RevolutOpen } from "@/components/revolut-open";
import { cleanTag, openRevolutApp, readRevolut, saveRevolut, type SleeveCcy } from "@/lib/revolut-link";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const CCYS: SleeveCcy[] = ["USD", "EUR", "GBP", "MXN"];

/** Revolut, where it can be looked at on its own. The balance stays in their app. */
export function RevolutDesk() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const saved = typeof window === "undefined" ? null : readRevolut();
  const [tag, setTag] = useState(saved?.tag ?? "");
  const [ccy, setCcy] = useState<SleeveCcy>("USD");
  const [amount, setAmount] = useState("20");
  const clean = cleanTag(tag);
  const n = Number(amount);

  function keep() {
    if (!clean) {
      toast.error("That Revtag is not valid.");
      return;
    }
    saveRevolut(clean, owner);
    toast.success(`@${clean} is the Revolut tag on this account.`);
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Revolut</p>
        <h1 className="mt-1 text-3xl tracking-tight">Their account. This desk opens it.</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">Senda does not hold a Revolut balance and cannot see one. A Revtag pays inside their app. Crypto comes back only if you paste this Phantom address into Revolut and they send it. The tag is stored with the rest of the sealed desk.</p>
      </header>
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">1 · Pay a tag</p>
          <p className="mt-2 text-sm text-muted">Opens Revolut with the amount. Their app moves the money. This page does not.</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">2 · Crypto back here</p>
          <p className="mt-2 text-sm text-muted">In Revolut: Crypto, Send, paste the Phantom address. USDC or SOL lands on that wallet.</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">3 · Their card</p>
          <p className="mt-2 text-sm text-muted">A virtual card spends money already in Revolut. This desk cannot see that charge.</p>
        </div>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Revtag</p>
        <div className="flex flex-wrap items-end gap-2">
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="@revtag" className="min-h-11 min-w-[12rem] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
          <button type="button" onClick={keep} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black">Keep the tag</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {CCYS.map((id) => (
            <button key={id} type="button" onClick={() => setCcy(id)} className={`rounded-full px-3 py-2 text-xs font-semibold ${ccy === id ? "bg-accent text-accent-fg" : "bg-white/10"}`}>{id}</button>
          ))}
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Amount" className="w-24 bg-transparent font-mono text-3xl outline-none" />
        </div>
        {clean && n > 0 ? (
          <div className="mt-3">
            <RevolutOpen tag={clean} ccy={ccy} amount={n} note="Senda" wallet={owner} product="revolut" usd={n} desk="revolut" />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">A valid tag and an amount open Revolut.</p>
        )}
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Crypto out of Revolut</p>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Revolut does not give this desk a balance. In the Revolut app, Crypto, then Send, then paste this Phantom address. USDC or SOL lands here. Senda does not take custody of the Revolut account.
        </p>
        <p className="mt-3 break-all font-mono text-sm">{owner || "Connect Phantom on the Phantom tab first."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {owner ? <button type="button" onClick={() => void navigator.clipboard.writeText(owner)} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black">Copy Phantom address</button> : null}
          <button type="button" onClick={openRevolutApp} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">Open Revolut</button>
          <Link to="/phantom" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">Phantom</Link>
          <Link to="/books" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">Books</Link>
        </div>
      </section>
      <PrepaidCard owner={owner} />
    </div>
  );
}
