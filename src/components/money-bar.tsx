import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { humanWalletError, injectedSolana, insideWalletApp, isPhoneBrowser, openInWallet } from "@/lib/mobile-wallet";
import { connectPhantom, readChain, readUsdcMoves, type UsdcMove } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

/** What the connected Solana wallet holds right now. Senda does not keep a balance. */
export function MoneyBar() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [sol, setSol] = useState<number | null>(null);
  const [usdc, setUsdc] = useState<number | null>(null);
  const [other, setOther] = useState(0);
  const [txs, setTxs] = useState<UsdcMove[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!owner) {
      setSol(null);
      setUsdc(null);
      setOther(0);
      setTxs([]);
      return;
    }
    let live = true;
    const pull = () => {
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
      readUsdcMoves(owner)
        .then((rows) => {
          if (live) setTxs(rows.filter((t) => t.signature));
        })
        .catch(() => {
          if (live) setTxs([]);
        });
    };
    pull();
    const id = window.setInterval(pull, 20000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  async function open() {
    const onPhone = isPhoneBrowser();
    const inWallet = insideWalletApp() || (onPhone && injectedSolana());
    if (!inWallet && onPhone) {
      openInWallet("phantom");
      return;
    }
    setBusy(true);
    try {
      const addr = await connectPhantom();
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") toast.error(linked.error || "The wallet did not stay.");
      else toast.success("This wallet is the account. USDC sent here shows up below.");
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "Could not connect."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="min-w-[8rem] flex-1">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">In the wallet</p>
          <p className="mt-0.5 truncate font-mono text-xs text-muted">{owner ? owner : "Not connected"}</p>
        </div>
        <Stat k="SOL" v={sol == null ? "—" : sol.toFixed(3)} />
        <Stat k="USDC" v={usdc == null ? "—" : usdc.toFixed(2)} />
        <Stat k="Other" v={owner ? String(other) : "—"} />
        {owner ? (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(owner);
              toast.success("Address copied. USDC sent to it lands in this wallet.");
            }}
            className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold"
          >
            Copy address
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void open()} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50">
            {busy ? "Waiting on Phantom…" : "Show my account"}
          </button>
        )}
        {owner ? (
          <Link to="/wallets" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
            Wallets
          </Link>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-subtle">
        {owner
          ? "This address is the clearing account. Senda does not hold the USDC. A transfer to it shows up here after the chain confirms."
          : "There is no Senda balance. The account is the wallet you connect. Load it by sending USDC to that address."}
      </p>
      {owner ? (
        <ul className="mt-2 border-t border-white/10">
          {txs.length === 0 ? <li className="py-2 text-xs text-subtle">No recent signatures on this address.</li> : null}
          {txs.slice(0, 5).map((t) => (
            <li key={t.signature} className="flex items-baseline justify-between gap-3 border-t border-white/10 py-2 first:border-t-0">
              <a className="truncate font-mono text-xs text-accent" href={`https://solscan.io/tx/${t.signature}`} target="_blank" rel="noreferrer">
                {t.err ? "Failed" : t.delta > 0 ? "In" : t.delta < 0 ? "Out" : "Signed"} · {t.signature.slice(0, 8)}…
              </a>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-subtle">
                {t.delta ? `${t.delta > 0 ? "+" : ""}${t.delta.toFixed(2)} USDC` : t.at ? new Date(t.at * 1000).toLocaleString() : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
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
