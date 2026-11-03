import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FillButton } from "@/components/fill-button";
import { LiveChart } from "@/components/price-chart";
import { MarkChart } from "@/components/mark-chart";
import { NewsWire } from "@/components/news-wire";
import { avantisOpen, derivBook, type DerivLane, type DerivRow } from "@/lib/deriv-book";
import { allInBps, basisBps, crossBps, doors, openFeeBps, previewLiq, productCross, ratioCross } from "@/lib/market-engine";
import { openOstiumByName } from "@/lib/ostium-trade";
import { connectWallet } from "@/lib/wallets";
import { clearMove, sealMove, stageMove } from "@/lib/moves";
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

function evmProvider(): Evm | null {
  const eth = (window as Window & { ethereum?: Evm & { providers?: Evm[] } }).ethereum;
  if (!eth) return null;
  return eth.providers?.[0] ?? eth;
}

const LANES: Array<[DerivLane, string]> = [
  ["fx", "FX"],
  ["metals", "Metals"],
  ["energy", "Energy"],
  ["softs", "Softs"],
  ["index", "Index"],
  ["crypto", "Crypto"],
  ["shares", "Shares"],
];

const NEWS: Partial<Record<string, string>> = {
  xau: "gold",
  xag: "silver",
  xpt: "platinum",
  xpd: "palladium",
  xcu: "copper",
  wti: "oil",
  brent: "brent",
  ung: "gas",
  eurusd: "euro",
  gbpusd: "pound",
  usdjpy: "yen",
  usdmxn: "peso",
};

