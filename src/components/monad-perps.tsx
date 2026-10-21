import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MarkChart } from "@/components/mark-chart";
import { FillCard } from "@/components/fill-card";
import { perplBook, type PerplMarket } from "@/lib/perpl-book";
import { perplTrade } from "@/lib/perpl-trade";
import { cn } from "@/lib/utils";

const AUSD = "0x00000000efe302beaa2b3e6e1b18d08d69a9012a";

function money(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  return `$${n.toPrecision(4)}`;
}

function phantomEth(): { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } {
  const eth = (window as unknown as { phantom?: { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } } }).phantom?.ethereum;
  if (!eth) throw new Error("Open this in Phantom. The Monad account is the Ethereum account in that app.");
  return eth;
}

export function MonadPerps() {
  const [book, setBook] = useState<PerplMarket[]>([]);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("");
  const [ausd, setAusd] = useState<number | null>(null);
  const [margin, setMargin] = useState("10");
  const [lev, setLev] = useState(2);
  const [busy, setBusy] = useState(false);
  const [fill, setFill] = useState<{ title: string; symbol: string; amount: string; sig: string } | null>(null);
  const [trail, setTrail] = useState<Record<string, number[]>>({});
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return book.filter((row) => !query || row.name.toLowerCase().includes(query));
  }, [book, q]);
  const market = book.find((row) => row.name === pick) ?? null;

  useEffect(() => {
    let live = true;
    const pull = () =>
      perplBook()
        .then((rows) => {
          if (!live) return;
          setBook(rows);
          setTrail((cur) => {
            const next = { ...cur };
            for (const row of rows) {
              const prev = next[row.name] ?? [];
              const last = prev[prev.length - 1];
              next[row.name] = last === row.price ? prev : [...prev, row.price].slice(-48);
            }
            return next;
          });
        })
        .catch(() => undefined);
    void pull();
    const id = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  async function account() {
    const eth = phantomEth();
    try {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x8f",
          chainName: "Monad",
          nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
          rpcUrls: ["https://rpc.monad.xyz"],
          blockExplorerUrls: ["https://monadscan.com"],
        }],
      });
    } catch {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x8f" }] });
    }
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const address = accounts[0];
    if (!address) throw new Error("Phantom did not return an address.");
    setWho(address);
    const data = `0x70a08231${address.slice(2).padStart(64, "0")}`;
    const raw = (await eth.request({ method: "eth_call", params: [{ to: AUSD, data }, "latest"] })) as string;
    setAusd(Number(BigInt(raw)) / 1e6);
  }

  async function trade(side: "long" | "short") {
    if (!market) return;
    const marginN = Number(margin);
    const max = market.marginBps > 0 ? Math.floor(10000 / market.marginBps) : 5;
    if (lev > max) {
      toast.error(`This market allows ${max}×.`);
      return;
    }
    setBusy(true);
    try {
      const done = await perplTrade({
        side,
        marketId: market.id,
        margin: marginN,
        leverage: lev,
        price: market.price,
        sizeDecimals: market.sizeDecimals,
      });
      if (!who) setWho(done.address);
      setFill({
        title: `${side === "long" ? "Long" : "Short"} ${market.name}`,
        symbol: market.name,
        amount: `$${marginN}`,
        sig: done.ref,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The order did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {fill ? (
        <FillCard title={fill.title} symbol={fill.symbol} amount={fill.amount} paid={`${fill.amount} AUSD`} received={`${fill.symbol}-PERP`} where="Monad" when="Just now" sig={fill.sig} onDone={() => setFill(null)} />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[#c6f56a] px-3 py-1 text-xs font-semibold text-black">Monad</span>
        <span className="rounded-full bg-[#2a2a2e] px-3 py-1 text-xs font-semibold">Perpl</span>
        <span className="rounded-full bg-[#2a2a2e] px-3 py-1 text-xs font-semibold">AUSD</span>
        <span className="rounded-full bg-[#2a2a2e] px-3 py-1 text-xs font-semibold">Not for a US address</span>
      </div>
      <p className="text-sm text-white/60">
        {book.length || "—"} perps on Monad. Collateral is AUSD. Long or Short asks Phantom to open the account if it is new, then sends the order. Perpl refuses a US address. The mark chart is what this screen has received.
      </p>
      <button type="button" onClick={() => void account().catch((e) => toast.error(e instanceof Error ? e.message : "Phantom did not open Monad."))} className="min-h-10 rounded-full bg-[#2a2a2e] px-4 text-sm font-semibold">
        {who ? `${who.slice(0, 6)}…${who.slice(-4)} · AUSD ${ausd == null ? "—" : ausd.toFixed(2)}` : "Open Monad in Phantom"}
      </button>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${shown.length}`} className="min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
      <ul className="max-h-[70vh] divide-y divide-white/10 overflow-auto">
        {shown.map((row) => (
          <li key={row.id}>
            <button type="button" onClick={() => { setPick(row.name); setOpen(true); }} className="flex w-full items-center justify-between py-3 text-left active:scale-[0.98]">
              <span>
                <span className="block text-sm font-semibold">{row.name}-PERP</span>
                <span className="block text-[11px] text-white/40">{row.open ? "Open" : "Closed"} · margin {(row.marginBps / 100).toFixed(0)}%</span>
              </span>
              <span className="font-mono text-sm">{money(row.price)}</span>
            </button>
          </li>
        ))}
      </ul>
      {open && market ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" role="dialog">
          <div className="w-full rounded-t-[28px] bg-[#0c0c0f] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/50">Monad · Perpl · AUSD</p>
                <h2 className="text-3xl font-semibold">{market.name}-PERP</h2>
                <p className="font-mono text-3xl">{money(market.price)}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-full bg-[#2a2a2e] px-4 text-sm font-semibold">Close</button>
            </div>
            <div className="mt-3">
              <MarkChart points={trail[market.name] ?? []} label={`${market.name} marks received on this screen`} />
            </div>
            <p className="mt-3 text-sm text-white/60">
              Initial margin {(market.marginBps / 100).toFixed(0)}%. Max {market.marginBps > 0 ? Math.floor(10000 / market.marginBps) : "—"}×. A new account takes 10 AUSD and two or three Phantom signatures before the order.
            </p>
            <label className="mt-3 block text-xs text-white/45">
              Margin, AUSD
              <input value={margin} onChange={(e) => setMargin(e.target.value)} inputMode="decimal" className="mt-1 min-h-12 w-full rounded-2xl bg-[#1c1c1e] px-4 font-mono text-lg outline-none" />
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] tracking-[0.14em] text-white/45">LEVERAGE {lev.toFixed(1)}×</span>
              <input type="range" min={1} max={market.marginBps > 0 ? Math.max(1, Math.floor(10000 / market.marginBps)) : 5} step={0.5} value={lev} onChange={(e) => setLev(Number(e.target.value))} className="mt-2 w-full accent-white" />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => void trade("long")} className="min-h-12 rounded-full bg-[#c6f56a] text-sm font-semibold text-black disabled:opacity-40">Long</button>
              <button type="button" disabled={busy} onClick={() => void trade("short")} className="min-h-12 rounded-full bg-[#ff5d73] text-sm font-semibold text-black disabled:opacity-40">Short</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
