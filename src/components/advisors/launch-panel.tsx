import { useState } from "react";
import { toast } from "sonner";
import { createOnSolana, holdDraft, listDrafts, type LaunchDraft } from "@/lib/launch-create";
import { connectPhantom } from "@/lib/phantom";

/** Pump or Bonk builds the mint. Phantom signs. The draft stays on this browser until then. */
export function LaunchPanel() {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [sol, setSol] = useState("0.02");
  const [pool, setPool] = useState<"pump" | "bonk">("pump");
  const [rows, setRows] = useState<LaunchDraft[]>(() => listDrafts());
  const [busy, setBusy] = useState(false);

  async function launch() {
    const held = holdDraft({
      chain: "solana",
      name,
      symbol,
      description,
      uri: "",
      sol: Number(sol) || 0,
      supply: "",
      pool,
    });
    if ("error" in held) {
      toast.error(held.error);
      return;
    }
    setRows(listDrafts());
    setBusy(true);
    try {
      const owner = await connectPhantom();
      const done = await createOnSolana(owner, held);
      setRows(listDrafts());
      toast.success(`Created ${held.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The create did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-[#101114] p-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">Launch</p>
        <h2 className="mt-1 text-lg font-semibold">A new Solana token</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Pump or Bonk builds the create. Phantom signs it. The mint key is not stored. This is a new token, not a share and not a PreStock.
        </p>
        <label className="mt-3 block text-xs text-white/45">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white" />
        </label>
        <label className="mt-3 block text-xs text-white/45">
          Ticker
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 font-mono text-sm text-white" />
        </label>
        <label className="mt-3 block text-xs text-white/45">
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white" />
        </label>
        <label className="mt-3 block text-xs text-white/45">
          First buy, SOL
          <input value={sol} onChange={(e) => setSol(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 font-mono text-sm text-white" />
        </label>
        <div className="mt-3 flex gap-2">
          {(["pump", "bonk"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setPool(id)} className={pool === id ? "min-h-10 flex-1 rounded-full bg-white text-sm font-semibold text-black" : "min-h-10 flex-1 rounded-full border border-white/15 text-sm text-white/70"}>
              {id === "pump" ? "Pump" : "Bonk"}
            </button>
          ))}
        </div>
        <button type="button" disabled={busy} onClick={() => void launch()} className="mt-4 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
          {busy ? "Waiting for the wallet…" : "Sign the create"}
        </button>
      </section>
      <section className="rounded-2xl border border-white/10 bg-black p-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">Drafts</p>
        <ul className="mt-3 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="border-b border-white/10 pb-3">
              <p className="text-sm font-semibold">{row.symbol} · {row.name}</p>
              <p className="mt-1 font-mono text-[11px] text-white/40">{row.status} · {row.pool} · {row.sol} SOL{row.mint ? ` · ${row.mint.slice(0, 4)}…${row.mint.slice(-4)}` : ""}</p>
            </li>
          ))}
          {rows.length === 0 ? <li className="text-sm text-white/45">No draft yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
