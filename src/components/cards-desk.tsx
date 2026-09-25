import { useState } from "react";
import { toast } from "sonner";
import { MCC } from "@/lib/card-issuing";
import { formatMoney, luhnOk, type Card, type CardKind } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const KINDS: { id: CardKind; label: string; blurb: string }[] = [
  { id: "virtual", label: "Virtual", blurb: "Mastercard-format debit on your Senda cash. Instant." },
  { id: "once", label: "One-time", blurb: "Shown once, then sealed. One capture. PAN is not kept." },
  { id: "fleet", label: "Fleet", blurb: "Higher cap. Same processor." },
];

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
    <main className="px-3 py-3 lg:px-4">
      <section className="senda-rise grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col justify-center rounded-[28px] border border-white/10 bg-[#0c0c14] p-6 lg:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Cards</p>
          <h1 className="mt-3 max-w-lg text-4xl leading-[1.05] tracking-tight lg:text-5xl">
            Pay a store from <span className="text-accent">this cash.</span>
          </h1>
          <p className="mt-4 font-mono text-5xl">${cash.toFixed(0)}</p>
          <p className="mt-3 max-w-md text-sm text-muted">
            {cash > 0
              ? "A charge comes out of this. The store gets a card number. It never sees your wallet, and it does not sell a PreStock."
              : "This is $0, so a store cannot charge yet. Add cash on Send, then come back and make the number."}
          </p>
          <a href="#make-card" className="mt-6 inline-flex min-h-12 w-fit items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">
            Make a card
          </a>
        </div>
        <div className="relative min-h-80 overflow-hidden rounded-[28px] border border-white/10">
          <video src="/video/card.mp4" poster="/images/metal-card.jpg" autoPlay muted loop playsInline className="senda-film h-full min-h-80 w-full object-cover" />
          <p className="absolute right-4 bottom-4 text-xs tracking-[0.18em] text-white/80 uppercase">The number. Not the wallet.</p>
        </div>
      </section>

      <section id="make-card" className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <p className="text-sm font-semibold">A card you keep</p>
          <p className="mt-1 text-sm text-muted">Use it more than once. Freeze it when you are done. The charge still has to fit in the cash above.</p>
          <div className="mt-4 grid gap-2">
            {KINDS.map((k) => (
              <button key={k.id} type="button" onClick={() => setKind(k.id)} className={cn("rounded-2xl px-4 py-3 text-left", kind === k.id ? "bg-accent text-accent-fg" : "bg-black/40")}>
                <span className="block text-sm font-semibold">{k.id === "virtual" ? "Everyday" : k.id === "once" ? "Burns after one charge" : "Higher limit"}</span>
                <span className="block text-xs opacity-80">{k.id === "virtual" ? "For stores you use again." : k.id === "once" ? "One charge, then the number dies." : "Same card, bigger daily cap."}</span>
              </button>
            ))}
          </div>
          <label className="mt-4 block text-xs text-subtle">Name on the card</label>
          <input value={nameOn} onChange={(e) => setNameOn(e.target.value.toUpperCase())} placeholder={w.tag.replace("@", "").toUpperCase() || "YOUR NAME"} className="mt-1 min-h-12 w-full rounded-2xl bg-black/40 px-4 text-sm outline-none" />
          <label className="mt-3 block text-xs text-subtle">Most it can spend in a day</label>
          <input value={limitRaw} onChange={(e) => setLimitRaw(e.target.value)} inputMode="decimal" className="mt-1 min-h-12 w-full rounded-2xl bg-black/40 px-4 text-sm outline-none" />
          <button type="button" onClick={issueNow} className="mt-4 min-h-12 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">
            Put this card on the account
          </button>
        </div>
        <div className="overflow-hidden rounded-[28px] border border-white/10">
          <img src="/images/metal-card.jpg" alt="The card a store sees" className="h-44 w-full object-cover" />
          <div className="bg-[#101018] p-5">
            <p className="text-sm font-semibold">{live.length ? `${live.length} live` : "No card yet"}</p>
            <p className="mt-1 text-sm text-muted">{live.length ? "The ones below are the numbers a store can charge." : "Nothing to type at checkout until you make one."}</p>
          </div>
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
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
          </div>
          {(w.cardAuths ?? []).length > 0 ? (
            <section className="mt-3 rounded-[28px] border border-white/10 bg-[#101018] p-5">
              <h2 className="text-sm font-semibold">Charges</h2>
              <ul className="mt-2 divide-y divide-border">
                {w.cardAuths.slice(0, 12).map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between py-3">
                    <div>
                      <p className="text-sm">{a.merchant}</p>
                      <p className="font-mono text-[11px] text-subtle">
                        {a.mti ?? "0110"} · STAN {a.stan ?? "—"} · RC {a.rc ?? a.status} · {a.mcc}
                      </p>
                    </div>
                    <p className={cn("font-mono text-sm", a.status === "declined" ? "text-down" : "text-fg")}>
                      {formatMoney(a.amount)}
                    </p>
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

  return (
    <section className="mt-3 grid gap-4 rounded-[28px] border border-white/10 bg-[#101018] p-4 lg:grid-cols-2">
      <div>
        <p className="text-xs tracking-wide text-subtle uppercase">One store</p>
        <h2 className="mt-1 font-display text-3xl">A number for this checkout</h2>
        <p className="mt-2 text-sm text-muted">
          Type the store and the amount. The number shows once. Copy it into checkout. The charge comes out of the cash on this page. A second try is declined.
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {MCC.map((m) => (
            <button key={m.id} type="button" onClick={() => setMcc(m.id)} className={cn("min-h-8 rounded-full px-3 text-xs font-semibold", mcc === m.id ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}>
              {m.label}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-xs text-subtle">Cap</label>
        <input
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          inputMode="decimal"
          className="mt-1 min-h-11 w-full rounded-lg bg-bg px-3 text-sm outline-none"
        />
        <label className="mt-3 block text-xs text-subtle">Lock to a store (optional)</label>
        <input
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="Store name"
          className="mt-1 min-h-11 w-full rounded-lg bg-bg px-3 text-sm outline-none"
        />
        <label className="mt-3 block text-xs text-subtle">Name printed</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          className="mt-1 min-h-11 w-full rounded-lg bg-bg px-3 text-sm outline-none"
        />
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
          className="mt-4 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
        >
          New number
        </button>
      </div>
      <div className="rounded-xl bg-bg p-4">
        {!reveal ? (
          <p className="text-sm text-subtle">The number shows here once. Leave this page and it is gone.</p>
        ) : (
          <>
            <p className="font-mono text-lg tracking-wide">{reveal.pan}</p>
            <p className="mt-2 font-mono text-sm text-muted">
              {reveal.expiry} · {reveal.cvv}
            </p>
            <p className="mt-2 text-xs text-subtle">Not stored. ··{reveal.last4} is all the account keeps.</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(reveal.pan.replace(/\s/g, ""));
                toast.success("Number copied. It is still not saved.");
              }}
              className="mt-4 min-h-11 rounded-lg bg-elevated px-4 text-sm font-semibold"
            >
              Copy number
            </button>
            {!spent ? (
              <button
                type="button"
                onClick={() => {
                  const ok = onAuth(reveal.id, Number(cap) || 0, merchant.trim() || MCC.find((m) => m.id === mcc)?.label || "Store", mcc);
                  if (ok) setSpent(true);
                }}
                className="mt-2 min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg"
              >
                Mark this charge
              </button>
            ) : (
              <p className="mt-3 text-sm text-up">Used. That number will not run again.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function McMark() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Mastercard-format">
      <span className="size-5 rounded-full bg-[#eb001b]" />
      <span className="-ml-2.5 size-5 rounded-full bg-[#f79e1b] mix-blend-screen" />
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
  const valid = card.pan ? luhnOk(card.pan) : false;
  const masked = card.sealed || !card.pan;
  const [merchant, setMerchant] = useState("");
  const [amt, setAmt] = useState("24");
  const [mcc, setMcc] = useState("5999");
  const [lim, setLim] = useState(String(card.dailyLimit));

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#16161f] to-[#0c2418] text-fg">
      <div className="px-5 py-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide uppercase opacity-70">{card.label}</p>
          <McMark />
        </div>
        <p className="mt-8 font-mono text-lg font-semibold tracking-[0.14em] tabular-nums">
          {revealed && !masked ? card.pan : `••••  ••••  ••••  ${card.last4}`}
        </p>
        <div className="mt-6 flex items-end justify-between text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wide opacity-50">Name</p>
            <p className="font-medium">{card.nameOn}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide opacity-50">Exp / CVV</p>
            <p className="tabular-nums">
              {card.expiry}
              {revealed && !masked ? `  ${card.cvv}` : "  •••"}
            </p>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] opacity-50">
          IIN {card.bin} · {masked ? "sealed" : valid ? "Luhn ok" : "Luhn fail"} · {card.status}
          {card.frozen ? " · frozen" : ""}
        </p>
      </div>
      <div className="bg-bg px-4 py-4 text-fg">
        <p className="text-xs text-muted">
          Spent {formatMoney(card.spent)} · today {formatMoney(card.dailySpent)} / {formatMoney(card.dailyLimit)} daily
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onFreeze} className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold">
            {card.frozen ? "Unfreeze" : "Freeze"}
          </button>
          <button type="button" onClick={onReveal} className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold">
            {revealed ? "Hide PAN" : "Show PAN"}
          </button>
          {!masked ? (
            <button type="button" onClick={onSeal} className="min-h-11 rounded-full bg-fg px-4 text-xs font-semibold text-bg">
              Seal number
            </button>
          ) : (
            <span className="inline-flex min-h-11 items-center text-xs text-subtle">Number not stored</span>
          )}
          <button type="button" onClick={onReplace} className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold">
            Replace PAN
          </button>
          <button type="button" onClick={onPay} className="min-h-11 rounded-full bg-accent px-4 text-xs font-semibold text-accent-fg">
            Authorize
          </button>
          <button type="button" onClick={onTerminate} className="min-h-11 rounded-full px-4 text-xs font-semibold text-down">
            Terminate
          </button>
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onLimit(Number(lim) || 0);
          }}
        >
          <input
            value={lim}
            onChange={(e) => setLim(e.target.value)}
            className="min-h-11 flex-1 rounded-full bg-elevated px-4 text-xs outline-none"
            aria-label="Daily limit"
          />
          <button type="submit" className="min-h-11 rounded-full bg-elevated px-4 text-xs font-semibold">
            Set daily
          </button>
        </form>
        {paying ? (
          <div className="mt-4 rounded-2xl bg-elevated p-3">
            <p className="text-xs font-medium text-muted">Authorization · 3DS on this device</p>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Merchant"
              className="mt-2 min-h-11 w-full rounded-xl bg-bg px-3 text-sm outline-none"
            />
            <input
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              inputMode="decimal"
              className="mt-2 min-h-11 w-full rounded-xl bg-bg px-3 text-sm outline-none"
            />
            <select
              value={mcc}
              onChange={(e) => setMcc(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl bg-bg px-3 text-sm outline-none"
            >
              {MCC.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onAuth(Number(amt) || 0, merchant.trim() || "Merchant", mcc)}
              className="mt-3 min-h-11 w-full rounded-full bg-fg text-xs font-semibold text-bg"
            >
              Approve {formatMoney(Number(amt) || 0)}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
