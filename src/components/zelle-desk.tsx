import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  DESKS,
  WATCH,
  accept,
  claw,
  freeze,
  fresh,
  issue,
  returnPublic,
  reveal,
  send,
  shield,
  stageBreakpoint,
  thaw,
  view,
  type Desk,
  type Lens,
  type Purpose,
  type Rail,
  type Result,
} from "@/lib/zelle-rail";
import { cn } from "@/lib/utils";

const LENSES: { id: Lens; label: string }[] = [
  { id: "public", label: "Public tape" },
  { id: "alpha", label: "Bank Alpha" },
  { id: "beta", label: "Bank Beta" },
  { id: "zelle", label: "Zelle" },
  { id: "anchorage", label: "Anchorage" },
];

const KIND: Record<string, string> = {
  issue: "Funded",
  shield: "Made confidential",
  send: "Hidden send",
  accept: "Accepted",
  reveal: "Made public",
  return: "Returned",
  freeze: "Frozen",
  thaw: "Thawed",
  claw: "Taken back",
};

const field = "min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none placeholder:text-subtle";

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function deskName(id: Desk): string {
  return DESKS.find((row) => row.id === id)?.name ?? id;
}

function stamp(at: number): string {
  return new Date(at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function ZelleDesk() {
  const [rail, setRail] = useState<Rail>(() => fresh());
  const [past, setPast] = useState<Rail[]>([]);
  const [lens, setLens] = useState<Lens>("public");
  const [amount, setAmount] = useState("1250000");
  const [memo, setMemo] = useState("Interbank settlement");
  const [purpose, setPurpose] = useState<Purpose>("settlement");
  const [target, setTarget] = useState<Desk>("alpha");
  const [err, setErr] = useState("");

  const picture = view(rail, lens);
  const usd = Number(amount.replace(/,/g, ""));
  const mine = lens === "alpha" || lens === "beta" ? lens : null;

  function apply(result: Result, nextLens?: Lens) {
    if (!result.ok) {
      setErr(result.error);
      return;
    }
    setErr("");
    setPast((rows) => [...rows, rail].slice(-20));
    setRail(result.rail);
    if (nextLens) setLens(nextLens);
  }

  function undo() {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast((rows) => rows.slice(0, -1));
    setRail(prev);
    setErr("");
  }

  function reset() {
    setRail(fresh());
    setPast([]);
    setErr("");
    setLens("public");
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">ZLUSD · devnet drill</p>
        <h1 className="mt-1 text-2xl tracking-tight">The amount stays off the tape.</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Breakpoint, 16 Nov 2026. Anchorage funded Bank Alpha. Alpha hid part of it and sent $1.25 million to Bank Beta. The public tape shows the payment, not the dollars. This tab replays that. Phantom is not asked to sign. No mint address is invented.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => apply(stageBreakpoint(rail), "public")} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
            Stage the $1.25M
          </button>
          <button type="button" onClick={undo} disabled={past.length === 0} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold disabled:opacity-40">
            Undo
          </button>
          <button type="button" onClick={reset} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold">
            Reset
          </button>
        </div>
        <p className="mt-3 text-xs text-subtle">Openings stay in this tab. Refresh drops them. Nothing is written to the phone.</p>
      </section>

      <div className="flex gap-1 overflow-x-auto">
        {LENSES.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => { setLens(row.id); setErr(""); }}
            className={cn("min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold", lens === row.id ? "bg-white text-black" : "border border-white/10 text-white/70")}
          >
            {row.label}
          </button>
        ))}
      </div>

      <section className="grid gap-2 sm:grid-cols-3">
        {picture.buckets.map((bucket) => (
          <article key={bucket.id} className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-3">
            <p className="text-sm font-semibold">{bucket.name}</p>
            <p className="text-[11px] text-subtle">{bucket.role}{bucket.frozen ? " · frozen" : ""}</p>
            <p className="mt-2 font-mono text-sm tabular-nums">Public {money(bucket.pub)}</p>
            <p className="font-mono text-sm tabular-nums text-muted">
              {bucket.conf == null ? "Confidential hidden" : `Confidential ${money(bucket.conf)}`}
            </p>
          </article>
        ))}
      </section>

      {lens === "public" ? (
        <p className="text-sm text-muted">This is what a stranger sees. A hidden send has a commitment, not a dollar figure. Shielding and making public still show, because those dollars leave or enter a public account.</p>
      ) : null}
      {lens === "zelle" ? (
        <p className="text-sm text-muted">Zelle can open every hidden amount. Zelle cannot fund, send, accept, freeze, or take money back.</p>
      ) : null}

      {picture.pending.length ? (
        <section className="space-y-2">
          {picture.pending.map((item) => (
            <article key={item.id} className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
              <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">{item.id} · waiting</p>
              <h2 className="mt-1 text-lg">{deskName(item.from)} → {deskName(item.to)}</h2>
              <p className="mt-1 font-mono text-2xl tabular-nums">{item.usd == null ? "Amount hidden" : money(item.usd)}</p>
              <p className="mt-1 text-sm text-muted">{item.purpose === "remit-in" ? "US → India stamp" : "Interbank settlement"} · {item.memo}</p>
              <p className="mt-1 break-all font-mono text-[11px] text-subtle">{item.commitment}</p>
              {item.canAccept ? (
                <button type="button" onClick={() => apply(accept(rail, item.id, lens as Desk))} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
                  Accept settlement
                </button>
              ) : (
                <p className="mt-2 text-xs text-subtle">{lens === item.to ? "Frozen. Accept stays closed until Anchorage thaws this bank." : "Only the receiving bank accepts."}</p>
              )}
            </article>
          ))}
        </section>
      ) : null}

      {mine ? (
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-lg">{deskName(mine)}</h2>
          <p className="mt-1 text-sm text-muted">
            Make confidential moves public dollars into the hidden bucket. That step is visible, which is why Alpha hid $2M and then sent $1.25M. The send is the line that stays dark.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-subtle">
              Amount
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Amount" className={cn(field, "mt-1 font-mono")} />
            </label>
            <label className="text-xs text-subtle">
              Memo
              <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={96} aria-label="Memo" className={cn(field, "mt-1")} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["settlement", "remit-in"] as const).map((row) => (
              <button key={row} type="button" onClick={() => setPurpose(row)} className={cn("min-h-11 rounded-full px-3 text-sm font-semibold", purpose === row ? "bg-white text-black" : "border border-white/10")}>
                {row === "settlement" ? "Interbank settlement" : "US → India stamp"}
              </button>
            ))}
          </div>
          {purpose === "remit-in" ? <p className="mt-2 text-xs text-subtle">A stamp on the settlement. Not a rupee payout, and Payoneer is not connected.</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => apply(shield(rail, mine, usd, memo))} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">Make confidential</button>
            <button type="button" onClick={() => apply(send(rail, mine, usd, purpose, memo))} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black">Send hidden</button>
            <button type="button" onClick={() => apply(reveal(rail, mine, usd, memo))} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold">Make public</button>
            <button type="button" onClick={() => apply(returnPublic(rail, mine, usd, memo))} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold">Return public</button>
          </div>
        </section>
      ) : null}

      {lens === "anchorage" ? (
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-lg">Issuer</h2>
          <p className="mt-1 text-sm text-muted">You see public balances. You do not see confidential ones. Freeze stops a bank from moving. Taking dollars back reaches the public balance only, so freeze first if you do not want them to hide the rest.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-subtle">
              Amount
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Amount" className={cn(field, "mt-1 font-mono")} />
            </label>
            <label className="text-xs text-subtle">
              Memo
              <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={96} aria-label="Memo" className={cn(field, "mt-1")} />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            {(["alpha", "beta"] as const).map((row) => (
              <button key={row} type="button" onClick={() => setTarget(row)} className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold", target === row ? "bg-white text-black" : "border border-white/10")}>
                {deskName(row)}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => apply(issue(rail, target, usd, memo))} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">Fund bank</button>
            <button type="button" onClick={() => apply(freeze(rail, target, memo))} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold">Freeze</button>
            <button type="button" onClick={() => apply(thaw(rail, target, memo))} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold">Thaw</button>
            <button type="button" onClick={() => apply(claw(rail, target, usd, memo))} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold">Take public back</button>
          </div>
        </section>
      ) : null}

      {err ? <p className="text-sm text-down">{err}</p> : null}

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Settlement agent</p>
        <h2 className="mt-1 text-lg">It prepares the hidden send. It does not sign one.</h2>
        <p className="mt-1 text-sm text-muted">
          Open Bank Alpha or Bank Beta, set the amount and the memo above, then let this agent queue it. The public tape still hides the dollars. Courier on Send and Sleeve on Stocks read the plan. This drill does not.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (lens !== "alpha" && lens !== "beta") {
                setErr("Open Bank Alpha or Bank Beta. The settlement agent cannot move the issuer, and it cannot see-and-send.");
                return;
              }
              apply(send(rail, lens, usd, purpose, memo));
            }}
            className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
          >
            Queue the hidden send
          </button>
          <Link to="/payments/plan" className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-sm font-semibold">
            Open the plan
          </Link>
          <Link to="/payments" className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-sm font-semibold">
            Courier
          </Link>
          <Link to="/equities" className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-sm font-semibold">
            Sleeve
          </Link>
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c]">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold">Tape</h2>
          <p className="text-xs text-subtle">{picture.tape.length ? `${picture.tape.length} lines from this lens.` : "Nothing on the tape yet."}</p>
        </div>
        <ul>
          {picture.tape.slice().reverse().map((line) => (
            <li key={line.id} className="border-t border-white/10 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">{KIND[line.kind] ?? line.kind}</p>
                <p className="font-mono text-sm tabular-nums">{line.hidden && line.usd == null ? "hidden" : line.usd == null ? "—" : money(line.usd)}</p>
              </div>
              <p className="mt-1 text-xs text-muted">{stamp(line.at)} · {deskName(line.from)} → {deskName(line.to)}{line.memo ? ` · ${line.memo}` : ""}</p>
              {line.commitment ? <p className="mt-1 break-all font-mono text-[11px] text-subtle">{line.commitment}</p> : null}
              {line.broken ? <p className="mt-1 text-xs text-down">The opening does not match this commitment.</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <h2 className="text-lg">What else landed, and what this desk will not fake</h2>
        <ul className="mt-3 divide-y divide-white/10">
          {WATCH.map((row) => (
            <li key={row.name} className="py-3">
              <p className="text-sm font-semibold">{row.name} <span className="font-normal text-subtle">· {row.status}</span></p>
              <p className="mt-1 text-sm text-muted">{row.line}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <h2 className="text-sm font-semibold">Security on this rail</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>The hidden amount is a SHA-256 commitment. The blind stays off the public tape. A bad opening is refused.</li>
          <li>The sender cannot accept. The auditor can see and cannot move. The issuer cannot see the hidden bucket.</li>
          <li>Freeze blocks shield, send, accept, reveal, and return. A claw still takes only what is public.</li>
          <li>Every move needs a memo. A hidden send is $1 to $2,500,000, and only from the confidential balance.</li>
          <li>Circle USDC is not wrapped. There is no mainnet ZLUSD address on this desk.</li>
        </ul>
      </section>
    </div>
  );
}
