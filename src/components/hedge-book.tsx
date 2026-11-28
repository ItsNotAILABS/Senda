import { useState } from "react";
import { toast } from "sonner";
import { avantisOpen, type DerivRow } from "@/lib/deriv-book";
import { rememberHedge, listHedges, type Hedge } from "@/lib/hedge-book";
import { USDC } from "@/lib/jup-exec";
import { signRoute } from "@/lib/jup-sign";
import { connectPhantom, splHolding } from "@/lib/phantom";
import { connectWallet } from "@/lib/wallets";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

type Evm = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; isMetaMask?: boolean; isBraveWallet?: boolean; providers?: Evm[] };

function metamask(): Evm {
  const eth = (window as unknown as { ethereum?: Evm }).ethereum;
  const list = eth?.providers?.length ? eth.providers : eth ? [eth] : [];
  const mm = list.find((p) => p.isMetaMask && !p.isBraveWallet) || list[0];
  if (!mm) throw new Error("MetaMask is not in this browser.");
  return mm;
}

async function sendBase(from: string, tx: { to: string; data: string }) {
  const provider = metamask();
  await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] }).catch(async (err: { code?: number }) => {
    if (err?.code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: "0x2105", chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"] }],
    });
  });
  const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from, to: tx.to, data: tx.data, value: "0x0" }] });
  if (typeof hash !== "string") throw new Error("MetaMask did not return a transaction.");
  return hash;
}

