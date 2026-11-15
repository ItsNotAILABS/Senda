import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fundGift, giftLink, loadGifts, markGift, newGift, saveGift, secretBytes, sweepGift, type GiftRecord } from "@/lib/gift-vault";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc, usdcPayLink } from "@/lib/solana-pay";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Kind = "pay" | "hold" | "transfer";

const KINDS: { id: Kind; label: string; line: string }[] = [
  { id: "pay", label: "QR pay", line: "They scan. They pay you." },
  { id: "hold", label: "Hold", line: "USDC sits until you release it." },
  { id: "transfer", label: "Transfer", line: "You sign. They get the USDC." },
];

async function paint(text: string): Promise<string> {
  const QR = await import("qrcode");
  return QR.default.toDataURL(text, { margin: 1, width: 240, color: { dark: "#050508", light: "#ffffff" } });
}

/** Three Solana contracts. A scan is a real USDC movement, or a receipt of one. */
export function RailContracts() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [kind, setKind] = useState<Kind>("pay");
  const [usd, setUsd] = useState("25");
  const [note, setNote] = useState("");
  const [who, setWho] = useState("");
  const [hours, setHours] = useState(72);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [holds, setHolds] = useState<GiftRecord[]>([]);
  const [releaseTo, setReleaseTo] = useState("");

  useEffect(() => {
    setHolds(loadGifts().filter((row) => row.status === "open"));
  }, [busy]);

  async function payer(): Promise<string> {
    return owner || (await connectPhantom());
  }

  async function makePay() {
    const amount = Number(usd);
    if (!(amount >= 1)) {
      toast.error("Enter at least $1.");
      return;
    }
    const to = await payer();
    const uri = usdcPayLink(to, amount, note.trim() || "Senda pay");
    setLink(uri);
    setQr(await paint(uri));
  }

  async function makeHold() {
    const amount = Number(usd);
    if (!(amount >= 1)) {
      toast.error("Enter at least $1.");
      return;
    }
    setBusy(true);
    try {
      const whoPays = await payer();
      const made = newGift(amount, note.trim() || "Hold", hours);
      saveGift(made.record);
      const sig = await fundGift({ owner: whoPays, vault: made.record.pubkey, usd: amount, memo: made.record.memo });
      const absolute = `${window.location.origin}${giftLink(secretBytes(made.record.secret), made.record.expiresAt, amount, made.record.memo)}`;
      setLink(absolute);
      setQr(await paint(absolute));
      setHolds(loadGifts().filter((row) => row.status === "open"));
      toast.success(`Hold funded. ${sig.slice(0, 8)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The hold did not fund.");
    } finally {
      setBusy(false);
    }
  }

  async function makeTransfer() {
    const amount = Number(usd);
    const dest = who.trim();
    if (!(amount >= 1) || dest.length < 32) {
      toast.error("Enter an amount and a Solana address.");
      return;
    }
    setBusy(true);
    try {
      const whoPays = await payer();
      const done = await payUsdc({ owner: whoPays, to: dest, usd: amount, memo: (note.trim() || "Senda transfer").slice(0, 32) });
      const proof = `https://solscan.io/tx/${done.signature}`;
      setLink(proof);
      setQr(await paint(proof));
      toast.success("Transfer signed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The transfer did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function release(row: GiftRecord, back: boolean) {
    const dest = back ? owner : releaseTo.trim();
    if (!dest) {
      toast.error(back ? "Connect the wallet that funded it." : "Paste who receives the hold.");
      return;
    }
    setBusy(true);
    try {
      const sig = await sweepGift({ secret: secretBytes(row.secret), to: dest });
      markGift(row.pubkey, back ? "reclaimed" : "claimed");
      setHolds(loadGifts().filter((item) => item.status === "open"));
      const proof = `https://solscan.io/tx/${sig}`;
      setLink(proof);
      setQr(await paint(proof));
      toast.success(back ? "Back in your wallet." : "Released.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The hold did not move.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-black p-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Solana</p>
      <h2 className="mt-1 text-lg font-semibold">Pay, hold, or transfer</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {KINDS.map((item) => (
          <button key={item.id} type="button" onClick={() => { setKind(item.id); setQr(""); setLink(""); }} className={cn("rounded-2xl border px-2 py-3 text-left", kind === item.id ? "border-accent bg-accent/10" : "border-white/10")}>
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-white/45">{item.line}</p>
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        <div className="flex gap-2">
          <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" aria-label="USDC" className="min-h-12 w-28 rounded-2xl border border-white/10 bg-black px-3 font-mono text-sm outline-none" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "hold" ? "What is being held" : kind === "transfer" ? "What this transfer is" : "What they are paying for"} className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black px-3 text-sm outline-none" />
        </div>
        {kind === "transfer" ? <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Solana address that receives it" className="min-h-12 rounded-2xl border border-white/10 bg-black px-3 font-mono text-xs outline-none" /> : null}
        {kind === "hold" ? (
          <div className="flex gap-2">
            {[24, 72, 168].map((n) => (
              <button key={n} type="button" onClick={() => setHours(n)} className={cn("h-9 flex-1 rounded-full text-xs font-semibold", hours === n ? "bg-white text-black" : "bg-white/10")}>{n === 168 ? "7 days" : `${n}h`}</button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void (kind === "pay" ? makePay() : kind === "hold" ? makeHold() : makeTransfer())}
          className="min-h-12 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? "Waiting on the wallet" : kind === "pay" ? "Show the pay QR" : kind === "hold" ? "Sign the hold" : "Sign the transfer"}
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/40">
        {kind === "pay" ? "The code is a Solana Pay request to your wallet. Scanning it asks their wallet to send USDC. This desk does not receive it." : null}
        {kind === "hold" ? "USDC moves to a new address. The QR is the release link, and it is also the key. The window is kept by this page, not by a program. Anyone with the link can move it." : null}
        {kind === "transfer" ? "You sign a USDC transfer. The QR after that is the receipt, not a second payment." : null}
      </p>
      {qr ? (
        <div className="mt-3 flex flex-col items-center gap-2">
          <img src={qr} alt="" className="h-52 w-52 rounded-2xl" />
          <button type="button" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success("Copied."))} className="h-9 rounded-full border border-white/15 px-3 text-xs font-semibold">Copy</button>
        </div>
      ) : null}
      {kind === "hold" && holds.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {holds.map((row) => (
            <li key={row.pubkey} className="rounded-2xl border border-white/10 px-3 py-3">
              <p className="text-sm font-semibold">${row.usd.toFixed(2)} · {row.memo || "Hold"}</p>
              <p className="mt-1 font-mono text-[11px] text-white/40">{row.pubkey.slice(0, 4)}…{row.pubkey.slice(-4)} · until {new Date(row.expiresAt).toLocaleString()}</p>
              <input value={releaseTo} onChange={(e) => setReleaseTo(e.target.value)} placeholder="Address to release to" className="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-black px-3 font-mono text-xs outline-none" />
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={() => void release(row, false)} className="h-10 flex-1 rounded-full bg-white text-xs font-semibold text-black disabled:opacity-40">Release</button>
                <button type="button" disabled={busy} onClick={() => void release(row, true)} className="h-10 flex-1 rounded-full border border-white/15 text-xs font-semibold disabled:opacity-40">Take back</button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
