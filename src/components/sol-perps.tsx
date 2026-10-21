import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FillCard } from "@/components/fill-card";
import { MarkChart } from "@/components/mark-chart";
import { noteAct } from "@/lib/book";
import { driftBook, type DriftMarket } from "@/lib/drift-book";
import { jupPerpOpen, jupPerpPositions, type JupAsset, type JupPosition } from "@/lib/jup-perps";
import { connectPhantom, sendVersioned } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

function money(n: number | null): string {
  if (!(n && n > 0)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  return `$${n.toPrecision(3)}`;
}

export function SolPerps() {
  const wallet = useWallet();
  const [book, setBook] = useState<DriftMarket[]>([]);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [open, setOpen] = useState(false);
  const [margin, setMargin] = useState("10");
  const [lev, setLev] = useState(2);
  const [busy, setBusy] = useState(false);
  const [positions, setPositions] = useState<JupPosition[]>([]);
  const [fill, setFill] = useState<{ title: string; symbol: string; sig: string } | null>(null);
  const [trail, setTrail] = useState<Record<string, number[]>>({});
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return book.filter((row) => !query || row.symbol.toLowerCase().includes(query));
  }, [book, q]);
  const market = book.find((row) => row.symbol === pick) ?? null;

  useEffect(() => {
    let live = true;
    const pull = () =>
      driftBook()
        .then((rows) => {
          if (!live) return;
          setBook(rows);
          setTrail((cur) => {
            const next = { ...cur };
            for (const row of rows) {
              if (!(row.price && row.price > 0)) continue;
              const prev = next[row.symbol] ?? [];
              const last = prev[prev.length - 1];
              next[row.symbol] = last === row.price ? prev : [...prev, row.price].slice(-48);
            }
            return next;
          });
        })
        .catch(() => undefined);
    void pull();
    const id = window.setInterval(pull, 30_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  useEffect(() => {
    if (!owner) return;
    let live = true;
    jupPerpPositions({ data: { owner } }).then((rows) => live && setPositions(rows)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [owner, busy]);

  async function trade(side: "long" | "short") {
    if (!market?.sign) return;
    const marginN = Number(margin);
    if (!(marginN >= 10)) {
      toast.error("Jupiter wants at least $10 of USDC on Solana.");
      return;
    }
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const kept = wallet.linkChain(who, "Phantom", "phantom");
        if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "The wallet did not stay.");
      }
      const built = await jupPerpOpen({
        data: { owner: who, asset: market.sign as JupAsset, side, collateral: marginN, leverage: lev },
      });
      const { Buffer } = await import("buffer");
      if (!globalThis.Buffer) globalThis.Buffer = Buffer;
      const { VersionedTransaction } = await import("@solana/web3.js");
      const tx = VersionedTransaction.deserialize(Buffer.from(built.tx, "base64"));
      const sig = await sendVersioned(tx);
      noteAct({
        kind: "swap",
        title: `${side} ${market.symbol}-PERP ${lev}x`,
        detail: `$${marginN} USDC on Solana · Jupiter`,
        signature: sig,
      });
      setFill({ title: `${side === "long" ? "Long" : "Short"} ${market.symbol}`, symbol: market.symbol, sig });
      setPositions(await jupPerpPositions({ data: { owner: who } }).catch(() => positions));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The position did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {fill ? (
        <FillCard
          title={fill.title}
          symbol={fill.symbol}
          amount={`$${margin}`}
          paid={`$${margin} USDC`}
          received={`${fill.symbol}-PERP`}
          where="Solana"
          when="Just now"
          sig={fill.sig}
          onDone={() => setFill(null)}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[#c6f56a] px-3 py-1 text-xs font-semibold text-black">Solana</span>
        <span className="rounded-full bg-[#2a2a2e] px-3 py-1 text-xs font-semibold">Drift book</span>
        <span className="rounded-full bg-[#2a2a2e] px-3 py-1 text-xs font-semibold">USDC</span>
        <span className="rounded-full bg-[#2a2a2e] px-3 py-1 text-xs font-semibold">SOL ETH BTC sign</span>
      </div>
      <p className="text-sm text-white/60">
        Drift’s Solana book. {book.length || "—"} names, marked live. SOL, ETH, and BTC sign here with the Phantom you already use. USDC stays on Solana. The other names are on the book. This app does not send an order for them.
      </p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${shown.length}`} className="min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
      <ul className="max-h-[70vh] divide-y divide-white/10 overflow-auto">
        {shown.map((row) => (
          <li key={row.symbol}>
            <button type="button" onClick={() => { setPick(row.symbol); setOpen(true); }} className="flex w-full items-center justify-between py-3 text-left active:scale-[0.98]">
              <span>
                <span className="block text-sm font-semibold">{row.symbol}-PERP</span>
                <span className="block text-[11px] text-white/40">{row.sign ? "Signs on Solana" : "Drift · read"}</span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm">{money(row.price)}</span>
                <span className={cn("font-mono text-xs", (row.change ?? 0) < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                  {row.change == null ? "—" : `${row.change >= 0 ? "+" : ""}${row.change.toFixed(2)}%`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {positions.length > 0 ? (
        <ul>
          {positions.map((p) => (
            <li key={p.pubkey} className="flex justify-between border-t border-white/10 py-2 text-sm">
              <span>{p.asset}-PERP {p.side} {p.leverage ? `${p.leverage.toFixed(1)}×` : ""}</span>
              <span className={cn("font-mono", p.pnl < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>{p.pnl >= 0 ? "+" : ""}{p.pnl.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {open && market ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" role="dialog">
          <div className="w-full rounded-t-[28px] bg-[#0c0c0f] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/50">Solana · Drift</p>
                <h2 className="text-3xl font-semibold">{market.symbol}-PERP</h2>
                <p className="font-mono text-3xl">{money(market.price)}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-full bg-[#2a2a2e] px-4 text-sm font-semibold">Close</button>
            </div>
            <div className="mt-3">
              <MarkChart points={trail[market.symbol] ?? []} label={`${market.symbol} marks received on this screen`} />
            </div>
            {market.sign ? (
              <>
                <label className="mt-4 block text-xs text-white/45">
                  Margin, USDC on Solana
                  <input value={margin} onChange={(e) => setMargin(e.target.value)} inputMode="decimal" className="mt-1 min-h-12 w-full rounded-2xl bg-[#1c1c1e] px-4 font-mono text-lg outline-none" />
                </label>
                <label className="mt-3 block">
                  <span className="text-[11px] tracking-[0.14em] text-white/45">LEVERAGE {lev.toFixed(1)}×</span>
                  <input type="range" min={1.1} max={20} step={0.1} value={lev} onChange={(e) => setLev(Number(e.target.value))} className="mt-2 w-full accent-white" />
                </label>
                <p className="mt-1 text-[11px] text-white/40">Jupiter builds the position. Phantom signs it on Solana. The fill card waits for that signature.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} onClick={() => void trade("long")} className="min-h-12 rounded-full bg-[#c6f56a] text-sm font-semibold text-black disabled:opacity-40">Long</button>
                  <button type="button" disabled={busy} onClick={() => void trade("short")} className="min-h-12 rounded-full bg-[#ff5d73] text-sm font-semibold text-black disabled:opacity-40">Short</button>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-white/70">
                {market.symbol} is on Drift’s Solana book{market.price ? ` at ${money(market.price)}` : ""}. This app does not send that order. SOL, ETH, and BTC are the positions Phantom signs here.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