export function DerivDesk({ lane: start = "fx", lanes }: { lane?: DerivLane; lanes?: DerivLane[] } = {}) {
  const wallet = useWallet();
  const allowed = lanes?.length ? lanes : LANES.map(([id]) => id);
  const [rows, setRows] = useState<DerivRow[]>([]);
  const [lane, setLane] = useState<DerivLane>(allowed.includes(start) ? start : allowed[0]);
  const [id, setId] = useState("eurusd");
  const [side, setSide] = useState<"long" | "short">("long");
  const [margin, setMargin] = useState(200);
  const [lev, setLev] = useState(5);
  const [busy, setBusy] = useState(false);
  const [trail, setTrail] = useState<Record<string, number[]>>({});

  useEffect(() => {
    let live = true;
    const pull = () =>
      derivBook()
        .then((next) => {
          if (!live) return;
          setRows(next);
          setTrail((cur) => {
            const out = { ...cur };
            for (const item of next) {
              if (!(item.mid && item.mid > 0)) continue;
              const prev = out[item.id] ?? [];
              const last = prev[prev.length - 1];
              out[item.id] = last === item.mid ? prev : [...prev, item.mid].slice(-48);
            }
            return out;
          });
        })
        .catch(() => undefined);
    void pull();
    const timer = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);

  const shown = rows.filter((r) => r.lane === lane);
  const row = shown.find((r) => r.id === id) ?? shown[0];
  const notional = margin > 0 && lev > 0 ? margin * lev : 0;
  const entry = row ? (side === "long" ? row.ask : row.bid) ?? row.mid : null;
  const tooSmall = row?.minNotional != null && notional > 0 && notional < row.minNotional;
  const spread = row ? crossBps(side, row.bid, row.ask, row.mid) : null;
  const feeBps = row ? openFeeBps(row.openFee) : null;
  const allIn = allInBps(spread, feeBps);
  const liq = previewLiq(entry, lev, side);
  const basis = row ? basisBps(row.spot, row.mid) : null;
  const ranked = row
    ? doors({
        side,
        bid: row.bid,
        ask: row.ask,
        mid: row.mid,
        openFee: row.openFee,
        hasPerp: Boolean(row.avantis),
        hasPrint: Boolean(row.ostium),
        hasHold: Boolean(row.hold),
      })
    : [];
  const mid = (key: string) => rows.find((r) => r.id === key)?.mid ?? null;
  const crosses = [
    ["EUR/JPY", productCross(mid("eurusd"), mid("usdjpy"))],
    ["GBP/JPY", productCross(mid("gbpusd"), mid("usdjpy"))],
    ["GBP/EUR", ratioCross(mid("gbpusd"), mid("eurusd"))],
    ["XAU/EUR", ratioCross(mid("xau"), mid("eurusd"))],
  ] as const;

  async function signBase() {
    if (!row?.avantis) return;
    setBusy(true);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
      const trader = existing || (await connectWallet("metamask")).address;
      if (!existing) {
        const linked = wallet.linkChain(trader, "MetaMask", "evm");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const built = await avantisOpen({
        data: { pair: row.avantis, trader, side, collateral: margin, leverage: lev },
      });
      const provider = evmProvider();
      if (!provider) throw new Error("No EVM wallet in this browser.");
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] }).catch(async (err: { code?: number }) => {
        if (err?.code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: "0x2105", chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"] }],
          });
          return;
        }
        throw err;
      });
      if (built.approve) {
        await provider.request({
          method: "eth_sendTransaction",
          params: [{ from: trader, to: built.approve.to, data: built.approve.data, value: "0x0" }],
        });
      }
      stageMove({ usd: margin, kind: "swap", title: `${side} ${row.avantis}` });
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: trader, to: built.trade.to, data: built.trade.data, value: "0x0" }],
      });
      sealMove(String(hash), true);
      toast.success(`On Base. ${String(hash).slice(0, 10)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The trade did not send.");
    } finally {
      setBusy(false);
    }
  }

  async function signOstium() {
    if (!row?.ostium || row.mid == null) return;
    setBusy(true);
    try {
      stageMove({ usd: margin, kind: "swap", title: `${side} ${row.ostium}` });
      const hash = await openOstiumByName({
        pair: row.ostium,
        side,
        collateral: margin,
        leverage: lev,
        price: row.mid,
      });
      sealMove(hash, true);
      toast.success(`On Arbitrum. ${hash.slice(0, 10)}…`);
    } catch (err) {
      clearMove();
      toast.error(err instanceof Error ? err.message : "The Arbitrum order did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Markets</p>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Ostium on Arbitrum signs when that pair is listed. Avantis on Base signs when that pair has a Base book. A hold is a Solana token. A share print is not the stock.
          </p>
        </div>
        <div className="flex gap-1">
          {(LANES.filter(([key]) => allowed.includes(key))).map(([key, label]) => (
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

      {row ? (
        <div className="mt-4 rounded-[22px] border border-white/10 bg-black/30 p-4">
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
          {row.hold ? (
            <div className="mt-4">
              <LiveChart mint={row.hold.mint} symbol={row.hold.symbol} live={row.spot ?? undefined} />
            </div>
          ) : (
            <div className="mt-4">
              <MarkChart points={trail[row.id] ?? []} label={`${row.base} prints received on this screen`} />
              <p className="mt-2 text-xs text-white/40">No Solana pool, so this is the print itself, not a candle from a swap pool.</p>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl bg-black/40 px-3 py-2">
              <p className="text-[11px] text-white/45">Bid</p>
              <p className="font-mono text-sm tabular-nums">{row.bid == null ? "—" : row.bid.toFixed(row.bid >= 20 ? 3 : 5)}</p>
            </div>
            <div className="rounded-2xl bg-black/40 px-3 py-2">
              <p className="text-[11px] text-white/45">Ask</p>
              <p className="font-mono text-sm tabular-nums">{row.ask == null ? "—" : row.ask.toFixed(row.ask >= 20 ? 3 : 5)}</p>
            </div>
            <div className="rounded-2xl bg-black/40 px-3 py-2">
              <p className="text-[11px] text-white/45">Basis</p>
              <p className="font-mono text-sm tabular-nums">{basis == null ? "No hold" : `${basis > 0 ? "+" : ""}${basis.toFixed(1)} bps`}</p>
            </div>
            <div className="rounded-2xl bg-black/40 px-3 py-2">
              <p className="text-[11px] text-white/45">Hold</p>
              <p className="truncate text-sm">{row.hold ? row.hold.symbol : "None"}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/50">
            {row.lane === "shares"
              ? `${row.base} is an Ostium print. It is not the share, not a filing, and not a Jupiter token.`
              : row.hold
                ? row.hold.note
                : "Top of book only. There is no deeper size on this print."}
          </p>
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
              <span className="text-xs text-subtle">
                Leverage {lev.toFixed(1)}× {row.maxLev ? `· book max ${row.maxLev}×` : ""}
              </span>
              <input
                type="range"
                min={1}
                max={Math.max(1, Math.min(row.maxLev ?? 20, 50))}
                step={0.5}
                value={Math.min(lev, Math.max(1, Math.min(row.maxLev ?? 20, 50)))}
                onChange={(e) => setLev(Number(e.target.value))}
                className="mt-3 w-full accent-white"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            {(["long", "short"] as const).map((next) => (
              <button
                key={next}
                type="button"
                onClick={() => setSide(next)}
                className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold capitalize", side === next ? "bg-accent text-accent-fg" : "border border-white/10")}
              >
                {next}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            {entry != null ? `You cross ${side === "long" ? "the ask" : "the bid"} at ${entry.toFixed(entry >= 20 ? 3 : 5)}. ` : ""}
            {allIn != null ? `Base all-in ${allIn.toFixed(1)} bps` : ""}
            {spread != null ? ` (spread ${spread.toFixed(1)}` : ""}
            {feeBps != null ? `${spread != null ? ", fee " : " ("}${feeBps.toFixed(1)}` : ""}
            {allIn != null ? "). " : " "}
            {ranked.find((d) => d.name === "Arbitrum")?.bps != null
              ? `Arbitrum spread ${ranked.find((d) => d.name === "Arbitrum")?.bps?.toFixed(1)} bps. `
              : ""}
            {liq != null ? `Preview liquidation ${liq.toFixed(liq >= 20 ? 2 : 5)}, half the margin. ` : ""}
            {basis != null ? `${row?.hold?.symbol} is ${Math.abs(basis).toFixed(1)} bps ${basis > 0 ? "rich" : "cheap"} to the print. ` : ""}
            {tooSmall ? `Base wants at least $${row.minNotional} of position.` : "Their contract decides the real liquidation."}
          </p>
          <button
            type="button"
            disabled={busy || !row.avantis || margin <= 0 || lev <= 0 || tooSmall}
            onClick={() => void signBase()}
            className="mt-3 flex min-h-14 w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
          >
            {busy ? "Waiting for the wallet…" : row.avantis ? `Sign ${side} on Base` : "No Base book for this pair"}
          </button>
          <button
            type="button"
            disabled={busy || !row.ostium || row.mid == null || margin <= 0 || lev <= 0}
            onClick={() => void signOstium()}
            className="mt-2 flex min-h-14 w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40"
          >
            {busy ? "Waiting for the wallet…" : row.ostium ? `Sign ${side} on Arbitrum` : "No Arbitrum book for this pair"}
          </button>
          {row.hold ? (
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-xs text-muted">{row.hold.note}</p>
              <FillButton
                mint={row.hold.mint}
                usd={margin || 1}
                side="buy"
                price={row.mid ?? undefined}
                symbol={row.hold.symbol}
                label={`Hold ${row.hold.symbol} on Solana`}
                className="mt-2 min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold"
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Asking the books.</p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">
            <tr>
              <th className="px-2 py-2 font-medium">Pair</th>
              <th className="px-2 py-2 text-right font-medium">Print</th>
              <th className="px-2 py-2 font-medium">Arbitrum</th>
              <th className="px-2 py-2 font-medium">Base</th>
              <th className="px-2 py-2 text-right font-medium">Open interest</th>
              <th className="px-2 py-2 text-right font-medium">Max</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((item) => (
              <tr
                key={item.id}
                onClick={() => setId(item.id)}
                className={cn("cursor-pointer border-t border-white/8", item.id === row?.id ? "bg-white/8" : "hover:bg-white/5")}
              >
                <td className="px-2 py-3 font-semibold">
                  {item.base}/{item.quote}
                </td>
                <td className="px-2 py-3 text-right font-mono tabular-nums">{printOf(item)}</td>
                <td className="px-2 py-3 text-muted">{item.ostium ? (item.open ? "Ostium · open" : "Ostium") : "—"}</td>
                <td className="px-2 py-3 text-muted">{item.avantis ? "Avantis" : "—"}</td>
                <td className="px-2 py-3 text-right font-mono tabular-nums">{money(item.oi)}</td>
                <td className="px-2 py-3 text-right font-mono">{item.maxLev ? `${item.maxLev}x` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {crosses.map(([name, value]) => (
          <span key={name} className="rounded-full bg-black/40 px-3 py-1 font-mono text-[11px] text-muted">
            {name} {value == null ? "—" : value >= 20 ? value.toFixed(2) : value.toFixed(5)}
            <span className="ml-1 text-subtle">derived</span>
          </span>
        ))}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold">{lane === "fx" ? "FX wire" : "Commodities wire"}</p>
        <NewsWire bare desk="commodities" query={row ? NEWS[row.id] || row.base : ""} limit={6} />
      </div>
    </div>
  );
}
