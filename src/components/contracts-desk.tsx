import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LiveChart } from "@/components/price-chart";
import { MoneyBar } from "@/components/money-bar";
import { OptionChain } from "@/components/option-chain";
import { OpenBook } from "@/components/pre-desk";
import { PocketDesk } from "@/components/pocket-desk";
import { TabLead } from "@/components/tab-lead";
import { cancelChainCover, listChainCovers, openChainCover, readCoverFills, type ChainCover } from "@/lib/cover-chain";
import { getOutsideBook, type OutsideContract } from "@/lib/derive-book";
import { formatStrike, type OptContract, type OptTenor } from "@/lib/option-chain";
import { connectPhantom, phantomProvider } from "@/lib/phantom";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function ContractsDesk({ names }: { names: HouseListing[] }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const book = names.filter((n) => n.last > 0);
  const [symbol, setSymbol] = useState(book[0]?.symbol || "");
  const [usd, setUsd] = useState(1);
  const [tenor, setTenor] = useState<OptTenor>("1d");
  const [order, setOrder] = useState<"chain" | "cover">("chain");
  const [picked, setPicked] = useState<OptContract | null>(null);
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");
  const [tickets, setTickets] = useState<ChainCover[]>([]);
  const [outside, setOutside] = useState<OutsideContract[]>([]);
  const name = book.find((n) => n.symbol === symbol) || book[0];

  async function signer(): Promise<string> {
    const live = phantomProvider()?.publicKey?.toString();
    const who = live || owner || (await connectPhantom());
    if (who !== owner) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
    }
    return who;
  }

  useEffect(() => {
    let live = true;
    const local = listChainCovers();
    if (!owner) {
      setTickets(local);
      return;
    }
    readCoverFills(owner)
      .then((chain) => {
        if (!live) return;
        const seen = new Set(local.map((r) => r.sig));
        setTickets([...local, ...chain.filter((r) => !seen.has(r.sig))]);
      })
      .catch(() => live && setTickets(local));
    return () => {
      live = false;
    };
  }, [owner, sig]);

  useEffect(() => {
    let live = true;
    getOutsideBook()
      .then((rows) => live && setOutside(rows))
      .catch(() => live && setOutside([]));
    return () => {
      live = false;
    };
  }, []);

  async function buyCover() {
    if (!name) return;
    setBusy(true);
    try {
      const who = await signer();
      const premium = Math.max(1, Math.round(usd * 0.04));
      const done = await openChainCover({
        owner: who,
        kind: "drop",
        title: `${name.symbol} drop`,
        symbol: name.symbol,
        mint: name.mint,
        strike: name.last,
        cover: usd,
        premium,
        days: 1,
      });
      setSig(done.sig);
      setTickets(listChainCovers());
      toast.success(`Cover opened. ${done.sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The cover did not open.");
    } finally {
      setBusy(false);
    }
  }

  async function buy(c: OptContract) {
    if (!name) return;
    setBusy(true);
    try {
      const who = await signer();
      const premium = Math.max(1, Math.round(usd * c.ask));
      const done = await openChainCover({
        owner: who,
        kind: c.kind === "put" ? "drop" : "life",
        title: `${name.symbol} ${c.kind} ${formatStrike(c.strike)}`,
        symbol: name.symbol,
        mint: name.mint,
        strike: c.strike,
        cover: usd,
        premium,
        days: c.tenor === "7d" ? 7 : 1,
      });
      setSig(done.sig);
      setTickets(listChainCovers());
      toast.success(`${name.symbol} ${c.kind} opened. ${done.sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The contract did not open.");
    } finally {
      setBusy(false);
    }
  }

  async function close(row: ChainCover) {
    setBusy(true);
    try {
      const who = await signer();
      const back = await cancelChainCover(row, who);
      setSig(back);
      setTickets(listChainCovers());
      toast.success(`Closed. $${row.premium.toFixed(2)} is back. ${back.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The close did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Contracts"
        title="Contracts"
        accent="with money in them."
        line="Buy a call or a put. Or open a pocket that pays on a time, a line, or a decision."
        live={["Buy a call or a put.", "A pocket on a time, a line, or a decision."]}
        coming={["A payout from someone else's wallet."]}
      />
      <MoneyBar />
      <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0e16]">
        <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 py-2">
          {book.map((n) => (
            <button
              key={n.symbol}
              type="button"
              onClick={() => setSymbol(n.symbol)}
              className={cn(
                "min-h-11 shrink-0 rounded-lg px-3 text-left",
                n.symbol === name?.symbol ? "bg-white/10" : "text-muted",
              )}
            >
              <span className="block text-sm font-semibold">{n.symbol}</span>
              <span className="block font-mono text-[11px] tabular-nums text-subtle">{formatUsd(n.last)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">Last</p>
            <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">{name ? formatUsd(name.last) : "—"}</p>
            <p className="mt-1 text-sm text-muted">{name ? name.name : "Pick a name"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">Size</p>
            <div className="mt-1 flex gap-1">
              <input
                inputMode="decimal"
                defaultValue={usd}
                key={usd}
                aria-label="Size in USDC"
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n > 0) setUsd(n);
                }}
                className="min-h-11 w-16 rounded-lg bg-white/5 px-2 font-mono text-sm outline-none"
              />
              {[1, 5, 10, 25].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setUsd(n)}
                  className={cn(
                    "min-h-11 min-w-11 rounded-lg px-3 font-mono text-sm font-semibold tabular-nums",
                    usd === n ? "bg-accent text-accent-fg" : "bg-white/5 text-muted",
                  )}
                >
                  ${n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid border-t border-white/10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="min-w-0 border-white/10 lg:border-r">
            {name ? <LiveChart mint={name.mint} symbol={name.symbol} live={name.last} /> : null}
          </div>
          <div className="min-w-0 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex gap-1">
                {(["chain", "cover"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOrder(id)}
                    className={cn(
                      "min-h-11 rounded-lg px-3 text-sm font-semibold",
                      order === id ? "bg-white/10 text-fg" : "text-muted",
                    )}
                  >
                    {id === "chain" ? "Chain" : "Cover"}
                  </button>
                ))}
              </div>
              <p className="font-mono text-xs tabular-nums text-muted">${usd.toFixed(2)}</p>
            </div>
            {order === "chain" ? (
              <>
                <OptionChain stock={name || null} tenor={tenor} onTenor={setTenor} busy={busy} onBuy={setPicked} />
                {picked && name ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-sm font-semibold">
                      {name.symbol} <span className={picked.kind === "call" ? "text-up" : "text-down"}>{picked.kind}</span>
                    </p>
                    <p className="mt-1 font-mono text-xs tabular-nums text-subtle">
                      Strike {formatStrike(picked.strike)} · debit ${Math.max(1, Math.round(usd * picked.ask)).toFixed(2)} · size ${usd.toFixed(2)}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      Phantom signs the debit into a premium account. Close returns it. It does not pay a profit until another wallet posts the payout.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void buy(picked)}
                      className="mt-3 min-h-11 w-full rounded-lg bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
                    >
                      Buy {picked.kind} {formatStrike(picked.strike)} · ${Math.max(1, Math.round(usd * picked.ask)).toFixed(2)}
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted">Tap a call or a put. Nothing signs until you buy.</p>
                )}
              </>
            ) : name ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-sm font-semibold">Cover a 10% drop</p>
                <dl className="mt-3 space-y-2 font-mono text-xs tabular-nums">
                  <div className="flex justify-between"><dt className="text-subtle">Last</dt><dd>{formatUsd(name.last)}</dd></div>
                  <div className="flex justify-between"><dt className="text-subtle">Pays at or under</dt><dd>{formatUsd(name.last * 0.9)}</dd></div>
                  <div className="flex justify-between"><dt className="text-subtle">Premium</dt><dd>${Math.max(1, Math.round(usd * 0.04)).toFixed(2)}</dd></div>
                  <div className="flex justify-between"><dt className="text-subtle">Size</dt><dd>${usd.toFixed(2)}</dd></div>
                </dl>
                <p className="mt-2 text-xs text-muted">Same cover as PreStocks. Premium is USDC. The token you hold stays put. Not a licensed policy.</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void buyCover()}
                  className="mt-3 min-h-11 w-full rounded-lg bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
                >
                  Buy the cover
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <OpenBook rows={tickets} names={names} busy={busy} onClose={(row) => void close(row)} />
      </section>
      <PocketDesk names={names} signer={signer} />
      <Outside rows={outside} />
    </div>
  );
}

function Outside({ rows }: { rows: OutsideContract[] }) {
  if (!rows.length) return null;
  return (
    <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0e16]">
      <div className="flex items-baseline justify-between px-4 py-3">
        <p className="font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">Derive</p>
        <p className="text-xs text-muted">Not signed here</p>
      </div>
      <div className="grid grid-cols-[1.1fr_.8fr_.8fr_.7fr] px-4 pb-2 font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">
        <p>Contract</p>
        <p className="text-right">Strike</p>
        <p className="text-right">Mark</p>
        <p className="text-right">Payoff</p>
      </div>
      <ul>
        {rows.map((row) => {
          const pay = row.kind === "call" ? Math.max(row.index - row.strike, 0) : Math.max(row.strike - row.index, 0);
          return (
            <li key={row.name} className="grid grid-cols-[1.1fr_.8fr_.8fr_.7fr] items-center border-t border-white/5 px-4 py-3">
              <p className="text-sm font-semibold">
                {row.symbol} <span className={row.kind === "call" ? "text-up" : "text-down"}>{row.kind}</span>
              </p>
              <p className="text-right font-mono text-sm tabular-nums">{formatUsd(row.strike)}</p>
              <p className="text-right font-mono text-sm tabular-nums">{formatUsd(row.mark)}</p>
              <p className="text-right font-mono text-sm tabular-nums">${pay.toFixed(2)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
