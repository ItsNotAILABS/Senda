import { useEffect, useState } from "react";
import { toast } from "sonner";
import { WalletPicker } from "@/components/wallet-picker";
import { DeskAudit } from "@/components/money-flow";
import { TokenMark } from "@/components/token-mark";
import { COVERS } from "@/lib/cover";
import { connectPhantom } from "@/lib/phantom";
import {
  cancelChainCover,
  coverPremium,
  coverPubkey,
  coverStrikeRatio,
  coverUsdc,
  listChainCovers,
  openChainCover,
  payoutCover,
  settleChainCover,
  type ChainCover,
  type CoverKind,
} from "@/lib/cover-chain";
import { bumpClears } from "@/components/clear-strip";
import { rememberClear } from "@/lib/clear-tape";
import { derivBook } from "@/lib/deriv-book";
import { listHedges, type Hedge } from "@/lib/hedge-book";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { readUsing } from "@/lib/using";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Pool = { ui: number } | { error: string };

function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const cents = Math.round(n * 100) / 100;
  return Number.isInteger(cents) ? `$${cents.toLocaleString("en-US")}` : `$${cents.toFixed(2)}`;
}

function poolLine(pool: Pool | null): string {
  if (pool == null) return "Cover USDC · reading the account";
  if ("error" in pool) return `Cover USDC · the read failed. ${pool.error}`;
  const text = pool.ui.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  return `Cover USDC · ${text}`;
}

