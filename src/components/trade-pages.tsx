import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BasketDesk } from "@/components/basket-desk";
import { CurveDesk } from "@/components/curve-desk";
import { EcosystemDesk } from "@/components/ecosystem-desk";
import { FillButton } from "@/components/fill-button";
import { JupBoard } from "@/components/jup-ticket";
import { LaunchDesk } from "@/components/launch-desk";
import { LendDesk } from "@/components/lend-desk";
import { MarketStream } from "@/components/market-stream";
import { OptionChain } from "@/components/option-chain";
import { PerpDesk } from "@/components/perp-desk";
import { RadarDesk } from "@/components/radar-desk";
import { TradeTerminal } from "@/components/trade-terminal";
import { type OptTenor } from "@/lib/option-chain";
import { connectPhantom, readChain, splHolding, type ChainWallet } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { getVerifiedAssets, type VerifiedAsset } from "@/lib/quote-gate";
import { formatUsd, getHouse, HOUSE_FALLBACK, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function usePreNames() {
  const [house, setHouse] = useState<HouseListing[]>(HOUSE_FALLBACK);
  useEffect(() => {
    let live = true;
    const pull = () =>
      getHouse()
        .then((rows) => {
          if (live && rows.length) setHouse(rows);
        })
        .catch(() => undefined);
    void pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);
  return useMemo(() => house.filter((r) => r.venue === "prestocks" && r.last > 0), [house]);
}

function useCash() {
  const wallet = useWallet();
  const cash = Math.floor((wallet.w.balances.USD || 0) + (wallet.w.balances.USDC || 0));
  return {
    cash,
    onCredit: async (amount: number, ref: string) => wallet.investIn(amount, ref),
    onDebit: async (amount: number, ref: string) => wallet.investOut(amount, ref),
  };
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-3 lg:px-5 lg:py-4">{children}</div>;
}

export function MarketsPage() {
  const names = usePreNames();
  const navigate = useNavigate();
  const [gate, setGate] = useState<VerifiedAsset[] | null>(null);
  const [note, setNote] = useState("Asking Jupiter for a $25 fill…");
  useEffect(() => {
    let live = true;
    getVerifiedAssets()
      .then((book) => {
        if (!live) return;
        setGate(book.assets.filter((a) => a.kind === "prestock"));
        setNote(book.note);
      })
      .catch(() => live && setNote("Jupiter did not answer. Nothing is listed."));
    return () => {
      live = false;
    };
  }, []);
  const rows = (gate ?? []).map((a) => {
    const n = names.find((row) => row.mint === a.mint);
    return { a, n };
  });
  return (
    <Page>
      <header className="mb-4">
        <h1 className="text-4xl font-semibold tracking-tight">Markets</h1>
        <p className="mt-2 max-w-xl text-sm text-white/50">{note}</p>
      </header>
      <ul className="overflow-hidden rounded-[28px] bg-[#141418]">
        {rows.map(({ a, n }) => {
          const chg = n?.change24h;
          const down = (chg ?? 0) < 0;
          return (
            <li key={a.mint} className="border-t border-white/8 first:border-t-0">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                onClick={() => void navigate({ href: `/invest/name/${encodeURIComponent(a.symbol)}` })}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-black">{a.symbol.slice(0, 4)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{a.symbol}</span>
                  <span className="block truncate text-xs text-white/45">{n?.name || "Pre-IPO token"}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-sm tabular-nums">{n ? formatUsd(n.last) : "—"}</span>
                  <span className={cn("font-mono text-[11px]", down ? "text-[#ff5d73]" : "text-[#3dd68c]")}>
                    {chg == null ? `${a.impactPct.toFixed(2)}% impact` : `${down ? "" : "+"}${(chg * 100).toFixed(2)}%`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {gate && rows.length === 0 ? <p className="px-4 py-8 text-sm text-muted">No pre-IPO name filled at $25 inside 1% impact.</p> : null}
      {!gate ? <p className="px-4 py-8 text-sm text-muted">Checking Jupiter…</p> : null}
    </Page>
  );
}

export function TicketPage({ symbol }: { symbol: string }) {
  const names = usePreNames();
  const navigate = useNavigate();
  const under = names.find((n) => n.symbol.toLowerCase() === decodeURIComponent(symbol).toLowerCase()) ?? names[0] ?? null;
  const [armed, setArmed] = useState(25);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  return (
    <div className="py-2">
      <div className="flex items-center gap-3 px-3 pb-1 lg:px-5">
        <button type="button" onClick={() => void navigate({ href: "/invest" })} className="text-xs text-subtle hover:text-fg">
          Markets
        </button>
        <select
          aria-label="Name"
          value={under?.symbol ?? ""}
          onChange={(e) => void navigate({ href: `/invest/name/${encodeURIComponent(e.target.value)}` })}
          className="min-h-9 rounded-lg border border-white/10 bg-black/40 px-2 font-mono text-xs"
        >
          {names.map((n) => (
            <option key={n.id} value={n.symbol}>
              {n.symbol}
            </option>
          ))}
        </select>
      </div>
      <TradeTerminal
        focus="ticket"
        names={names}
        under={under}
        onPick={(id) => {
          const row = names.find((n) => n.id === id);
          if (row) void navigate({ href: `/invest/name/${encodeURIComponent(row.symbol)}` });
        }}
        armed={armed}
        side={side}
        onArmed={setArmed}
        onSide={setSide}
        positions={[]}
      />
    </div>
  );
}

export function PositionsPage() {
  const wallet = useWallet();
  const names = usePreNames();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [chain, setChain] = useState<ChainWallet | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!owner) return;
    let live = true;
    readChain(owner)
      .then((snap) => live && setChain(snap))
      .catch((e: unknown) => live && setErr(e instanceof Error ? e.message : "The wallet did not answer."));
    return () => {
      live = false;
    };
  }, [owner]);

  async function sellHalf(mint: string, symbol: string) {
    setBusy(mint);
    try {
      const who = owner || (await connectPhantom());
      const held = await splHolding(who, mint);
      const half = BigInt(held.raw) / 2n;
      if (half <= 0n) throw new Error(`Not enough ${symbol} to sell half.`);
      const last = names.find((n) => n.mint === mint)?.last ?? 0;
      const usd = last > 0 ? Math.max(1, Math.round(((held.ui / 2) * last) * 100) / 100) : Math.max(1, held.ui / 2);
      const done = await runPrestock({ owner: who, mint, side: "sell", usd, price: last > 0 ? last : 1 });
      toast.success(`Sold about half of ${symbol}. ${done.signature.slice(0, 8)}…`);
      setChain(await readChain(who));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The sell did not send.");
    } finally {
      setBusy("");
    }
  }

  const rows = (chain?.tokens ?? []).filter((t) => t.ui > 0 && t.symbol !== "USDC");
  const usdc = chain?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;

  return (
    <Page>
      <h1 className="text-2xl tracking-tight">Positions</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        This is the connected wallet. Not a balance stored in the browser. Sell sends a Jupiter swap you sign. USDC {owner ? usdc.toFixed(2) : "—"}
        {chain ? ` · SOL ${chain.sol.toFixed(4)}` : ""}
      </p>
      {!owner ? (
        <button
          type="button"
          onClick={() => {
            void connectPhantom()
              .then((addr) => {
                const linked = wallet.linkChain(addr, "Phantom", "phantom");
                if (!linked.ok) toast.error(linked.error || "Could not keep the address.");
              })
              .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "No wallet."));
          }}
          className="mt-4 min-h-11 rounded-full bg-fg px-5 text-sm font-semibold text-bg"
        >
          Connect the wallet
        </button>
      ) : null}
      {err ? <p className="mt-3 text-sm text-down">{err}</p> : null}
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] text-subtle uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Token</th>
              <th className="px-2 py-2 text-right font-medium">Balance</th>
              <th className="px-4 py-2 text-right font-medium">Sell</th>
            </tr>
          </thead>
          <tbody>
            {!owner ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-muted">
                  Connect a wallet to read what it holds.
                </td>
              </tr>
            ) : !chain ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-muted">
                  Reading the chain…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-muted">
                  No tokens besides cash.
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.mint} className="border-t border-white/10">
                  <td className="px-4 py-2 font-mono text-xs font-semibold">{t.symbol}</td>
                  <td className="px-2 py-2 text-right font-mono text-xs">{t.ui.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" disabled={busy === t.mint} onClick={() => void sellHalf(t.mint, t.symbol)} className="min-h-9 rounded-full bg-elevated px-3 text-xs font-semibold">
                      {busy === t.mint ? "Signing…" : "Sell half"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Page>
  );
}

export function OptionsPage() {
  const names = usePreNames();
  const [id, setId] = useState<string | null>(null);
  const [tenor, setTenor] = useState<OptTenor>("1d");
  const [armed, setArmed] = useState(25);
  const under = names.find((n) => n.id === id) ?? names[0] ?? null;

  return (
    <div className="grid min-h-[calc(100dvh-4.25rem)] lg:grid-cols-[240px_minmax(0,1fr)_280px]">
      <aside className="border-b border-white/10 lg:border-r lg:border-b-0">
        <p className="px-4 pt-4 text-[11px] tracking-wide text-subtle uppercase">Underlying</p>
        <ul className="max-h-80 overflow-auto lg:max-h-none">
          {names.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => setId(n.id)}
                className={cn("flex w-full items-center justify-between px-4 py-2 text-left text-sm", under?.id === n.id ? "bg-white/10" : "hover:bg-white/5")}
              >
                <span className="font-mono text-xs font-semibold">{n.symbol}</span>
                <span className="font-mono text-[11px] tabular-nums">{formatUsd(n.last)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0">
        {under ? (
          <div className="border-b border-white/10 px-4 py-3">
            <h1 className="text-xl">{under.symbol} options</h1>
            <p className="mt-1 text-sm text-muted">
              Last {formatUsd(under.last)} · mark {formatUsd(under.mark)}. This chain is a model of a digital on last. It is not a listed option, and signing it does not open one. The token is the exposure.
            </p>
          </div>
        ) : null}
        <OptionChain
          stock={under}
          tenor={tenor}
          onTenor={setTenor}
          onBuy={() => toast.message("No listed option on this name. The buy beside the chain is the token.")}
        />
      </div>
      <aside className="border-t border-white/10 p-4 lg:border-t-0 lg:border-l">
        <p className="text-[11px] text-subtle">Size, dollars</p>
        <input
          inputMode="decimal"
          value={armed ? String(armed) : ""}
          onChange={(e) => setArmed(Number(e.target.value) || 0)}
          className="mt-1 min-h-12 w-full rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-lg outline-none"
        />
        <p className="mt-3 text-xs text-muted">No exchange lists these strikes. Buying the token is the live exposure. Cover, on its own page, is a separate premium.</p>
        {under ? (
          <div className="mt-3">
            <FillButton
              mint={under.mint}
              usd={armed}
              price={under.last}
              label={`Buy $${armed || 0} ${under.symbol}`}
              className="min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg"
            />
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function CashDesk({ children }: { children: (cash: ReturnType<typeof useCash>, names: HouseListing[]) => ReactNode }) {
  const names = usePreNames();
  const cash = useCash();
  return <Page>{children(cash, names)}</Page>;
}

export function PerpsPage() {
  return (
    <Page>
      <PerpDesk />
    </Page>
  );
}

export function BorrowPage() {
  const names = usePreNames();
  return (
    <Page>
      <LendDesk house={names} />
    </Page>
  );
}

export function BasketPage() {
  return (
    <CashDesk>
      {(cash, names) => <BasketDesk house={names} />}
    </CashDesk>
  );
}

export function ProtectPage() {
  return (
    <CashDesk>
      {(cash, names) => <MarketStream house={names} cash={cash.cash} onDebit={cash.onDebit} onCredit={cash.onCredit} />}
    </CashDesk>
  );
}

export function LaunchPage() {
  return (
    <Page>
      <LaunchDesk />
    </Page>
  );
}

export function CurvePage() {
  return (
    <Page>
      <CurveDesk />
    </Page>
  );
}

export function RadarPage() {
  const names = usePreNames();
  return (
    <Page>
      <RadarDesk house={names} />
    </Page>
  );
}

export function RailsPage() {
  const names = usePreNames();
  return (
    <Page>
      <EcosystemDesk house={names} />
    </Page>
  );
}

export function RoutesPage() {
  const names = usePreNames();
  return (
    <Page>
      <h1 className="mb-3 text-2xl tracking-tight">Routes</h1>
      <p className="mb-3 max-w-xl text-sm text-muted">Jupiter quotes the mint. You sign. This page is only the route.</p>
      <JupBoard names={names} />
    </Page>
  );
}
