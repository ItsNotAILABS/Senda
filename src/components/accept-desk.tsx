import { useState } from "react";
import { toast } from "sonner";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export function parsePayRequest(raw: string): { to: string; usd: number; memo: string } {
  const text = raw.trim();
  if (!text) return { to: "", usd: 0, memo: "" };
  if (text.startsWith("solana:")) {
    const body = text.slice("solana:".length);
    const [addr, query] = body.split("?");
    const params = new URLSearchParams(query || "");
    return {
      to: decodeURIComponent(addr || ""),
      usd: Number(params.get("amount") || 0),
      memo: params.get("memo") || params.get("label") || "",
    };
  }
  return { to: text, usd: 0, memo: "" };
}

export function AcceptDesk({ initialTo = "", initialUsd = "", initialMemo = "" }: { initialTo?: string; initialUsd?: string; initialMemo?: string }) {
  const wallet = useWallet();
  const seeded = parsePayRequest(initialTo.startsWith("solana:") ? initialTo : "");
  const [to, setTo] = useState(seeded.to || initialTo);
  const [usd, setUsd] = useState(seeded.usd ? String(seeded.usd) : initialUsd);
  const [memo, setMemo] = useState(seeded.memo || initialMemo);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);

  function applyPaste() {
    const parsed = parsePayRequest(paste);
    if (parsed.to) setTo(parsed.to);
    if (parsed.usd > 0) setUsd(String(parsed.usd));
    if (parsed.memo) setMemo(parsed.memo);
  }

  async function pay() {
    const amount = Number(usd);
    if (!to.trim() || !(amount > 0)) {
      toast.error("Need an address and an amount.");
      return;
    }
    setBusy(true);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const done = await payUsdc({ owner, to: to.trim(), usd: amount, memo: memo || "Senda pay" });
      toast.success(`Paid. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The payment did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-4">
      <h1 className="text-2xl tracking-tight">Accept</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Paste a solana: link, or fill the address and the USDC amount. You sign. The USDC leaves this wallet. This is not a card charge.
      </p>
      <textarea
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        placeholder="solana:address?amount=25&spl-token=…"
        className="mt-4 min-h-20 w-full rounded-2xl bg-elevated px-4 py-3 font-mono text-xs outline-none"
      />
      <button type="button" onClick={applyPaste} className="mt-2 min-h-10 rounded-full bg-elevated px-4 text-xs font-semibold">
        Read the link
      </button>
      <div className="mt-4 grid gap-2">
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana address" className="min-h-12 rounded-2xl bg-elevated px-4 font-mono text-xs outline-none" />
        <input inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} placeholder="USDC" className="min-h-12 rounded-2xl bg-elevated px-4 font-mono text-lg outline-none" />
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Memo" className="min-h-12 rounded-2xl bg-elevated px-4 text-sm outline-none" />
      </div>
      <button type="button" disabled={busy} onClick={() => void pay()} className="mt-4 min-h-12 w-full rounded-full bg-fg text-sm font-semibold text-bg disabled:opacity-50">
        {busy ? "Waiting for the wallet…" : "Pay USDC"}
      </button>
    </div>
  );
}
