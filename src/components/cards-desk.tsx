import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CorridorCard } from "@/components/corridor-card";
import { CardFund } from "@/components/card-fund";
import { MoneyJumps } from "@/components/money-jumps";
import { MCC } from "@/lib/card-issuing";
import { AccountDetails } from "@/components/account-details";
import { MoneyBar } from "@/components/money-bar";
import { paySol, payToken, payUsdc } from "@/lib/solana-pay";
import { bindCardSend, CARD_BOOK } from "@/lib/card-rails";
import { CardTerms } from "@/components/card-terms";
import { USDC } from "@/lib/jup-exec";
import { signRoute } from "@/lib/jup-sign";
import { connectPhantom } from "@/lib/phantom";
import { EarnDesk } from "@/components/earn-desk";
import { McPayout } from "@/components/mc-payout";
import { CheckoutForm } from "@/components/checkout-form";
import { TabLead } from "@/components/tab-lead";
import { formatMoney, type Card, type CardAuth, type CardKind } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const CASH = "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH";
const PAY_WITH = [
  { id: "CASH", mint: CASH, label: "Phantom Cash" },
  { id: "USDC", mint: USDC, label: "USDC" },
  { id: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", label: "USDT" },
] as const;

function CardConnect({ owner }: { owner: string }) {
  const [where, setWhere] = useState<"jupiter" | "avici" | "kast" | "xplace" | "phantom" | "fuse">("jupiter");
  const [asset, setAsset] = useState("USDC");
  const [to, setTo] = useState("");
  const [usd, setUsd] = useState("10");
  const [busy, setBusy] = useState(false);
  const book = CARD_BOOK[where];
  const note: Record<typeof where, string> = {
    jupiter: "Jupiter’s card is theirs. Paste the Spend address their app shows. Only USDC.",
    avici: "Avici’s card is theirs. Paste the escrow address they show. The balance sits in their contract.",
    kast: "KAST holds the deposit. Paste the Solana address they show. This send is USDC.",
    xplace: "USDT, SOL, wETH, cbBTC, or jitoSOL. USDC is refused. A new address stops at the first-send cap.",
    phantom: "Phantom’s Visa is theirs. This swaps USDC for their CASH token and leaves it in the wallet that signs.",
    fuse: "Fuse’s Visa is theirs. Paste the card address they show. United States, except New York and Alaska.",
  };

  async function send() {
    const n = Number(usd);
    if (!(n > 0)) {
      toast.error("Enter an amount.");
      return;
    }
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (where === "phantom") {
        const done = await signRoute({
          owner: who,
          inputMint: USDC,
          outputMint: CASH,
          amountRaw: Math.round(n * 1e6),
          outDecimals: 6,
          usd: n,
        });
        toast.success(`CASH is in this wallet. Phantom’s card spends it. solscan.io/tx/${done.signature}`);
      } else {
        const remembered = (() => {
          try {
            const raw = JSON.parse(localStorage.getItem("senda.cardfund.v2") || "{}") as Record<string, string>;
            return raw[where] || "";
          } catch {
            return "";
          }
        })();
        const bound = bindCardSend({ program: where, symbol: asset, dest: to, amount: n });
        const keep = () => {
          const prior = remembered ? { ...JSON.parse(localStorage.getItem("senda.cardfund.v2") || "{}") } : {};
          prior[where] = bound.dest;
          localStorage.setItem("senda.cardfund.v2", JSON.stringify(prior));
        };
        if (bound.asset.native) {
          const sigOut = await paySol({ owner: who, to: bound.dest, sol: n });
          keep();
          toast.success(`${n} SOL sent. solscan.io/tx/${sigOut}`);
        } else if (bound.asset.symbol === "USDC") {
          const done = await payUsdc({ owner: who, to: bound.dest, usd: n, memo: where });
          keep();
          toast.success(`${n} USDC sent. solscan.io/tx/${done.signature}`);
        } else {
          const done = await payToken({ owner: who, to: bound.dest, mint: bound.asset.mint, symbol: bound.asset.symbol, amount: n, decimals: bound.asset.decimals });
          keep();
          toast.success(`${n} ${bound.asset.symbol} sent. solscan.io/tx/${done.signature}`);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <h2 className="text-lg font-semibold">Fund a card you already have</h2>
      <label className="mt-3 block text-[12px] text-white/45">
        Where it goes
        <select value={where} onChange={(e) => { const next = e.target.value as typeof where; setWhere(next); setAsset(CARD_BOOK[next]?.assets[0].symbol ?? "USDC"); }} className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-black px-3 text-[15px] text-white">
          <option value="jupiter">Jupiter</option>
          <option value="avici">Avici</option>
          <option value="kast">KAST</option>
          <option value="xplace">XPlace</option>
          <option value="phantom">Phantom</option>
          <option value="fuse">Fuse</option>
        </select>
      </label>
      {where === "phantom" ? null : (
        <>
          {book && book.assets.length > 1 ? (
            <label className="mt-3 block text-[12px] text-white/45">
              Asset
              <select value={asset} onChange={(e) => setAsset(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-black px-3 text-[15px] text-white">
                {book.assets.map((row) => (
                  <option key={row.symbol} value={row.symbol}>{row.symbol}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="mt-3 block text-[12px] text-white/45">
            Their address
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="From that app" className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-black px-3 font-mono text-[14px] text-white" />
          </label>
        </>
      )}
      <label className="mt-3 block text-[12px] text-white/45">
        Amount
        <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-black px-3 text-[15px] text-white" />
      </label>
      <p className="mt-3 text-[13px] leading-snug text-white/50">{note[where]}</p>
      <CardTerms id={where} />
      <button type="button" disabled={busy} onClick={() => void send()} className="mt-3 h-12 w-full rounded-full bg-[#d7e36a] text-[15px] font-semibold text-black disabled:opacity-50">
        {busy ? "Waiting on the wallet" : where === "phantom" ? "Swap into CASH" : "Sign and send"}
      </button>
    </section>
  );
}

const PANEL = "rounded-[22px] border border-white/10 bg-[#10131c]";

const KINDS: { id: CardKind; label: string; line: string }[] = [
  { id: "virtual", label: "Everyday", line: "Use it again." },
  { id: "once", label: "One charge", line: "Then the number dies." },
  { id: "fleet", label: "Fleet", line: "Higher daily cap." },
];

const CAPS = [20, 40, 80, 150];

/** Real auths only. Blank merchant stays blank — nothing is named for you. */
function groupAuths(auths: CardAuth[]) {
  const order: string[] = [];
  const map = new Map<string, CardAuth[]>();
  for (const a of auths) {
    const merchant = a.merchant.trim() || "—";
    const hit = map.get(merchant);
    if (hit) hit.push(a);
    else {
      map.set(merchant, [a]);
      order.push(merchant);
    }
  }
  return order.map((merchant) => ({ merchant, rows: map.get(merchant) ?? [] }));
}

/** Real merchants. A tap only fills this checkout — it does not mint or charge. */
const STORES: { id: string; label: string; merchant: string; cap: number; mcc: string }[] = [
  { id: "coffee", label: "Coffee", merchant: "Starbucks", cap: 8, mcc: "5812" },
  { id: "transit", label: "Transit", merchant: "Uber", cap: 24, mcc: "4121" },
  { id: "grocery", label: "Grocery", merchant: "Whole Foods", cap: 80, mcc: "5411" },
  { id: "online", label: "Online", merchant: "Amazon", cap: 45, mcc: "5999" },
  { id: "fuel", label: "Fuel", merchant: "Shell", cap: 60, mcc: "5541" },
  { id: "phone", label: "Phone", merchant: "Verizon", cap: 85, mcc: "0000" },
  { id: "software", label: "Software", merchant: "Adobe", cap: 55, mcc: "5815" },
  { id: "travel", label: "Travel", merchant: "United Airlines", cap: 240, mcc: "4511" },
];

export function CardsDesk({
  initialSpend = 0,
  view = "all",
}: {
  initialSpend?: number;
  view?: "all" | "account" | "pay" | "chain" | "number" | "expenses" | "rails";
}) {
  const { w, freeze, cardSpend, issue, terminate, replace, setLimit, sealIssued, issueCheckout } = useWallet();
  const [openId, setOpenId] = useState<string | null>(null);
  const [kind, setKind] = useState<CardKind>("virtual");
  const [nameOn, setNameOn] = useState("");
  const [limitRaw, setLimitRaw] = useState("1500");
  const [payId, setPayId] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [spendTo, setSpendTo] = useState("");
  const [spendUsd, setSpendUsd] = useState("5");
  const [spending, setSpending] = useState(false);

  const openCards = w.cards.filter((c) => c.status !== "terminated");
  const expenses = groupAuths(w.cardAuths ?? []);

  function issueNow() {
    const r = issue(kind, nameOn || w.tag.replace("@", "").toUpperCase() || "SENDA", Number(limitRaw) || 1500);
    if (!r.ok) toast.error(r.error);
    else toast.success("On this cash. A store network will not clear it.");
  }

  async function spendUsdc() {
    setSpending(true);
    try {
      const existing = w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      const done = await payUsdc({ owner, to: spendTo.trim(), usd: Number(spendUsd), memo: "senda card" });
      toast.success(`USDC sent. ${done.signature.slice(0, 8)}…`);
      setCardOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The transfer did not send.");
    } finally {
      setSpending(false);
    }
  }

  return (
    <main className="senda-rise space-y-3 px-3 py-3 lg:px-4">
      {view === "all" ? (
      <>
      <TabLead
        kicker="Shop"
        title="A number for the store"
        accent="not the token."
        line="The dollar number is a Lead Bank account. Deposits become USDC in the wallet. The Visa is Rain’s, not a number made here."
        live={["Account details", "USDC address", "One charge"]}
        coming={["Lead number, once the Bridge key is on", "A Rain Visa"]}
      />
      <MoneyJumps here="/cards" />
      <Link to="/cards/rails" className="flex items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-4">
        <span>
          <span className="block text-sm font-semibold">Real cards</span>
          <span className="mt-1 block text-xs text-muted">Jupiter, Phantom Cash, Rain, KAST, Fuse, Western Union. Their Visa. You sign the top-up.</span>
        </span>
        <span className="text-accent">→</span>
      </Link>
      <CardConnect owner={w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? ""} />
      <MoneyBar />
      <section className="rounded-[22px] border border-white/10 bg-black px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-semibold tracking-tight">Money</h2>
        </div>
        <button type="button" onClick={() => setCardOpen(true)} className="mt-4 flex w-full items-center justify-between text-left">
          <span>
            <span className="block text-xl font-semibold">Spend USDC</span>
            <span className="mt-1 block text-sm text-white/50">The wallet signs. No card number is minted here.</span>
          </span>
          <span className="text-white/50">›</span>
        </button>
        <div className="mt-4 flex items-center gap-4">
          <div className="relative grid h-16 w-28 place-items-end overflow-hidden rounded-xl border border-white/10 bg-[#07080d] p-2 text-xs font-semibold">
            <span className="absolute inset-x-0 top-0 h-px bg-[#d6ff4a]" />
            USDC
          </div>
          <div>
            <p className="text-lg font-semibold">Wallet spend</p>
            <p className="text-sm text-[#c6f56a]">USDC leaves only when you sign</p>
          </div>
        </div>
        <ul className="mt-5 space-y-2 text-sm text-white/80">
          <li>The receipt from Earn stays in this wallet. There is no lockup on a liquid stake token.</li>
          <li>A Solana send is not a card charge. Paying a debit card is Mastercard Send, and it only goes out when the partner key is on this server.</li>
          <li>Apple Pay and Google Pay are not attached. A network that is not signed is not shown as live.</li>
        </ul>
      </section>
      <McPayout />
      <CheckoutForm />
      <EarnDesk />
      {cardOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-[28px] bg-[#140b3a] p-5">
            <div className="flex justify-end">
              <button type="button" onClick={() => setCardOpen(false)} className="text-2xl text-white/70">×</button>
            </div>
            <h3 className="text-center text-3xl font-semibold">Spend from this wallet</h3>
            <p className="mt-2 text-center text-sm text-white/70">Phantom signs a USDC transfer to a Solana address. A coffee shop that does not take Solana cannot clear it.</p>
            <label className="mt-5 block text-xs text-white/50">
              Dollars
              <input inputMode="decimal" value={spendUsd} onChange={(e) => setSpendUsd(e.target.value)} className="mt-1 min-h-12 w-full rounded-2xl bg-black/40 px-4 font-mono text-lg outline-none" />
            </label>
            <label className="mt-3 block text-xs text-white/50">
              Solana address
              <input value={spendTo} onChange={(e) => setSpendTo(e.target.value)} placeholder="Address" className="mt-1 min-h-12 w-full rounded-2xl bg-black/40 px-4 font-mono text-sm outline-none" />
            </label>
            <button type="button" disabled={spending} onClick={() => void spendUsdc()} className="mt-5 min-h-14 w-full rounded-full bg-white text-base font-semibold text-black">
              {spending ? "Waiting for Phantom…" : "Sign USDC"}
            </button>
          </div>
        </div>
      ) : null}
      </>
      ) : null}

      {view === "all" || view === "account" ? <CorridorCard /> : null}

      {view === "all" || view === "account" ? (
      <AccountDetails owner={w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? ""} />
      ) : null}

      {view === "all" || view === "pay" ? (
      <CheckoutPay
        initialSpend={initialSpend}
        onMint={(cap, merchant, name) => issueCheckout(cap, merchant, name)}
        onAuth={(id, amount, merchant, mcc) => {
          const r = cardSpend(amount, merchant || "Checkout", id, mcc);
          if (!r.ok) toast.error(r.error);
          else toast.success("Approved once. That number is dead.");
          return r.ok;
        }}
      />
      ) : null}

      {view === "all" || view === "chain" ? (
      <PayOnChain owner={w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? ""} />
      ) : null}

      {view === "rails" ? <CardFund owner={w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? ""} /> : null}

      {view === "all" || view === "rails" ? <CardRails /> : null}

      {view === "all" || view === "expenses" ? (
      <section className={cn(PANEL, "p-4")}>
        <h2 className="text-sm font-semibold">Expenses</h2>
        {expenses.length === 0 ? (
          <p className="mt-3 text-sm text-muted">none yet</p>
        ) : (
          <ul className="mt-2 divide-y divide-white/10">
            {expenses.map((g) => (
              <li key={g.merchant} className="py-3">
                <p className="text-sm font-semibold">{g.merchant}</p>
                <ul className="mt-2 space-y-2">
                  {g.rows.map((a) => (
                    <li key={a.id} className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-sm tabular-nums">{formatMoney(a.amount)}</span>
                      <span className={cn("text-sm", a.status === "declined" ? "text-down" : "text-muted")}>{a.status}</span>
                      <span className="font-mono text-sm tabular-nums">···· {a.last4 || "—"}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
      ) : null}

      {view === "all" || view === "number" ? (
      <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setMaking((v) => !v)}
          className="min-h-10 rounded-full border border-white/10 px-4 text-sm font-semibold"
        >
          Make a card
        </button>
      </div>

      {making ? (
        <section className={cn(PANEL, "p-4")}>
          <div className="grid gap-2 sm:grid-cols-3">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={cn("rounded-[18px] px-4 py-3 text-left", kind === k.id ? "bg-accent text-accent-fg" : "bg-black/30")}
              >
                <span className="block text-sm font-semibold">{k.label}</span>
                <span className="mt-1 block text-xs opacity-75">{k.line}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
            <label className="block">
              <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">Name</span>
              <input
                value={nameOn}
                onChange={(e) => setNameOn(e.target.value.toUpperCase())}
                placeholder={w.tag.replace("@", "").toUpperCase() || "YOUR NAME"}
                className="mt-1 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">Daily cap</span>
              <input
                value={limitRaw}
                onChange={(e) => setLimitRaw(e.target.value)}
                inputMode="decimal"
                className="mt-1 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-sm outline-none"
              />
            </label>
            <button type="button" onClick={issueNow} className="min-h-12 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">
              Make this card
            </button>
          </div>
        </section>
      ) : null}

      {openCards.length ? (
        <section className="grid gap-3 lg:grid-cols-2">
          {openCards.map((c) => (
            <CardFace
              key={c.id}
              card={c}
              revealed={openId === c.id}
              paying={payId === c.id}
              onReveal={() => setOpenId(openId === c.id ? null : c.id)}
              onFreeze={() => freeze(c.id)}
              onTerminate={() => {
                terminate(c.id);
                toast.message("Terminated.");
              }}
              onReplace={() => {
                const r = replace(c.id);
                if (!r.ok) toast.error(r.error);
                else toast.success("New PAN. Old number dead.");
              }}
              onSeal={() => {
                const r = sealIssued(c.id);
                if (!r.ok) toast.error(r.error);
                else {
                  setOpenId(null);
                  toast.success("Number dropped. Last four stays.");
                }
              }}
              onLimit={(n) => {
                const r = setLimit(c.id, n);
                if (!r.ok) toast.error(r.error);
              }}
              onPay={() => setPayId(payId === c.id ? null : c.id)}
              onAuth={(amount, merchant, mcc) => {
                const r = cardSpend(amount, merchant, c.id, mcc);
                if (!r.ok) toast.error(r.error);
                else toast.success(`Approved ${formatMoney(amount)} · ${merchant}`);
              }}
            />
          ))}
        </section>
      ) : null}
      </>
      ) : null}
    </main>
  );
}

function CheckoutPay({
  initialSpend = 0,
  onMint,
  onAuth,
}: {
  initialSpend?: number;
  onMint: (
    cap: number,
    merchant: string,
    name: string,
  ) => { ok: true; reveal: { id: string; pan: string; cvv: string; expiry: string; last4: string } } | { ok: false; error: string };
  onAuth: (id: string, amount: number, merchant: string, mcc: string) => boolean;
}) {
  const [cap, setCap] = useState(initialSpend > 0 ? String(initialSpend) : "40");
  const [merchant, setMerchant] = useState("");
  const [name, setName] = useState("SENDA");
  const [mcc, setMcc] = useState("5999");
  const [picked, setPicked] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ id: string; pan: string; cvv: string; expiry: string; last4: string } | null>(null);
  const [spent, setSpent] = useState(false);
  const store = merchant.trim() || MCC.find((m) => m.id === mcc)?.label || "Store";

  function pickStore(id: string) {
    const s = STORES.find((x) => x.id === id);
    if (!s) return;
    setPicked(s.id);
    setMerchant(s.merchant);
    setCap(String(s.cap));
    setMcc(s.mcc);
    setName("SENDA");
  }

  return (
    <section className="grid items-stretch gap-3 lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.18fr)]">
      <div className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] lg:min-h-[340px]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_28%,rgb(255_255_255/0.07)_46%,transparent_64%)]" />
        <div className="relative flex items-start justify-between">
          <ChipMark />
          <McMark />
        </div>
        <div className="relative mt-6">
          {reveal ? (
            <>
              <p className="font-mono text-xl tracking-[0.14em] sm:text-2xl">{reveal.pan}</p>
              <p className="mt-3 font-mono text-sm tabular-nums">
                {reveal.expiry} · {reveal.cvv}
              </p>
              <p className="mt-1 font-mono text-[11px] text-white/45">···· {reveal.last4}</p>
            </>
          ) : (
            <p className="font-mono text-xl tracking-[0.18em] text-white/35">•••• •••• •••• ••••</p>
          )}
          <p className="mt-3 text-sm">{store}</p>
          <label className="mt-2 block">
            <span className="sr-only">Amount</span>
            <input
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              inputMode="decimal"
              aria-label="Amount"
              className="w-full bg-transparent font-mono text-4xl tabular-nums outline-none"
            />
          </label>
          {spent ? <p className="text-sm text-accent">Used</p> : null}
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          {reveal ? (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(reveal.pan.replace(/\s/g, ""));
                toast.success("Number copied. It is still not saved.");
              }}
              className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold"
            >
              Copy number
            </button>
          ) : null}
          {!spent ? (
            <button
              type="button"
              onClick={() => {
                if (!reveal) {
                  const r = onMint(Number(cap) || 0, merchant, name.trim() || "SENDA");
                  if (!r.ok) toast.error(r.error);
                  else {
                    setReveal(r.reveal);
                    setSpent(false);
                  }
                  return;
                }
                const ok = onAuth(reveal.id, Number(cap) || 0, store, mcc);
                if (ok) setSpent(true);
              }}
              className="min-h-11 flex-1 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg"
            >
              {reveal ? (
                <>
                  Charge <span className="font-mono">${Number(cap) || 0}</span>
                </>
              ) : (
                "Make the number"
              )}
            </button>
          ) : null}
        </div>
      </div>

      <div className={cn(PANEL, "p-3 sm:p-4")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STORES.map((s) => {
            const on = picked === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => pickStore(s.id)}
                className={cn(
                  "rounded-[22px] border border-white/10 px-3 py-3 text-left",
                  on ? "border-transparent bg-accent text-accent-fg" : "bg-black/30",
                )}
              >
                <span className="block text-sm font-semibold">{s.label}</span>
                <span className={cn("mt-1 block truncate text-xs", on ? "text-accent-fg/80" : "text-muted")}>{s.merchant}</span>
                <span className="mt-2 block font-mono text-sm tabular-nums">${s.cap}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ChipMark() {
  return (
    <span className="grid h-9 w-12 grid-cols-3 gap-px rounded-md bg-[#c6b48a] p-1" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="rounded-[1px] bg-[#8d7344]/80" />
      ))}
    </span>
  );
}

function PayOnChain({ owner }: { owner: string }) {
  const [to, setTo] = useState("");
  const [usd, setUsd] = useState("20");
  const [pay, setPay] = useState<(typeof PAY_WITH)[number]["id"]>("USDC");
  const [sig, setSig] = useState("");
  const [busy, setBusy] = useState(false);
  const picked = PAY_WITH.find((row) => row.id === pay) ?? PAY_WITH[1];

  return (
    <section className={cn(PANEL, "grid gap-3 p-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-end")}>
      <div>
        <p className="text-[11px] tracking-[0.14em] text-accent uppercase">Solana Pay</p>
        <h2 className="mt-1 text-lg">Pay the address</h2>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Phantom Cash, USDC, or USDT. The wallet signs one transfer of the token you pick. The address receives that token, not a conversion.
        </p>
        <div className="mt-3 flex gap-2">
          {PAY_WITH.map((row) => (
            <button key={row.id} type="button" onClick={() => setPay(row.id)} className={cn("min-h-10 rounded-full px-3 text-sm font-semibold", pay === row.id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
              {row.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Solana address"
          spellCheck={false}
          className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-sm outline-none"
        />
        <div className="flex gap-2">
          <input
            value={usd}
            onChange={(e) => setUsd(e.target.value)}
            inputMode="decimal"
            aria-label="Amount"
            className="min-h-12 w-28 rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-sm outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!owner) {
                toast.error("Connect a Solana wallet.");
                return;
              }
              setBusy(true);
              setSig("");
              const amount = Number(usd);
              const sent = pay === "USDC"
                ? payUsdc({ owner, to, usd: amount }).then((r) => r.signature)
                : payToken({ owner, to, mint: picked.mint, symbol: picked.id, amount }).then((r) => r.signature);
              void sent
                .then((signature) => {
                  setSig(signature);
                  toast.success("Phantom signed.");
                })
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "The transfer did not send."))
                .finally(() => setBusy(false));
            }}
            className="min-h-12 flex-1 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            {busy ? "Waiting on the wallet" : owner ? `Sign ${picked.label}` : "Connect a wallet first"}
          </button>
        </div>
        {sig ? (
          <a className="truncate font-mono text-xs text-accent" href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer">
            {sig}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function McMark() {
  return (
    <span className="font-mono text-[11px] tracking-[0.16em] text-white/70" aria-label="Senda number">
      SENDA
    </span>
  );
}

const RAILS: { name: string; spend: string; holds: string; clears: string; here: string }[] = [
  {
    name: "This desk",
    spend: "Senda cash",
    holds: "This browser",
    clears: "Nothing. The number never reaches Visa.",
    here: "Live. Cap, charge, freeze.",
  },
  {
    name: "Solana Pay",
    spend: "USDC on mainnet",
    holds: "Your wallet, until you sign",
    clears: "The merchant's USDC account. A memo carries the reference.",
    here: "Live. Sign USDC above.",
  },
  {
    name: "Phantom Cash",
    spend: "CASH, a Bridge dollar on Solana",
    holds: "Your Phantom balance until the swipe",
    clears: "Lead Bank debit. Apple Pay and Google Pay.",
    here: "Not ours. KYC inside Phantom.",
  },
  {
    name: "Jupiter",
    spend: "USDC",
    holds: "The Jupiter card balance",
    clears: "Visa. Issuer is Rain or DCS, depending on the card.",
    here: "Not ours. The card lives in Jupiter.",
  },
  {
    name: "KAST",
    spend: "USDC, USDT, or PYUSD, deposited on Solana",
    holds: "KAST. Custodial.",
    clears: "Visa, including a Solana-branded physical card.",
    here: "Not ours. KYC in the KAST app.",
  },
  {
    name: "Solflare",
    spend: "USDC from the wallet",
    holds: "Was the wallet",
    clears: "Paused 28 Jul 2026. The issuer, Kulipa, wound down.",
    here: "No card to use.",
  },
];

function CardRails() {
  return (
    <section className={cn(PANEL, "p-4")}>
      <div className="grid gap-3 lg:grid-cols-3">
        <div>
          <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">1 · Make</p>
          <p className="mt-1 text-sm text-muted">A 16-digit number, shown once. We keep the last four and the cap. Not the full number.</p>
        </div>
        <div>
          <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">2 · Charge</p>
          <p className="mt-1 text-sm text-muted">The charge debits Senda cash on this browser. It does not ask a bank, and a terminal will decline it.</p>
        </div>
        <div>
          <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">3 · A real swipe</p>
          <p className="mt-1 text-sm text-muted">A store clears only a number from an issuer. The top-up is on Rails. Senda does not print those 16 digits.</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[11px] tracking-[0.14em] text-subtle uppercase">
            <tr>
              <th className="py-2 pr-3 font-medium">Card</th>
              <th className="py-2 pr-3 font-medium">Spends</th>
              <th className="py-2 pr-3 font-medium">Who holds it</th>
              <th className="py-2 pr-3 font-medium">What a store sees</th>
              <th className="py-2 font-medium">On this desk</th>
            </tr>
          </thead>
          <tbody>
            {RAILS.map((r) => (
              <tr key={r.name} className="border-t border-white/10 align-top">
                <td className="py-3 pr-3 font-semibold">{r.name}</td>
                <td className="py-3 pr-3 text-muted">{r.spend}</td>
                <td className="py-3 pr-3 text-muted">{r.holds}</td>
                <td className="py-3 pr-3 text-muted">{r.clears}</td>
                <td className="py-3 text-muted">{r.here}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CardFace({
  card,
  revealed,
  paying,
  onReveal,
  onFreeze,
  onTerminate,
  onReplace,
  onSeal,
  onLimit,
  onPay,
  onAuth,
}: {
  card: Card;
  revealed: boolean;
  paying: boolean;
  onReveal: () => void;
  onFreeze: () => void;
  onTerminate: () => void;
  onReplace: () => void;
  onSeal: () => void;
  onLimit: (n: number) => void;
  onPay: () => void;
  onAuth: (amount: number, merchant: string, mcc: string) => void;
}) {
  const masked = card.sealed || !card.pan;
  const [merchant, setMerchant] = useState("");
  const [amt, setAmt] = useState("25");
  const [mcc, setMcc] = useState("5999");
  const [lim, setLim] = useState(String(card.dailyLimit));
  const status = card.frozen ? "Frozen" : masked ? "Sealed" : card.disposable ? "One charge" : "Live";

  return (
    <article className={cn(PANEL, "overflow-hidden")}>
      <div className="relative flex min-h-[210px] flex-col bg-[#07080d] px-5 py-5 shadow-[inset_0_1px_0_rgb(214_255_74/0.4)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[#d6ff4a]" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-white/55 uppercase">{card.label}</p>
            <p className="mt-2 inline-flex min-h-6 items-center rounded-full bg-[#d6ff4a] px-2 text-[11px] font-semibold text-black">{status}</p>
          </div>
          <McMark />
        </div>
        <div className="relative mt-5">
          <ChipMark />
        </div>
        <p className="relative mt-5 font-mono text-lg tracking-[0.18em] sm:text-xl">
          {revealed && !masked ? card.pan : `••••  ••••  ••••  ${card.last4}`}
        </p>
        <div className="relative mt-auto flex items-end justify-between pt-4 text-sm">
          <div>
            <p className="text-[10px] tracking-[0.14em] text-white/45 uppercase">Name</p>
            <p className="font-medium">{card.nameOn}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.14em] text-white/45 uppercase">Exp / CVV</p>
            <p className="font-mono">
              {card.expiry}
              {revealed && !masked ? `  ${card.cvv}` : "  •••"}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="font-mono text-xs text-subtle">
          {formatMoney(card.spent)} spent · {formatMoney(card.dailySpent)} / {formatMoney(card.dailyLimit)} today
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onFreeze} className="min-h-11 rounded-full bg-white/10 px-4 text-xs font-semibold">
            {card.frozen ? "Unfreeze" : "Freeze"}
          </button>
          {!masked ? (
            <button type="button" onClick={onSeal} className="min-h-11 rounded-full bg-white px-4 text-xs font-semibold text-black">
              Seal
            </button>
          ) : (
            <span className="inline-flex min-h-11 items-center text-xs text-subtle">Number not stored</span>
          )}
          <button type="button" onClick={onReveal} className="min-h-11 rounded-full bg-white/10 px-4 text-xs font-semibold">
            {revealed ? "Hide" : "Show"}
          </button>
          <button type="button" onClick={onPay} className="min-h-11 rounded-full bg-accent px-4 text-xs font-semibold text-accent-fg">
            Charge
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onReplace} className="min-h-10 rounded-full px-3 text-xs font-semibold text-muted">
            Replace
          </button>
          <button type="button" onClick={onTerminate} className="min-h-10 rounded-full px-3 text-xs font-semibold text-down">
            Terminate
          </button>
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onLimit(Number(lim) || 0);
            }}
          >
            <input
              value={lim}
              onChange={(e) => setLim(e.target.value)}
              className="min-h-10 w-24 rounded-full border border-white/10 bg-black/30 px-3 font-mono text-xs outline-none"
              aria-label="Daily limit"
            />
            <button type="submit" className="min-h-10 rounded-full bg-white/10 px-3 text-xs font-semibold">
              Daily
            </button>
          </form>
        </div>
        {paying ? (
          <div className="rounded-[18px] border border-white/10 bg-black/30 p-3">
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Store"
              className="min-h-11 w-full rounded-xl bg-[#10131c] px-3 text-sm outline-none"
            />
            <div className="mt-2 flex gap-2">
              {CAPS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmt(String(n))}
                  className={cn(
                    "grid size-10 flex-1 place-items-center rounded-full font-mono text-[11px] font-semibold",
                    Number(amt) === n ? "bg-accent text-accent-fg" : "bg-[#10131c] text-muted",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <input
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              inputMode="decimal"
              aria-label="Charge amount"
              className="mt-2 min-h-11 w-full rounded-xl bg-[#10131c] px-3 font-mono text-sm outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {MCC.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMcc(m.id)}
                  className={cn("min-h-8 rounded-full px-2.5 text-[11px] font-semibold", mcc === m.id ? "bg-accent text-accent-fg" : "text-muted")}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onAuth(Number(amt) || 0, merchant.trim() || "Store", mcc)}
              className="mt-3 min-h-11 w-full rounded-full bg-accent text-xs font-semibold text-accent-fg"
            >
              Charge {formatMoney(Number(amt) || 0)}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
