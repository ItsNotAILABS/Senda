import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PairBundle } from "@/components/pair-bundle";
import { HedgeBook } from "@/components/hedge-book";
import { FillButton } from "@/components/fill-button";
import { CandleChart } from "@/components/candle-chart";
import { avantisOpen, derivBook, derivCandles, type CandleTf, type DerivBar, type DerivLane, type DerivRow } from "@/lib/deriv-book";
import { allInBps, basisBps, crossBps, fundingUsd, liqGapBps, markPnl, openFeeBps, previewLiq, productCross, ratioCross, roomUsd, sizeBlock } from "@/lib/market-engine";
import { loadFills, rememberFill, type OutsideFill } from "@/lib/outside-blotter";
import { connectWallet, detectWallets } from "@/lib/wallets";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

function printOf(row: DerivRow) {
  if (row.mid == null) return "—";
  if (row.mid >= 1000) return row.mid.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (row.mid >= 20) return row.mid.toFixed(3);
  return row.mid.toFixed(5);
}

function money(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

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
  try {
    if (sessionStorage.getItem("senda.activeWallet") === "metamask") {
      const mm = providers.find((p) => {
        const flag = p as Evm & { isMetaMask?: boolean; isBraveWallet?: boolean };
        return Boolean(flag.isMetaMask && !flag.isBraveWallet);
      });
      if (mm) provider = mm;
    }
  } catch {
    /* private mode */
  }
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


export function DerivDesk() {
  const wallet = useWallet();
  const [rows, setRows] = useState<DerivRow[]>([]);
  const [lane, setLane] = useState<DerivLane>("fx");
  const [id, setId] = useState("eurusd");
  const [side, setSide] = useState<"long" | "short">("long");
  const [margin, setMargin] = useState(200);
  const [lev, setLev] = useState(5);
  const [tf, setTf] = useState<CandleTf>("15");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [busy, setBusy] = useState(false);
  const [fills, setFills] = useState<OutsideFill[]>([]);
  const [bars, setBars] = useState<DerivBar[]>([]);

  useEffect(() => {
    setFills(loadFills());
    let live = true;
    const pull = () =>
      derivBook()
        .then((next) => live && setRows(next))
        .catch(() => undefined);
    void pull();
    const timer = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);

  const shown = rows.filter((r) => r.lane === lane);
  const row = rows.find((r) => r.id === id) ?? shown[0];
  const pairKey = row?.ostium ?? "";

  useEffect(() => {
    if (!pairKey) {
      setBars([]);
      return;
    }
    let live = true;
    derivCandles({ data: { pair: pairKey, tf } })
      .then((next) => live && setBars(next))
      .catch(() => live && setBars([]));
    return () => {
      live = false;
    };
  }, [pairKey, tf]);
  const notional = margin > 0 && lev > 0 ? margin * lev : 0;
  const entry = row ? ((side === "long" ? row.ask : row.bid) ?? row.mid) : null;
  const spread = row ? crossBps(side, row.bid, row.ask, row.mid) : null;
  const feeBps = row ? openFeeBps(row.openFee) : null;
  const allIn = allInBps(spread, feeBps);
  const liq = previewLiq(entry, lev, side);
  const gap = liqGapBps(row?.mid ?? null, liq);
  const basis = row ? basisBps(row.spot, row.mid) : null;
  const room = row ? roomUsd(row.oi, row.maxOi) : null;
  const block = row?.avantis ? sizeBlock(notional, row.minNotional, room) : "No Base book for this pair.";
  const carry = row ? fundingUsd(notional, row.fundingPctPerHour, 8) : null;
  const mid = (key: string) => rows.find((r) => r.id === key)?.mid ?? null;
  const crosses = [
    ["EUR/JPY", productCross(mid("eurusd"), mid("usdjpy"))],
    ["GBP/JPY", productCross(mid("gbpusd"), mid("usdjpy"))],
    ["GBP/EUR", ratioCross(mid("gbpusd"), mid("eurusd"))],
    ["XAU/EUR", ratioCross(mid("xau"), mid("eurusd"))],
  ] as const;

  async function signBase(next: "long" | "short") {
    if (!row?.avantis || block) return;
    setSide(next);
    setBusy(true);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
      let trader = existing;
      if (!trader) {
        const installed = detectWallets().filter((w) => w.chain === "evm" && w.installed);
        const choice = installed.find((w) => w.id === "metamask") ?? installed[0];
        if (!choice) throw new Error("No EVM wallet in this browser.");
        trader = (await connectWallet(choice.id)).address;
        const linked = wallet.linkChain(trader, choice.name, "evm");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const built = await avantisOpen({
        data: {
          pair: row.avantis,
          trader,
          side: next,
          collateral: margin,
          leverage: lev,
          stopLoss: Number(sl) > 0 ? Number(sl) : undefined,
          takeProfit: Number(tp) > 0 ? Number(tp) : undefined,
        },
      });
      if (built.approve) await sendOnBase(trader, built.approve);
      const hash = String(await sendOnBase(trader, built.trade));
      setFills(rememberFill({ pair: row.avantis, side: next, margin, lev, entry: built.openPrice ?? entry, hash, at: Date.now() }));
      toast.success(`On Base. ${hash.slice(0, 10)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The trade did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-3 sm:p-4">
      <PairBundle rows={rows} />
      <HedgeBook rows={rows} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">{row ? `${row.base}/${row.quote}` : "Markets"}{row?.open === false ? " · shut" : ""}</p>
          <p className="mt-1 font-mono text-sm text-muted">
            {row?.bid != null && row?.ask != null ? `Bid ${row.bid.toFixed(row.bid >= 20 ? 2 : 5)}   Ask ${row.ask.toFixed(row.ask >= 20 ? 2 : 5)}   ` : ""}
            {bars.length > 1 ? `Low ${Math.min(...bars.map((b) => b.low)).toFixed(bars[0].low >= 20 ? 2 : 5)}   High ${Math.max(...bars.map((b) => b.high)).toFixed(bars[0].high >= 20 ? 2 : 5)}` : "Live quote."}
          </p>
        </div>
        <div className="flex gap-1">
          {(
            [
              ["fx", "FX"],
              ["metals", "Metals"],
              ["energy", "Oil"],
              ["index", "Index"],
              ["softs", "Softs"],
              ["crypto", "Crypto"],
              ["shares", "Shares"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setLane(key);
                const first = rows.find((r) => r.lane === key);
                if (first) setId(first.id);
              }}
              className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", lane === key ? "bg-white text-black" : "bg-black/40 text-muted")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid items-start gap-3 lg:grid-cols-[188px_minmax(0,1fr)_300px]">
        <aside className="rounded-[22px] border border-white/10 bg-black/30 p-2">
          <p className="px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">Symbol · Last</p>
          <div className="max-h-[640px] overflow-auto">
            {shown.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setId(item.id)}
                className={cn("flex w-full items-center justify-between rounded-xl px-2 py-2 text-left", item.id === row?.id ? "bg-white/10" : "hover:bg-white/5")}
              >
                <span className="min-w-0 text-left">
                  <span className="block text-sm font-semibold">{item.base}/{item.quote}</span>
                  <span className="block font-mono text-[10px] text-subtle">{item.open === false ? "Shut" : item.bid != null && item.ask != null ? `${item.bid.toFixed(item.bid >= 20 ? 2 : 4)} / ${item.ask.toFixed(item.ask >= 20 ? 2 : 4)}` : "Live"}</span>
                </span>
                <span className={cn("font-mono text-xs tabular-nums", item.open === false ? "text-subtle" : "text-white")}>{printOf(item)}</span>
              </button>
            ))}
            {!shown.length ? <p className="px-2 py-3 text-sm text-muted">Asking the books.</p> : null}
          </div>
        </aside>
        <div>
          <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0b0d14]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
              <p className="font-mono text-sm">
                {row ? `${row.base}/${row.quote}` : "—"}
                <span className="ml-2 text-muted">{row ? printOf(row) : ""}</span>
                {bars.length > 1 ? (
                  <span className={cn("ml-2", bars[bars.length - 1].close >= bars[0].open ? "text-accent" : "text-down")}>
                    {(((bars[bars.length - 1].close - bars[0].open) / bars[0].open) * 100).toFixed(2)}%
                  </span>
                ) : null}
              </p>
              <div className="flex gap-1">
                {(
                  [
                    ["1", "1m"],
                    ["5", "5m"],
                    ["15", "15m"],
                    ["60", "1H"],
                    ["240", "4H"],
                    ["1D", "1D"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTf(key)}
                    className={cn("min-h-8 rounded-full px-2.5 font-mono text-[11px]", tf === key ? "bg-white text-black" : "text-muted hover:bg-white/10")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {bars.length > 1 ? (
              <CandleChart bars={bars} precision={row?.mid != null && row.mid < 20 ? 5 : row?.mid != null && row.mid < 1000 ? 3 : 2} />
            ) : (
              <div className="flex h-[560px] items-center justify-center text-sm text-muted">No candles on this timeframe.</div>
            )}
          </div>
        </div>
        <aside className="rounded-[22px] border border-white/10 bg-black/30 p-4">
          {row ? (
        <div className="rounded-2xl bg-black/30 p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-3xl tracking-tight">
                {row.base}/{row.quote}
              </h2>
              <p className="mt-1 font-mono text-sm text-muted">
                {printOf(row)} {row.open == null ? "" : row.open ? "· open" : "· shut"}
                {row.bid != null && row.ask != null ? ` · ${row.bid.toFixed(row.bid >= 20 ? 3 : 5)} / ${row.ask.toFixed(row.ask >= 20 ? 3 : 5)}` : ""}
              </p>
            </div>
            <p className="font-mono text-3xl tabular-nums">${notional ? notional.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "0"}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-subtle">Margin, USDC on Base</span>
              <input
                inputMode="decimal"
                value={margin ? String(margin) : ""}
                onChange={(e) => setMargin(Number(e.target.value) || 0)}
                className="mt-1 min-h-12 w-full rounded-full border border-white/10 bg-black/40 px-4 font-mono outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs text-subtle">Leverage {row.maxLev ? `· their cap ${row.maxLev}x` : ""}</span>
              <input
                inputMode="decimal"
                value={lev ? String(lev) : ""}
                onChange={(e) => setLev(Math.min(row.maxLev ?? 500, Number(e.target.value) || 0))}
                className="mt-1 min-h-12 w-full rounded-full border border-white/10 bg-black/40 px-4 font-mono outline-none"
              />
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-subtle">Stop</span>
              <input
                inputMode="decimal"
                value={sl}
                placeholder="optional"
                onChange={(e) => setSl(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-full border border-white/10 bg-black/40 px-4 font-mono outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs text-subtle">Take profit</span>
              <input
                inputMode="decimal"
                value={tp}
                placeholder="optional"
                onChange={(e) => setTp(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-full border border-white/10 bg-black/40 px-4 font-mono outline-none"
              />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || Boolean(block)}
              onClick={() => void signBase("short")}
              className="min-h-16 rounded-2xl bg-[#ff5a5a] text-sm font-semibold text-white disabled:opacity-40"
            >
              <span className="block text-[11px] font-normal opacity-80">Sell</span>
              {row.bid != null ? row.bid.toFixed(row.bid >= 20 ? 3 : 5) : "—"}
            </button>
            <button
              type="button"
              disabled={busy || Boolean(block)}
              onClick={() => void signBase("long")}
              className="min-h-16 rounded-2xl bg-[#14f195] text-sm font-semibold text-black disabled:opacity-40"
            >
              <span className="block text-[11px] font-normal opacity-70">Buy</span>
              {row.ask != null ? row.ask.toFixed(row.ask >= 20 ? 3 : 5) : "—"}
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {entry != null ? `You cross ${side === "long" ? "the ask" : "the bid"} at ${entry.toFixed(entry >= 20 ? 3 : 5)}. ` : ""}
            {allIn != null ? `Base all-in ${allIn.toFixed(1)} bps` : ""}
            {spread != null ? ` (spread ${spread.toFixed(1)}` : ""}
            {feeBps != null ? `${spread != null ? ", fee " : " ("}${feeBps.toFixed(1)}` : ""}
            {allIn != null ? "). " : " "}
            {row.fundingPctPerHour != null ? `Their hourly funding is ${row.fundingPctPerHour}%. ` : ""}
            {carry != null && row.fundingPctPerHour !== 0 ? `Eight hours of that is about $${carry.toFixed(2)}. ` : ""}
            {liq != null ? `Preview liquidation ${liq.toFixed(liq >= 20 ? 2 : 5)}, half the margin. ` : ""}
            {basis != null ? `${row.hold?.symbol} is ${Math.abs(basis).toFixed(1)} bps ${basis > 0 ? "rich" : "cheap"} to the print. ` : ""}
            {room != null ? `Room left ${money(room)}. ` : ""}
            {block ?? "Their contract decides the real liquidation. Stop and take profit go on the same signature."}
          </p>
          {row.hold ? (
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-xs text-muted">{row.hold.note}</p>
              <FillButton
                mint={row.hold.mint}
                usd={margin || 1}
                side="buy"
                price={row.spot ?? row.mid ?? undefined}
                label={`Hold ${row.hold.symbol} on Solana`}
                className="mt-2 min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold"
              />
            </div>
          ) : null}
        </div>
          ) : <p className="px-1 text-sm text-muted">Asking the books.</p>}
          <p className="font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">Risk</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">All-in</dt><dd className="font-mono">{allIn == null ? "—" : `${allIn.toFixed(1)} bps`}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">To preview liq</dt><dd className="font-mono">{gap == null ? "—" : `${gap.toFixed(0)} bps`}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Room</dt><dd className="font-mono">{money(room)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Basis</dt><dd className="font-mono">{basis == null ? "—" : `${basis > 0 ? "+" : ""}${basis.toFixed(1)}`}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Funding / hr</dt><dd className="font-mono">{row?.fundingPctPerHour == null ? "—" : `${row.fundingPctPerHour}%`}</dd></div>
          </dl>
          <div className="mt-4 flex flex-col gap-1">
            {crosses.map(([name, value]) => (
              <span key={name} className="font-mono text-[11px] text-muted">
                {name} {value == null ? "—" : value >= 20 ? value.toFixed(2) : value.toFixed(5)} · derived
              </span>
            ))}
          </div>
          <p className="mt-4 font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">Signed on Base</p>
          {fills.length ? (
            <ul className="mt-2 space-y-2">
              {fills.map((fill) => {
                const mark = rows.find((r) => r.avantis === fill.pair)?.mid ?? null;
                const pnl = markPnl(fill.side, fill.entry, mark, fill.margin * fill.lev);
                return (
                  <li key={fill.hash} className="font-mono text-xs text-muted">
                    <span className="block">
                      {fill.side} {fill.pair} {fill.lev}x
                    </span>
                    <span className={cn("block", pnl != null && pnl < 0 ? "text-down" : "text-accent")}>
                      {pnl == null ? fill.hash.slice(0, 10) : `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted">Nothing signed from this browser.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
