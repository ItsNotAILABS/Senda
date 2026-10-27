import { useEffect, useState } from "react";
import { toast } from "sonner";
import { agentBalances, agentPass, agentPubkey, agentWithdraw, liveNotes, livePosition, type LivePos } from "@/lib/agent-live";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";

export function LiveAgent() {
  const [pub, setPub] = useState("");
  const [usdc, setUsdc] = useState<number | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [pos, setPos] = useState<LivePos | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState("");

  function pull() {
    setPub(agentPubkey());
    setPos(livePosition());
    setNotes(liveNotes().map((row) => row.text));
    agentBalances()
      .then((row) => {
        setUsdc(row.usdc);
        setSol(row.sol);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    pull();
  }, []);

  useEffect(() => {
    if (!armed) return;
    let stop = false;
    let running = false;
    const tick = () => {
      if (stop || running) return;
      running = true;
      agentPass()
        .then((text) => {
          pull();
          if (!text.startsWith("Holding") && !text.startsWith("No liquid")) toast.message(text);
        })
        .catch((e) => {
          toast.error(e instanceof Error ? e.message : "The agent pass failed.");
          pull();
        })
        .finally(() => {
          running = false;
        });
    };
    tick();
    const id = window.setInterval(tick, 45_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [armed]);

  async function fund() {
    setBusy(true);
    try {
      const owner = await connectPhantom();
      const sig = await payUsdc({ owner, to: agentPubkey(), usd: 5, memo: "agent fund" });
      toast.success(`$5 sent to the agent. ${sig.signature.slice(0, 8)}…`);
      pull();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The fund did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function once() {
    setBusy(true);
    try {
      const text = await agentPass();
      toast.message(text);
      pull();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The pass did not send.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!to.trim()) return toast.error("Paste the address that should receive the USDC.");
    setBusy(true);
    try {
      const sig = await agentWithdraw(to.trim(), Math.min(5, usdc || 0));
      toast.success(`Sent. ${sig.slice(0, 8)}…`);
      pull();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The withdraw did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div>
        <p className="font-mono text-[10px] tracking-[0.16em] text-white/40 uppercase">Live agent</p>
        <h2 className="mt-1 text-2xl tracking-tight">The agent does not hold a key.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          A pass no longer signs. Queue the trade on the desk and sign it in Phantom. If this browser already has an old agent address, you can still withdraw what it holds. A new one is not created.
        </p>
      </div>
      <div className="rounded-2xl border border-white/10 p-4">
        <p className="text-[10px] tracking-wide text-white/40 uppercase">Agent address</p>
        <p className="mt-1 break-all font-mono text-xs">{pub || "—"}</p>
        <p className="mt-2 font-mono text-sm tabular-nums">
          {usdc == null ? "—" : `$${usdc.toFixed(2)} USDC`} · {sol == null ? "—" : `${sol.toFixed(4)} SOL`}
        </p>
        <p className="mt-1 text-xs text-white/40">{pub ? "This address is old. Withdraw it. Do not fund a new one." : "No agent address. Nothing here can sign."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy || !pub} onClick={() => void fund()} className="h-11 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40">
            Fund the old address
          </button>
          <button type="button" disabled={busy} onClick={() => void once()} className="h-11 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40">
            Run one pass
          </button>
          <button type="button" onClick={() => setArmed((v) => !v)} className="h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">
            {armed ? "Stop" : "Arm"}
          </button>
        </div>
        {pos ? (
          <p className="mt-3 text-sm">
            Open: {pos.symbol} from ${pos.entry} · ${pos.usd.toFixed(2)} · {pos.sig.slice(0, 8)}
          </p>
        ) : (
          <p className="mt-3 text-sm text-white/40">No open token.</p>
        )}
      </div>
      <div className="rounded-2xl border border-white/10 p-4">
        <p className="text-sm font-semibold">Send the idle USDC back</p>
        <p className="mt-1 text-xs text-white/40">Only when nothing is open. A second wallet can fund the same address. The key that can move it is in this browser, so this is not a shared multisig. Idle USDC earns nothing here. SOL yield is the stake lane on Swap.</p>
        <div className="mt-2 flex gap-2">
          <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="Solana address" spellCheck={false} className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-xs outline-none" />
          <button type="button" disabled={busy} onClick={() => void withdraw()} className="h-11 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40">Withdraw</button>
        </div>
      </div>
      <ul className="space-y-1 text-xs text-white/50">
        {notes.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
