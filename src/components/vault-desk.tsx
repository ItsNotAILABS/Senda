import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { FilmBand } from "@/components/film-band";
import { TabLead } from "@/components/tab-lead";
import { WalletPicker } from "@/components/wallet-picker";
import { readChain, type ChainWallet } from "@/lib/phantom";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { unwrapUsdc, wrapUsdc, wrappedUsdc } from "@/lib/vault-wrap";
import { CCYS, formatMoney, type Ccy } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const LOGO_SYMBOLS = new Set(["SPACEX", "OPENAI", "ANTHROPIC", "ANDURIL", "NEURALINK", "FIGUREAI", "KALSHI", "POLYMARKET"]);

type Position = {
  mint: string;
  symbol: string;
  name: string;
  tokens: number;
  last: number;
  value: number;
  premium: number | null;
};

function logoSrc(symbol: string): string | null {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!LOGO_SYMBOLS.has(s)) return null;
  return `/logos/${s.toLowerCase()}.png`;
}

function bookUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function tokenQty(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function positionsOf(names: HouseListing[], chain: ChainWallet | null): Position[] {
  if (!chain) return [];
  const byMint = new Map<string, HouseListing>();
  for (const n of names) {
    if (n.venue !== "prestocks" || byMint.has(n.mint)) continue;
    byMint.set(n.mint, n);
  }
  const rows: Position[] = [];
  for (const token of chain.tokens) {
    const house = byMint.get(token.mint);
    if (!house || !(token.ui > 0)) continue;
    rows.push({
      mint: house.mint,
      symbol: house.symbol,
      name: house.name,
      tokens: token.ui,
      last: house.last,
      value: token.ui * house.last,
      premium: house.premium,
    });
  }
  rows.sort((a, b) => b.value - a.value || a.symbol.localeCompare(b.symbol));
  return rows;
}

export function VaultDesk({ names }: { names: HouseListing[] }) {
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const owner = link?.address ?? "";
  const [snap, setSnap] = useState<{ owner: string; chain: ChainWallet } | null>(null);
  const [reading, setReading] = useState(false);
  const [tick, setTick] = useState(0);
  const [raw, setRaw] = useState("25");
  const [cap, setCap] = useState(100);
  const [name, setName] = useState("");
  const [ccy, setCcy] = useState<Ccy>("USD");
  const chain = snap && snap.owner === owner ? snap.chain : null;
  const usdc = chain?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;
  const wrapped = owner ? wrappedUsdc(owner) : 0;
  const rows = useMemo(() => positionsOf(names, chain), [names, chain]);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const waiting = !wallet.ready || (Boolean(owner) && reading && !chain);

  useEffect(() => setCap(spendCap()), []);
  useEffect(() => {
    if (!owner) {
      setSnap(null);
      setReading(false);
      return;
    }
    let live = true;
    setReading(true);
    readChain(owner)
      .then((s) => {
        if (!live) return;
        setSnap({ owner, chain: s });
      })
      .catch(() => {
        if (!live) return;
        setSnap((cur) => (cur?.owner === owner ? cur : null));
      })
      .finally(() => {
        if (live) setReading(false);
      });
    return () => {
      live = false;
    };
  }, [owner, tick]);

  function wrap(amount?: number) {
    if (!owner) return;
    const n = amount ?? Number(raw);
    if (!(n > 0)) return toast.error("Enter an amount.");
    try {
      wrapUsdc(owner, link?.label || "Wallet", n, usdc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not wrap.");
      return;
    }
    const r = wallet.add(n, "USD", "usdc");
    if (!r.ok) {
      unwrapUsdc(owner, n);
      toast.error(r.error);
      return;
    }
    setTick((t) => t + 1);
    toast.success(`Wrapped $${n.toFixed(2)}. It is still in the wallet.`);
  }

  function push(amount?: number) {
    if (!owner) return;
    const n = amount ?? Number(raw);
    if (!(n > 0)) return toast.error("Enter an amount.");
    if (n - wrapped > 0.001) return toast.error("Only wrapped USDC can be pushed back.");
    const r = wallet.release(n, link?.label || "Phantom");
    if (!r.ok) return toast.error(r.error);
    unwrapUsdc(owner, n);
    setTick((t) => t + 1);
    toast.success(`Pushed $${n.toFixed(2)} back to the wallet.`);
  }

  function wrapHeld() {
    if (!owner) return toast.error("Connect Phantom first.");
    const open = Math.round((usdc - wrapped) * 100) / 100;
    if (!(open > 0)) return toast.error("Nothing left in Phantom to wrap.");
    setRaw(open.toFixed(2));
    wrap(open);
  }

  function sendBack() {
    if (!owner) return toast.error("Connect Phantom first.");
    const n = Math.round(wrapped * 100) / 100;
    if (!(n > 0)) return toast.error("Nothing wrapped to send back.");
    setRaw(n.toFixed(2));
    push(n);
  }

  return (
    <main className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Portfolio"
        title="PreStocks you hold,"
        accent="marked live."
        line="The total is tokens in this wallet times the last print. Nothing on the book is a paper share."
        live={["Chain balance", "Value at the live last", "Wrap USDC and send it back"]}
        coming={["A broker account", "Margin"]}
      />

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 lg:p-8">
        <p className="font-mono text-5xl tabular-nums tracking-tight lg:text-6xl">{waiting ? "—" : bookUsd(total)}</p>
        <p className="mt-2 font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Tokens × last print</p>
        <p className="mt-2 font-mono text-xs text-subtle">
          {waiting
            ? "Reading the wallet…"
            : owner
              ? `${owner.slice(0, 4)}…${owner.slice(-4)}${rows.length ? ` · ${rows.length} name${rows.length === 1 ? "" : "s"}` : ""}`
              : "No wallet connected."}
        </p>

        {!waiting && rows.length === 0 ? (
          <div className="mt-6">
            <p className="text-sm text-muted">{owner ? "This wallet holds no PreStocks." : "Connect a wallet. The book stays empty until it does."}</p>
            <Link to="/pre" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
              Open PreStocks
            </Link>
          </div>
        ) : null}

        {!waiting && rows.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="text-[11px] tracking-[0.14em] text-subtle uppercase">
                  <th className="pb-2 font-normal">Symbol</th>
                  <th className="pb-2 text-right font-normal">Tokens</th>
                  <th className="pb-2 text-right font-normal">Last</th>
                  <th className="pb-2 text-right font-normal">Value</th>
                  <th className="pb-2 text-right font-normal">Premium</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const logo = logoSrc(row.symbol);
                  return (
                    <tr key={row.mint} className="border-t border-white/[0.06]">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          {logo ? (
                            <img src={logo} alt="" className="size-9 rounded-full bg-white object-contain p-1" />
                          ) : (
                            <span className="grid size-9 place-items-center rounded-full bg-black/40 font-mono text-[10px]">{row.symbol.slice(0, 2)}</span>
                          )}
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{row.symbol}</span>
                            <span className="block truncate text-[11px] text-subtle">{row.name}</span>
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-sm tabular-nums">{tokenQty(row.tokens)}</td>
                      <td className="py-3 text-right font-mono text-sm tabular-nums">{formatUsd(row.last)}</td>
                      <td className="py-3 text-right font-mono text-sm tabular-nums">{row.value > 0 ? formatUsd(row.value) : "$0.00"}</td>
                      <td className="py-3 text-right font-mono text-sm tabular-nums">
                        <span
                          className={cn(
                            row.premium == null ? "text-muted" : row.premium < 0 ? "text-up" : "text-down",
                          )}
                        >
                          {formatPremium(row.premium)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <h2 className="text-2xl tracking-tight">Cash sleeve</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          A wrap is a claim on USDC that never leaves Phantom. Push sends the claim back. Agents can only send inside the cap.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl bg-black/30 px-4 py-4">
            <p className="text-xs text-subtle">On-chain USDC</p>
            <p className="mt-1 font-mono text-3xl">{owner ? `$${usdc.toFixed(2)}` : "—"}</p>
            <p className="mt-2 text-xs text-muted">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "No wallet connected."}</p>
          </div>
          <div className="rounded-2xl bg-black/30 px-4 py-4">
            <p className="text-xs text-subtle">Wrapped</p>
            <p className="mt-1 font-mono text-3xl text-accent">${wrapped.toFixed(2)}</p>
            <p className="mt-2 text-xs text-muted">Still sitting in the wallet. Counted once.</p>
          </div>
          <div className="rounded-2xl bg-black/30 px-4 py-4">
            <p className="text-xs text-subtle">Send cap</p>
            <p className="mt-1 font-mono text-3xl">${cap}</p>
            <div className="mt-3 flex gap-1">
              {[25, 100, 500].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCap(setSpendCap(n))}
                  className={cn("min-h-9 rounded-full px-3 font-mono text-xs", cap === n ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}
                >
                  ${n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-white/[0.06] pt-4">
          <div>
            <p className="text-xs text-subtle">Wrapped in Phantom</p>
            <p className="mt-1 font-mono text-4xl text-accent">${wrapped.toFixed(2)}</p>
            <p className="mt-2 text-sm text-muted">
              {owner ? `Phantom holds $${usdc.toFixed(2)} USDC. The wrap stays in that wallet.` : "Connect Phantom. The wrap never leaves it."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={wrapHeld} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
              Wrap what Phantom holds
            </button>
            <button type="button" onClick={sendBack} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold">
              Send back to Phantom
            </button>
          </div>
        </div>

        <div className="mt-4 max-w-xl">
          {owner ? (
            <>
              <input
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                inputMode="decimal"
                className="min-h-12 w-full rounded-full border border-white/10 bg-black/40 px-4 font-mono text-lg outline-none"
                aria-label="Amount"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => wrap()} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
                  Wrap
                </button>
                <button type="button" onClick={() => push()} className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold">
                  Push back
                </button>
                <Link to="/agents" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
                  Fund an agent inside the cap
                </Link>
              </div>
            </>
          ) : (
            <WalletPicker />
          )}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-lg">How a PreStock swap is signed</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Jupiter builds it inside Senda. There is no trip out to the issuer.</li>
            <li>Only SOL, USDC, and the PreStock mints are allowed. Anything else never reaches the wallet.</li>
            <li>The chain simulates it first. If it would fail, Phantom is not asked.</li>
            <li>Impact over 5%, or a size over the cap, is refused.</li>
            <li>You sign. The key never comes here.</li>
          </ul>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-lg">Cash vaults</h2>
          <p className="mt-1 text-sm text-muted">A named pocket of Senda cash. It is not a second wallet and it does not mint USDC.</p>
          <ul className="mt-3 space-y-2">
            {wallet.w.vaults.length === 0 ? <li className="rounded-[22px] bg-black/40 px-3 py-3 text-sm text-subtle">None yet.</li> : null}
            {wallet.w.vaults.map((v) => (
              <li key={v.id} className="flex items-baseline justify-between rounded-[22px] bg-black/40 px-3 py-3 text-sm">
                <span>{v.name}</span>
                <span className="font-mono tabular-nums">{formatMoney(v.balance, v.ccy)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 text-sm outline-none"
            />
            <select value={ccy} onChange={(e) => setCcy(e.target.value as Ccy)} className="min-h-11 rounded-full border border-white/10 bg-black/40 px-3 text-sm">
              {CCYS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const r = wallet.openVault(name, ccy);
                if (!r.ok) toast.error(r.error);
                else {
                  setName("");
                  toast.success("Vault opened.");
                }
              }}
              className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg"
            >
              Open
            </button>
          </div>
        </div>
      </section>

      <FilmBand poster="/images/orbit.jpg" label="The wallet stays the wallet." />
    </main>
  );
}
