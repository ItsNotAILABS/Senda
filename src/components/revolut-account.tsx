import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const CCY = ["USD", "EUR", "GBP", "MXN"] as const;
const KEY = "senda.revtag.v1";

function loadTag() {
  if (typeof window === "undefined") return "";
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as { tag?: string } | null;
    return raw?.tag ?? "";
  } catch {
    return "";
  }
}

function clean(tag: string) {
  return tag.trim().replace(/^@/, "").toLowerCase();
}

export function RevolutAccount() {
  const { w } = useWallet();
  const owner = w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [tag, setTag] = useState(loadTag);
  const [ccy, setCcy] = useState<(typeof CCY)[number]>("USD");
  const [amount, setAmount] = useState("20");
  const kept = clean(tag);
  const n = Number(amount);

  function save() {
    if (!/^[a-z0-9_]{3,16}$/.test(kept)) return toast.error("That Revtag is not valid.");
    localStorage.setItem(KEY, JSON.stringify({ tag: kept, owner }));
    toast.success(`@${kept} is the Revolut tag on this account.`);
  }

  function open() {
    if (!kept || !(n > 0)) return toast.error("A valid tag and an amount open Revolut.");
    window.open(`https://revolut.me/${kept}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Revolut</p>
        <h1 className="mt-1 text-3xl tracking-tight">Their account. This desk opens it.</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">Senda does not hold a Revolut balance and cannot see one.</p>
      </header>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="font-semibold">1 · Pay a tag</h2>
        <p className="mt-1 text-sm text-muted">Opens Revolut with the amount. Their app moves the money. This page does not.</p>
        <h2 className="mt-4 font-semibold">2 · Crypto back here</h2>
        <p className="mt-1 text-sm text-muted">In Revolut: Crypto, Send, paste the Phantom address. USDC or SOL lands on that wallet.</p>
        <h2 className="mt-4 font-semibold">3 · Their card</h2>
        <p className="mt-1 text-sm text-muted">A virtual card spends money already in Revolut. This desk cannot see that charge.</p>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="font-semibold">Revtag</h2>
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="@tag" className="mt-3 min-h-11 w-full rounded-full bg-black/40 px-4 outline-none" />
        <button type="button" onClick={save} className="mt-3 min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold">
          Keep the tag
        </button>
        <div className="mt-3 flex gap-1">
          {CCY.map((id) => (
            <button key={id} type="button" onClick={() => setCcy(id)} className={id === ccy ? "min-h-9 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-9 rounded-full px-3 text-sm text-white/60"}>
              {id}
            </button>
          ))}
        </div>
        <input aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="mt-3 min-h-11 w-full rounded-full bg-black/40 px-4 font-mono outline-none" />
        {kept && n > 0 ? (
          <button type="button" onClick={open} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
            Open Revolut · {n} {ccy}
          </button>
        ) : (
          <p className="mt-3 text-sm text-muted">A valid tag and an amount open Revolut.</p>
        )}
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="font-semibold">Crypto out of Revolut</h2>
        <p className="mt-1 font-mono text-sm text-muted">{owner || "Connect Phantom first."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {owner ? (
            <button type="button" onClick={() => void navigator.clipboard.writeText(owner).then(() => toast.success("Copied."))} className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold">
              Copy Phantom address
            </button>
          ) : null}
          <button type="button" onClick={() => window.open("https://app.revolut.com", "_blank", "noopener,noreferrer")} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black">
            Open Revolut
          </button>
          <Link to="/phantom" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
            Phantom
          </Link>
          <Link to="/books" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
            Books
          </Link>
        </div>
      </section>
    </div>
  );
}
