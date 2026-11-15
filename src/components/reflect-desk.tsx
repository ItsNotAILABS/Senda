import { useEffect, useState } from "react";
import { toast } from "sonner";
import { connectPhantom, sendVersioned } from "@/lib/phantom";
import { reflectBook, reflectTx, type ReflectBook } from "@/lib/reflect";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

/** Reflect USDC+ / USDT+ and a branded mint. Every write is their unsigned transaction, signed here. */
export function ReflectDesk() {
  const wallet = useWallet();
  const [book, setBook] = useState<ReflectBook | null>(null);
  const [note, setNote] = useState("Reading Reflect");
  const [index, setIndex] = useState(0);
  const [usd, setUsd] = useState(5);
  const [name, setName] = useState("Senda Dollar");
  const [symbol, setSymbol] = useState("SND");
  const [feeBps, setFeeBps] = useState(0);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    reflectBook()
      .then((row) => {
        setBook(row);
        setNote(row.types.length ? row.types.map((t) => t.name).join(" · ") : "Reflect returned no assets");
      })
      .catch((e: unknown) => setNote(e instanceof Error ? e.message : "Reflect did not answer"));
  }, []);

  async function go(kind: "mint" | "burn" | "launch") {
    setBusy(kind);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const signer = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(signer, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
      }
      const built = await reflectTx({
        data: { kind, signer, index, usd, name, symbol, feeBps },
      });
      const { VersionedTransaction } = await import("@solana/web3.js");
      const raw = Uint8Array.from(atob(built.transaction), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(raw);
      const sig = await sendVersioned(tx);
      toast.success(built.integrationId ? `Signed. Integration ${built.integrationId.slice(0, 8)}… ${sig.slice(0, 8)}…` : `Signed. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reflect did not build a transaction.");
    } finally {
      setBusy("");
    }
  }

  const rate = book?.rates.find((row) => row.stablecoin === index)?.receipt;
  const apy = book?.apy.find((row) => row.index === index)?.apy;

  return (
    <div className="space-y-4 px-3 py-3">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Reflect</p>
        <h2 className="mt-1 text-2xl tracking-tight">Their dollar, in this wallet</h2>
        <p className="mt-1 max-w-xl text-sm text-white/55">
          USDC+ and USDT+ are Reflect’s. Minting and redeeming build a transaction on their API. Phantom signs it. A branded token is their Create flow: your wallet becomes the authority. Senda does not hold either.
        </p>
        <p className="mt-2 text-xs text-white/40">{note}{book?.users != null ? ` · ${book.users.toLocaleString("en-US")} users` : ""}</p>
      </header>

      <div className="flex gap-2">
        {(book?.types.length ? book.types : [{ index: 0, name: "USDC+" }, { index: 1, name: "USDT+" }]).map((row) => (
          <button key={row.index} type="button" onClick={() => setIndex(row.index)} className={index === row.index ? "min-h-9 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-9 rounded-full bg-white/10 px-3 text-sm"}>
            {row.name}
          </button>
        ))}
      </div>
      <p className="text-sm text-white/60">
        {rate != null ? `Receipt rate ${rate.toFixed(4)}` : "No receipt rate on this read"}
        {apy != null ? ` · ${apy.toFixed(2)}% APY` : " · Reflect is not publishing an APY on this read"}
      </p>

      <section className="rounded-[22px] border border-white/10 bg-[#12141a] p-4">
        <p className="text-sm font-semibold">Use the plus asset</p>
        <label className="mt-2 block text-xs text-white/45">
          Dollars
          <input inputMode="decimal" value={String(usd)} onChange={(e) => setUsd(Math.max(0, Number(e.target.value) || 0))} className="mt-1 min-h-11 w-full rounded-2xl bg-black/30 px-4 font-mono text-sm outline-none" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy !== ""} onClick={() => void go("mint")} className="min-h-11 rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
            {busy === "mint" ? "Waiting on the wallet" : `Mint $${usd || 0}`}
          </button>
          <button type="button" disabled={busy !== ""} onClick={() => void go("burn")} className="min-h-11 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">
            {busy === "burn" ? "Waiting on the wallet" : `Redeem $${usd || 0}`}
          </button>
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#12141a] p-4">
        <p className="text-sm font-semibold">Release a token</p>
        <p className="mt-1 text-xs text-white/45">This asks Reflect to create a branded mint backed by the plus asset you picked. You sign. You are the authority. It fails if Reflect refuses the account.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="mt-3 min-h-11 w-full rounded-2xl bg-black/30 px-4 text-sm outline-none" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="Symbol" className="min-h-11 rounded-2xl bg-black/30 px-4 font-mono text-sm outline-none" />
          <input inputMode="numeric" value={String(feeBps)} onChange={(e) => setFeeBps(Math.max(0, Math.min(10000, Number(e.target.value) || 0)))} aria-label="Fee in basis points" className="min-h-11 rounded-2xl bg-black/30 px-4 font-mono text-sm outline-none" />
        </div>
        <p className="mt-1 text-xs text-white/35">Fee is basis points. 100 is 1%. 0 takes nothing.</p>
        <button type="button" disabled={busy !== ""} onClick={() => void go("launch")} className="mt-3 min-h-11 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
          {busy === "launch" ? "Waiting on the wallet" : "Sign the Reflect launch"}
        </button>
      </section>
    </div>
  );
}
