import { useEffect, useState } from "react";
import { toast } from "sonner";
import { readSolPrice, settleTable, tableAddress, tableBalances } from "@/lib/table-pot";
import { assetPayLink } from "@/lib/solana-pay";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

/**
 * Games that pool USDC. Players pay the table address.
 * This device signs the payout. Practice chips above this are not this pot.
 */
export function TableDesk({ names }: { names: HouseListing[] }) {
  const [address, setAddress] = useState("");
  const [usdc, setUsdc] = useState(0);
  const [sol, setSol] = useState(0);
  const [winner, setWinner] = useState("");
  const [other, setOther] = useState("");
  const [locked, setLocked] = useState(0);
  const [call, setCall] = useState<"up" | "down">("up");
  const [symbol, setSymbol] = useState(names[0]?.symbol ?? "");
  const [side, setSide] = useState<"cheap" | "rich">("cheap");
  const [busy, setBusy] = useState(false);
  const name = names.find((n) => n.symbol === symbol) ?? names[0];

  async function refresh() {
    try {
      const next = await tableBalances();
      setUsdc(next.usdc);
      setSol(next.sol);
    } catch {
      /* empty pot reads as zero once the account exists */
    }
  }

  useEffect(() => {
    try {
      setAddress(tableAddress());
    } catch {
      toast.error("This browser would not keep a table key.");
    }
    void refresh();
  }, []);

  async function pay(to: string, usd: number, memo: string) {
    if (!(usd > 0)) {
      toast.error("The pot is empty.");
      return;
    }
    if (sol < 0.002) {
      toast.error("Send about 0.01 SOL to the table address so it can pay the fee.");
      return;
    }
    setBusy(true);
    try {
      const sig = await settleTable(to, usd, memo);
      toast.success(`Paid. ${sig.slice(0, 8)}…`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The pot did not pay.");
    } finally {
      setBusy(false);
    }
  }

  const link = address ? assetPayLink("USDC", address, 0, "Senda table") : "";

  return (
    <section className="mt-4 rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">USDC table</p>
      <h2 className="mt-1 text-2xl tracking-tight">
        Pool the money. <span className="text-accent">This device pays the winner.</span>
      </h2>
      <p className="mt-2 text-sm text-muted">
        Anyone can send USDC to this address from a wallet or an exchange withdrawal. The felt above is practice. This pot is USDC. The key that pays the winner stays on this device, so the person holding the phone can redirect it. Senda never sees the key.
      </p>
      <p className="mt-3 break-all font-mono text-xs">{address || "—"}</p>
      <p className="mt-2 font-mono text-sm tabular-nums">
        {usdc.toFixed(2)} USDC · {sol.toFixed(4)} SOL
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!address}
          onClick={() => {
            void navigator.clipboard.writeText(address);
            toast.success("Table address copied.");
          }}
          className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40"
        >
          Copy address
        </button>
        <button
          type="button"
          disabled={!link}
          onClick={() => {
            void navigator.clipboard.writeText(link);
            toast.success("Pay link copied.");
          }}
          className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40"
        >
          Copy USDC link
        </button>
        <button type="button" onClick={() => void refresh()} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">
          Refresh
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold">Up / Down</h3>
          <p className="mt-1 text-xs text-muted">Lock the SOL print. Read it again. The winner takes the pot.</p>
          <div className="mt-3 flex gap-2">
            {(["up", "down"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setCall(id)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", call === id ? "bg-accent text-accent-fg" : "border border-white/10")}>
                {id === "up" ? "Up" : "Down"}
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-xs tabular-nums">{locked > 0 ? `Locked ${formatUsd(locked)}` : "Not locked"}</p>
          <button
            type="button"
            className="mt-3 min-h-11 w-full rounded-full border border-white/15 text-sm font-semibold"
            onClick={() => {
              void readSolPrice().then((row) => {
                if (!(row.usd > 0)) toast.error("No SOL price.");
                else {
                  setLocked(row.usd);
                  toast.success(`Locked ${formatUsd(row.usd)}.`);
                }
              });
            }}
          >
            Lock SOL
          </button>
          <button
            type="button"
            disabled={busy || !(locked > 0)}
            className="mt-2 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
            onClick={() => {
              void (async () => {
                const row = await readSolPrice();
                if (!(row.usd > 0)) {
                  toast.error("No SOL price.");
                  return;
                }
                const won = call === "up" ? row.usd > locked : row.usd < locked;
                if (row.usd === locked) {
                  toast.error("The print did not move. The pot stays.");
                  return;
                }
                if (!won) {
                  toast.error(`Print is ${formatUsd(row.usd)}. The call missed. The pot stays.`);
                  return;
                }
                if (!winner.trim()) {
                  toast.error("Enter the winner’s Solana address.");
                  return;
                }
                await pay(winner, Math.floor(usdc * 100) / 100, `SOL ${call}`);
              })();
            }}
          >
            Settle if it hit
          </button>
        </article>

        <article className="rounded-2xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold">Cheap or rich</h3>
          <p className="mt-1 text-xs text-muted">The live premium decides. Cheap means the token is under its mark.</p>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="mt-3 min-h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-sm">
            {names.map((n) => (
              <option key={n.symbol} value={n.symbol}>
                {n.symbol}
              </option>
            ))}
          </select>
          <p className="mt-2 font-mono text-xs">{name ? `${formatUsd(name.last)} · ${formatPremium(name.premium)}` : "No names"}</p>
          <div className="mt-3 flex gap-2">
            {(["cheap", "rich"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setSide(id)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold capitalize", side === id ? "bg-accent text-accent-fg" : "border border-white/10")}>
                {id}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || !name}
            className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
            onClick={() => {
              if (!name) return;
              const premium = name.premium ?? 0;
              const won = side === "cheap" ? premium < 0 : premium > 0;
              if (!won) {
                toast.error(`${name.symbol} is ${formatPremium(premium)}. The call missed. The pot stays.`);
                return;
              }
              if (!winner.trim()) {
                toast.error("Enter the winner’s Solana address.");
                return;
              }
              void pay(winner, Math.floor(usdc * 100) / 100, `${name.symbol} ${side}`);
            }}
          >
            Settle if it hit
          </button>
        </article>

        <article className="rounded-2xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold">Split</h3>
          <p className="mt-1 text-xs text-muted">Two addresses. Half the USDC each. Two signatures from this device.</p>
          <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Second address" className="mt-3 min-h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 font-mono text-xs outline-none" />
          <button
            type="button"
            disabled={busy}
            className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
            onClick={() => {
              const half = Math.floor(usdc * 50) / 100;
              if (!(half > 0) || !winner.trim() || !other.trim()) {
                toast.error("Need two addresses and at least $0.02 in the pot.");
                return;
              }
              void (async () => {
                await pay(winner, half, "Split A");
                const left = await tableBalances();
                const rest = Math.floor(left.usdc * 100) / 100;
                if (rest > 0) await pay(other, rest, "Split B");
              })();
            }}
          >
            Pay both
          </button>
        </article>
      </div>

      <label className="mt-4 block text-xs text-subtle">
        Winner address
        <input value={winner} onChange={(e) => setWinner(e.target.value)} placeholder="Solana address" className="mt-1 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-sm outline-none" />
      </label>
    </section>
  );
}
