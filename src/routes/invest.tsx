import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PitFloor } from "@/components/pit-floor";
import type { DeskMode } from "@/components/watchlist";
import { loadClearing, postPerp } from "@/lib/clearing";
import { connectPhantom, readChain } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { getHouse } from "@/lib/sol-house";
import { usePit } from "@/lib/use-pit";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const DESKS = new Set<DeskMode>(["term", "spot", "world", "book", "options", "perps", "vault", "tape", "prog", "comms", "minty", "wrap", "curve", "basket", "lend", "eco", "xstock", "futures", "loans", "bridge", "hedge", "cover", "pre", "smart"]);

export const Route = createFileRoute("/invest")({
  validateSearch: (raw: Record<string, unknown>): { desk?: DeskMode; lane?: "solana" } => {
    const desk = typeof raw.desk === "string" && DESKS.has(raw.desk as DeskMode) ? (raw.desk as DeskMode) : undefined;
    const lane = raw.lane === "solana" ? "solana" : undefined;
    return { ...(desk ? { desk } : {}), ...(lane ? { lane } : {}) };
  },
  component: Invest,
});

function Invest() {
  const { desk, lane } = Route.useSearch();
  const pit = usePit(null);
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [usdc, setUsdc] = useState(0);

  useEffect(() => {
    if (!owner) {
      setUsdc(0);
      return;
    }
    let live = true;
    const pull = () => {
      void readChain(owner)
        .then((chain) => {
          if (live) setUsdc(chain.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 15000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  return (
    <AppShell>
      <PitFloor
        chips={usdc}
        start={desk}
        lane={lane}
        frozen={pit.frozen}
        onBuyIn={async () => ({ ok: false, error: "USDC has to be on the wallet. Add swaps SOL into it." })}
        onTrade={async (marketId, side, spend) => {
          if (spend < 1) return { ok: false, error: "Clearing takes $1 or more of USDC." };
          const names = await getHouse();
          const row = names.find((h) => h.id === marketId) ?? names.find((h) => h.symbol === marketId);
          if (!row?.mint) return { ok: false, error: "That name is not on the book." };
          const who = owner || (await connectPhantom());
          if (!owner) {
            const linked = wallet.linkChain(who, "Phantom", "phantom");
            if (!linked.ok) return { ok: false, error: linked.error || "Could not keep the address." };
          }
          const clearing = await loadClearing();
          const dir = side === "no" ? "short" : "long";
          const paid = await payUsdc({
            owner: who,
            to: clearing.pubkey,
            usd: spend,
            memo: `Senda clear perp ${row.symbol} ${dir}`,
          });
          await postPerp({
            data: {
              owner: who,
              sig: paid.signature,
              symbol: row.symbol,
              mint: row.mint,
              side: dir,
              notional: spend,
              margin: spend,
            },
          });
          wallet.investOut(spend, row.symbol);
          return { ok: true, cost: spend, shares: spend };
        }}
        onCredit={async (amount, ref) => wallet.investIn(amount, ref)}
        onDebit={async (amount, ref) => wallet.investOut(amount, ref)}
      />
    </AppShell>
  );
}
