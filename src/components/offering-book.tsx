import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FillButton } from "@/components/fill-button";
import { noteAct } from "@/lib/book";
import { avantisOpen, DERIVS } from "@/lib/deriv-book";
import { getLifiQuote } from "@/lib/lifi";
import { signLifi } from "@/lib/lifi-sign";
import { listOfferings, type OfferingRow } from "@/lib/offering-book";
import { connectPhantom, sendVersioned } from "@/lib/phantom";
import { jupPerpOpen, type JupAsset } from "@/lib/jup-perps";
import { payUsdc } from "@/lib/solana-pay";
import { EVM_MARKETS, rawAmount, type LifiQuote } from "@/lib/trade-book.mjs";
import { stageMove, sealMove } from "@/lib/moves";
import { connectWallet } from "@/lib/wallets";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  name: "Names",
  listed: "Shares",
  stake: "Savings",
  spot: "Spot",
  metal: "Metals",
  fx: "FX",
  loan: "Loans",
  perp: "Perps",
  rail: "Send",
  ostium: "Ostium",
  chain: "Chains",
  option: "Options",
  cover: "Cover",
  commodity: "Commodities",
  index: "Indexes",
};

const PERP_ASSET = new Set(["SOL", "ETH", "BTC"]);

function solMint(mint: string): boolean {
  return mint.length >= 32 && !mint.startsWith("0x");
}

export function OfferingBook() {
  const [rows, setRows] = useState<OfferingRow[]>([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("all");
  const [cap, setCap] = useState(24);
  const [usd, setUsd] = useState(5);

  useEffect(() => {
    let live = true;
    listOfferings()
      .then((next) => {
        if (live) setRows(next);
      })
      .catch((e) => {
        if (live) setErr(e instanceof Error ? e.message : "The book did not load.");
      });
    return () => {
      live = false;
    };
  }, []);

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.family, (counts.get(row.family) ?? 0) + 1);
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (family !== "all" && row.family !== family) return false;
      if (!query) return true;
      return `${row.symbol} ${row.name} ${row.venue} ${row.chain} ${row.note}`.toLowerCase().includes(query);
    });
  }, [rows, q, family]);
  const page = shown.slice(0, cap);

  return (
    <section className="p-3">
      <p className="text-[11px] tracking-[0.16em] text-[#c6f56a]">PRODUCTS</p>
      <h2 className="mt-1 text-2xl font-semibold">Every product, with its own ticket</h2>
      <p className="mt-2 text-sm text-white/55">
        {rows.length > 0 ? `${rows.length} on the book. A button signs only when that product has a route.` : "The book writes when this page loads."}
      </p>
      {err ? <p className="mt-2 text-sm text-down">{err}</p> : null}
      <div className="mt-3 flex gap-2">
        {[1, 5, 10, 25].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("grid size-11 place-items-center rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/15")}>
            ${n}
          </button>
        ))}
      </div>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setCap(24);
        }}
        placeholder="Search every product"
        className="mt-3 min-h-11 w-full rounded-full bg-black/40 px-4 text-sm outline-none"
      />
      {counts.size > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          <button type="button" onClick={() => { setFamily("all"); setCap(24); }} className={family === "all" ? "shrink-0 rounded-full bg-white px-3 py-1 font-mono text-xs text-black" : "shrink-0 rounded-full bg-black/40 px-3 py-1 font-mono text-xs text-white/70"}>
            All {rows.length}
          </button>
          {[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => (
            <button key={id} type="button" onClick={() => { setFamily(id); setCap(24); }} className={family === id ? "shrink-0 rounded-full bg-white px-3 py-1 font-mono text-xs text-black" : "shrink-0 rounded-full bg-black/40 px-3 py-1 font-mono text-xs text-white/70"}>
              {LABEL[id] ?? id} {n}
            </button>
          ))}
        </div>
      ) : null}
      <ul className="mt-3 grid gap-3">
        {page.map((row) => (
          <li key={row.id}>
            <ProductCard row={row} usd={usd} />
          </li>
        ))}
      </ul>
      {shown.length > page.length ? (
        <button type="button" onClick={() => setCap((n) => n + 24)} className="mt-3 min-h-10 rounded-full border border-white/15 px-4 text-sm">
          Show more · {shown.length - page.length} left
        </button>
      ) : null}
    </section>
  );
}

