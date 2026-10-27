import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { avantisOpen, derivBook, type DerivRow } from "@/lib/deriv-book";
import { loadClearing, postPred } from "@/lib/clearing";
import { basisBps } from "@/lib/market-engine";
import { payUsdc } from "@/lib/solana-pay";
import { connectWallet, detectWallets } from "@/lib/wallets";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TENORS = ["15m", "1h", "4h", "1d"] as const;
type Tenor = (typeof TENORS)[number];

type Evm = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

function evmProviders(): Evm[] {
  const eth = (window as Window & { ethereum?: Evm & { providers?: Evm[] } }).ethereum;
  if (!eth) return [];
  return eth.providers?.length ? eth.providers : [eth];
}

async function sendOnBase(from: string, tx: { to: string; data: string }) {
  const providers = evmProviders();
  if (!providers.length) throw new Error("No EVM wallet in this browser.");
  let provider = providers[0];
  for (const candidate of providers) {
    const accounts = (await candidate.request({ method: "eth_accounts" }).catch(() => [])) as string[];
    if (accounts.some((a) => a.toLowerCase() === from.toLowerCase())) {
      provider = candidate;
      break;
    }
  }
  await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] }).catch(async (err: { code?: number }) => {
    if (err?.code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: "0x2105", chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"] }],
    });
  });
  return provider.request({ method: "eth_sendTransaction", params: [{ from, to: tx.to, data: tx.data, value: "0x0" }] });
}

function px(n: number | null) {
  if (n == null) return "—";
  if (n >= 100) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toFixed(n >= 20 ? 3 : 4);
}

function strikes(mark: number): number[] {
  const step = Math.max(mark >= 100 ? 1 : 0.01, Math.round(mark * 0.01 * 100) / 100);
  const mid = mark >= 100 ? Math.round(mark) : Math.round(mark * 100) / 100;
  return [-2, -1, 0, 1, 2].map((i) => Math.round((mid + i * step) * 100) / 100).filter((n) => n > 0);
}

