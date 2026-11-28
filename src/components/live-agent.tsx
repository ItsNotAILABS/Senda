import { useEffect, useState } from "react";
import { toast } from "sonner";
import { agentBalances, agentPass, agentPubkey, agentWithdraw, liveNotes, livePosition, type LivePos } from "@/lib/agent-live";
import { cofferWallet } from "@/lib/coffer";
import { cofferSetting, saveCofferSetting, type CofferSetting } from "@/lib/coffer-setting";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { houseSend, nativeBalance, nativeDesk, agentTransfer } from "@/lib/solana-native";
import { bookOrWarn } from "@/lib/agent-ledger";
import { explainPayment } from "@/lib/payment-error";
import { AgentBook } from "@/components/agent-book";

export function LiveAgent() {
  const [pub, setPub] = useState("");
  const [usdc, setUsdc] = useState<number | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [pos, setPos] = useState<LivePos | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState("");
  const [setting, setSetting] = useState<CofferSetting>({ on: true, network: "devnet" });
  const [coffer, setCoffer] = useState("");
  const [cofferId, setCofferId] = useState("");
  const [cofferSol, setCofferSol] = useState<number | null>(null);
  const [houseSol, setHouseSol] = useState<number | null>(null);

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
    const next = cofferSetting();
    setSetting(next);
    pull();
    if (!next.on) return;
    void cofferWallet({ data: { label: "Senda agent", network: next.network, type: "agent" } })
      .then(async (row) => {
        setCoffer(row.address);
        setCofferId(row.id);
        const desk = await nativeDesk();
        setHouseSol(desk.houseSol);
        const held = await nativeBalance({ data: { address: row.address } });
        setCofferSol(held.sol);
      })
      .catch((error) => {
        setCoffer("");
        toast.error(error instanceof Error ? error.message : "Coffer did not open a wallet.");
      });
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
      const dest = coffer || agentPubkey();
      if (!dest) throw new Error("No agent address. Nothing was sent.");
      const sig = await payUsdc({ owner, to: dest, usd: 5, memo: "agent fund" });
      toast.success(`$5 sent to the agent. ${sig.signature.slice(0, 8)}…`);
      pull();
    } catch (e) {
      toast.error(explainPayment(e));
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
        <h2 className="mt-1 text-2xl tracking-tight">Phantom signs. Coffer holds the agent address.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          The agent does not keep a key in this browser and it does not sign. Coffer opens a Solana wallet for it. You can send SOL or USDC to that address. A trade still waits for Phantom.
        </p>
      </div>
      <div className="rounded-2xl border border-white/10 p-4">
        <p className="text-[10px] tracking-wide text-white/40 uppercase">Agent wallets</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const next = { ...setting, on: !setting.on };
              saveCofferSetting(next);
              setSetting(next);
            }}
            className="h-11 rounded-full border border-white/15 px-4 text-sm font-semibold"
          >
            {setting.on ? "Coffer on" : "Coffer off"}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = { ...setting, network: setting.network === "devnet" ? "mainnet-beta" as const : "devnet" as const };
              saveCofferSetting(next);
              setSetting(next);
              setCoffer("");
              setCofferSol(null);
              if (!next.on) return;
              void cofferWallet({ data: { label: "Senda agent", network: next.network, type: "agent" } })
                .then(async (row) => {
                  setCoffer(row.address);
                  setCofferId(row.id);
                  if (next.network !== "devnet") {
                    setCofferSol(null);
                    return;
                  }
                  const held = await nativeBalance({ data: { address: row.address } });
                  setCofferSol(held.sol);
                })
                .catch((error) => {
                  setCoffer("");
                  toast.error(error instanceof Error ? error.message : "Coffer did not open a wallet.");
                });
            }}
            className="h-11 rounded-full border border-white/15 px-4 text-sm font-semibold"
          >
            {setting.network}
          </button>
        </div>
        <p className="mt-3 break-all font-mono text-xs">{coffer || (setting.on ? "Asking Coffer…" : "Agents will not open a Coffer wallet.")}</p>
        <p className="mt-1 font-mono text-sm tabular-nums">{cofferSol == null ? "—" : `${cofferSol.toFixed(4)} SOL`}</p>
        <p className="mt-1 text-xs text-white/40">
          House wallet {houseSol == null ? "—" : `${houseSol.toFixed(2)} SOL`} on the chain. Book balance is the ledger below. This agent can spend its own SOL. Phantom is only the $5 button. Treasury draw stays closed.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !coffer || setting.network !== "devnet"}
            onClick={() => {
              setBusy(true);
              void houseSend({ data: { to: coffer, sol: 0.05 } })
                .then(async (row) => {
                  setHouseSol(row.houseSol);
                  setCofferSol(row.toSol);
                  const missed = await bookOrWarn({
                    signature: row.signature,
                    amountRaw: "50000000",
                    ccy: "SOL",
                    kind: "send",
                    bookgDt: new Date().toISOString().slice(0, 10),
                    dbtr: { Nm: "House", AcctId: "FMn74h5jZMPXoKYYWSTxHiD5j6PeAVsAc6ftkxg6apvA", walletId: "wal_b0791dd8c1d32753c9" },
                    cdtr: { Nm: "Senda agent", AcctId: coffer, walletId: cofferId },
                    purp: "AGNT",
                    ustrd: "House to agent. Devnet CLI.",
                    sts: "BOOK",
                  });
                  if (missed) toast.error(`Sent ${row.signature.slice(0, 8)}. The ledger did not file it. Do not send it again.`);
                  else toast.success(`CLI sent 0.05 SOL. ${row.signature.slice(0, 8)}…`);
                })
                .catch((error) => toast.error(explainPayment(error)))
                .finally(() => setBusy(false));
            }}
            className="h-11 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40"
          >
            Send 0.05 SOL from the house wallet
          </button>
          <button
            type="button"
            disabled={busy || !cofferId || setting.network !== "devnet"}
            onClick={() => {
              setBusy(true);
              void cofferWallet({ data: { label: "Senda desk", network: "devnet", type: "agent" } })
                .then((desk) => agentTransfer({ data: { fromId: cofferId, to: desk.address, sol: 0.01 } }).then((sent) => ({ desk, sent })))
                .then(async ({ desk, sent }) => {
                  setCofferSol(sent.fromSol);
                  const missed = await bookOrWarn({
                    signature: sent.signature,
                    amountRaw: "10000000",
                    ccy: "SOL",
                    kind: "send",
                    bookgDt: new Date().toISOString().slice(0, 10),
                    dbtr: { Nm: "Senda agent", AcctId: coffer, walletId: cofferId },
                    cdtr: { Nm: "Senda desk", AcctId: desk.address, walletId: desk.id },
                    purp: "AGNT",
                    ustrd: "Agent to agent. The agent wallet spent.",
                    sts: "BOOK",
                  });
                  if (missed) toast.error(`Sent ${sent.signature.slice(0, 8)}. The ledger did not file it. Do not send it again.`);
                  else toast.success(`Agent paid the desk. ${sent.signature.slice(0, 8)}…`);
                })
                .catch((error) => toast.error(explainPayment(error)))
                .finally(() => setBusy(false));
            }}
            className="h-11 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40"
          >
            Agent pays the desk 0.01 SOL
          </button>
          <button type="button" disabled={busy || !coffer} onClick={() => void fund()} className="h-11 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40">
            Send $5 from Phantom
          </button>
        </div>
      </div>
      <AgentBook acct={coffer} />
      <div className="rounded-2xl border border-white/10 p-4">
        <p className="text-[10px] tracking-wide text-white/40 uppercase">Agent address</p>
        <p className="mt-1 break-all font-mono text-xs">{pub || "—"}</p>
        <p className="mt-2 font-mono text-sm tabular-nums">
          {usdc == null ? "—" : `$${usdc.toFixed(2)} USDC`} · {sol == null ? "—" : `${sol.toFixed(4)} SOL`}
        </p>
        <p className="mt-1 text-xs text-white/40">{pub ? "This address is old. Withdraw it. Do not fund a new one." : "No agent address. Nothing here can sign."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
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
