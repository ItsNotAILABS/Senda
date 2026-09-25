import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { MCC } from "@/lib/card-issuing";
import { formatMoney, type Card, type CardKind } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const PANEL = "rounded-[22px] border border-white/[0.08] bg-[#10131c]";

const KINDS: { id: CardKind; label: string; line: string }[] = [
  { id: "virtual", label: "Everyday", line: "Use it again." },
  { id: "once", label: "One charge", line: "Then the number dies." },
  { id: "fleet", label: "Fleet", line: "Higher daily cap." },
];

const CAPS = [20, 40, 80, 150];

export function CardsDesk({ initialSpend = 0 }: { initialSpend?: number }) {
  const { w, freeze, cardSpend, issue, terminate, replace, setLimit, sealIssued, issueCheckout } = useWallet();
  const [openId, setOpenId] = useState<string | null>(null);
  const [kind, setKind] = useState<CardKind>("virtual");
  const [nameOn, setNameOn] = useState("");
  const [limitRaw, setLimitRaw] = useState("1500");
  const [payId, setPayId] = useState<string | null>(null);

  const live = w.cards.filter((c) => c.status !== "terminated");
  const cash = (w.balances.USD || 0) + (w.balances.USDC || 0);

  function issueNow() {
    const r = issue(kind, nameOn || w.tag.replace("@", "").toUpperCase() || "SENDA", Number(limitRaw) || 1500);
    if (!r.ok) toast.error(r.error);
    else toast.success("That card is on the account. The store charges this cash.");
  }

  return (
    <main className="senda-rise space-y-3 px-3 py-3 lg:px-4">
      <header className={cn(PANEL, "px-6 py-6 lg:px-8")}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">Shop</p>
            <h1 className="mt-2 text-5xl tracking-tight lg:text-6xl">The card</h1>
          </div>
          <div className="text-right">
            <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Cash</p>
            <p className="font-mono text-4xl lg:text-5xl">${cash.toFixed(0)}</p>
          </div>
        </div>
        <p className="mt-3 max-w-md text-sm text-muted">
          {cash > 0 ? "A store charges this cash." : "Nothing to charge until cash is on the account."}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a href="#make-card" className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">
            Make a card
          </a>
          {cash <= 0 ? (
            <Link to="/payments" className="text-sm font-semibold text-accent">
              Add cash
            </Link>
          ) : null}
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
        <div className="relative min-h-[420px] overflow-hidden rounded-[22px] border border-white/[0.08]">
          <video
            src="/video/card.mp4"
            poster="/images/metal-card.jpg"
            autoPlay
            muted
            loop
            playsInline
            className="senda-film absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <p className="absolute bottom-5 left-5 text-xs tracking-[0.18em] text-white/85 uppercase">The number. Not the wallet.</p>
        </div>
        <div className="relative min-h-72 overflow-hidden rounded-[22px] border border-white/[0.08] lg:min-h-[420px]">
          <img src="/images/metal-card.jpg" alt="Metal card" className="h-full min-h-72 w-full object-cover lg:min-h-[420px]" />
        </div>
      </section>

      <section id="make-card" className={cn(PANEL, "p-5 sm:p-6")}>
        <h2 className="text-3xl">Make a card</h2>
        <p className="mt-1 text-sm text-muted">It spends the cash above.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={cn("rounded-[18px] px-4 py-4 text-left", kind === k.id ? "bg-accent text-accent-fg" : "bg-black/30")}
            >
              <span className="block text-sm font-semibold">{k.label}</span>
              <span className="mt-1 block text-xs opacity-75">{k.line}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
          <label className="block">
            <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">Name</span>
            <input
              value={nameOn}
              onChange={(e) => setNameOn(e.target.value.toUpperCase())}
              placeholder={w.tag.replace("@", "").toUpperCase() || "YOUR NAME"}
              className="mt-1 min-h-12 w-full rounded-2xl border border-white/[0.06] bg-black/30 px-4 text-sm outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">Daily cap</span>
            <input
              value={limitRaw}
              onChange={(e) => setLimitRaw(e.target.value)}
              inputMode="decimal"
              className="mt-1 min-h-12 w-full rounded-2xl border border-white/[0.06] bg-black/30 px-4 text-sm outline-none"
            />
          </label>
          <button type="button" onClick={issueNow} className="min-h-12 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">
            Make this card
          </button>
        </div>
      </section>

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

      {live.length ? (
        <section className="grid gap-3 lg:grid-cols-2">
          {live.map((c) => (
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

      {(w.cardAuths ?? []).length > 0 ? (
        <section className={cn(PANEL, "p-5")}>
          <h2 className="text-sm font-semibold">Charges</h2>
          <ul className="mt-2 divide-y divide-white/10">
            {w.cardAuths.slice(0, 12).map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 py-3">
                <div>
                  <p className="text-sm">{a.merchant}</p>
                  <p className="font-mono text-[11px] text-subtle">
                    {a.mti ?? "0110"} · STAN {a.stan ?? "—"} · RC {a.rc ?? a.status} · {a.mcc}
                  </p>
                </div>
                <p className={cn("font-mono text-sm", a.status === "declined" ? "text-down" : "text-fg")}>{formatMoney(a.amount)}</p>
              </li>
            ))}
          </ul>
        </section>
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
  const [reveal, setReveal] = useState<{ id: string; pan: string; cvv: string; expiry: string; last4: string } | null>(null);
  const [spent, setSpent] = useState(false);
  const store = merchant.trim() || MCC.find((m) => m.id === mcc)?.label || "Store";

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <div className={cn(PANEL, "p-5 sm:p-6")}>
        <h2 className="text-3xl">This checkout</h2>
        <p className="mt-1 text-sm text-muted">One number. One charge.</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {MCC.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMcc(m.id)}
              className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", mcc === m.id ? "bg-accent text-accent-fg" : "bg-black/30 text-muted")}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {CAPS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCap(String(n))}
              className={cn(
                "grid size-12 place-items-center rounded-full font-mono text-xs font-semibold",
                "shadow-[inset_0_0_0_2px_rgb(255_255_255/0.22),inset_0_0_0_5px_rgb(7_8_13/0.5)]",
                Number(cap) === n ? "bg-accent text-accent-fg" : "bg-[#171c12] text-accent",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">Amount</span>
          <input
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            inputMode="decimal"
            className="mt-1 min-h-12 w-full rounded-2xl border border-white/[0.06] bg-black/30 px-4 text-sm outline-none"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">Store</span>
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Store name"
            className="mt-1 min-h-12 w-full rounded-2xl border border-white/[0.06] bg-black/30 px-4 text-sm outline-none"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            className="mt-1 min-h-12 w-full rounded-2xl border border-white/[0.06] bg-black/30 px-4 text-sm outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            const r = onMint(Number(cap) || 0, merchant, name.trim() || "SENDA");
            if (!r.ok) toast.error(r.error);
            else {
              setReveal(r.reveal);
              setSpent(false);
            }
          }}
          className="mt-4 min-h-12 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg"
        >
          Make the number
        </button>
      </div>

      <div className="relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#141820] p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_28%,rgb(255_255_255/0.07)_46%,transparent_64%)]" />
        <div className="relative flex items-start justify-between">
          <ChipMark />
          <McMark />
        </div>
        {!reveal ? (
          <div className="relative">
            <p className="font-mono text-xl tracking-[0.18em] text-white/40">•••• •••• •••• ••••</p>
            <p className="mt-3 text-sm text-muted">The number shows once.</p>
          </div>
        ) : (
          <div className="relative">
            <p className="font-mono text-xl tracking-[0.16em] sm:text-2xl">{reveal.pan}</p>
            <div className="mt-5 flex items-end justify-between text-sm">
              <div>
                <p className="text-[10px] tracking-[0.14em] text-white/50 uppercase">Name</p>
                <p>{name.trim() || "SENDA"}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] tracking-[0.14em] text-white/50 uppercase">Exp / CVV</p>
                <p className="font-mono">
                  {reveal.expiry} · {reveal.cvv}
                </p>
              </div>
            </div>
            <p className="mt-3 font-mono text-[11px] text-white/45">Not stored ···· {reveal.last4}</p>
            {spent ? <p className="mt-3 text-sm text-accent">Used. That number will not run again.</p> : null}
          </div>
        )}
        <div className="relative mt-6 flex flex-wrap gap-2">
          {reveal ? (
            <>
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
              {!spent ? (
                <button
                  type="button"
                  onClick={() => {
                    const ok = onAuth(reveal.id, Number(cap) || 0, store, mcc);
                    if (ok) setSpent(true);
                  }}
                  className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg"
                >
                  Charge ${Number(cap) || 0}
                </button>
              ) : null}
            </>
          ) : (
            <p className="text-xs tracking-[0.16em] text-white/50 uppercase">{store}</p>
          )}
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

function McMark() {
  return (
    <span className="inline-flex items-center" aria-label="Mastercard-format">
      <span className="size-6 rounded-full bg-[#eb001b]" />
      <span className="-ml-3 size-6 rounded-full bg-[#f79e1b] mix-blend-screen" />
    </span>
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
      <div className="relative overflow-hidden bg-[#141820] px-6 py-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,rgb(255_255_255/0.07)_48%,transparent_66%)]" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-white/55 uppercase">{card.label}</p>
            <p className="mt-1 text-xs font-semibold text-accent">{status}</p>
          </div>
          <McMark />
        </div>
        <div className="relative mt-8">
          <ChipMark />
        </div>
        <p className="relative mt-6 font-mono text-lg tracking-[0.16em] sm:text-xl">
          {revealed && !masked ? card.pan : `••••  ••••  ••••  ${card.last4}`}
        </p>
        <div className="relative mt-6 flex items-end justify-between text-sm">
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
              className="min-h-10 w-24 rounded-full border border-white/[0.06] bg-black/30 px-3 text-xs outline-none"
              aria-label="Daily limit"
            />
            <button type="submit" className="min-h-10 rounded-full bg-white/10 px-3 text-xs font-semibold">
              Daily
            </button>
          </form>
        </div>
        {paying ? (
          <div className="rounded-[18px] border border-white/[0.06] bg-black/30 p-3">
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
              className="mt-2 min-h-11 w-full rounded-xl bg-[#10131c] px-3 text-sm outline-none"
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
