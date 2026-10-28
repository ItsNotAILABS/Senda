import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MOVE_LANES, mayanQuote, type MoveQuote } from "@/lib/mayan-quote";
import { signMayan } from "@/lib/mayan-sign";
import { connectPhantom } from "@/lib/phantom";
import { cn } from "@/lib/utils";

const FUND = [
  { id: "usdc", label: "USDC", line: "Already in this Phantom. Nothing to buy." },
  { id: "apple", label: "Apple Pay", line: "Phantom’s checkout. Crossmint delivers the token." },
  { id: "card", label: "Card", line: "Stripe, MoonPay, or the provider Phantom picks." },
  { id: "revolut", label: "Revolut", line: "A Phantom provider. The card is theirs." },
  { id: "paypal", label: "PayPal", line: "A Phantom provider. USDC lands here." },
] as const;

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function evm(): Eth | null {
  const w = window as unknown as { phantom?: { ethereum?: Eth }; ethereum?: Eth };
  return w.phantom?.ethereum || w.ethereum || null;
}

/** Move Solana USDC, or fund the Phantom that is already connected. */
export function MoveWidget({ owner }: { owner: string }) {
  const [lane, setLane] = useState<(typeof MOVE_LANES)[number]["id"]>("hl-perps");
  const [usd, setUsd] = useState("25");
  const [quote, setQuote] = useState<MoveQuote | null>(null);
  const [fault, setFault] = useState("");
  const [busy, setBusy] = useState(false);
  const [dest, setDest] = useState("");
  const [fund, setFund] = useState<(typeof FUND)[number]["id"]>("usdc");
  const amount = Number(usd);
  const picked = MOVE_LANES.find((row) => row.id === lane) ?? MOVE_LANES[0];

  useEffect(() => {
    if (!(amount >= 5)) {
      setQuote(null);
      return;
    }
    let live = true;
    setFault("");
    const pull = () => {
      mayanQuote({ data: { lane, amount } })
        .then((row) => {
          if (!live) return;
          setQuote(row);
        })
        .catch((err: unknown) => {
          if (!live) return;
          setQuote(null);
          setFault(err instanceof Error ? err.message : "No quote.");
        });
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [lane, amount]);

  async function destination(): Promise<string> {
    if (dest.trim()) return dest.trim();
    const eth = evm();
    if (!eth) throw new Error("Paste the 0x address that should receive it, or open Phantom’s Ethereum account.");
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const who = accounts[0] || "";
    if (!who) throw new Error("The wallet did not give an Ethereum address.");
    setDest(who);
    return who;
  }

  async function sign() {
    if (!quote) return;
    setBusy(true);
    try {
      const from = owner || (await connectPhantom());
      const to = await destination();
      if (!/^0x[a-fA-F0-9]{40}$/.test(to)) throw new Error("Hyperliquid and these chains receive at an 0x address.");
      const sig = await signMayan(quote.quote, from, to, quote.quotedAt);
      toast.success(`Signed. ${sig.slice(0, 10)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  function fundGo() {
    if (!owner) {
      toast.error("Connect Phantom first. The tokens land on that address.");
      return;
    }
    if (fund === "usdc") {
      void navigator.clipboard.writeText(owner).then(() => toast.success("Address copied."));
      return;
    }
    void navigator.clipboard.writeText(owner).then(() => toast.success("Address copied. A deposit lands on this Phantom."));
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-black p-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Move</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">Solana USDC, one signature</h2>
      <p className="mt-1 text-sm text-white/55">Hyperliquid perps or spot, or USDC on another chain. Mayan Swift. Senda takes 8 bps. A failed route refunds to this Solana account.</p>
      <div className="mt-3 flex gap-1.5 overflow-x-auto">
        {MOVE_LANES.map((row) => (
          <button key={row.id} type="button" onClick={() => setLane(row.id)} className={cn("h-9 shrink-0 rounded-full px-3 text-xs font-semibold", lane === row.id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
            {row.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr]">
        <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="USDC to move" className="min-h-12 rounded-2xl border border-white/10 bg-black px-3 font-mono text-lg outline-none" />
        <input value={dest} onChange={(e) => setDest(e.target.value.trim())} placeholder="0x that receives it. Blank uses Phantom’s Ethereum account." className="min-h-12 rounded-2xl border border-white/10 bg-black px-3 font-mono text-xs outline-none" />
      </div>
      <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
        {quote ? quote.lines.map((row) => (
          <li key={row.name} className="flex items-baseline justify-between gap-3 px-3 py-2">
            <span className="text-sm">{row.name}</span>
            <span className="text-right">
              <span className="block font-mono text-sm tabular-nums">{row.value}</span>
              <span className="block text-[11px] text-white/40">{row.note}</span>
            </span>
          </li>
        )) : (
          <li className="px-3 py-4 text-sm text-white/45">{amount >= 5 ? fault || "Asking Mayan…" : "Minimum is $5."}</li>
        )}
      </ul>
      <p className="mt-2 text-xs text-white/40">{quote ? `${quote.route}${quote.seconds ? ` · about ${quote.seconds}s` : ""} · ${picked.where}` : picked.where}</p>
      <button type="button" disabled={busy || !quote} onClick={() => void sign()} className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        {busy ? "Waiting on Phantom" : "Sign the move"}
      </button>

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Into this Phantom</p>
        <h3 className="mt-1 text-lg font-semibold">Fund the address that is already connected</h3>
        <p className="mt-1 break-all font-mono text-xs text-white/55">{owner || "Connect Phantom. That address is where it lands."}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {FUND.map((row) => (
            <button key={row.id} type="button" onClick={() => setFund(row.id)} className={cn("rounded-2xl border px-2 py-2 text-left", fund === row.id ? "border-accent bg-accent/10" : "border-white/10")}>
              <p className="text-sm font-semibold">{row.label}</p>
              <p className="mt-1 text-[11px] leading-snug text-white/45">{row.line}</p>
            </button>
          ))}
        </div>
        <button type="button" onClick={fundGo} className="mt-3 min-h-11 w-full rounded-full border border-white/15 text-sm font-semibold">
          {fund === "usdc" ? "Copy this Phantom address" : "Copy the address the deposit lands on"}
        </button>
      </div>
    </section>
  );
}
