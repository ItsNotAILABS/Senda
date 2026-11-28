import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { buildActivity, parseRecovery, recipientsOf, recoveryFile, searchActivity, type ActivityRow } from "@/lib/activity";
import { readChain, rpc } from "@/lib/phantom";
import { listTrades, rememberTrade } from "@/lib/trade-log";
import { listTransactions, mergeRecovered, reconcileTransactions, type JournalEntry } from "@/lib/tx-journal.mjs";
import { fundTreasury } from "@/lib/treasury-fund";
import { TREASURY_PROGRAM_ID } from "@/lib/treasury-ix";
import { nativeDesk } from "@/lib/solana-native";
import { AgentBook } from "@/components/agent-book";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const field = "min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none";

function short(value: string): string {
  if (value.length < 12) return value || "—";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function ActivityDesk() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((link) => link.kind === "phantom" || link.kind === "solana")?.address ?? "";
  const [sol, setSol] = useState<number | null>(null);
  const [usdc, setUsdc] = useState<number | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [query, setQuery] = useState("");
  const [fault, setFault] = useState("");
  const [busy, setBusy] = useState(false);
  const [fundSol, setFundSol] = useState("0.05");
  const [funding, setFunding] = useState(false);
  const [cli, setCli] = useState("");

  function readJournal() {
    if (!owner) {
      setJournal([]);
      return;
    }
    try {
      setJournal(listTransactions(window.localStorage, owner));
      setFault("");
    } catch (error) {
      setFault(error instanceof Error ? error.message : "The recovery journal could not be read.");
    }
  }

  useEffect(() => {
    void nativeDesk()
      .then((row) => setCli(`${row.magic || "program"} · house ${row.houseSol.toFixed(2)} SOL · draw ${row.spendOpen ? "open" : "closed"}`))
      .catch(() => setCli(""));
  }, []);

  useEffect(() => {
    readJournal();
    if (!owner) {
      setSol(null);
      setUsdc(null);
      return;
    }
    let live = true;
    readChain(owner)
      .then((book) => {
        if (!live) return;
        setSol(book.sol);
        setUsdc(book.tokens.find((token) => token.symbol === "USDC")?.ui ?? 0);
      })
      .catch(() => {
        if (live) {
          setSol(null);
          setUsdc(null);
        }
      });
    return () => {
      live = false;
    };
  }, [owner]);

  const all = useMemo(() => buildActivity(journal, owner ? listTrades() : []), [journal, owner]);
  const rows = useMemo(() => searchActivity(all, query), [all, query]);
  const people = useMemo(() => recipientsOf(all), [all]);
  const pending = journal.filter((row) => row.status === "pending" || row.status === "confirmed");

  async function recheck() {
    if (!owner) return;
    setBusy(true);
    try {
      setJournal(await reconcileTransactions(window.localStorage, owner, rpc));
    } catch (error) {
      setFault(error instanceof Error ? error.message : "The chain did not answer. Status stays unknown.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!owner) return toast.error("Connect Phantom. The file is for that wallet.");
    const file = recoveryFile(owner, journal, listTrades());
    const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "senda-activity.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function incoming(file: File) {
    if (!owner) return toast.error("Connect the same wallet this file was exported from.");
    const parsed = parseRecovery(await file.text(), owner);
    if ("error" in parsed) return toast.error(parsed.error);
    try {
      setJournal(mergeRecovered(window.localStorage, owner, parsed.journal));
      for (const trade of parsed.trades) {
        if (trade.signature) rememberTrade(trade);
      }
      toast.success("Recovered onto this screen. Chain status was not invented.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The file was not applied.");
    }
  }

  return (
    <div className="space-y-3 pb-28">
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Activity</p>
        <h2 className="mt-1 text-xl font-semibold">What this wallet did.</h2>
        <p className="mt-1 text-sm text-muted">Balances are the chain. Pending sends are the recovery journal. Trades are signatures this browser filed. Another phone does not have them until you move the file. This is not a bank account.</p>
        <p className="mt-3 font-mono text-sm">{owner ? short(owner) : "Not connected"}</p>
        <p className="mt-1 font-mono text-sm text-white/70">SOL {sol == null ? "—" : sol.toFixed(3)} · USDC {usdc == null ? "—" : usdc.toFixed(2)}</p>
        <p className="mt-2 text-xs text-white/45">{pending.length ? `${pending.length} not finalized. Do not send the same one again.` : "No pending send on this screen."}</p>
      </section>
      <AgentBook />

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a signature, address, or asset" aria-label="Search activity" className={field} />
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={!owner || busy} onClick={() => void recheck()} className="min-h-11 flex-1 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
            {busy ? "Checking" : "Recheck chain"}
          </button>
          <button type="button" onClick={download} className="min-h-11 flex-1 rounded-full bg-white/10 text-sm font-semibold">Export</button>
        </div>
        <label className="mt-2 flex min-h-11 items-center justify-center rounded-full border border-white/15 text-sm font-semibold">
          Import on this screen
          <input type="file" accept="application/json" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) void incoming(file); e.target.value = ""; }} />
        </label>
        {fault ? <p className="mt-3 text-sm text-[#ff8b8b]">{fault}</p> : null}
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 30).map((row: ActivityRow) => (
            <li key={row.id} className="rounded-2xl bg-white/[0.04] px-3 py-3">
              <p className="text-sm font-semibold">{row.kind} · {row.asset} · {row.amount || "—"}</p>
              <p className="mt-1 text-xs text-white/55">{row.status}{row.destination ? ` · ${short(row.destination)}` : ""}</p>
              <a className="mt-1 inline-block font-mono text-[11px] text-white/45 underline" href={`https://solscan.io/tx/${row.signature}`} target="_blank" rel="noreferrer">{row.signature.slice(0, 8)}…</a>
            </li>
          ))}
          {owner && rows.length === 0 ? <li className="text-sm text-white/45">Nothing recorded for that search.</li> : null}
        </ul>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Recipients</p>
        <ul className="mt-3 space-y-2">
          {people.slice(0, 12).map((person) => (
            <li key={person.address} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-mono text-xs">{short(person.address)}</span>
              <span className="text-xs text-white/45">{person.count} · {person.asset}</span>
            </li>
          ))}
          {people.length === 0 ? <li className="text-sm text-white/45">No send address yet.</li> : null}
        </ul>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Program</p>
        <h2 className="mt-1 text-lg font-semibold">Other programs fund this account.</h2>
        <p className="mt-1 text-sm text-muted">The program is on devnet. Instruction 1 sends devnet SOL into your treasury account. Phantom signs. Mainnet is not asked. Draw is not in this transaction.</p>
        <label className="mt-3 block text-xs text-white/45">
          Devnet SOL
          <input value={fundSol} onChange={(e) => setFundSol(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className={`mt-1 ${field}`} />
        </label>
        <button
          type="button"
          disabled={!owner || funding}
          onClick={() => {
            if (!owner) return;
            setFunding(true);
            void fundTreasury(owner, Number(fundSol))
              .then((row) => toast.success(`Funded ${row.treasury.slice(0, 4)}… ${row.signature.slice(0, 8)}`))
              .catch((error) => toast.error(error instanceof Error ? error.message : "The fund did not send."))
              .finally(() => setFunding(false));
          }}
          className="mt-3 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40"
        >
          {funding ? "Waiting for Phantom" : "Fund the program"}
        </button>
        <p className="mt-2 break-all font-mono text-[11px] text-white/55">{TREASURY_PROGRAM_ID}</p>
        {cli ? <p className="mt-1 text-xs text-white/45">CLI {cli}</p> : null}
      </section>
    </div>
  );
}
