import { useEffect, useRef, useState } from "react";
import { PRO_POINTS, PRO_TERMS, loadPro, savePro, settle, walletStopped, type ProIntent, type ProState } from "@/lib/pro-desk";

type Intent = ProIntent & { mint: string; why: string; signature: string };

const CAPS = [0.5, 1, 5, 25] as const;
const IMPACTS = [1, 3, 5] as const;

/** Opt-in signer for buys. Off until the terms are accepted. The wallet still approves. */
export function ProPanel({
  token,
  call,
  sign,
}: {
  token: string;
  call: (token: string, method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  sign: (row: Intent, opts?: { maxImpact?: number }) => Promise<void>;
}) {
  const [checks, setChecks] = useState(() => PRO_POINTS.map(() => false));
  const [state, setState] = useState<ProState | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setState(loadPro());
  }, []);

  function write(line: string) {
    setLog((rows) => [`${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ${line}`, ...rows].slice(0, 6));
  }

  function accept() {
    const next: ProState = { version: PRO_TERMS, acceptedAt: new Date().toISOString(), armed: false, maxTradeUsd: 5, maxImpact: 1 };
    savePro(next);
    setState(next);
  }

  function patch(part: Partial<ProState>) {
    if (!state) return;
    const next = { ...state, ...part };
    savePro(next);
    setState(next);
  }

  const callRef = useRef(call);
  const signRef = useRef(sign);
  callRef.current = call;
  signRef.current = sign;

  useEffect(() => {
    if (!state?.armed || !token) return;
    let stop = false;
    let busy = false;
    const risk = { maxTradeUsd: state.maxTradeUsd, maxImpact: state.maxImpact };
    const tick = async () => {
      if (stop || busy) return;
      busy = true;
      let attempted = "";
      try {
        const data = await callRef.current(token, "list_intents");
        const rows = ((data.intents as Intent[]) || []).filter((row) => row.status === "queued" && !String(row.why || "").startsWith("matrix|"));
        const plan = settle(rows, risk);
        for (const row of plan.release) {
          await callRef.current(token, "release", { id: row.id });
          write(row.why);
        }
        const nextId = plan.sign[0]?.id;
        const next = rows.find((row) => row.id === nextId);
        if (!next || stop) return;
        attempted = next.id;
        setWorking(true);
        write(`Opening the wallet for ${next.symbol} $${next.usd}.`);
        await signRef.current(next, { maxImpact: risk.maxImpact });
        write(`${next.symbol} signed.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The wallet did not sign.";
        write(message);
        if (walletStopped(message)) {
          setState((current) => {
            if (!current) return current;
            const off = { ...current, armed: false };
            savePro(off);
            return off;
          });
          write("Pro is off. The wallet was not signed.");
        } else if (attempted && /price impact/i.test(message)) {
          await callRef.current(token, "release", { id: attempted }).catch(() => undefined);
          write("Impact was over the cap. That buy was released.");
        }
      } finally {
        busy = false;
        setWorking(false);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 20_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [state?.armed, state?.maxTradeUsd, state?.maxImpact, token]);

  const ready = checks.every(Boolean);

  return (
    <section className="rounded-3xl bg-white px-4 py-4 text-black">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-black px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.16em] text-white">PRO</span>
        <h2 className="text-lg font-semibold tracking-tight">Signs buys. You set the risk.</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-black/70">
        While Pro is on, a queued buy that fits the trade cap and the impact cap opens your wallet by itself. Conflicts are cleared first: sells are dropped, a second buy of the same name is dropped, and anything over the cap is dropped. Nothing here holds a key.
      </p>
      {!state ? (
        <div className="mt-4 space-y-3">
          <p className="font-mono text-[10px] tracking-[0.16em] text-black/45 uppercase">Terms · {PRO_TERMS}</p>
          {PRO_POINTS.map((line, i) => (
            <label key={line} className="flex items-start gap-3 text-sm leading-relaxed">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-black"
                checked={checks[i]}
                onChange={(e) => setChecks((rows) => rows.map((on, n) => (n === i ? e.target.checked : on)))}
              />
              <span>{line}</span>
            </label>
          ))}
          <button type="button" disabled={!ready} onClick={accept} className="min-h-12 w-full rounded-full bg-black text-sm font-semibold text-white disabled:opacity-30">
            Accept and continue
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-black/45">Accepted {new Date(state.acceptedAt).toLocaleString()}.</p>
          <div className="flex flex-wrap gap-2">
            {CAPS.map((n) => (
              <button key={n} type="button" onClick={() => patch({ maxTradeUsd: n, armed: false })} className={`min-h-10 rounded-full px-3 text-xs font-semibold ${state.maxTradeUsd === n ? "bg-black text-white" : "bg-black/5"}`}>
                ${n} max
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {IMPACTS.map((n) => (
              <button key={n} type="button" onClick={() => patch({ maxImpact: n, armed: false })} className={`min-h-10 rounded-full px-3 text-xs font-semibold ${state.maxImpact === n ? "bg-black text-white" : "bg-black/5"}`}>
                {n}% impact
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => patch({ armed: !state.armed })}
            className={`min-h-12 w-full rounded-full text-sm font-semibold ${state.armed ? "bg-black text-white" : "border border-black/20"}`}
          >
            {state.armed ? (working ? "Pro is on · wallet opening" : "Pro is on · tap to stop") : "Arm Pro"}
          </button>
          <p className="text-xs leading-relaxed text-black/55">
            {state.armed
              ? `Armed. Buys at or under $${state.maxTradeUsd} and ${state.maxImpact}% impact can open the wallet. Changing a cap turns Pro off.`
              : "Off. Queued buys wait for you to sign them yourself."}
          </p>
          {log.length ? (
            <ul className="space-y-1 font-mono text-[11px] text-black/60">
              {log.map((line) => <li key={line}>{line}</li>)}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
