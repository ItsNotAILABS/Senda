import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { connectPhantom, readChain } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { openDeposit } from "@/components/fund-sheet";
import { injectedWallet, insideWalletApp, isPhoneBrowser, phantomBrowseHref } from "@/lib/mobile-wallet";

/** What the connected Solana wallet holds right now. Senda does not keep a balance. */
export function MoneyBar() {
  const wallet = useWallet();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [sol, setSol] = useState<number | null>(null);
  const [usdc, setUsdc] = useState<number | null>(null);
  const [other, setOther] = useState(0);

  useEffect(() => {
    if (!owner) {
      setSol(null);
      setUsdc(null);
      setOther(0);
      return;
    }
    let live = true;
    readChain(owner)
      .then((s) => {
        if (!live) return;
        setSol(s.sol);
        setUsdc(s.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
        setOther(s.tokens.filter((t) => t.symbol !== "USDC").length);
      })
      .catch(() => {
        if (live) setSol(null);
      });
    return () => {
      live = false;
    };
  }, [owner]);

  async function open() {
    try {
      const addr = await connectPhantom();
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok) toast.error(linked.error || "The wallet did not stay.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect.");
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-3">
      <div className="min-w-[8rem] flex-1">
        <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">In the wallet</p>
        <p className="mt-0.5 truncate font-mono text-xs text-muted">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Not connected"}</p>
      </div>
      <Stat k="SOL" v={sol == null ? "—" : sol.toFixed(3)} />
      <Stat k="USDC" v={usdc == null ? "—" : usdc.toFixed(2)} />
      <Stat k="Other" v={owner ? String(other) : "—"} />
      {owner ? (
        <Link to="/wallets/activity" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
          Activity
        </Link>
      ) : (
        <a
          href={phantomBrowseHref(path)}
          onClick={(e) => {
            if (injectedWallet() || insideWalletApp() || !isPhoneBrowser()) {
              e.preventDefault();
              void open();
            }
          }}
          className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
        >
          Connect Phantom
        </a>
      )}
      <button type="button" onClick={() => openDeposit()} className="min-h-10 rounded-full bg-white/10 px-4 text-sm font-semibold">
        Deposit
      </button>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[10px] text-subtle">{k}</p>
      <p className="font-mono text-sm tabular-nums">{v}</p>
    </div>
  );
}
