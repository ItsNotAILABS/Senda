import { useState } from "react";
import { toast } from "sonner";
import { PayQr } from "@/components/pay-qr";
import { PayScan } from "@/components/pay-scan";
import { readPayCode } from "@/lib/qr-pay";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc, transferRequest, USDC_MINT } from "@/lib/solana-pay";
import { spendCap } from "@/lib/spend-cap";
import { useWalletCtx } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const PRESETS = [5, 10, 25, 50] as const;

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function short(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

/** USDC leaves this Phantom. A code can fill the person. The wallet still signs. */
export function WalletSend() {
  const wallet = useWalletCtx();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [to, setTo] = useState("");
  const [usd, setUsd] = useState("10");
  const [note, setNote] = useState("");
  const [who, setWho] = useState("");
  const [scan, setScan] = useState(false);
  const [phase, setPhase] = useState<"ready" | "leaving" | "sent">("ready");
  const [sig, setSig] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [sentUsd, setSentUsd] = useState(0);
  const [err, setErr] = useState("");
  const amount = Number(usd);
  const mine = owner ? transferRequest({ recipient: owner, splToken: USDC_MINT.toBase58(), label: "Senda", message: "USDC" }) : "";

  function take(text: string) {
    const row = readPayCode(text);
    if (!row.ok) {
      setErr(row.error);
      toast.error(row.error);
      return;
    }
    setTo(row.to);
    setWho(row.label || row.message || "");
    if (row.amount && row.amount > 0) setUsd(String(row.amount));
    if (row.memo) setNote(row.memo);
    setErr("");
    setScan(false);
    setPhase("ready");
  }

  async function send() {
    if (!(amount > 0) || !to.trim()) return;
    if (amount > spendCap()) {
      setErr(`That is over the send cap of ${money(spendCap())}.`);
      return;
    }
    setPhase("leaving");
    setErr("");
    try {
      const whoAddr = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(whoAddr, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
      }
      const paid = await payUsdc({ owner: whoAddr, to: to.trim(), usd: amount, memo: note.trim() || "send" });
      setSig(paid.signature);
      setSentTo(to.trim());
      setSentUsd(amount);
      setPhase("sent");
    } catch (e) {
      setPhase("ready");
      setErr(e instanceof Error ? e.message : "The wallet did not sign.");
    }
  }

  if (phase === "sent") {
    return (
      <section className="senda-sheet overflow-hidden rounded-[28px] border border-white/10 bg-[#10131c] p-5">
        <div className="senda-pop mx-auto grid size-16 place-items-center rounded-full bg-[#d7e36a] text-2xl font-semibold text-black">✓</div>
        <p className="mt-4 text-center text-[11px] tracking-[0.16em] text-[#c6f56a] uppercase">Sent</p>
        <p className="mt-1 text-center font-mono text-5xl tabular-nums">{money(sentUsd)}</p>
        <p className="mt-2 text-center text-sm text-white/55">USDC left this wallet for {short(sentTo)}.</p>
        <a className="mt-4 block truncate text-center font-mono text-xs text-[#c6f56a]" href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer">{sig}</a>
        <button
          type="button"
          onClick={() => { setPhase("ready"); setSig(""); setTo(""); setWho(""); }}
          className="mt-4 min-h-12 w-full rounded-full bg-white text-sm font-semibold text-black"
        >
          Send another
        </button>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#10131c] p-5">
      {phase === "leaving" ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-[#07070f]/92 p-5">
          <div className="relative mb-8 h-16">
            <span className="absolute top-6 left-[12%] size-3 rounded-full bg-white/30" />
            <span className="absolute top-6 right-[12%] size-3 rounded-full bg-[#d7e36a]" />
            <span className="senda-coin absolute top-4 size-8 rounded-full bg-[#d7e36a] shadow-[0_0_18px_#d7e36a]" />
          </div>
          <p className="text-[11px] tracking-[0.16em] text-[#c6f56a] uppercase">Leaving this wallet</p>
          <p className="mt-1 font-mono text-4xl tabular-nums">{money(amount)}</p>
          <p className="mt-2 text-sm text-white/60">Phantom has the signature. Nothing has left until you approve it.</p>
        </div>
      ) : null}
      <p className="text-[11px] tracking-[0.16em] text-[#c6f56a] uppercase">Send</p>
      <h2 className="mt-1 text-2xl tracking-tight">USDC from this wallet</h2>
      <p className="mt-1 text-sm text-white/50">Scan a Solana code, or show yours. The amount moves only after Phantom signs.</p>
      <div className="mt-4 flex items-end gap-1">
        <span className="mb-1 font-mono text-4xl text-white/40">$</span>
        <input
          value={usd}
          onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          aria-label="Dollars to send"
          className="w-full bg-transparent font-mono text-5xl tabular-nums outline-none"
        />
      </div>
      <div className="mt-3 flex gap-2">
        {PRESETS.map((n) => (
          <button key={n} type="button" onClick={() => setUsd(String(n))} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", Number(usd) === n ? "bg-white text-black" : "bg-white/10")}>
            ${n}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => setScan((v) => !v)} className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold", scan ? "bg-white text-black" : "bg-[#d7e36a] text-black")}>
          {scan ? "Close scanner" : "Scan a code"}
        </button>
      </div>
      {scan ? (
        <div className="senda-sheet mt-3">
          <PayScan onCode={take} />
        </div>
      ) : null}
      <label className="mt-3 block">
        <span className="text-[11px] tracking-[0.14em] text-white/40 uppercase">To</span>
        <input value={to} onChange={(e) => { setTo(e.target.value.trim()); setWho(""); }} placeholder="Solana address" aria-label="Recipient" className="mt-1 min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-3 font-mono text-sm outline-none" />
      </label>
      {who ? <p className="mt-2 text-sm text-white/70">{who}</p> : null}
      <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 80))} placeholder="Note, optional" aria-label="Note" className="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-sm outline-none" />
      {err ? <p className="mt-2 text-sm text-[#ff5d73]">{err}</p> : null}
      <button type="button" disabled={phase === "leaving" || !(amount > 0) || to.trim().length < 32} onClick={() => void send()} className="relative mt-4 min-h-12 w-full overflow-hidden rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
        {phase === "leaving" ? <span className="senda-flow absolute inset-y-0 w-16 bg-white/50" /> : null}
        <span className="relative">Send {amount > 0 ? money(amount) : "USDC"}</span>
      </button>
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-sm font-semibold">Your code</p>
        <p className="mt-1 text-xs text-white/45">{owner ? "They scan this. It asks for USDC to this Phantom. Showing it does not move money." : "Connect Phantom and this code is for that address."}</p>
        {mine ? (
          <div className="senda-paint mt-3">
            <PayQr value={mine} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
