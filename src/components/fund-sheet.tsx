import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Delete } from "lucide-react";
import { getFx } from "@/lib/wallet-fx";
import { connectWallet, detectWallets } from "@/lib/wallets";
import { isPhoneBrowser } from "@/lib/mobile-wallet";
import { robinhoodBuyingPowerUrl } from "@/lib/robinhood";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const FUND_EVENT = "senda-fund";
const LAST_KEY = "senda.fund.last";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

type Step = "methods" | "amount" | "pay" | "wallets" | "crypto";
type PayId = "apple" | "debit" | "credit" | "venmo" | "paypal" | "revolut" | "robinhood";
type Asset = "USDC" | "SOL";
type Last = "crypto" | "apple" | "cash" | "apps";

const MIN: Record<PayId, number> = {
  apple: 0.5,
  debit: 0.5,
  credit: 0.5,
  venmo: 1,
  paypal: 1,
  revolut: 1,
  robinhood: 1,
};

const PAY_LABEL: Record<PayId, string> = {
  apple: "Apple Pay",
  debit: "Debit Card",
  credit: "Credit Card",
  venmo: "Venmo",
  paypal: "PayPal",
  revolut: "Revolut Pay",
  robinhood: "Robinhood",
};

const FIAT: PayId[] = ["apple", "debit", "credit", "venmo", "paypal", "revolut"];

export function openDeposit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FUND_EVENT));
}

function centsOf(raw: string) {
  const [whole, frac = ""] = raw.split(".");
  const w = Number(whole || "0");
  if (!Number.isFinite(w)) return 0;
  return w * 100 + Number((frac + "00").slice(0, 2));
}

function remember(kind: Last) {
  try {
    localStorage.setItem(LAST_KEY, kind);
  } catch {
    /* private mode */
  }
}

function readLast(): Last | null {
  try {
    const v = localStorage.getItem(LAST_KEY);
    return v === "crypto" || v === "apple" || v === "cash" || v === "apps" ? v : null;
  } catch {
    return null;
  }
}

function Mark({ letter, tone }: { letter: string; tone: string }) {
  return (
    <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl text-sm font-semibold", tone)}>{letter}</span>
  );
}