function ProductCard({ row, usd }: { row: OfferingRow; usd: number }) {
  return (
    <article className="rounded-[22px] border border-white/10 bg-[#101114] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-wide text-white/40 uppercase">{LABEL[row.family] ?? row.family} · {row.chain}</p>
          <h3 className="mt-1 text-lg font-semibold">{row.symbol}</h3>
          <p className="text-sm text-white/55">{row.name}</p>
        </div>
        <p className="font-mono text-[11px] text-white/45">{row.status}</p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/45">{row.note}</p>
      <p className="mt-1 text-[11px] text-white/30">{row.venue}{row.signPath ? ` · ${row.signPath}` : ""}</p>
      <div className="mt-3">
        <Ticket row={row} usd={usd} />
      </div>
    </article>
  );
}

function Ticket({ row, usd }: { row: OfferingRow; usd: number }) {
  const hold = DERIVS.find((item) => item.avantis === row.symbol || item.ostium === row.symbol.replace("/", "-"));
  if ((row.signPath === "jupiter" || row.signPath === "prestock") && solMint(row.mint)) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <FillButton mint={row.mint} usd={usd} symbol={row.symbol} label={`Buy $${usd}`} className="min-h-10 rounded-full bg-[#d7e36a] text-sm font-semibold text-black" />
        <FillButton mint={row.mint} usd={usd} side="sell" symbol={row.symbol} label={`Sell $${usd}`} className="min-h-10 rounded-full border border-white/15 text-sm font-semibold" />
      </div>
    );
  }
  if (row.signPath === "lifi") return <LifiTicket row={row} usd={usd} />;
  if (row.signPath === "jup-perps" || row.signPath === "drift") return <PerpTicket row={row} usd={usd} />;
  if (row.signPath === "arbitrum") {
    return (
      <div className="grid gap-2">
        {hold?.hold ? (
          <div className="grid grid-cols-2 gap-2">
            <FillButton mint={hold.hold.mint} usd={usd} symbol={hold.hold.symbol} label={`Buy $${usd} ${hold.hold.symbol}`} className="min-h-10 rounded-full bg-[#d7e36a] text-sm font-semibold text-black" />
            <FillButton mint={hold.hold.mint} usd={usd} side="sell" symbol={hold.hold.symbol} label={`Sell $${usd}`} className="min-h-10 rounded-full border border-white/15 text-sm font-semibold" />
          </div>
        ) : null}
        {hold?.avantis ? <AvantisTicket pair={hold.avantis} usd={usd} /> : <p className="text-xs text-white/45">Ostium prints this. Avantis does not list a Base order for it, so there is no signature.</p>}
      </div>
    );
  }
  if (row.signPath === "phantom") return <SendTicket usd={usd} />;
  if (hold?.hold) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <FillButton mint={hold.hold.mint} usd={usd} symbol={hold.hold.symbol} label={`Buy $${usd}`} className="min-h-10 rounded-full bg-[#d7e36a] text-sm font-semibold text-black" />
        <FillButton mint={hold.hold.mint} usd={usd} side="sell" symbol={hold.hold.symbol} label={`Sell $${usd}`} className="min-h-10 rounded-full border border-white/15 text-sm font-semibold" />
      </div>
    );
  }
  return <p className="text-xs text-white/45">No route signs this row. It stays on the book as a print.</p>;
}