/** Long in Phantom, short in MetaMask, or both. The pair that has no token is MetaMask only. */
export function HedgeBook({ rows }: { rows: DerivRow[] }) {
  const wallet = useWallet();
  const phantom = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const mask = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
  const book = rows.filter((r) => r.hold || r.avantis);
  const [id, setId] = useState("usdjpy");
  const [usd, setUsd] = useState("25");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<Hedge[]>(() => (typeof window === "undefined" ? [] : listHedges()));
  const row = book.find((r) => r.id === id) ?? book.find((r) => r.id === "eurusd") ?? book[0];

  async function solana(): Promise<string> {
    const addr = phantom || (await connectPhantom());
    if (!phantom) {
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep Phantom.");
    }
    return addr;
  }

  async function base(): Promise<string> {
    if (mask) return mask;
    const got = await connectWallet("metamask");
    const linked = wallet.linkChain(got.address, "MetaMask", "evm");
    if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep MetaMask.");
    return got.address;
  }

  async function longToken(addr: string): Promise<Hedge["long"]> {
    if (!row?.hold) throw new Error("This pair has no token. The long is on Base.");
    const n = Number(usd);
    const signed = await signRoute({
      owner: addr,
      inputMint: USDC,
      outputMint: row.hold.mint,
      amountRaw: Math.round(n * 1_000_000),
      outDecimals: 6,
      usd: n,
    });
    const held = await splHolding(addr, row.hold.mint).catch(() => null);
    const got = held && held.ui > 0 ? held.ui : signed.outUi;
    return { where: "Phantom", what: `Long ${got > 0 ? got.toLocaleString("en-US", { maximumFractionDigits: 4 }) : ""} ${row.hold.symbol}`.trim(), signature: signed.signature };
  }

  async function baseSide(side: "long" | "short"): Promise<Hedge["short"]> {
    if (!row?.avantis) throw new Error("This pair has no Base book.");
    const n = Number(usd);
    if (n < 10) throw new Error("A Base leg takes at least $10.");
    const trader = await base();
    const built = await avantisOpen({ data: { pair: row.avantis, trader, side, collateral: n, leverage: 2 } });
    if (built.approve) await sendBase(trader, built.approve);
    const hash = await sendBase(trader, built.trade);
    return { where: "MetaMask", what: `${side === "long" ? "Long" : "Short"} ${row.base}/${row.quote} on Base, 2×`, signature: hash };
  }

  async function run(mode: "long" | "short" | "both") {
    if (!row) return;
    const n = Number(usd);
    if (!(n >= 1)) {
      toast.error("Set a size.");
      return;
    }
    setBusy(mode);
    const hedge: Hedge = { id: crypto.randomUUID(), pair: `${row.base}/${row.quote}`, at: Date.now() };
    try {
      if (mode === "long" || mode === "both") {
        hedge.long = row.hold ? await longToken(await solana()) : await baseSide("long");
      }
      if (mode === "short" || mode === "both") {
        if (row.avantis) hedge.short = await baseSide("short");
        else if (row.hold) {
          const addr = await solana();
          const held = await splHolding(addr, row.hold.mint);
          if (!(Number(held.raw) > 0)) throw new Error(`Short means selling ${row.hold.symbol}. This wallet does not hold it, and there is no Base book.`);
          const signed = await signRoute({
            owner: addr,
            inputMint: row.hold.mint,
            outputMint: USDC,
            amountRaw: Number(held.raw),
            outDecimals: 6,
            usd: Math.max(n, 1),
          });
          hedge.short = { where: "Phantom", what: `Sold ${row.hold.symbol} back to USDC`, signature: signed.signature };
        }
      }
      if (!hedge.long && !hedge.short) throw new Error("This pair has nothing to sign.");
      setOpen(rememberHedge(hedge));
      const legs = [hedge.long?.where, hedge.short?.where].filter(Boolean).join(" and ");
      toast.success(`${hedge.pair} signed in ${legs}.`);
    } catch (e) {
      if (hedge.long || hedge.short) setOpen(rememberHedge(hedge));
      toast.error(e instanceof Error ? e.message : "The hedge did not sign.");
    } finally {
      setBusy("");
    }
  }

  if (!row) return null;

  return (
    <section className="mb-4 rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Hedge</p>
      <h2 className="mt-1 text-xl font-semibold">Long and short can both be open.</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Phantom and MetaMask stay signed in together. A token leg signs in Phantom. USD/JPY, oil, and the rest of the book sign in MetaMask. Both means one after the other, two signatures, one hedge. This does not mint a coin that pretends to be the yen.
      </p>
      <p className="mt-2 font-mono text-xs text-white/70">Phantom {phantom ? "on" : "off"} · MetaMask {mask ? "on" : "off"}</p>
      <div className="mt-3 flex gap-1 overflow-x-auto">
        {book.map((item) => (
          <button key={item.id} type="button" onClick={() => setId(item.id)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${item.id === row.id ? "bg-white text-black" : "bg-white/10"}`}>
            {item.base}/{item.quote}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <p className="font-mono text-3xl">{row.base}/{row.quote}</p>
          <p className="mt-1 text-xs text-muted">{row.hold ? `${row.hold.symbol} in Phantom.` : "No token."} {row.avantis ? "Base book in MetaMask." : "No Base book."}</p>
        </div>
        <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="USDC for the hedge" className="w-28 bg-transparent font-mono text-4xl outline-none" />
        <button type="button" disabled={busy !== ""} onClick={() => void run("long")} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">{busy === "long" ? "Waiting" : "Long"}</button>
        <button type="button" disabled={busy !== ""} onClick={() => void run("short")} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">{busy === "short" ? "Waiting" : "Short"}</button>
        <button type="button" disabled={busy !== ""} onClick={() => void run("both")} className="min-h-11 rounded-full border border-white/20 px-4 text-sm font-semibold disabled:opacity-40">{busy === "both" ? "Waiting" : "Both"}</button>
      </div>
      <ul className="mt-4 space-y-2">
        {open.length === 0 ? <li className="text-sm text-muted">No hedge yet.</li> : null}
        {open.map((hedge) => (
          <li key={hedge.id} className="rounded-2xl border border-white/10 px-3 py-3">
            <p className="font-mono text-lg">{hedge.pair}</p>
            {hedge.long ? <p className="mt-1 text-sm">Long · {hedge.long.where} · {hedge.long.what}</p> : null}
            {hedge.short ? <p className="mt-1 text-sm">Short · {hedge.short.where} · {hedge.short.what}</p> : null}
            <p className="mt-1 text-xs text-subtle">{new Date(hedge.at).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