/** Deposit sheet: crypto and Robinhood fill the wallet. Cards settle on Stripe and do not. */
export function FundSheet() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState<Step[]>(["methods"]);
  const [pay, setPay] = useState<PayId>("apple");
  const [asset, setAsset] = useState<Asset>("USDC");
  const [raw, setRaw] = useState("0");
  const [solPx, setSolPx] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [fault, setFault] = useState("");
  const [qr, setQr] = useState("");
  const [last, setLast] = useState<Last | null>(null);
  const [installed, setInstalled] = useState({ phantom: false, solflare: false });
  const step = stack[stack.length - 1] ?? "methods";
  const phone = typeof navigator !== "undefined" && isPhoneBrowser();
  const amount = centsOf(raw) / 100;
  const min = MIN[pay];
  const low = amount + 1e-9 < min;
  const delivers = pay === "robinhood";
  const quote = asset === "USDC" || !(solPx > 0) ? amount : amount / solPx;

  useEffect(() => {
    const on = () => {
      setFault("");
      setStack(["methods"]);
      setLast(readLast());
      setOpen(true);
    };
    window.addEventListener(FUND_EVENT, on);
    return () => window.removeEventListener(FUND_EVENT, on);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const flag = q.get("deposit");
    if (!flag) return;
    if (flag === "paid") {
      toast.message("Stripe accepted the charge. That money is not USDC in the wallet. Crypto or Robinhood is what fills this address.");
    } else if (flag === "cancel") {
      toast.message("Checkout cancelled. Nothing was charged.");
    }
    q.delete("deposit");
    q.delete("session_id");
    const next = `${window.location.pathname}${q.toString() ? `?${q}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }, []);

  useEffect(() => {
    if (!open) return;
    const found = detectWallets();
    setInstalled({
      phantom: Boolean(found.find((w) => w.id === "phantom")?.installed) || phone,
      solflare: Boolean(found.find((w) => w.id === "solflare")?.installed) || phone,
    });
    let live = true;
    getFx()
      .then((fx) => {
        if (live && fx.SOL > 0) setSolPx(fx.SOL);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [open, phone]);

  useEffect(() => {
    if (!open || step !== "crypto" || !owner) {
      setQr("");
      return;
    }
    let live = true;
    const uri = asset === "USDC" ? `solana:${owner}?spl-token=${USDC_MINT}` : `solana:${owner}`;
    void import("qrcode").then((QR) =>
      QR.default.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#10140a", light: "#ffffff" } }).then((url) => {
        if (live) setQr(url);
      }),
    );
    return () => {
      live = false;
    };
  }, [open, step, owner, asset]);

  function close() {
    setOpen(false);
    setStack(["methods"]);
    setFault("");
    setBusy(null);
  }

  function push(next: Step) {
    setFault("");
    setStack((s) => [...s, next]);
  }

  function back() {
    setFault("");
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }

  function press(key: string) {
    setRaw((prev) => {
      if (key === "back") {
        const cut = prev.slice(0, -1);
        return cut === "" || cut === "0" ? "0" : cut;
      }
      if (key === ".") {
        if (prev.includes(".")) return prev;
        return `${prev}.`;
      }
      if (prev === "0") return key;
      const frac = prev.split(".")[1];
      if (frac && frac.length >= 2) return prev;
      if (prev.replace(".", "").length >= 7) return prev;
      return prev + key;
    });
  }

  function toMin() {
    const text = Number.isInteger(min) ? String(min) : min.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
    setRaw(text);
  }

  async function connect(id: "phantom" | "solflare") {
    setBusy(id);
    try {
      const got = await connectWallet(id);
      const linked = wallet.linkChain(got.address, got.label, id === "phantom" ? "phantom" : "solana");
      if (!linked.ok && linked.error !== "Already linked.") toast.error(linked.error || "The wallet did not stay.");
      else toast.success(`${got.label} is connected.`);
      remember("apps");
      setLast("apps");
      push("crypto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect.");
    } finally {
      setBusy(null);
    }
  }

  function useRobinhood() {
    if (!owner) {
      toast.error("Connect Phantom or Solflare first. Robinhood sends USDC to that address.");
      return;
    }
    setPay("robinhood");
    setAsset("USDC");
    push("amount");
  }

  async function openRobinhood() {
    if (!owner) {
      toast.error("Connect a Solana wallet first. That address receives the USDC.");
      return;
    }
    if (low) return;
    remember("apps");
    const url = robinhoodBuyingPowerUrl({ wallet: owner, usd: Math.max(1, Math.round(amount)), origin: window.location.origin });
    window.location.assign(url);
  }

  async function payFiat() {
    if (low || busy) return;
    setBusy("pay");
    setFault("");
    try {
      const res = await fetch("/api/fund-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usd: amount, method: pay, receive: asset, wallet: owner }),
      });
      const json = (await res.json()) as { url?: string; error?: string; note?: string };
      if (!res.ok || !json.url) {
        setFault(json.error || "Checkout did not open.");
        return;
      }
      remember(pay === "apple" ? "apple" : "cash");
      if (json.note) toast.message(json.note);
      window.location.assign(json.url);
    } catch (e) {
      setFault(e instanceof Error ? e.message : "Checkout did not open.");
    } finally {
      setBusy(null);
    }
  }

  async function copyAddress() {
    if (!owner) return;
    try {
      await navigator.clipboard.writeText(owner);
      remember("crypto");
      setLast("crypto");
      toast.success("Address copied. Send on Solana only.");
    } catch {
      toast.error("Could not copy. Select the address and copy it.");
    }
  }

  if (!open) return null;

  const full = step === "amount" || step === "crypto";
  const title =
    step === "methods" ? "Deposit methods" : step === "pay" ? "Select method" : step === "wallets" ? "Select wallet or app" : step === "crypto" ? "Crypto" : "Deposit";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <button type="button" aria-label="Close deposit" className="absolute inset-0 bg-black/70" onClick={close} />
      <div
        className={cn(
          "relative flex w-full flex-col bg-[#0e0e11] text-fg",
          full ? "h-[100dvh]" : "max-h-[88dvh] rounded-t-[28px] border border-white/10",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" />
        <header className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => (stack.length > 1 ? back() : close())}
            className="grid size-11 place-items-center rounded-full text-fg"
            aria-label={stack.length > 1 ? "Back" : "Close"}
          >
            <ChevronLeft className="size-5" />
          </button>
          <h2 className="flex-1 text-center text-base font-semibold">{title}</h2>
          <span className="size-11" />
        </header>

        {step === "methods" ? (
          <ul className="space-y-2 overflow-y-auto px-4 pb-8">
            <MethodRow
              mark={<Mark letter="◎" tone="bg-white/10 text-fg" />}
              title="Crypto"
              badge={last === "crypto" ? "Last used" : undefined}
              line="Transfer from any wallet or exchange"
              onClick={() => {
                remember("crypto");
                push("crypto");
              }}
            />
            <MethodRow
              mark={<Mark letter="Pay" tone="bg-white/10 text-fg" />}
              title="Apple Pay"
              badge={last === "apple" ? "Last used" : "Popular"}
              tone="good"
              line="Card checkout. Apple Pay shows when this phone has a card."
              onClick={() => {
                setPay("apple");
                setAsset("USDC");
                remember("apple");
                push("amount");
              }}
            />
            <MethodRow
              mark={<Mark letter="$" tone="bg-white/10 text-fg" />}
              title="Cash"
              badge={last === "cash" ? "Last used" : undefined}
              line="Credit card, PayPal, Revolut Pay, and more"
              onClick={() => {
                remember("cash");
                push("pay");
              }}
            />
            <MethodRow
              mark={<Mark letter="::" tone="bg-white/10 text-fg" />}
              title="Detected apps"
              badge={last === "apps" ? "Last used" : undefined}
              line="Fund from Phantom, Solflare, or Robinhood"
              onClick={() => push("wallets")}
            />
          </ul>
        ) : null}

        {step === "wallets" ? (
          <ul className="space-y-2 overflow-y-auto px-4 pb-8">
            <p className="px-1 pb-1 text-sm text-muted">Connect and transfer from these apps. Senda never holds the key.</p>
            <WalletRow
              mark={<Mark letter="Ph" tone="bg-[#2a2040] text-[#c7b6ff]" />}
              title="Phantom"
              detected={installed.phantom}
              line="Connect and transfer from Phantom."
              busy={busy === "phantom"}
              onClick={() => void connect("phantom")}
            />
            <WalletRow
              mark={<Mark letter="Sf" tone="bg-[#2a2610] text-[#ffe56a]" />}
              title="Solflare"
              detected={installed.solflare}
              line="Connect and transfer from Solflare."
              busy={busy === "solflare"}
              onClick={() => void connect("solflare")}
            />
            <WalletRow
              mark={<Mark letter="Rh" tone="bg-[#102818] text-[#7dffb0]" />}
              title="Robinhood"
              detected={phone || Boolean(owner)}
              line="Buys USDC on Solana into the connected address."
              busy={false}
              onClick={useRobinhood}
            />
          </ul>
        ) : null}

        {step === "pay" ? (
          <ul className="space-y-2 overflow-y-auto px-4 pb-8">
            {FIAT.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => {
                    setPay(id);
                    setAsset("USDC");
                    push("amount");
                  }}
                  className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-[#17171b] px-3 text-left"
                >
                  <Mark letter={id === "apple" ? "Pay" : id === "venmo" ? "V" : id === "paypal" ? "P" : id === "revolut" ? "R" : "Card"} tone="bg-black/40 text-fg" />
                  <span className="flex-1 text-base font-semibold">
                    {PAY_LABEL[id]}
                    {id === "apple" ? <span className="ml-2 rounded-full bg-[#143226] px-2 py-0.5 text-xs font-medium text-[#8dffa8]">Recommended</span> : null}
                  </span>
                  <ChevronRight className="size-4 text-white/40" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {step === "crypto" ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-8">
            <div className="flex justify-center gap-2">
              {(["USDC", "SOL"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAsset(id)}
                  className={cn("min-h-10 rounded-full px-4 text-sm font-semibold", asset === id ? "bg-accent text-accent-fg" : "bg-white/10 text-white/70")}
                >
                  {id}
                </button>
              ))}
            </div>
            {owner ? (
              <>
                {qr ? <img src={qr} alt="" className="mx-auto size-48 rounded-2xl bg-white p-2" /> : null}
                <p className="break-all text-center font-mono text-sm">{owner}</p>
                <button type="button" onClick={() => void copyAddress()} className="min-h-12 rounded-full bg-accent text-sm font-semibold text-accent-fg">
                  Copy address
                </button>
                <p className="text-center text-sm text-muted">
                  Send {asset} on Solana only. {asset === "USDC" ? "USDC mint ends in TDt1v." : "Native SOL, not a wrapped token from another chain."} It shows in the wallet bar when the chain sees it. Senda does not take custody.
                </p>
              </>
            ) : (
              <>
                <p className="text-center text-sm text-muted">Connect the wallet that should receive the transfer.</p>
                <button type="button" onClick={() => void connect("phantom")} className="min-h-12 rounded-full bg-accent text-sm font-semibold text-accent-fg">
                  {busy === "phantom" ? "Opening…" : "Connect Phantom"}
                </button>
                <button type="button" onClick={() => void connect("solflare")} className="min-h-12 rounded-full border border-white/15 text-sm font-semibold">
                  {busy === "solflare" ? "Opening…" : "Connect Solflare"}
                </button>
              </>
            )}
          </div>
        ) : null}

        {step === "amount" ? (
          <div className="flex flex-1 flex-col px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-1 flex-col items-center justify-center">
              <p className="font-mono text-6xl font-semibold tracking-tight tabular-nums">${raw === "" ? "0" : raw}</p>
              <button
                type="button"
                onClick={() => {
                  if (delivers) return;
                  setAsset((a) => (a === "USDC" ? "SOL" : "USDC"));
                }}
                className="mt-3 text-base text-white/60"
              >
                {delivers ? "Receiving " : "Worth "}
                <span className="font-mono text-white">{asset === "SOL" && solPx > 0 ? quote.toFixed(4) : amount.toFixed(2)}</span> {asset}
                {delivers ? null : <span className="text-white/40"> · tap to switch</span>}
              </button>
              <p className="mt-3 max-w-sm text-center text-xs text-white/45">
                {delivers
                  ? "Robinhood Connect buys USDC on Solana and sends it to this wallet."
                  : "This is a price quote, not a delivery. Stripe collects dollars. It does not drop USDC or SOL into the wallet."}
              </p>
            </div>
            <p className="mb-2 text-right text-sm text-white/50">Minimum deposit ${Number.isInteger(min) ? min.toFixed(0) : min.toFixed(2)}</p>
            <button
              type="button"
              onClick={() => push("pay")}
              className="mb-3 flex min-h-14 items-center gap-3 rounded-2xl bg-[#17171b] px-3 text-left"
            >
              <Mark
                letter={pay === "revolut" ? "R" : pay === "venmo" ? "V" : pay === "paypal" ? "P" : pay === "robinhood" ? "Rh" : pay === "apple" ? "Pay" : "Card"}
                tone="bg-black/40 text-fg"
              />
              <span className="flex-1 font-semibold">{PAY_LABEL[pay]}</span>
              <ChevronRight className="size-4 text-white/40" />
            </button>
            {fault ? <p className="mb-2 text-sm text-[#ff8d9a]">{fault}</p> : null}
            <button
              type="button"
              disabled={busy === "pay"}
              onClick={() => {
                if (low) toMin();
                else if (pay === "robinhood") void openRobinhood();
                else void payFiat();
              }}
              className="min-h-14 rounded-2xl bg-accent text-base font-semibold text-accent-fg disabled:opacity-60"
            >
              {busy === "pay" ? "Opening…" : low ? "Change to minimum" : pay === "robinhood" ? "Open Robinhood" : `Pay $${amount.toFixed(2)}`}
            </button>
            <div className="mt-2 grid grid-cols-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((key) => (
                <button key={key} type="button" onClick={() => press(key)} className="grid min-h-14 place-items-center text-2xl font-medium">
                  {key === "back" ? <Delete className="size-6" /> : key}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MethodRow({
  mark,
  title,
  badge,
  tone,
  line,
  onClick,
}: {
  mark: ReactNode;
  title: string;
  badge?: string;
  tone?: "good";
  line: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl bg-[#17171b] px-3 text-left">
        {mark}
        <span>
          <span className="flex items-center gap-2 text-base font-semibold">
            {title}
            {badge ? (
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone === "good" ? "bg-[#143226] text-[#8dffa8]" : "bg-white/10 text-white/70")}>{badge}</span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-sm text-white/55">{line}</span>
        </span>
      </button>
    </li>
  );
}

function WalletRow({
  mark,
  title,
  detected,
  line,
  busy,
  onClick,
}: {
  mark: ReactNode;
  title: string;
  detected: boolean;
  line: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onClick} disabled={busy} className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl bg-[#17171b] px-3 text-left disabled:opacity-60">
        {mark}
        <span>
          <span className="flex items-center gap-2 text-base font-semibold">
            {title}
            {detected ? <span className="rounded-full bg-[#143226] px-2 py-0.5 text-xs font-medium text-[#8dffa8]">Detected</span> : null}
          </span>
          <span className="mt-0.5 block text-sm text-white/55">{busy ? "Opening…" : line}</span>
        </span>
      </button>
    </li>
  );
}
