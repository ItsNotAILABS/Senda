import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { KINDS } from "@/lib/agent-kinds";
import { previewFill } from "@/lib/fill-quote";
import {
  livePlan,
  noteSend,
  noteSleeve,
  proposeSend,
  proposeSleeve,
  readPlan,
  sendRoom,
  sleeveRoom,
  writePlan,
  type MoneyPlan,
} from "@/lib/money-plan";
import { checkParallax } from "@/lib/parallax-gate";
import { connectPhantom, phantomProvider } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { payUsdc } from "@/lib/solana-pay";
import { spendCap } from "@/lib/spend-cap";
import { cn } from "@/lib/utils";

const DOORS: { href: string; label: string }[] = [
  { href: "/payments", label: "Send" },
  { href: "/payments/zelle", label: "Zelle" },
  { href: "/equities", label: "Stocks" },
  { href: "/pre", label: "Pre-IPO" },
  { href: "/invest", label: "Trade" },
  { href: "/wallet", label: "Convert" },
  { href: "/payments/add", label: "Add money" },
  { href: "/agents", label: "All agents" },
];

const field = "min-h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-sm outline-none";

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function TransferAgent(
  props:
    | { surface: "plan" }
    | { surface: "send"; owner: string; pocket: number }
    | { surface: "stocks"; owner: string; symbol: string; mint: string; halted?: boolean },
) {
  const [plan, setPlan] = useState<MoneyPlan>(() => readPlan());
  const live = livePlan(plan);
  const cap = spendCap();
  const sendLeft = sendRoom(live, cap);
  const stockLeft = sleeveRoom(live, cap);

  function save(next: MoneyPlan) {
    setPlan(writePlan(next));
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">
        {props.surface === "plan" ? "Planner" : props.surface === "send" ? "Courier" : "Sleeve"}
      </p>
      <h2 className="mt-1 text-lg font-semibold">
        {props.surface === "plan"
          ? "The plan the other desks read."
          : props.surface === "send"
            ? "A send, inside the plan."
            : "A share, inside the sleeve."}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {props.surface === "plan"
          ? "Cash floor, what can leave this month, and what the stock sleeve may buy. Courier and Sleeve refuse anything past it. You still sign."
          : props.surface === "send"
            ? `Send room ${money(sendLeft)} this month. Floor ${money(live.cashFloor)}. The wallet still signs the USDC.`
            : `Sleeve room ${money(stockLeft)} this month${live.sleeveSymbol ? `, only ${live.sleeveSymbol}` : ""}. Jupiter quotes it. You sign.`}
      </p>
      <p className="mt-2 font-mono text-[11px] text-subtle">
        Spend cap {money(cap)}
        {props.surface !== "plan" ? (
          <>
            {" "}
            · <Link to="/payments/plan" className="text-accent">Edit the plan</Link>
          </>
        ) : null}
      </p>
      {props.surface === "plan" ? <PlanForm plan={live} onSave={save} /> : null}
      {props.surface === "send" ? (
        <SendForm
          owner={props.owner}
          pocket={props.pocket}
          plan={live}
          cap={cap}
          onSent={(usd) => save(noteSend(live, usd))}
        />
      ) : null}
      {props.surface === "stocks" ? (
        <StockForm
          owner={props.owner}
          symbol={props.symbol}
          mint={props.mint}
          halted={props.halted}
          plan={live}
          cap={cap}
          onBought={(usd) => save(noteSleeve(live, usd))}
        />
      ) : null}
      {props.surface === "plan" ? <Doors /> : null}
    </section>
  );
}

function PlanForm({ plan, onSave }: { plan: MoneyPlan; onSave: (next: MoneyPlan) => void }) {
  const [floor, setFloor] = useState(String(plan.cashFloor));
  const [monthSend, setMonthSend] = useState(String(plan.monthSend));
  const [sleeve, setSleeve] = useState(String(plan.sleeveMonth));
  const [symbol, setSymbol] = useState(plan.sleeveSymbol);
  const [note, setNote] = useState(plan.note);

  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const next = writePlan({
          ...plan,
          cashFloor: Number(floor) || 0,
          monthSend: Number(monthSend) || 0,
          sleeveMonth: Number(sleeve) || 0,
          sleeveSymbol: symbol,
          note,
        });
        onSave(next);
        toast.success("Plan saved. Courier and Sleeve read this.");
      }}
    >
      <label className="text-xs text-subtle">
        Cash floor
        <input value={floor} onChange={(e) => setFloor(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className={cn(field, "mt-1")} />
      </label>
      <label className="text-xs text-subtle">
        Send budget this month
        <input value={monthSend} onChange={(e) => setMonthSend(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className={cn(field, "mt-1")} />
      </label>
      <label className="text-xs text-subtle">
        Stock sleeve this month
        <input value={sleeve} onChange={(e) => setSleeve(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className={cn(field, "mt-1")} />
      </label>
      <label className="text-xs text-subtle">
        Only this share, or blank for any
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 12))} placeholder="SPYX" className={cn(field, "mt-1")} />
      </label>
      <label className="text-xs text-subtle sm:col-span-2">
        Note
        <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 240))} placeholder="Rent Friday. Sleeve is the index." className={cn(field, "mt-1")} />
      </label>
      <button type="submit" className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg sm:col-span-2 sm:w-fit">
        Save the plan
      </button>
    </form>
  );
}