function formatDistance(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function termWord(kind: CoverKind): string {
  switch (kind) {
    case "drop":
      return "10% drop";
    case "drop5":
      return "5% drop";
    case "life":
      return "Fixed USDC";
  }
}

export function CoverDesk({ names }: { names: HouseListing[] }) {
  const book = names.filter((n) => n.venue === "prestocks" && n.last > 0);
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [mode, setMode] = useState<CoverKind>("drop");
  const [symbol, setSymbol] = useState(book[0]?.symbol ?? "");
  const [lifeId, setLifeId] = useState(COVERS[0].id);
  const [usd, setUsd] = useState(1);
  const [rows, setRows] = useState<ChainCover[]>([]);
  const [busy, setBusy] = useState(false);
  const [arm, setArm] = useState(false);
  const [pool, setPool] = useState<Pool | null>(null);
  const [hedges, setHedges] = useState<Hedge[]>([]);
  const [hedgeId, setHedgeId] = useState("");
  const [hedgeUsd, setHedgeUsd] = useState(25);
  const [prints, setPrints] = useState<Record<string, number>>({});
  const [watch, setWatch] = useState(false);
  const name = book.find((n) => n.symbol === symbol) ?? book[0];
  const life = COVERS.find((c) => c.id === lifeId) ?? COVERS[0];
  const premium = coverPremium(mode, usd, life.premium);
  const openRows = rows.filter((r) => r.status === "open");
  const ratio = coverStrikeRatio(mode);
  const trigger = name && ratio != null ? name.last * ratio : null;

  function refresh() {
    setRows(listChainCovers());
  }

  useEffect(() => {
    refresh();
    setHedges(listHedges());
    const u = readUsing();
    if (u && names.some((n) => n.symbol === u.symbol)) setSymbol(u.symbol);
  }, [names]);

  useEffect(() => {
    let live = true;
    derivBook()
      .then((rows) => {
        if (!live) return;
        const next: Record<string, number> = {};
        for (const row of rows) {
          const px = row.mid ?? row.spot;
          if (px && px > 0) next[`${row.base}/${row.quote}`] = px;
        }
        setPrints(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!watch) return;
    let running = false;
    const id = window.setInterval(() => {
      if (running) return;
      const row = listChainCovers().find((cover) => {
        if (cover.status !== "open" || !cover.symbol) return false;
        const ratio = coverStrikeRatio(cover.kind);
        const price = book.find((n) => n.symbol === cover.symbol)?.last || 0;
        return ratio != null && price > 0 && (price <= cover.strike * ratio || Date.now() > cover.until);
      });
      if (!row) return;
      running = true;
      const price = book.find((n) => n.symbol === row.symbol)?.last || 0;
      payoutCover(row, price)
        .then((sig) => {
          toast.success(`Cover paid from its own key. ${sig.slice(0, 8)}`);
          refresh();
        })
        .catch((e) => toast.error(e instanceof Error ? e.message : "The payout did not send."))
        .finally(() => {
          running = false;
        });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [watch, book]);

  useEffect(() => {
    setArm(false);
  }, [mode, usd, symbol, lifeId]);

  useEffect(() => {
    let live = true;
    coverUsdc()
      .then((ui) => {
        if (!live) return;
        if (!Number.isFinite(ui)) {
          setPool({ error: "The cover account did not return a USDC balance." });
          return;
        }
        setPool({ ui });
      })
      .catch((e: unknown) => {
        if (!live) return;
        setPool({ error: e instanceof Error ? e.message : "The cover account could not be read." });
      });
    return () => {
      live = false;
    };
  }, [rows]);

  async function payer(): Promise<string> {
    const who = owner || (await connectPhantom());
    if (!owner) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
    }
    return who;
  }

  async function open() {
    setBusy(true);
    try {
      const who = await payer();
      if (mode === "life") {
        const row = await openChainCover({
          owner: who,
          kind: "life",
          title: life.title,
          cover: life.premium,
          premium: life.premium,
          days: 30,
        });
        rememberClear({ sig: row.sig, from: who, to: coverPubkey(), usd: row.premium, memo: row.title, kind: "cover", status: "pending" });
        bumpClears();
        toast.success(`${life.title} is a fixed USDC premium in the cover account.`);
      } else {
        if (!name) throw new Error("No PreStock to cover.");
        const label = mode === "drop5" ? "5%" : "10%";
        const row = await openChainCover({
          owner: who,
          kind: mode,
          title: `${name.symbol} ${label} drop`,
          symbol: name.symbol,
          mint: name.mint,
          strike: name.last,
          cover: usd,
          premium,
          days: 1,
        });
        rememberClear({ sig: row.sig, from: who, to: coverPubkey(), usd: row.premium, memo: row.title, kind: "cover", status: "pending" });
        bumpClears();
        toast.success(`${name.symbol} premium signed. The token stays in the wallet.`);
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The cover did not send.");
      refresh();
    } finally {
      setBusy(false);
      setArm(false);
    }
  }

  async function settle(row: ChainCover, cancel: boolean) {
    if (!owner) return toast.error("Connect the wallet that paid the premium.");
    setBusy(true);
    try {
      if (cancel) {
        const sig = await cancelChainCover(row, owner);
        rememberClear({ sig, from: owner, to: owner, usd: row.premium, memo: row.title, kind: "cover", status: "pending" });
        bumpClears();
        toast.success(`USDC sent back. ${sig.slice(0, 8)}`);
      } else {
        const price = prints[row.symbol] || book.find((n) => n.symbol === row.symbol)?.last || 0;
        const out = await settleChainCover(row, owner, price);
        rememberClear({ sig: out.sig, from: owner, to: owner, usd: row.premium, memo: row.title, kind: "cover", status: "pending" });
        bumpClears();
        toast.success(out.bought ? "USDC sent back. The buy is signed." : "USDC sent back.");
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Settle did not send.");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-3 px-3 py-4 lg:px-5">
      <DeskAudit live="The premium is USDC you sign into the cover account, after a review." hold="Settle pays it back only on the term you already see. It is not a licensed policy." />
      <p className="font-mono text-sm tabular-nums text-fg">{poolLine(pool)}</p>
      <p className="text-sm text-muted">
        The premium leaves your wallet into a cover address this browser can move. The devnet program only stores terms. It does not pay. Send about 0.01 SOL to the cover address once, then Watch pays the USDC back when the live print is through the floor, without a second Phantom prompt. The token stays in your wallet. A buy on a hit is still a separate signature.
      </p>
      <button type="button" onClick={() => setWatch((v) => !v)} className="min-h-10 rounded-full border border-white/15 px-4 text-xs font-semibold">
        {watch ? "Watching the floor" : "Watch the floor"}
      </button>
      <HedgeCover
        hedges={hedges}
        hedgeId={hedgeId}
        onPick={setHedgeId}
        usd={hedgeUsd}
        onUsd={setHedgeUsd}
        prints={prints}
        busy={busy}
        onSign={async (hedge, kind) => {
          const strike = prints[hedge.pair];
          if (!(strike > 0)) {
            toast.error("That pair has no print yet. Cover needs a strike.");
            return;
          }
          setBusy(true);
          try {
            const who = await payer();
            const size = Math.max(1, hedgeUsd);
            const cost = coverPremium(kind, size);
            const label = kind === "drop5" ? "5%" : "10%";
            const row = await openChainCover({
              owner: who,
              kind,
              title: `${hedge.pair} ${label} on the hedge`,
              symbol: hedge.pair,
              strike,
              cover: size,
              premium: cost,
              days: 1,
            });
            rememberClear({ sig: row.sig, from: who, to: coverPubkey(), usd: row.premium, memo: row.title, kind: "cover", status: "pending" });
            bumpClears();
            refresh();
            toast.success(`${hedge.pair} cover signed. The hedge stays where it was signed.`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "The cover did not send.");
          } finally {
            setBusy(false);
          }
        }}
      />

      <div className="grid w-full items-start gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-white/10 bg-[#10131c] p-3 lg:p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg tracking-tight">PreStocks</h1>
              <p className="mt-1 text-xs text-subtle">Last is the print. Mark is the SPV. Pick a name, then sign.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["drop", "10%"],
                  ["drop5", "5%"],
                  ["life", "Fixed USDC"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={cn(
                    "min-h-10 rounded-full px-3 text-sm font-semibold",
                    mode === id ? "bg-accent text-accent-fg" : "border border-white/10 text-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 text-sm text-muted">
            {mode === "life"
              ? "A fixed USDC premium for that label. Not a death benefit."
              : mode === "drop5"
                ? "Premium is 2.5% of the size, at least $1. The line is 95% of the print you sign."
                : "Premium is 4% of the size, at least $1. The line is 90% of the print you sign."}
          </p>

          {mode === "life" ? (
            <label className="mt-3 block text-xs text-subtle">
              Label
              <select
                value={lifeId}
                onChange={(e) => setLifeId(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-fg outline-none"
              >
                {COVERS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} · ${c.premium}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">{life.blurb}</span>
            </label>
          ) : (
            <label className="mt-3 block text-xs text-subtle">
              Size · {name?.symbol ?? "no name"}
              <input
                value={usd}
                onChange={(e) => setUsd(Math.max(1, Number(e.target.value) || 0))}
                inputMode="decimal"
                className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-lg tabular-nums outline-none"
              />
            </label>
          )}

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-subtle">Premium</p>
              <p className="font-mono text-2xl tabular-nums text-fg">{money(premium)}</p>
              {mode !== "life" && name && trigger != null ? (
                <p className="mt-1 text-xs text-muted">
                  {name.symbol} strike {formatUsd(name.last)} · trigger {formatUsd(trigger)}. The floor is {Math.abs(((trigger - name.last) / name.last) * 10_000).toFixed(0)} bps under the mark. It pays when a print is through that floor. The premium is the whole price. There is no second desk fee.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted">The premium is the whole price. There is no second desk fee on a cover.</p>
              )}
            </div>
            {owner ? (
              <button
                type="button"
                disabled={busy || (mode !== "life" && !name)}
                onClick={() => {
                  if (!arm) {
                    setArm(true);
                    return;
                  }
                  void open();
                }}
                className="min-h-12 min-w-36 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg disabled:opacity-50"
              >
                {busy ? "Waiting for Phantom…" : arm ? "Sign the premium" : "Review"}
              </button>
            ) : (
              <div className="w-full max-w-xl">
                <WalletPicker />
              </div>
            )}
          </div>
          {arm ? <p className="mt-2 text-xs text-muted">Review: {money(premium)} USDC leaves this wallet. The token stays. This is not an insurance policy.</p> : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-subtle">
                  <th className="px-2 py-1.5 font-medium">Symbol</th>
                  <th className="px-2 py-1.5 text-right font-medium">Last</th>
                  <th className="px-2 py-1.5 text-right font-medium">Mark</th>
                </tr>
              </thead>
              <tbody>
                {book.map((n) => {
                  const on = n.symbol === name?.symbol;
                  return (
                    <tr
                      key={n.id}
                      onClick={() => setSymbol(n.symbol)}
                      className={cn("cursor-pointer border-b border-white/5", on ? "bg-white/10" : "hover:bg-white/[0.04]")}
                    >
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-2">
                          <TokenMark stock={n} size={28} />
                          <span>
                            <span className="block font-semibold">{n.symbol}</span>
                            <span className="block text-[11px] text-subtle">{n.name}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">{formatUsd(n.last)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">{formatUsd(n.mark)}</td>
                    </tr>
                  );
                })}
                {book.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-3 text-muted">
                      No name priced.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-white/10 bg-[#10131c] p-3 lg:p-4">
          <h2 className="text-lg tracking-tight">Open covers</h2>
          <p className="mt-1 text-xs text-subtle">Distance is how far the live print sits above the trigger.</p>
          {openRows.length === 0 ? <p className="mt-4 text-sm text-muted">None.</p> : null}
          {openRows.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-subtle">
                    <th className="px-2 py-1.5 font-medium">Cover</th>
                    <th className="px-2 py-1.5 text-right font-medium">Strike</th>
                    <th className="px-2 py-1.5 text-right font-medium">Live</th>
                    <th className="px-2 py-1.5 text-right font-medium">Distance</th>
                    <th className="px-2 py-1.5 text-right font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {openRows.map((r) => {
                    const listed = book.find((n) => n.symbol === r.symbol);
                    const live = listed && listed.last > 0 ? listed.last : null;
                    const line = coverStrikeRatio(r.kind);
                    const hitAt = line != null && r.strike > 0 ? r.strike * line : null;
                    const distance = live != null && hitAt != null ? ((live - hitAt) / live) * 100 : null;
                    return (
                      <tr key={r.id} className="border-b border-white/5 align-top">
                        <td className="px-2 py-3">
                          <span className="block font-semibold">{r.symbol || r.title}</span>
                          <span className="mt-0.5 block text-[11px] text-subtle">
                            {r.kind === "life" ? r.title : termWord(r.kind)} · {money(r.premium)}
                          </span>
                          <a
                            href={`https://solscan.io/tx/${r.sig}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 block font-mono text-[11px] text-accent"
                          >
                            {r.sig.slice(0, 8)}
                          </a>
                        </td>
                        <td className="px-2 py-3 text-right font-mono tabular-nums">{r.strike > 0 ? formatUsd(r.strike) : "—"}</td>
                        <td className="px-2 py-3 text-right font-mono tabular-nums">{live != null ? formatUsd(live) : "—"}</td>
                        <td
                          className={cn(
                            "px-2 py-3 text-right font-mono tabular-nums",
                            distance != null && distance <= 0 ? "text-accent" : "text-muted",
                          )}
                        >
                          {distance == null ? "—" : formatDistance(distance)}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void settle(r, false)}
                              className="min-h-9 rounded-full bg-accent px-4 text-xs font-semibold text-accent-fg disabled:opacity-40"
                            >
                              Settle
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void settle(r, true)}
                              className="min-h-9 rounded-full border border-white/15 px-4 text-xs font-semibold text-muted disabled:opacity-40"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function HedgeCover({
  hedges,
  hedgeId,
  onPick,
  usd,
  onUsd,
  prints,
  busy,
  onSign,
}: {
  hedges: Hedge[];
  hedgeId: string;
  onPick: (id: string) => void;
  usd: number;
  onUsd: (n: number) => void;
  prints: Record<string, number>;
  busy: boolean;
  onSign: (hedge: Hedge, kind: "drop" | "drop5") => void;
}) {
  const hedge = hedges.find((row) => row.id === hedgeId) ?? hedges[0];
  const print = hedge ? prints[hedge.pair] : undefined;
  return (
    <section className="rounded-2xl border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">On a hedge</p>
      <h2 className="mt-1 text-lg">Cover the pair you already signed.</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        The premium is USDC into the same cover account. The long stays in Phantom and the short stays in MetaMask. If the print falls through the line, the USDC comes back. It does not buy the currency.
      </p>
      {hedges.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No hedge yet. Open one on Trade, then cover it here.</p>
      ) : (
        <>
          <div className="mt-3 flex gap-1 overflow-x-auto">
            {hedges.map((row) => (
              <button key={row.id} type="button" onClick={() => onPick(row.id)} className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-semibold", hedge?.id === row.id ? "bg-white text-black" : "bg-white/10")}>
                {row.pair}
              </button>
            ))}
          </div>
          {hedge ? (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <p className="font-mono text-2xl">{hedge.pair}</p>
                <p className="mt-1 text-xs text-muted">
                  {hedge.long ? `Long · ${hedge.long.where}` : "No long"}
                  {hedge.short ? ` · Short · ${hedge.short.where}` : ""}
                  {print ? ` · print ${print >= 20 ? print.toFixed(2) : print.toFixed(5)}` : " · print not loaded"}
                </p>
              </div>
              <label className="text-xs text-subtle">
                Size
                <input value={usd} onChange={(e) => onUsd(Math.max(1, Number(e.target.value) || 0))} inputMode="decimal" className="mt-1 block w-28 rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-lg" />
              </label>
              <button type="button" disabled={busy} onClick={() => onSign(hedge, "drop5")} className="min-h-10 rounded-full bg-white px-4 text-xs font-semibold text-black disabled:opacity-40">
                5% · {money(coverPremium("drop5", usd))}
              </button>
              <button type="button" disabled={busy} onClick={() => onSign(hedge, "drop")} className="min-h-10 rounded-full bg-accent px-4 text-xs font-semibold text-accent-fg disabled:opacity-40">
                10% · {money(coverPremium("drop", usd))}
              </button>
            </div>
          ) : null}
        </>
      )}
      <a href="/invest" className="mt-3 inline-flex text-xs font-semibold text-accent">Open a hedge on Trade</a>
    </section>
  );
}
