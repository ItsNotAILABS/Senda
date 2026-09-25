import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { MCC } from "@/lib/card-issuing";
import { TabLead } from "@/components/tab-lead";
import { formatMoney, type Card, type CardAuth, type CardKind } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

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

export function CardsDesk({ initialSpend = 0 }: { initialSpend?: number }) {
  const { w, freeze, cardSpend, issue, terminate, replace, setLimit, sealIssued, issueCheckout } = useWallet();
  const [openId, setOpenId] = useState<string | null>(null);
  const [kind, setKind] = useState<CardKind>("virtual");
  const [nameOn, setNameOn] = useState("");
  const [limitRaw, setLimitRaw] = useState("1500");
  const [payId, setPayId] = useState<string | null>(null);

  const openCards = w.cards.filter((c) => c.status !== "terminated");
  const cash = (w.balances.USD || 0) + (w.balances.USDC || 0);
  const expenses = groupAuths(w.cardAuths ?? []);

  function issueNow() {
    const r = issue(kind, nameOn || w.tag.replace("@", "").toUpperCase() || "SENDA", Number(limitRaw) || 1500);
    if (!r.ok) toast.error(r.error);
    else toast.success("That card is on the account. The store charges this cash.");
  }

  return (
    <main className="senda-rise space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Shop"
        title="A number for the store"
        accent="not the token."
        line="The store sees a number. The charge takes the cash on this account."
        live={["Make a card", "One-time number", "Charge Senda cash", "Freeze"]}
        coming={["A licensed card network", "Apple Pay", "The charge actually reaching a merchant"]}
      />

      <section className={cn(PANEL, "flex flex-wrap items-end justify-between gap-4 px-5 py-4")}>
        <div>
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Cash</p>
          <p className="font-mono text-4xl tabular-nums">${cash.toFixed(0)}</p>
          <p className="mt-1 text-sm text-muted">
            {cash > 0 ? "A store charge takes this cash." : "Nothing to charge until cash is on the account."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="#make-card" className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">
            Make a card
          </a>
          {cash <= 0 ? (
            <Link to="/payments" className="text-sm font-semibold text-accent">
              Add cash
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
        <div className="relative min-h-[420px] overflow-hidden rounded-[22px] border border-white/10">
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
        <div className="relative min-h-72 overflow-hidden rounded-[22px] border border-white/10 lg:min-h-[420px]">
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

      <section className={cn(PANEL, "p-5")}>
        <h2 className="text-sm font-semibold">Expenses</h2>
        {expenses.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No spend yet.</p>
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
  }

  return (
    <section className="space-y-3">
      <div className={cn(PANEL, "p-4 sm:p-5")}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Stores</h2>
          <p className="text-xs text-muted">Fills the checkout. Nothing moves until you charge.</p>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {STORES.map((s) => {
            const on = picked === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => pickStore(s.id)}
                className={cn(
                  "min-w-[7.75rem] shrink-0 rounded-[22px] border border-white/10 px-3 py-3 text-left",
                  on ? "border-transparent bg-accent text-accent-fg" : "bg-[#10131c]",
                )}
              >
                <span className="block text-sm font-semibold">{s.label}</span>
                <span className={cn("mt-1 block truncate text-xs", on ? "text-accent-fg/80" : "text-muted")}>{s.merchant}</span>
                <span className="mt-2 block font-mono text-sm">${s.cap}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
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
            className="mt-1 min-h-12 w-full rounded-2xl border border-white/[0.06] bg-black/30 px-4 font-mono text-lg outline-none"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">Store</span>
          <input
            value={merchant}
            onChange={(e) => {
              const next = e.target.value;
              setMerchant(next);
              setPicked((id) => (STORES.find((s) => s.id === id)?.merchant === next ? id : null));
            }}
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

      <div className="relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-[22px] border border-white/10 bg-[#141820] p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]">
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
                  Charge <span className="font-mono">${Number(cap) || 0}</span>
                </button>
              ) : null}
            </>
          ) : (
            <p className="text-xs tracking-[0.16em] text-white/50 uppercase">{store}</p>
          )}
        </div>
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