/** Gold, silver, the other metals, and oil. The prediction settles on the Ostium print. The perp, when one exists, is Avantis on Base. */
export function CommodityBook({ mode = "full", focus, onFocus }: { mode?: "full" | "trade"; focus?: string; onFocus?: (id: string) => void }) {
  const wallet = useWallet();
  const [rows, setRows] = useState<DerivRow[]>([]);
  const [id, setId] = useState(focus || "xau");
  const [tenor, setTenor] = useState<Tenor>("1h");
  const [stake, setStake] = useState(5);
  const [margin, setMargin] = useState(50);
  const [lev, setLev] = useState(5);
  const [busy, setBusy] = useState("");
  const shown = rows.filter((r) => r.lane === "metals" || r.lane === "energy");
  const row = shown.find((r) => r.id === id) ?? shown[0];

  useEffect(() => {
    if (focus) setId(focus);
  }, [focus]);

  useEffect(() => {
    let live = true;
    const pull = () => derivBook().then((next) => live && setRows(next)).catch(() => undefined);
    void pull();
    const timer = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);

  const ladder = useMemo(() => (row?.mid ? strikes(row.mid) : []), [row?.mid]);
  const basis = row ? basisBps(row.spot, row.mid) : null;

  function pick(next: string) {
    setId(next);
    onFocus?.(next);
  }

  async function predict(side: "yes" | "no", strike: number) {
    if (!row?.mid) return;
    setBusy(`${side}-${strike}`);
    try {
      const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address;
      if (!owner) throw new Error("Connect Phantom. The stake is USDC.");
      const house = await loadClearing();
      const mint = row.hold?.mint || USDC;
      const tag = strike > 0 ? String(strike) : "open";
      const paid = await payUsdc({ owner, to: house.pubkey, usd: stake, memo: `Senda clear pred ${row.base} ${tenor} ${side} ${tag}` });
      const opened = await postPred({
        data: { owner, sig: paid.signature, symbol: row.base, mint, tenor, side, usd: stake, strike },
      });
      toast.success(`${row.base} ${side === "yes" ? "above" : "below"} ${strike > 0 ? strike : opened.openPrice.toFixed(2)}. It settles on the Ostium print.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The prediction did not send.");
    } finally {
      setBusy("");
    }
  }

  async function perp(side: "long" | "short") {
    if (!row?.avantis) return;
    setBusy(side);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
      let trader = existing;
      if (!trader) {
        const choice = detectWallets().find((w) => w.chain === "evm" && w.installed);
        if (!choice) throw new Error("No EVM wallet in this browser. The perp signs on Base.");
        trader = (await connectWallet(choice.id)).address;
        const linked = wallet.linkChain(trader, choice.name, "evm");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const built = await avantisOpen({ data: { pair: row.avantis, trader, side, collateral: margin, leverage: lev } });
      if (built.approve) await sendOnBase(trader, built.approve);
      const hash = String(await sendOnBase(trader, built.trade));
      toast.success(`${row.base} ${side} on Base. ${hash.slice(0, 10)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The perp did not send.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="border-b border-white/10 px-4 py-4">
      <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Metals and oil</p>
      <h2 className="mt-1 text-lg font-semibold">The print is Ostium. The prediction pays on that print.</h2>
      <div className="mt-3 flex gap-1 overflow-x-auto">
        {shown.map((item) => (
          <button key={item.id} type="button" onClick={() => pick(item.id)} className={cn("min-w-[6.5rem] shrink-0 rounded-xl px-3 py-2 text-left", item.id === row?.id ? "bg-white/10" : "hover:bg-white/5")}>
            <span className="block text-[11px] font-semibold">{item.base}</span>
            <span className="font-mono text-sm tabular-nums">{px(item.mid)}</span>
          </button>
        ))}
        {!shown.length ? <p className="text-sm text-muted">Asking the prints.</p> : null}
      </div>
      {row ? (
        <div className="mt-4">
          <p className="font-mono text-4xl tabular-nums">{px(row.mid)}</p>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted">
            {row.base}/{row.quote}
            {row.hold ? ` · ${row.hold.symbol} on Solana is ${row.spot ? px(row.spot) : "not quoted"}` : " · no token for this one on Solana"}
            {basis != null ? `. The token is ${Math.abs(basis).toFixed(0)} bps ${basis > 0 ? "rich" : "cheap"} to the print.` : "."}
            {row.avantis ? " The perp is a separate signature on Base." : " There is no Base perp for this one, so the trade here is the prediction."}
          </p>
          {mode === "full" ? (
            <>
              <div className="mt-3 flex flex-wrap gap-1">
                {TENORS.map((t) => (
                  <button key={t} type="button" onClick={() => setTenor(t)} className={cn("min-h-8 rounded-full px-3 font-mono text-xs", tenor === t ? "bg-accent text-accent-fg" : "bg-white/10")}>{t}</button>
                ))}
                {[1, 5, 25].map((n) => (
                  <button key={n} type="button" onClick={() => setStake(n)} className={cn("min-h-8 rounded-full px-3 font-mono text-xs", stake === n ? "bg-white text-black" : "bg-white/10")}>${n}</button>
                ))}
              </div>
              <div className="mt-3 grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={!!busy || !row.mid} onClick={() => void predict("yes", 0)} className="min-h-12 rounded-xl bg-[#14f195]/15 text-sm font-semibold text-accent disabled:opacity-40">Above the print · ${stake}</button>
                  <button type="button" disabled={!!busy || !row.mid} onClick={() => void predict("no", 0)} className="min-h-12 rounded-xl bg-[#ff5a5a]/15 text-sm font-semibold text-down disabled:opacity-40">Below the print · ${stake}</button>
                </div>
                {ladder.map((k) => (
                  <div key={k} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <button type="button" disabled={!!busy} onClick={() => void predict("yes", k)} className="min-h-10 rounded-xl bg-[#14f195]/10 text-xs font-semibold text-accent">Above {px(k)}</button>
                    <span className="font-mono text-[11px] text-subtle">{px(k)}</span>
                    <button type="button" disabled={!!busy} onClick={() => void predict("no", k)} className="min-h-10 rounded-xl bg-[#ff5a5a]/10 text-xs font-semibold text-down">Below {px(k)}</button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {row.avantis ? (
            <div className="mt-4 rounded-2xl border border-white/10 p-3">
              <p className="text-sm font-semibold">Trade it</p>
              <p className="mt-1 text-[13px] text-muted">Long or short {row.avantis} on Base. Margin is USDC there, not the prediction stake.</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {[25, 50, 200].map((n) => (
                  <button key={n} type="button" onClick={() => setMargin(n)} className={cn("min-h-8 rounded-full px-3 font-mono text-xs", margin === n ? "bg-white text-black" : "bg-white/10")}>${n}</button>
                ))}
                {[2, 5, 10].map((n) => (
                  <button key={n} type="button" onClick={() => setLev(n)} className={cn("min-h-8 rounded-full px-3 font-mono text-xs", lev === n ? "bg-white text-black" : "bg-white/10")}>{n}×</button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" disabled={!!busy} onClick={() => void perp("long")} className="min-h-12 rounded-full bg-[#14f195] text-sm font-semibold text-black disabled:opacity-40">{busy === "long" ? "Waiting…" : `Long ${px(row.ask)}`}</button>
                <button type="button" disabled={!!busy} onClick={() => void perp("short")} className="min-h-12 rounded-full bg-[#ff5a5a] text-sm font-semibold text-white disabled:opacity-40">{busy === "short" ? "Waiting…" : `Short ${px(row.bid)}`}</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function CommodityStrip({ onPick }: { onPick: (id: string) => void }) {
  const [rows, setRows] = useState<DerivRow[]>([]);
  useEffect(() => {
    let live = true;
    derivBook().then((next) => live && setRows(next.filter((r) => r.lane === "metals" || r.lane === "energy"))).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  if (!rows.length) return null;
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
      {rows.map((r) => (
        <button key={r.id} type="button" onClick={() => onPick(r.id)} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-left hover:bg-white/15">
          <span className="text-[11px] font-semibold">{r.base}</span>
          <span className="ml-2 font-mono text-xs tabular-nums">{px(r.mid)}</span>
        </button>
      ))}
    </div>
  );
}