function SendForm({
  owner,
  pocket,
  plan,
  cap,
  onSent,
}: {
  owner: string;
  pocket: number;
  plan: MoneyPlan;
  cap: number;
  onSent: (usd: number) => void;
}) {
  const [to, setTo] = useState("");
  const [usd, setUsd] = useState("25");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function sign() {
    const proposed = proposeSend({ plan, cap, pocket, usd: Number(usd) || 0, to, memo });
    if (!proposed.ok) {
      setErr(proposed.error);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const who = owner || (await connectPhantom());
      if (!who) throw new Error("Connect a wallet first.");
      const paid = await payUsdc({ owner: who, to: to.trim(), usd: proposed.usd, memo: memo.trim() });
      onSent(proposed.usd);
      toast.success(`Signed ${money(proposed.usd)}. ${paid.signature.slice(0, 8)}.`);
      setMemo("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      <p className="text-xs text-subtle">Pocket {money(pocket)}. The signature still needs USDC in the wallet, not only this number.</p>
      <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="Their Solana address" aria-label="Recipient" className={field} />
      <div className="grid grid-cols-2 gap-2">
        <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Dollars" className={field} />
        <input value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 80))} placeholder="Memo" aria-label="Memo" className={field} />
      </div>
      {err ? <p className="text-sm text-down">{err}</p> : null}
      <button type="button" disabled={busy} onClick={() => void sign()} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50">
        {busy ? "Waiting for the wallet…" : "Courier signs the send"}
      </button>
    </div>
  );
}

function StockForm({
  owner,
  symbol,
  mint,
  halted,
  plan,
  cap,
  onBought,
}: {
  owner: string;
  symbol: string;
  mint: string;
  halted?: boolean;
  plan: MoneyPlan;
  cap: number;
  onBought: (usd: number) => void;
}) {
  const [usd, setUsd] = useState("25");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [line, setLine] = useState("");

  async function sign() {
    const proposed = proposeSleeve({ plan, cap, symbol, usd: Number(usd) || 0, halted });
    if (!proposed.ok) {
      setErr(proposed.error);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const who = phantomProvider()?.publicKey?.toString() || owner || (await connectPhantom());
      if (!who) throw new Error("Connect a wallet first.");
      const preview = await previewFill({ mint, side: "buy", usd: proposed.usd, symbol });
      const gate = checkParallax({
        owner: who,
        symbol,
        side: "buy",
        usd: proposed.usd,
        impact: preview.impact,
        budgetLeft: Math.min(cap, sleeveRoom(plan, cap)),
      });
      if (!gate.ok) throw new Error(gate.why);
      const done = await runPrestock({ owner: who, mint, side: "buy", usd: proposed.usd, symbol, desk: "sleeve" });
      onBought(proposed.usd);
      const next = `Signed ${symbol} ${money(proposed.usd)}. ${done.signature.slice(0, 8)}.`;
      setLine(next);
      toast.success(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      <p className="text-sm">
        Buying <span className="font-semibold">{symbol || "nothing selected"}</span>
        {mint ? <span className="mt-1 block break-all font-mono text-[11px] text-subtle">{mint}</span> : null}
      </p>
      <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Dollars" className={field} />
      {err ? <p className="text-sm text-down">{err}</p> : null}
      {line ? <p className="text-sm text-accent">{line}</p> : null}
      <button type="button" disabled={busy || !symbol || !mint} onClick={() => void sign()} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50">
        {busy ? "Quoting…" : `Sleeve buys ${symbol || "the share"}`}
      </button>
    </div>
  );
}

function Doors() {
  const navigate = useNavigate();
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="text-sm font-semibold">Same desk. Open any of it.</p>
      <div className="mt-2 flex gap-2 overflow-x-auto">
        {DOORS.map((door) => (
          <button key={door.href} type="button" onClick={() => void navigate({ href: door.href })} className="min-h-10 shrink-0 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold">
            {door.label}
          </button>
        ))}
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {KINDS.map((kind) => (
          <li key={kind.id} className="rounded-2xl border border-white/10 px-3 py-2">
            <p className="text-sm font-semibold">{kind.title}</p>
            <p className="mt-1 text-xs text-muted">{kind.line}</p>
          </li>
        ))}
      </ul>
      <Link to="/agents" className="mt-3 inline-flex min-h-10 items-center text-sm text-accent">
        Make one in the studio
      </Link>
    </div>
  );
}
