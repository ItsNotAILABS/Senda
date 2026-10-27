import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { WalletPicker } from "@/components/wallet-picker";
import { CardUse } from "@/components/card-use";
import { PairHoldings } from "@/components/pair-bundle";
import { payReference, transferRequest } from "@/lib/solana-pay";
import { readChain, readUsdcMoves, invalidateChain, connectPhantom, pickOwner, type ChainWallet, type UsdcMove } from "@/lib/phantom";
import { buildPicture, quoteHeld, type Picture } from "@/lib/money-picture";
import { loadPulse } from "@/lib/universe";
import { onTrades } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const CASH = "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH";

function money(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** The customer account. The number is USDC on the wallet. The card spends and receives on that wallet. */
export function CompanyAccount({ compact = false }: { compact?: boolean }) {
  const { w, issue, linkChain } = useWallet();
  const owner = pickOwner(w.links);
  const card = w.cards.find((c) => c.status === "active" && !c.frozen) ?? w.cards.find((c) => c.status !== "terminated");
  const [chain, setChain] = useState<ChainWallet | null>(null);
  const [moves, setMoves] = useState<UsdcMove[]>([]);
  const [err, setErr] = useState("");
  const [pay, setPay] = useState("");
  const [tick, setTick] = useState(0);
  const [worth, setWorth] = useState<Picture | null>(null);
  useEffect(() => onTrades(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    if (!owner) {
      setChain(null);
      setMoves([]);
      setPay("");
      return;
    }
    let live = true;
    const pull = () => {
      readChain(owner)
        .then((s) => {
          if (!live) return;
          setChain(s);
          setErr("");
        })
        .catch((e: unknown) => {
          if (live) setErr(e instanceof Error ? e.message : "Could not read the account.");
        });
    };
    pull();
    const id = window.setInterval(pull, 15000);
    void readUsdcMoves(owner)
      .then((rows) => {
        if (live) setMoves(rows);
      })
      .catch(() => undefined);
    const movesId = window.setInterval(() => {
      void readUsdcMoves(owner)
        .then((rows) => {
          if (live) setMoves(rows);
        })
        .catch(() => undefined);
    }, 15000);
    const ref = payReference(`acct:${owner}`);
    setPay(
      transferRequest({
        recipient: owner,
        splToken: USDC,
        reference: ref,
        label: "Senda",
        message: "Pay this account",
        memo: "Senda account",
      }),
    );
    return () => {
      live = false;
      window.clearInterval(id);
      window.clearInterval(movesId);
    };
  }, [owner, tick]);

  useEffect(() => {
    if (!owner || !chain) {
      setWorth(null);
      return;
    }
    let live = true;
    void loadPulse()
      .catch(() => ({ rows: [] }))
      .then((pulse) => quoteHeld(chain.tokens.map((t) => t.mint), pulse.rows))
      .then((tape) => {
        if (!live) return;
        setWorth(buildPicture({ owner, sol: chain.sol, tokens: chain.tokens, tape, cash: 0, house: null }));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [owner, chain]);

  const usdc = chain?.tokens.find((t) => t.mint === USDC || t.symbol === "USDC")?.ui ?? 0;
  const cash = chain?.tokens.find((t) => t.mint === CASH || t.symbol === "CASH")?.ui ?? 0;
  const total = worth?.total ?? usdc + cash;
  const bare = worth?.lines.filter((line) => !(line.usd > 0)) ?? [];
  const dollarLine = worth
    ? `USDC ${money(worth.usdc)} · CASH ${money(worth.phantomCash)} · ${worth.sol.toFixed(4)} SOL${worth.solUsd > 0 ? ` ($${money(worth.solUsd)})` : ""}`
    : "Reading this address.";

  function getCard() {
    const r = issue("virtual", w.tag.replace("@", "").toUpperCase() || "SENDA", 1500);
    if (!r.ok) toast.error(r.error || "No card.");
    else toast.success("Card is on this account. It spends the USDC you sign.");
  }

  async function copyPay() {
    if (!pay) return;
    try {
      await navigator.clipboard.writeText(pay);
      toast.success("Pay link copied. Their wallet sends USDC here.");
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(90%_80%_at_100%_0%,rgb(214_255_74/0.14),transparent_46%),#10131c] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Senda</p>
          <p className="mt-1 font-mono text-4xl tabular-nums tracking-tight sm:text-5xl">{owner ? money(total) : "—"}</p>
          <p className="mt-1 text-sm text-muted">{owner ? dollarLine : "Connect a wallet. That address is the account."}</p>
          {bare.length ? <p className="mt-1 text-xs text-subtle">Not in the dollar total yet: {bare.map((line) => line.symbol).join(", ")}. No price came back.</p> : null}
          {worth && worth.lines.some((line) => line.usd > 0) ? (
            <ul className="mt-3 max-w-md space-y-1">
              {worth.lines
                .filter((line) => line.usd > 0)
                .sort((a, b) => b.usd - a.usd)
                .slice(0, 8)
                .map((line) => (
                  <li key={line.symbol} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 text-xs">
                    <span className="font-semibold">{line.symbol}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${total > 0 ? Math.max(4, (line.usd / total) * 100) : 0}%` }} />
                    </span>
                    <span className="text-right font-mono tabular-nums">{money(line.usd)}</span>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
        {owner && chain ? (
          <div className="text-right">
            <p className="font-mono text-sm text-subtle">
              {chain.sol.toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL
              <span className="mt-1 block">{owner.slice(0, 4)}…{owner.slice(-4)}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                invalidateChain(owner);
                setTick((n) => n + 1);
              }}
              className="mt-2 block text-xs font-semibold text-accent"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                void connectPhantom()
                  .then((addr) => {
                    const linked = linkChain(addr, "Phantom", "phantom");
                    if (!linked.ok) {
                      toast.error(linked.error || "The wallet did not stay.");
                      return;
                    }
                    invalidateChain(addr);
                    setTick((n) => n + 1);
                    toast.success("Reading the Phantom that just connected.");
                  })
                  .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Phantom did not connect."));
              }}
              className="mt-1 block text-xs font-semibold text-white/70"
            >
              Use this Phantom
            </button>
          </div>
        ) : null}
      </div>
      {err ? <p className="mt-2 text-sm text-down">{err}</p> : null}
      {chain && chain.tokens.filter((t) => t.symbol !== "USDC").length ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto">
          {chain.tokens
            .filter((t) => t.symbol !== "USDC" && t.symbol !== "CASH")
            .slice(0, 8)
            .map((t) => (
              <li key={t.mint} className="min-w-[108px] rounded-2xl bg-black/30 px-3 py-2">
                <p className="text-sm font-semibold">{t.symbol}</p>
                <p className="font-mono text-xs">{t.ui < 1 ? t.ui.toFixed(4) : t.ui.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
              </li>
            ))}
        </ul>
      ) : null}
      {owner ? <PairHoldings owner={owner} /> : null}
      {!owner ? (
        <div className="mt-4"><WalletPicker /></div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Go to="/payments" search={{ act: "add" }} label="Add" />
            <Go to="/payments" search={{ act: "send" }} label="Send" />
            <Go to="/invest" label="Trade" />
            <Go to="/social" label="Predict" />
            <Go to="/cover" label="Cover" />
            <Go to="/cards" search={{ spend: 0 }} label="Card" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-black/30 px-3 py-3">
            <div>
              <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">Card</p>
              <p className="font-mono text-sm">{card ? `•••• ${card.last4}` : "None yet"}</p>
            </div>
            {card ? (
              <Link to="/cards" search={{ spend: 0 }} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black inline-flex items-center">
                Use
              </Link>
            ) : (
              <button type="button" onClick={getCard} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
                Get a card
              </button>
            )}
          </div>
          {!compact && card && owner ? (
            <div className="mt-3">
              <CardUse card={card} owner={owner} />
            </div>
          ) : null}
          {!compact && pay ? (
            <div className="mt-3">
              <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">Pay this account</p>
              <p className="mt-1 break-all font-mono text-[11px] text-muted">{pay}</p>
              <button type="button" onClick={() => void copyPay()} className="mt-2 min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold">
                Copy pay link
              </button>
            </div>
          ) : null}
          {moves.length > 0 ? (
              <ul className="mt-4 border-t border-white/10">
                {moves.slice(0, compact ? 4 : 8).map((tx) => (
                  <li key={tx.signature} className="flex items-center justify-between gap-3 border-b border-white/10 py-2 text-sm last:border-0">
                    <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noreferrer" className="min-w-0">
                      <span className={cn("block font-mono tabular-nums", tx.err ? "text-down" : tx.delta < 0 ? "text-white" : "text-accent")}>
                        {tx.err ? "Failed" : `${tx.delta > 0 ? "+" : ""}${tx.delta.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`}
                      </span>
                      <span className="block truncate text-[11px] text-subtle">{tx.other ? `${tx.other.slice(0, 4)}…${tx.other.slice(-4)}` : "USDC"}</span>
                    </a>
                    <span className="shrink-0 text-[11px] text-subtle">{tx.time ? new Date(tx.time * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-subtle">No USDC in or out on this address yet.</p>
            )}
        </>
      )}
    </section>
  );
}

function Go({
  to,
  search,
  label,
}: {
  to: "/payments" | "/cards" | "/invest" | "/social" | "/cover";
  search?: { act: string } | { spend: number };
  label: string;
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className="flex min-h-12 items-center justify-center rounded-full bg-white/10 text-sm font-semibold"
    >
      {label}
    </Link>
  );
}
