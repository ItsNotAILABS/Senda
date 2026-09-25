import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Bluetooth, Plus, RefreshCw } from "lucide-react";
import { AddMoneyScreen } from "@/components/add-money";
import { NearbyDesk } from "@/components/nearby-desk";
import { CCYS, CCY_META, formatMoney, revolutFee, sendaDeposit, type Ccy } from "@/lib/wallet";
import { rate } from "@/lib/wallet-fx";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export type PayAct = "send" | "request" | "exchange" | "add" | "withdraw" | "nearby";

const ACTS: { id: PayAct; label: string; icon: typeof ArrowUpRight }[] = [
  { id: "send", label: "Send", icon: ArrowUpRight },
  { id: "request", label: "Request", icon: ArrowDownLeft },
  { id: "nearby", label: "Nearby", icon: Bluetooth },
  { id: "exchange", label: "Exchange", icon: RefreshCw },
  { id: "add", label: "Add", icon: Plus },
];

const field =
  "min-h-12 w-full rounded-2xl border border-white/[0.08] bg-black/30 px-4 text-sm outline-none placeholder:text-subtle";

export function PaymentsDesk({ initialAct, initialFrom }: { initialAct?: string; initialFrom?: string }) {
  const start: PayAct = ACTS.some((a) => a.id === initialAct) ? (initialAct as PayAct) : "send";
  const [act, setAct] = useState<PayAct>(start);
  const [pocket, setPocket] = useState<Ccy | null>(null);
  const w = useWallet();
  const fromInit = CCYS.includes(initialFrom as Ccy) ? (initialFrom as Ccy) : "USD";

  const total = CCYS.reduce((s, c) => s + (w.w.balances[c] || 0) * (w.usdPer[c] || (c === "USD" || c === "USDC" ? 1 : 0)), 0);
  const open = CCYS.filter((c) => w.w.opened.includes(c) || (w.w.balances[c] || 0) > 0);
  const pockets = (open.length ? open : (["USD"] as Ccy[])).map((c) => ({
    c,
    v: w.w.balances[c] || 0,
  }));
  const ach = sendaDeposit(w.w.tag);

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <section className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5 sm:p-6">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Send</p>
        <h1 className="mt-2 text-4xl tracking-tight">
          Cash on hand. <span className="text-accent">Send it.</span>
        </h1>
        <p className="mt-5 font-mono text-5xl tabular-nums tracking-tight">{formatMoney(total, "USD")}</p>
        <p className="mt-2 text-sm text-muted">{w.w.tag}</p>
        <p className="mt-1 font-mono text-xs text-subtle">
          {ach.routing} · {ach.account}
        </p>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#10131c]">
        <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold">Pockets</h2>
          <p className="font-mono text-[11px] text-subtle">{pockets.length}</p>
        </div>
        <ul>
          {pockets.map((p) => {
            const meta = CCY_META[p.c];
            const px = w.usdPer[p.c] || (p.c === "USD" || p.c === "USDC" ? 1 : 0);
            return (
              <li key={p.c} className="border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    setPocket(p.c);
                    setAct("exchange");
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-[11px]">
                    {meta.flag}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{meta.name}</span>
                    <span className="block font-mono text-[11px] text-subtle">{p.c}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-sm tabular-nums">{formatMoney(p.v, p.c)}</span>
                    {p.c !== "USD" && px > 0 ? (
                      <span className="block font-mono text-[11px] text-subtle tabular-nums">{formatMoney(p.v * px, "USD")}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid grid-cols-5 rounded-[22px] border border-white/[0.08] bg-[#10131c] p-2">
        {ACTS.map((a) => {
          const Icon = a.icon;
          const on = act === a.id;
          return (
            <button key={a.id} type="button" onClick={() => setAct(a.id)} className="flex flex-col items-center gap-2 rounded-2xl px-1 py-2">
              <span className={cn("grid size-10 place-items-center rounded-full", on ? "bg-accent text-accent-fg" : "bg-white/[0.06]")}>
                <Icon className="size-4" strokeWidth={1.9} />
              </span>
              <span className={cn("text-[11px] font-semibold sm:text-xs", on ? "text-fg" : "text-muted")}>{a.label}</span>
            </button>
          );
        })}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className={cn("rounded-[22px] border border-white/[0.08] bg-[#10131c]", act === "nearby" ? "py-4" : "p-5")}>
          {act === "send" ? <SendForm w={w} /> : null}
          {act === "nearby" ? <NearbyDesk /> : null}
          {act === "request" ? <RequestForm w={w} /> : null}
          {act === "exchange" ? <ExchangeForm key={pocket ?? fromInit} w={w} fromInit={pocket ?? fromInit} /> : null}
          {act === "add" ? <AddForm w={w} /> : null}
        </div>
        <aside className="h-fit rounded-[22px] border border-white/[0.08] bg-[#10131c] p-4">
          <h2 className="text-sm font-semibold">Activity</h2>
          {w.w.txs.length === 0 ? <p className="py-4 text-sm text-subtle">Nothing sent yet.</p> : null}
          <ul>
            {w.w.txs.slice(0, 12).map((t) => (
              <li key={t.id} className="border-t border-white/[0.08] py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">{t.counterparty}</p>
                  <p className="font-mono text-xs tabular-nums">{formatMoney(t.amount, t.ccy)}</p>
                </div>
                <p className="text-xs text-subtle">
                  {t.kind}
                  {t.note ? ` · ${t.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </div>
  );
}

function SendForm({ w }: { w: ReturnType<typeof useWallet> }) {
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [ccy, setCcy] = useState<Ccy>("USD");
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = Number(raw) || 0;
  const amountUsd = amount * (w.usdPer[ccy] || 0);
  const rev = revolutFee("send", amountUsd, w.weekend);

  function go() {
    if (busy) return;
    const t = tag.trim();
    if (!t) {
      toast.error("Who is it for?");
      return;
    }
    setBusy(true);
    const who = w.remember(name || t, t);
    const r = w.send(amount, ccy, who, note);
    setBusy(false);
    if (!r.ok) toast.error(r.error);
    else toast.success(`Sent ${formatMoney(amount, ccy)} to ${who.tag}.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="text-xs font-medium text-subtle">To · @tag</span>
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="@someone" className={cn(field, "mt-1")} />
      </label>
      {w.w.contacts.length > 0 ? (
        <div className="flex gap-1 overflow-x-auto">
          {w.w.contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setTag(c.tag);
                setName(c.name);
              }}
              className="min-h-11 shrink-0 rounded-full bg-white/[0.06] px-4 text-sm font-medium"
            >
              {c.tag}
            </button>
          ))}
        </div>
      ) : null}
      <label className="block">
        <span className="text-xs font-medium text-subtle">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" className={cn(field, "mt-1")} />
      </label>
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="text-xs font-medium text-subtle">Amount</span>
          <input
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="0"
            className={cn(field, "mt-1 font-mono text-lg tabular-nums")}
          />
        </label>
        <label className="w-28">
          <span className="text-xs font-medium text-subtle">Ccy</span>
          <select value={ccy} onChange={(e) => setCcy(e.target.value as Ccy)} className={cn(field, "mt-1")}>
            {CCYS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className={field} />
      <p className="text-sm text-muted">
        Instant · $0 · available {formatMoney(w.w.balances[ccy], ccy)}
        {rev > 0 ? ` · Revolut would take ${formatMoney(rev)}` : ""}
      </p>
      <button
        type="button"
        disabled={busy || !(amount > 0)}
        onClick={go}
        className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40"
      >
        Send
      </button>
    </div>
  );
}

function RequestForm({ w }: { w: ReturnType<typeof useWallet> }) {
  const opened = w.w.opened?.length ? w.w.opened : ["USD"];
  const [tag, setTag] = useState("");
  const [ccy, setCcy] = useState<Ccy>("USD");
  const [raw, setRaw] = useState("");
  const amount = Number(raw) || 0;

  function go() {
    const t = tag.trim();
    if (!t) {
      toast.error("Who from?");
      return;
    }
    const who = w.remember(t, t);
    const r = w.receive(amount, ccy, who.tag, `Paid your request · ${ccy}`);
    if (r.ok) toast.success(`${who.tag} paid ${formatMoney(amount, ccy)}.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Lands in the currency you pick.</p>
      <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="@someone" className={field} />
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="0"
          className={cn(field, "flex-1 font-mono text-lg tabular-nums")}
        />
        <select value={ccy} onChange={(e) => setCcy(e.target.value as Ccy)} className={cn(field, "w-28")}>
          {opened.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={!(amount > 0)}
        onClick={go}
        className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40"
      >
        Request {amount > 0 ? formatMoney(amount, ccy) : ""}
      </button>
    </div>
  );
}

function ExchangeForm({ w, fromInit }: { w: ReturnType<typeof useWallet>; fromInit: Ccy }) {
  const opened: Ccy[] = w.w.opened?.length ? w.w.opened : ["USD"];
  const [from, setFrom] = useState<Ccy>(opened.includes(fromInit) ? fromInit : "USD");
  const [to, setTo] = useState<Ccy>("EUR");
  const [raw, setRaw] = useState("");
  const amount = Number(raw) || 0;
  const r = rate(from, to, w.usdPer);
  const got = amount * r;
  const amountUsd = amount * (w.usdPer[from] || 0);
  const rev = revolutFee("fx", amountUsd, w.weekend);
  const oneToOne = (from === "USD" && to === "USDC") || (from === "USDC" && to === "USD");

  const preview = useMemo(() => got, [got]);

  function go() {
    const res = w.convert(from, to, amount);
    if (!res.ok) toast.error(res.error);
    else toast.success(`Now holding ${formatMoney(preview, to)}.`);
  }

  const choices = Array.from(new Set([...opened, from, to]));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">It stays in the currency you pick.</p>
      <div className="grid grid-cols-2 gap-2">
        <select value={from} onChange={(e) => setFrom(e.target.value as Ccy)} className={field}>
          {choices.map((c) => (
            <option key={c} value={c}>
              From {c}
            </option>
          ))}
        </select>
        <select value={to} onChange={(e) => setTo(e.target.value as Ccy)} className={field}>
          {CCYS.map((c) => (
            <option key={c} value={c}>
              Hold {c}
            </option>
          ))}
        </select>
      </div>
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="0"
        className={cn(field, "min-h-14 font-mono text-3xl tabular-nums")}
      />
      <p className="font-mono text-xs text-subtle">Available {formatMoney(w.w.balances[from] ?? 0, from)}</p>
      <div className="rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm">
        <p className="font-medium">You hold {formatMoney(got, to)}</p>
        <p className="mt-1 text-muted">
          {oneToOne ? "USDC ↔ USD is 1:1. No spread." : `1 ${from} = ${r.toFixed(4)} ${to} · mid-market · $0`}
        </p>
        {rev > 0 ? <p className="mt-1 text-muted">Revolut weekend/over-cap would take {formatMoney(rev)}.</p> : null}
      </div>
      <button
        type="button"
        disabled={!(amount > 0) || from === to}
        onClick={go}
        className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40"
      >
        Exchange
      </button>
    </div>
  );
}

function AddForm({ w }: { w: ReturnType<typeof useWallet> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      {open ? <AddMoneyScreen onClose={() => setOpen(false)} /> : null}
      <button type="button" onClick={() => setOpen(true)} className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg">
        Add money
      </button>
      <button
        type="button"
        className="min-h-12 rounded-full border border-white/15 text-sm font-semibold"
        onClick={() => {
          const r = w.withdraw(Math.min(w.w.balances.USD, 2500), "USD");
          if (!r.ok) toast.error(r.error);
          else toast.success("On the way to checking.");
        }}
      >
        Withdraw to bank
      </button>
    </div>
  );
}
