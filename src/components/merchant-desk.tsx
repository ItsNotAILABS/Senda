import { useState } from "react";
import { Keypair } from "@solana/web3.js";
import { toast } from "sonner";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom } from "@/lib/phantom";
import { parseTransfer, payUsdc, transferRequest, USDC_MINT } from "@/lib/solana-pay";
import { rememberTrade } from "@/lib/trade-log";
import { cn } from "@/lib/utils";

const WINDOWS = [
  { id: "15m", label: "15 min", ms: 15 * 60 * 1000 },
  { id: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { id: "1d", label: "1 day", ms: 24 * 60 * 60 * 1000 },
] as const;

function expiry(memo?: string): number | null {
  const hit = memo?.match(/exp=(\d+)/);
  return hit ? Number(hit[1]) : null;
}

/** Pay a shop in USDC, or hand them a bill that dies on a clock. Phantom signs the payment. */
export function MerchantDesk({ owner }: { owner: string }) {
  const [bill, setBill] = useState("");
  const [usd, setUsd] = useState("5");
  const [note, setNote] = useState("");
  const [shop, setShop] = useState("");
  const [windowId, setWindowId] = useState<(typeof WINDOWS)[number]["id"]>("1h");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState("");

  async function pay() {
    const text = bill.trim();
    setBusy("pay");
    try {
      let to = text;
      let amount = Number(usd);
      let memo = note;
      if (text.toLowerCase().startsWith("solana:")) {
        const parsed = parseTransfer(text);
        if ("error" in parsed) throw new Error(parsed.error);
        if (parsed.splToken && parsed.splToken !== USDC_MINT.toBase58()) throw new Error("This bill is not USDC.");
        const dies = expiry(parsed.memo);
        if (dies && Date.now() > dies) throw new Error("This bill has expired. Ask them for a new one.");
        to = parsed.recipient;
        if (parsed.amount) amount = parsed.amount;
        memo = parsed.memo || parsed.message || note;
      }
      if (!(amount >= 0.01)) throw new Error("Enter what the bill is for.");
      const who = owner || (await connectPhantom());
      const paid = await payUsdc({ owner: who, to, usd: amount, memo: memo || "merchant" });
      rememberTrade({ symbol: "USDC", side: "send", usd: amount, mint: USDC, signature: paid.signature });
      toast.success(`Paid. ${paid.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The shop was not paid.");
    } finally {
      setBusy("");
    }
  }

  async function ask() {
    const amount = Number(usd);
    if (!(amount >= 0.01)) {
      toast.error("Name the amount.");
      return;
    }
    setBusy("ask");
    try {
      const who = owner || (await connectPhantom());
      const span = WINDOWS.find((row) => row.id === windowId) ?? WINDOWS[1];
      const dies = Date.now() + span.ms;
      const next = transferRequest({
        recipient: who,
        amount,
        splToken: USDC_MINT.toBase58(),
        reference: Keypair.generate().publicKey.toBase58(),
        label: shop.trim() || "Senda",
        message: note.trim() || "USDC",
        memo: `exp=${dies} ${note.trim()}`.trim(),
      });
      setLink(next);
      toast.success(`This bill dies at ${new Date(dies).toLocaleTimeString()}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The bill was not made.");
    } finally {
      setBusy("");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Bill copied.");
    } catch {
      toast.error("Could not copy the bill.");
    }
  }

  return (
    <section className="space-y-4 rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Merchant</p>
      <h2 className="font-display text-2xl tracking-tight">Pay a shop. Or get paid.</h2>
      <p className="max-w-lg text-sm text-muted">USDC on Solana. On a phone, Pay opens Phantom and you approve there. A bill is a solana: link with a clock. After the clock, this desk will not pay it.</p>
      <div>
        <p className="text-sm font-semibold">Pay</p>
        <textarea value={bill} onChange={(e) => setBill(e.target.value.trim())} rows={2} placeholder="Their address, or a solana: bill" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs" />
      </div>
      <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Dollars" className="w-full bg-transparent font-mono text-4xl outline-none" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What this is for" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
      <button type="button" disabled={busy !== ""} onClick={() => void pay()} className="min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        {busy === "pay" ? "Waiting on Phantom" : "Pay"}
      </button>
      <div className="border-t border-white/10 pt-4">
        <p className="text-sm font-semibold">Get paid</p>
        <p className="mt-1 text-xs text-muted">The bill pays this Phantom. Hand the link to the buyer. On their phone it opens Phantom.</p>
        <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Shop name" className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
        <div className="mt-2 flex gap-1">
          {WINDOWS.map((row) => (
            <button key={row.id} type="button" onClick={() => setWindowId(row.id)} className={cn("min-h-9 flex-1 rounded-full text-xs font-semibold", windowId === row.id ? "bg-white text-black" : "border border-white/10 text-muted")}>{row.label}</button>
          ))}
        </div>
        <button type="button" disabled={busy !== ""} onClick={() => void ask()} className="mt-2 min-h-11 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
          {busy === "ask" ? "…" : "Make a bill"}
        </button>
        {link ? (
          <div className="mt-3 space-y-2">
            <p className="break-all font-mono text-[11px] text-subtle">{link}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void copy()} className="min-h-10 flex-1 rounded-full border border-white/10 text-xs font-semibold">Copy</button>
              <a href={link} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-fg">Open in Phantom</a>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
