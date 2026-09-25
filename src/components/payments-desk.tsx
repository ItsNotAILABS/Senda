import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AddMoneyScreen } from "@/components/add-money";
import { NearbyDesk } from "@/components/nearby-desk";
import { CCYS, formatMoney, revolutFee, sendaDeposit, type Ccy } from "@/lib/wallet";
import { rate } from "@/lib/wallet-fx";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export type PayAct = "send" | "request" | "exchange" | "add" | "withdraw" | "nearby";

const ACTS: { id: PayAct; label: string }[] = [
  { id: "send", label: "Send" },
  { id: "nearby", label: "Nearby" },
  { id: "request", label: "Request" },
  { id: "exchange", label: "Exchange" },
  { id: "add", label: "Add" },
];

export function PaymentsDesk({ initialAct, initialFrom }: { initialAct?: string; initialFrom?: string }) {
  const start: PayAct = ACTS.some((a) => a.id === initialAct) ? (initialAct as PayAct) : "send";
  const [act, setAct] = useState<PayAct>(start);
  const w = useWallet();
  const fromInit = CCYS.includes(initialFrom as Ccy) ? (initialFrom as Ccy) : "USD";

  const total = CCYS.reduce((s, c) => s + (w.w.balances[c] || 0) * (w.usdPer[c] || (c === "USD" || c === "USDC" ? 1 : 0)), 0);
  const pockets = (w.w.opened.length ? w.w.opened : (["USD"] as Ccy[])).map((c) => ({
    c,
    v: w.w.balances[c] || 0,
  }));

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <section className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[28px] border border-white/10 bg-[#0c0c14] p-6 lg:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Send</p>
          <h1 className="mt-3 text-5xl tracking-tight">${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}</h1>
          <p className="mt-3 max-w-md text-sm text-muted">
            {w.w.tag}. This is cash you can send, request, or change. A PreStock is not in this number. You buy that on the book.
          </p>
          <p className="mt-4 font-mono text-xs text-subtle">
            {sendaDeposit(w.w.tag).routing} · {sendaDeposit(w.w.tag).account}
          </p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-4">
          <p className="text-sm font-semibold">Held</p>
          <ul className="mt-3 space-y-2">
            {pockets.map((p) => (
              <li key={p.c}>
                <button type="button" onClick={() => setAct("exchange")} className="flex w-full items-center justify-between rounded-2xl bg-black/30 px-3 py-3 text-left">
                  <span>
                    <span className="block text-sm font-semibold">{p.c}</span>
                    <span className="block text-[11px] text-subtle">Tap to change it</span>
                  </span>
                  <span className="font-mono text-sm">{formatMoney(p.v, p.c)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {(
          [
            ["send", "Send", "To an @tag", "bg-[#14f195]/15"],
            ["nearby", "Nearby", "A note, not an account", "bg-[#9945ff]/20"],
            ["request", "Request", "Ask for the same cash", "bg-[#3b82f6]/15"],
            ["exchange", "Exchange", "Hold another currency", "bg-[#eab308]/15"],
            ["add", "Add", "Card, bank, or USDC", "bg-[#06b6d4]/15"],
          ] as const
        ).map(([id, label, hint, tint]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAct(id)}
            className={cn("rounded-2xl border px-3 py-3 text-left", act === id ? "border-accent bg-[#101018]" : "border-white/10 bg-[#101018]")}
          >
            <span className={cn("mb-2 grid size-8 place-items-center rounded-lg text-[10px] font-semibold", tint)}>{label.slice(0, 1)}</span>
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block text-[11px] text-muted">{hint}</span>
          </button>
        ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-4">
          {act === "send" ? <SendForm w={w} /> : null}
          {act === "nearby" ? <NearbyDesk /> : null}
          {act === "request" ? <RequestForm w={w} /> : null}
          {act === "exchange" ? <ExchangeForm w={w} fromInit={fromInit} /> : null}
          {act === "add" ? <AddForm w={w} /> : null}
        </div>
        <aside className="h-fit rounded-[28px] border border-white/10 bg-[#101018] p-4">
          <h2 className="text-sm font-semibold">Activity</h2>
          {w.w.txs.length === 0 ? <p className="py-4 text-sm text-subtle">Nothing sent from this account yet.</p> : null}
          <ul>
            {w.w.txs.slice(0, 12).map((t) => (
              <li key={t.id} className="border-t border-white/10 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">{t.counterparty}</p>
                  <p className="font-mono text-xs tabular-nums">{formatMoney(t.amount, t.ccy)}</p>
                </div>
                <p className="text-xs text-subtle">{t.kind}{t.note ? ` · ${t.note}` : ""}</p>
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
    <div className="flex flex-col gap-4 px-5">
      <label className="block">
        <span className="text-xs font-medium text-subtle">To · @tag</span>
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="@someone"
          className="mt-1 min-h-12 w-full rounded-2xl bg-elevated px-4 text-sm outline-none placeholder:text-subtle"
        />
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
              className="min-h-11 shrink-0 rounded-full bg-elevated px-4 text-sm font-medium"
            >
              {c.tag}
            </button>
          ))}
        </div>
      ) : null}
      <label className="block">
        <span className="text-xs font-medium text-subtle">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Optional"
          className="mt-1 min-h-12 w-full rounded-2xl bg-elevated px-4 text-sm outline-none placeholder:text-subtle"
        />
      </label>
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="text-xs font-medium text-subtle">Amount</span>
          <input
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="0"
            className="mt-1 min-h-12 w-full rounded-2xl bg-elevated px-4 text-lg font-semibold tabular-nums outline-none placeholder:text-subtle"
          />
        </label>
        <label className="w-28">
          <span className="text-xs font-medium text-subtle">Ccy</span>
          <select
            value={ccy}
            onChange={(e) => setCcy(e.target.value as Ccy)}
            className="mt-1 min-h-12 w-full rounded-2xl bg-elevated px-3 text-sm outline-none"
          >
            {CCYS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note"
        className="min-h-12 rounded-2xl bg-elevated px-4 text-sm outline-none placeholder:text-subtle"
      />
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
    <div className="flex flex-col gap-4 px-5">
      <p className="text-sm text-muted">Lands in the currency you pick. Hold it there — no auto-convert.</p>
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="@someone"
        className="min-h-12 rounded-2xl bg-elevated px-4 text-sm outline-none placeholder:text-subtle"
      />
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="0"
          className="min-h-12 flex-1 rounded-2xl bg-elevated px-4 text-lg font-semibold tabular-nums outline-none placeholder:text-subtle"
        />
        <select
          value={ccy}
          onChange={(e) => setCcy(e.target.value as Ccy)}
          className="min-h-12 w-28 rounded-2xl bg-elevated px-3 text-sm outline-none"
        >
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
        className="min-h-12 rounded-full bg-fg text-base font-semibold text-bg"
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
    <div className="flex flex-col gap-4 px-5">
      <p className="text-sm text-muted">
        Convert and hold. EUR for Europe, MXN for Mexico, USDC 1:1 with the dollar, SOL at the live price. It stays until you move it.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value as Ccy)}
          className="min-h-12 rounded-2xl bg-elevated px-3 text-sm outline-none"
        >
          {choices.map((c) => (
            <option key={c} value={c}>
              From {c}
            </option>
          ))}
        </select>
        <select
          value={to}
          onChange={(e) => setTo(e.target.value as Ccy)}
          className="min-h-12 rounded-2xl bg-elevated px-3 text-sm outline-none"
        >
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
        className="min-h-14 rounded-2xl bg-elevated px-4 text-3xl font-semibold tabular-nums outline-none placeholder:text-subtle"
      />
      <p className="text-xs text-subtle">Available {formatMoney(w.w.balances[from] ?? 0, from)}</p>
      <div className="rounded-2xl bg-elevated px-4 py-3 text-sm">
        <p className="font-medium">You hold {formatMoney(got, to)}</p>
        <p className="mt-1 text-muted">
          {oneToOne
            ? "USDC ↔ USD is 1:1. No spread."
            : `1 ${from} = ${r.toFixed(4)} ${to} · mid-market · $0`}
        </p>
        {rev > 0 ? (
          <p className="mt-1 text-muted">Revolut weekend/over-cap would take {formatMoney(rev)}.</p>
        ) : null}
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
    <div className="flex flex-col gap-4 px-5">
      {open ? <AddMoneyScreen onClose={() => setOpen(false)} /> : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg"
      >
        Add money
      </button>
      <button
        type="button"
        className="min-h-12 rounded-full bg-elevated text-sm font-semibold"
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
