import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PasskeyCard } from "@/components/passkey-card";
import { PassportBar } from "@/components/passport-bar";
import { PhonePassport } from "@/components/phone-passport";
import { JUPITER_LANES, holdingBand, shareCard } from "@/lib/access-rails";
import { livePlan, readPlan, sendRoom } from "@/lib/money-plan";
import { passportMeta, passportUnlocked } from "@/lib/passport";
import { liveSolAddress, splHolding } from "@/lib/phantom";
import { sealOpen } from "@/lib/seal";
import { spendCap } from "@/lib/spend-cap";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const DOORS = [
  { href: "/payments", label: "Send" },
  { href: "/payments/plan", label: "Plan" },
  { href: "/payments/zelle", label: "Zelle" },
  { href: "/equities", label: "Stocks" },
  { href: "/invest?desk=kalshi", label: "Kalshi" },
  { href: "/invest?desk=poly", label: "Polymarket" },
  { href: "/equities/liquidity", label: "Liquidity" },
  { href: "/equities/bullish", label: "Bullish" },
  { href: "/vault/loans", label: "Loans" },
] as const;

export function GlobalPassport() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const [device, setDevice] = useState<"open" | "sealed" | "none">("none");
  const [walletOpen, setWalletOpen] = useState(false);
  const [usdc, setUsdc] = useState<number | null>(null);
  const [bandOnly, setBandOnly] = useState(true);
  const [floor, setFloor] = useState(0);
  const [left, setLeft] = useState(0);
  const [cap, setCap] = useState(100);

  useEffect(() => {
    const pull = () => {
      const meta = passportMeta();
      setDevice(passportUnlocked() ? "open" : meta ? "sealed" : "none");
      setWalletOpen(sealOpen());
      const plan = livePlan(readPlan());
      const limit = spendCap();
      setFloor(plan.cashFloor);
      setCap(limit);
      setLeft(sendRoom(plan, limit));
    };
    pull();
    const id = window.setInterval(pull, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const owner = liveSolAddress() || link?.address || "";
    if (!owner) {
      setUsdc(null);
      return;
    }
    let live = true;
    splHolding(owner, USDC)
      .then((holding) => live && setUsdc(holding.ui))
      .catch(() => live && setUsdc(null));
    return () => {
      live = false;
    };
  }, [link?.address]);

  const walletText = link?.address || liveSolAddress();
  const hold = usdc == null ? "Wallet not read" : bandOnly ? holdingBand(usdc) : `$${usdc.toFixed(2)} public`;

  async function copy() {
    const text = shareCard({
      device,
      wallet: walletText,
      usdc,
      bandOnly,
      floor,
      sendLeft: left,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Card copied. Nothing was uploaded.");
    } catch {
      toast.error("Could not copy the card.");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 pb-16">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Global passport</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Access, on this phone.</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        Jupiter’s passport checks identity for banks and issuers. This one does not call them. It opens the phone key and the wallet stamp you already have, and it says what it cannot prove.
      </p>

      <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c]">
        <div className="grid sm:grid-cols-3">
          <div className="border-b border-white/10 p-4 sm:border-r sm:border-b-0">
            <p className="font-mono text-[10px] tracking-[0.14em] text-white/40 uppercase">On this chain</p>
            <p className="mt-2 text-sm font-semibold">Wallet and cash</p>
            <p className="mt-2 text-sm text-white/60">{walletText ? `${walletText.slice(0, 4)}…${walletText.slice(-4)}` : "No wallet connected"}</p>
            <p className="mt-1 text-sm text-white/60">{hold}</p>
            <p className="mt-3 text-xs leading-relaxed text-white/45">A public balance, or a band. Not a proof of wealth.</p>
          </div>
          <div className="border-b border-white/10 p-4 sm:border-r sm:border-b-0">
            <p className="font-mono text-[10px] tracking-[0.14em] text-white/40 uppercase">Passport</p>
            <ul className="mt-2 space-y-3">
              {JUPITER_LANES.map((lane) => (
                <li key={lane.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">{lane.name}</p>
                    <p className="shrink-0 font-mono text-[10px] tracking-wide text-accent uppercase">{lane.there}</p>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">{lane.here}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-4">
            <p className="font-mono text-[10px] tracking-[0.14em] text-white/40 uppercase">Issuers and banks</p>
            <p className="mt-2 text-sm leading-relaxed text-white/60">Jupiter’s off-chain door is their identity. This phone does not open it.</p>
            <div className="mt-3 flex flex-col gap-2">
              <button type="button" onClick={() => void navigate({ href: "/equities/liquidity" })} className="min-h-11 rounded-full bg-white/10 px-3 text-left text-sm font-semibold">
                Liquidity · a quote, not a filing
              </button>
              <button type="button" onClick={() => void navigate({ href: "/equities/bullish" })} className="min-h-11 rounded-full bg-white/10 px-3 text-left text-sm font-semibold">
                Bullish · announced, not a borrow
              </button>
              <button type="button" onClick={() => void navigate({ href: "/payments/zelle" })} className="min-h-11 rounded-full bg-white/10 px-3 text-left text-sm font-semibold">
                Zelle · a drill, not a bank login
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <PassportBar />
      </div>
      <div className="mt-3">
        <PasskeyCard />
      </div>
      <div className="mt-3">
        <PhonePassport compact />
      </div>

      <section className="mt-3 rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Standing</p>
        <p className="mt-1 text-sm text-white/60">Limits you set. Not a score a lender can pull.</p>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-white/50">Phone key</dt>
            <dd>{device === "open" ? "Open" : device === "sealed" ? "Sealed" : "Not created"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-white/50">Wallet stamp</dt>
            <dd>{walletOpen ? "Open" : "Sealed"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-white/50">Send cap</dt>
            <dd className="font-mono">${cap.toLocaleString("en-US")}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-white/50">Cash floor</dt>
            <dd className="font-mono">${floor.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-white/50">Send room</dt>
            <dd className="font-mono">${left.toFixed(2)} left</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-white/50">USDC</dt>
            <dd className="text-right">{hold}</dd>
          </div>
        </dl>
        <button type="button" onClick={() => setBandOnly((v) => !v)} className="mt-3 min-h-11 w-full rounded-full border border-white/10 text-sm font-semibold">
          {bandOnly ? "Show the public balance" : "Share a band instead"}
        </button>
        <button type="button" onClick={() => void copy()} className="mt-2 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg">
          Copy the card
        </button>
        <p className="mt-2 text-xs leading-relaxed text-white/45">The card stays on this phone until you paste it. No document, no photo, no upload.</p>
      </section>

      <section className="mt-3">
        <p className="font-mono text-[10px] tracking-[0.16em] text-white/40 uppercase">Doors stay open</p>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {DOORS.map((door) => (
            <button
              key={door.href}
              type="button"
              onClick={() => void navigate({ href: door.href })}
              className="min-h-11 shrink-0 rounded-full border border-white/10 px-3 text-sm font-semibold"
            >
              {door.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
