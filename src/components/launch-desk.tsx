import { useState } from "react";
import { clankerEth, letsbonk, pumpCreate, type Chain } from "@/lib/minty";
import { PROGRAM_ID, FEE_BPS } from "@/lib/senda-program";
import { cn } from "@/lib/utils";

export function LaunchDesk() {
  const [chain, setChain] = useState<Chain>("solana");
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const ready = name.trim().length > 1 && ticker.trim().length > 1;

  return (
    <div className="px-4 pb-8">
      <p className="text-sm text-muted">Minty</p>
      <h2 className="mt-1 font-display text-3xl tracking-tight">Launch a mint</h2>
      <p className="mt-2 text-sm text-muted">
        Pump.fun on Solana, Clanker on Ethereum. Same create flow the ecosystem already runs. Senda does not custody the
        mint.
      </p>
      <div className="mt-4 flex gap-1">
        {(
          [
            ["solana", "Solana"],
            ["ethereum", "Ethereum"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setChain(id)}
            className={cn(
              "min-h-11 flex-1 rounded-full text-sm font-semibold",
              chain === id ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-xs font-medium text-subtle">Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Open something"
        className="mt-1 min-h-12 w-full rounded-2xl bg-elevated px-4 text-sm outline-none"
      />
      <label className="mt-3 block text-xs font-medium text-subtle">Ticker</label>
      <input
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        placeholder="TICK"
        maxLength={12}
        className="mt-1 min-h-12 w-full rounded-2xl bg-elevated px-4 text-sm outline-none"
      />
      {chain === "solana" ? (
        <div className="mt-5 flex flex-col gap-2">
          <a
            href={ready ? pumpCreate(name.trim(), ticker.trim()) : "https://pump.fun/create"}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center justify-center rounded-full bg-fg text-sm font-semibold text-bg"
          >
            Create on Pump.fun
          </a>
          <a
            href={ready ? letsbonk(name.trim(), ticker.trim()) : "https://letsbonk.fun"}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center justify-center rounded-full bg-elevated text-sm font-semibold"
          >
            LetsBonk
          </a>
        </div>
      ) : (
        <a
          href={ready ? clankerEth(name.trim(), ticker.trim()) : "https://clanker.world"}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-fg text-sm font-semibold text-bg"
        >
          Create on Clanker (ETH)
        </a>
      )}
      <p className="mt-8 font-mono text-[11px] leading-relaxed text-subtle">
        Agency program {PROGRAM_ID}
        <br />
        route_fill · fee {FEE_BPS} bps · CPI Jupiter · no inventory
      </p>
    </div>
  );
}
