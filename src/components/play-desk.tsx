import { useState } from "react";
import { toast } from "sonner";
import { dropChallenge, loadPlay, settleCloser, settleDirection, type Challenge, type PlayKind } from "@/lib/play";
import { formatMoney } from "@/lib/wallet";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

export function PlayDesk({ house }: { house: HouseListing[] }) {
  const wallet = useWallet();
  const names = house.filter((h) => h.venue === "prestocks").slice(0, 12);
  const [kind, setKind] = useState<PlayKind>("direction");
  const [tag, setTag] = useState("");
  const [stockId, setStockId] = useState(names[0]?.id ?? "");
  const [pick, setPick] = useState<"up" | "down">("up");
  const [stake, setStake] = useState(0);
  const [log, setLog] = useState(loadPlay);
  const stock = names.find((n) => n.id === stockId) ?? names[0];

  async function play() {
    if (!stock) return;
    const who = tag.trim();
    if (!who) {
      toast.error("Enter their @tag.");
      return;
    }
    if (!(stake > 0)) {
      toast.error("Enter a stake.");
      return;
    }
    const friend = wallet.remember(who, who);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const done = await runPrestock({ owner, mint: stock.mint, side: "buy", usd: stake, price: stock.last });
      const result = kind === "direction" ? settleDirection(stock, pick) : settleCloser(stock);
      const row: Challenge = {
        id: `pl${Math.random().toString(36).slice(2, 8)}`,
        kind,
        friend: friend.name,
        tag: friend.tag,
        symbol: stock.symbol,
        stake,
        pick,
        result,
        pnl: 0,
        createdAt: new Date().toISOString(),
      };
      setLog(dropChallenge(log, row));
      toast.success(`${stock.symbol} bought. ${done.signature.slice(0, 8)}… Score is ${result}, the token is the stake.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The swap did not send.");
    }
  }

  return (
    <div className="flex flex-col px-4 pb-8">
      <p className="pt-3 text-sm text-muted">
        Same cash. You pick a friend by @tag, a PreStock, a stake. Direction uses the 24h tape. Closer uses last vs mark.
      </p>
      <div className="mt-3 flex gap-1">
        {(
          [
            ["direction", "Direction"],
            ["closer", "Closer to mark"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            className={cn(
              "min-h-11 flex-1 rounded-full text-sm font-semibold",
              kind === id ? "bg-fg text-bg" : "bg-elevated text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="mt-4 text-xs font-medium text-subtle">Friend @tag</label>
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="@someone"
        className="mt-1 min-h-12 rounded-2xl bg-elevated px-4 text-sm outline-none placeholder:text-subtle"
      />
      {wallet.w.contacts.length > 0 ? (
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {wallet.w.contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setTag(c.tag)}
              className="min-h-11 shrink-0 rounded-full bg-elevated px-4 text-sm"
            >
              {c.tag}
            </button>
          ))}
        </div>
      ) : null}
      <label className="mt-3 text-xs font-medium text-subtle">Name</label>
      <select
        value={stock?.id ?? ""}
        onChange={(e) => setStockId(e.target.value)}
        className="mt-1 min-h-12 rounded-2xl bg-elevated px-4 text-sm outline-none"
      >
        {names.map((n) => (
          <option key={n.id} value={n.id}>
            {n.symbol} · last {formatUsd(n.last)}
          </option>
        ))}
      </select>
      {kind === "direction" ? (
        <div className="mt-3 flex gap-1">
          {(["up", "down"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPick(p)}
              className={cn(
                "min-h-11 flex-1 rounded-full text-sm font-semibold capitalize",
                pick === p ? (p === "up" ? "bg-up text-up-fg" : "bg-down text-down-fg") : "bg-elevated text-muted",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">You win if last is inside 8% of mark.</p>
      )}
      <label className="mt-3 text-xs font-medium text-subtle">Stake · USD</label>
      <input
        inputMode="decimal"
        value={stake ? String(stake) : ""}
        onChange={(e) => setStake(Number(e.target.value) || 0)}
        placeholder="0"
        className="mt-1 min-h-12 rounded-2xl bg-elevated px-4 text-lg font-semibold tabular-nums outline-none"
      />
      <button
        type="button"
        disabled={!stock}
        onClick={play}
        className="mt-4 min-h-12 rounded-full bg-fg text-base font-semibold text-bg"
      >
        Play {tag || "—"} · {stake > 0 ? formatMoney(stake) : "$0"}
      </button>
      {log.length === 0 ? (
        <p className="mt-6 text-sm text-subtle">No games yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {log.map((c: Challenge) => (
            <li key={c.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">
                  {c.symbol} vs {c.tag}
                </p>
                <p className="text-xs text-subtle">
                  {c.kind} · {c.pick} · {c.result}
                </p>
              </div>
              <p className={cn("text-sm font-semibold tabular-nums", c.pnl >= 0 ? "text-up" : "text-down")}>
                {c.pnl >= 0 ? "+" : "−"}
                {formatMoney(Math.abs(c.pnl))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