function LifiTicket({ row, usd }: { row: OfferingRow; usd: number }) {
  const [busy, setBusy] = useState(false);
  const wallet = useWallet();
  const market = EVM_MARKETS.find((item) => item.token.toLowerCase() === row.mint.toLowerCase() || item.symbol === row.symbol);

  async function go(side: "buy" | "sell") {
    if (!market) {
      toast.error("LI.FI has no market for this token.");
      return;
    }
    setBusy(true);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
      const fromAddress = existing || (await connectWallet("metamask")).address;
      const amount = rawAmount(usd, side === "sell" ? market.decimals : market.usdcDecimals);
      const fresh = await getLifiQuote({
        data: {
          tape: market.tape,
          usd,
          side,
          ...(side === "sell" ? { tokenRaw: amount.toString() } : {}),
          fromAddress,
        },
      });
      if ("error" in fresh) throw new Error(fresh.error);
      const hash = await signLifi(market, fresh as LifiQuote, {
        token: side === "sell" ? market.token : market.usdc,
        amount,
        usd,
      });
      noteAct({ kind: "swap", title: `${side === "buy" ? "Buy" : "Sell"} ${row.symbol}`, detail: "LI.FI", signature: hash });
      toast.success(`${side === "buy" ? "Bought" : "Sold"} ${row.symbol}. ${hash.slice(0, 10)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  if (!market) return <p className="text-xs text-white/45">No LI.FI market for this address.</p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" disabled={busy} onClick={() => void go("buy")} className="min-h-10 rounded-full bg-[#d7e36a] text-sm font-semibold text-black">{busy ? "…" : `Buy $${usd}`}</button>
      <button type="button" disabled={busy} onClick={() => void go("sell")} className="min-h-10 rounded-full border border-white/15 text-sm font-semibold">{busy ? "…" : `Sell $${usd}`}</button>
    </div>
  );
}

function PerpTicket({ row, usd }: { row: OfferingRow; usd: number }) {
  const [busy, setBusy] = useState(false);
  const wallet = useWallet();
  const asset = row.symbol.replace("-PERP", "").toUpperCase();
  if (!PERP_ASSET.has(asset)) return <p className="text-xs text-white/45">This perp is on the book. Only SOL, ETH, and BTC have a Jupiter order.</p>;

  async function go(side: "long" | "short") {
    const collateral = Math.max(10, usd);
    setBusy(true);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      const built = await jupPerpOpen({ data: { owner, asset: asset as JupAsset, side, collateral, leverage: 2 } });
      const { Buffer } = await import("buffer");
      if (!globalThis.Buffer) globalThis.Buffer = Buffer;
      const { VersionedTransaction } = await import("@solana/web3.js");
      const tx = VersionedTransaction.deserialize(Buffer.from(built.tx, "base64"));
      const sig = await sendVersioned(tx);
      noteAct({ kind: "swap", title: `${side} ${asset} 2x`, detail: "Jupiter Perps", signature: sig });
      toast.success(`${side} ${asset} 2x. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The position did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      {usd < 10 ? <p className="text-[11px] text-white/40">Jupiter takes at least $10. This button uses $10.</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => void go("long")} className="min-h-10 rounded-full bg-[#d7e36a] text-sm font-semibold text-black">{busy ? "…" : "Long 2x"}</button>
        <button type="button" disabled={busy} onClick={() => void go("short")} className="min-h-10 rounded-full border border-white/15 text-sm font-semibold">{busy ? "…" : "Short 2x"}</button>
      </div>
    </div>
  );
}

function AvantisTicket({ pair, usd }: { pair: string; usd: number }) {
  const [busy, setBusy] = useState(false);
  const wallet = useWallet();

  async function go(side: "long" | "short") {
    setBusy(true);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
      const trader = existing || (await connectWallet("metamask")).address;
      const built = await avantisOpen({ data: { pair, trader, side, collateral: usd, leverage: 2 } });
      const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; providers?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> }[] } }).ethereum;
      const provider = eth?.providers?.[0] ?? eth;
      if (!provider) throw new Error("No Ethereum wallet in this browser.");
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] }).catch(async (err: { code?: number }) => {
        if (err?.code !== 4902) throw err;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: "0x2105", chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"] }],
        });
      });
      if (built.approve) {
        await provider.request({ method: "eth_sendTransaction", params: [{ from: trader, to: built.approve.to, data: built.approve.data, value: "0x0" }] });
      }
      stageMove({ usd, kind: "swap", title: `${side} ${pair}` });
      const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from: trader, to: built.trade.to, data: built.trade.data, value: "0x0" }] });
      sealMove(String(hash), true);
      noteAct({ kind: "swap", title: `${side} ${pair}`, detail: "Avantis on Base", signature: String(hash) });
      toast.success(`${side} ${pair} on Base. ${String(hash).slice(0, 10)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Base did not take the order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" disabled={busy} onClick={() => void go("long")} className="min-h-10 rounded-full bg-white text-sm font-semibold text-black">{busy ? "…" : `Long $${usd}`}</button>
      <button type="button" disabled={busy} onClick={() => void go("short")} className="min-h-10 rounded-full border border-white/15 text-sm font-semibold">{busy ? "…" : `Short $${usd}`}</button>
    </div>
  );
}

function SendTicket({ usd }: { usd: number }) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const wallet = useWallet();

  async function go() {
    setBusy(true);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      const out = await payUsdc({ owner, to: to.trim(), usd, memo: "Senda" });
      noteAct({ kind: "send", title: `Send $${usd} USDC`, detail: to.trim(), signature: out.signature });
      toast.success(`Sent. ${out.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The send did not go.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana address" className="min-h-11 rounded-full bg-black/40 px-4 text-sm outline-none" />
      <button type="button" disabled={busy || to.trim().length < 32} onClick={() => void go()} className="min-h-10 rounded-full bg-[#d7e36a] text-sm font-semibold text-black">
        {busy ? "…" : `Send $${usd} USDC`}
      </button>
    </div>
  );
}
