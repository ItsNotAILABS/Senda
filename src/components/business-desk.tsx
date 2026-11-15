import { useEffect, useState } from "react";
import { toast } from "sonner";
import { USDC } from "@/lib/jup-exec";
import { signRoute } from "@/lib/jup-sign";
import { humanWalletError } from "@/lib/mobile-wallet";
import { getMxnDesk } from "@/lib/mxn-rate";
import { connectPhantom, mintDecimals, readChain } from "@/lib/phantom";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { payBatch, payUsdc } from "@/lib/solana-pay";
import { rememberTrade } from "@/lib/trade-log";
import { cn } from "@/lib/utils";

const MXNE = "6zYgzrT7X2wi9a9NeMtUvUWLLmf2a8vBsbYkocYdB9wa";

type Mode = "pay" | "many" | "collect";
type Line = { to: string; usd: string };

/** Senda's own pay desk. USDC moves when Phantom signs. An agent can prepare the bill. It cannot sign it. */
export function BusinessDesk({ owner }: { owner: string }) {
  const [mode, setMode] = useState<Mode>("pay");
  const [amount, setAmount] = useState("20");
  const [to, setTo] = useState("");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { to: "", usd: "" },
    { to: "", usd: "" },
  ]);
  const [usdc, setUsdc] = useState<number | null>(null);
  const [mxne, setMxne] = useState<number | null>(null);
  const [mxn, setMxn] = useState(0);
  const [spread, setSpread] = useState<number | null>(null);
  const [clock, setClock] = useState<string | null>(null);
  const [cap, setCap] = useState(() => (typeof window === "undefined" ? 500 : spendCap()));
  const [busy, setBusy] = useState("");
  const [fail, setFail] = useState("");

  useEffect(() => {
    void getMxnDesk().then((d) => {
      setMxn(d.market || d.bitso || 0);
      setSpread(d.market && d.bitso ? ((d.bitso - d.market) / d.market) * 100 : null);
    }).catch(() => setMxn(0));
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!owner) return;
    let live = true;
    void readChain(owner).then((chain) => {
      if (!live) return;
      setUsdc(chain.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
      setMxne(chain.tokens.find((t) => t.mint === MXNE)?.ui ?? 0);
    }).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [owner, busy]);

  const n = Number(amount) || 0;
  const pesos = mxn > 0 ? n * mxn : 0;
  const short = usdc != null && n > usdc + 1e-9;

  function applyAgent(raw: string) {
    try {
      const body = JSON.parse(raw) as { to?: string; amount?: number; memo?: string; lines?: Line[] };
      if (body.lines?.length) {
        setMode("many");
        setLines(body.lines.slice(0, 6).map((row) => ({ to: String(row.to || ""), usd: String(row.usd || "") })));
      } else {
        setMode("pay");
        if (body.to) setTo(body.to);
        if (body.amount) setAmount(String(body.amount));
        if (body.memo) setMemo(body.memo);
      }
      toast.success("The agent prepared it. You still sign.");
    } catch {
      toast.error("That is not a payment.");
    }
  }

  async function who() {
    const addr = owner || (await connectPhantom());
    return addr;
  }

  async function sendHome() {
    setBusy("home");
    setFail("");
    try {
      const addr = await who();
      const paid = await payUsdc({ owner: addr, to: to.trim(), usd: n, memo: memo.trim() || "home", deskFee: true });
      rememberTrade({ symbol: "USDC", side: "send", usd: n, mint: USDC, signature: paid.signature });
      const note = pesos > 0
        ? `I sent $${n.toFixed(2)} USDC. About ${Math.round(pesos)} pesos if you sell them. ${paid.signature}`
        : `I sent $${n.toFixed(2)} USDC. ${paid.signature}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(note)}`, "_blank", "noopener,noreferrer");
      toast.success(`Sent. ${paid.signature.slice(0, 8)}…`);
    } catch (e) {
      const message = humanWalletError(e instanceof Error ? e.message : "It did not send.");
      setFail(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function pay() {
    setBusy("pay");
    setFail("");
    try {
      const addr = await who();
      const paid = await payUsdc({ owner: addr, to: to.trim(), usd: n, memo: memo.trim() || "senda", deskFee: true });
      rememberTrade({ symbol: "USDC", side: "send", usd: n, mint: USDC, signature: paid.signature });
      toast.success(`Paid. ${paid.signature.slice(0, 8)}…`);
    } catch (e) {
      const message = humanWalletError(e instanceof Error ? e.message : "The payment did not send.");
      setFail(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function payroll() {
    const rows = lines.map((row) => ({ to: row.to.trim(), usd: Number(row.usd), memo: "payroll" })).filter((row) => row.to && row.usd > 0);
    setBusy("many");
    setFail("");
    try {
      const addr = await who();
      const signature = await payBatch({ owner: addr, rows });
      const sum = rows.reduce((s, row) => s + row.usd, 0);
      rememberTrade({ symbol: "USDC", side: "send", usd: sum, mint: USDC, signature });
      toast.success(`Paid ${rows.length}. ${signature.slice(0, 8)}…`);
    } catch (e) {
      const message = humanWalletError(e instanceof Error ? e.message : "The payroll did not send.");
      setFail(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function holdPesos() {
    if (!(n > 0)) return toast.error("Enter the dollars.");
    setBusy("mxn");
    setFail("");
    try {
      const addr = await who();
      const decimals = await mintDecimals(MXNE);
      const done = await signRoute({ owner: addr, inputMint: USDC, outputMint: MXNE, amountRaw: Math.round(n * 1e6), outDecimals: decimals, usd: n });
      rememberTrade({ symbol: "MXNe", side: "buy", usd: n, mint: MXNE, signature: done.signature });
      toast.success(`${done.outUi.toFixed(2)} pesos are in this wallet.`);
    } catch (e) {
      const message = humanWalletError(e instanceof Error ? e.message : "The pesos did not land.");
      setFail(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function copyCollect() {
    if (!owner) return toast.error("Connect Phantom. That is the account they pay.");
    const payload = { to: owner, asset: "USDC", amount: n, memo: memo.trim() || "senda" };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
      toast.success("Copied. An agent can hand this back to be signed.");
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-[#07080d]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-white/10 px-3 py-2">
        <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase">
          <span className="senda-dot inline-block size-1.5 rounded-full bg-up" aria-hidden />
          <span className="text-up">Live</span>
          <span className="text-subtle">USDC</span>
        </p>
        <p className={cn("font-mono text-[11px] tabular-nums", spread == null ? "text-subtle" : spread < 0 ? "text-down" : "text-up")}>
          USD/MXN {mxn > 0 ? mxn.toFixed(4) : "—"}
          {spread == null ? "" : ` ${spread > 0 ? "+" : ""}${spread.toFixed(2)}%`}
        </p>
        <p className={cn("font-mono text-[11px] tabular-nums", owner ? "text-up" : "text-down")}>
          {clock ?? "—"} UTC · {owner ? "Signer on" : "No signer"}
        </p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10">
        <div className="px-3 py-2">
          <p className="font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">USDC</p>
          <p className={cn("font-mono text-xl tabular-nums", usdc != null && usdc > 0 ? "text-up" : "text-subtle")}>{usdc == null ? "—" : usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="px-3 py-2">
          <p className="font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">MXNe</p>
          <p className={cn("font-mono text-xl tabular-nums", mxne != null && mxne > 0 ? "text-up" : "text-subtle")}>{mxne == null ? "—" : mxne.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="px-3 py-2">
          <p className="font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">Cap</p>
          <p className="font-mono text-xl tabular-nums">${cap}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 px-3 py-2">
        {([
          ["pay", "Pay"],
          ["many", "Payroll"],
          ["collect", "Collect"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setMode(id)} className={cn("min-h-12 rounded-lg px-2 text-sm font-semibold", mode === id ? "bg-accent text-accent-fg" : "bg-white/5 text-muted")}>{label}</button>
        ))}
      </div>
      <div className="px-3 pb-3">
        {mode !== "many" ? (
          <label className="block">
            <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">
              <span className="senda-dot inline-block size-1.5 rounded-full bg-up" aria-hidden />
              Size
            </span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Amount" className={cn("w-full bg-transparent font-mono text-5xl tabular-nums outline-none animate-pulse", short ? "text-down" : "text-up")} />
          </label>
        ) : null}
        {mode !== "many" ? (
          <p className={cn("font-mono text-[11px] tabular-nums", usdc == null ? "text-subtle" : short ? "text-down" : "text-up")}>
            {usdc == null ? "Balance —" : short ? `Not covered · ${usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC` : `Covered · ${usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`}
          </p>
        ) : null}
        {mode !== "many" && pesos > 0 ? <p className="font-mono text-xs text-subtle">About {pesos.toLocaleString("en-US", { maximumFractionDigits: 0 })} pesos. The send is still USDC.</p> : null}
        {mode === "pay" ? (
          <>
            <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="Their Solana address" spellCheck={false} className="mt-3 min-h-12 w-full rounded-lg border border-white/10 bg-black/40 px-3 font-mono text-xs outline-none" />
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What it's for" className="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-base outline-none" />
            <button type="button" disabled={busy !== ""} onClick={() => void pay()} className="mt-3 min-h-12 w-full rounded-lg bg-accent text-base font-semibold text-accent-fg disabled:opacity-40">{busy === "pay" ? "Waiting on Phantom" : `Pay ${n || 0} USDC`}</button>
            <button type="button" disabled={busy !== ""} onClick={() => void sendHome()} className="mt-2 min-h-12 w-full rounded-lg border border-white/15 text-sm font-semibold disabled:opacity-40">{busy === "home" ? "Waiting on Phantom" : `Send home · ${pesos > 0 ? Math.round(pesos).toLocaleString("en-US") + " pesos" : "WhatsApp"}`}</button>
          </>
        ) : null}
        {mode === "many" ? (
          <>
            <ul className="space-y-2">
              {lines.map((row, i) => (
                <li key={i} className="grid grid-cols-[1fr_5.5rem] gap-2">
                  <input value={row.to} onChange={(e) => setLines((cur) => cur.map((item, j) => j === i ? { ...item, to: e.target.value.trim() } : item))} placeholder="Address" spellCheck={false} className="min-h-12 rounded-lg border border-white/10 bg-black/40 px-3 font-mono text-xs outline-none" />
                  <input value={row.usd} onChange={(e) => setLines((cur) => cur.map((item, j) => j === i ? { ...item, usd: e.target.value.replace(/[^0-9.]/g, "") } : item))} inputMode="decimal" aria-label="USDC" placeholder="USDC" className={cn("min-h-12 rounded-lg border border-white/10 bg-black/40 px-3 font-mono text-sm outline-none", row.usd ? "text-up" : "animate-pulse")} />
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setLines((cur) => cur.length >= 6 ? cur : [...cur, { to: "", usd: "" }])} className="mt-2 min-h-12 text-xs font-semibold text-muted">Add a person</button>
            <button type="button" disabled={busy !== ""} onClick={() => void payroll()} className="mt-2 min-h-12 w-full rounded-lg bg-accent text-base font-semibold text-accent-fg disabled:opacity-40">{busy === "many" ? "Waiting on Phantom" : "Pay them in one signature"}</button>
          </>
        ) : null}
        {mode === "collect" ? (
          <>
            <p className="mt-2 break-all font-mono text-xs text-muted">{owner || "Connect Phantom. This account receives."}</p>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What they are paying for" className="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-base outline-none" />
            <button type="button" onClick={() => void copyCollect()} className="mt-3 min-h-12 w-full rounded-lg bg-white text-base font-semibold text-black">Copy for them, or for an agent</button>
            <button type="button" disabled={busy !== ""} onClick={() => void holdPesos()} className="mt-2 min-h-12 w-full rounded-lg border border-white/15 text-sm font-semibold disabled:opacity-40">{busy === "mxn" ? "Waiting on Phantom" : `Hold ${n || 0} dollars as pesos`}</button>
          </>
        ) : null}
        <label className="mt-4 block">
          <span className="font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">Agent handoff</span>
          <textarea
            rows={2}
            placeholder='Paste {"to","amount","memo"} or {"lines":[...]}'
            onBlur={(e) => {
              const raw = e.target.value.trim();
              if (raw.startsWith("{")) applyAgent(raw);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs outline-none"
          />
        </label>
        <div className="mt-3 flex items-center gap-2">
          <input value={String(cap)} onChange={(e) => setCap(Number(e.target.value) || 0)} inputMode="decimal" aria-label="Spend cap" className="min-h-12 w-28 rounded-lg border border-white/10 bg-black/40 px-3 font-mono text-sm" />
          <button type="button" onClick={() => { const next = setSpendCap(cap); setCap(next); toast.success(`An agent cannot prepare a send over $${next}.`); }} className="min-h-12 rounded-lg bg-white/10 px-4 text-sm font-semibold">Set the cap</button>
        </div>
        {fail ? <p key={fail} className="senda-shake mt-3 text-sm text-down">{fail}</p> : null}
      </div>
    </section>
  );
}
