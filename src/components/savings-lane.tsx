import { useEffect, useState } from "react";
import { toast } from "sonner";
import { connectPhantom, readChain } from "@/lib/phantom";
import { signRoute, SOL } from "@/lib/jup-sign";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const PRODUCTS = [
  { symbol: "JitoSOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", via: "Jito" },
  { symbol: "mSOL", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", via: "Marinade" },
  { symbol: "bSOL", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", via: "Blaze" },
  { symbol: "JupSOL", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", via: "Jupiter" },
  { symbol: "INF", mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", via: "Sanctum" },
] as const;

export function SavingsLane({ owner, sol, jito, solPx }: { owner: string; sol: number; jito: number; solPx: number }) {
  const wallet = useWallet();
  const [pick, setPick] = useState<(typeof PRODUCTS)[number]["symbol"]>("JitoSOL");
  const [held, setHeld] = useState<Record<string, number>>({});
  const [raw, setRaw] = useState("0.05");
  const [busy, setBusy] = useState<"in" | "out" | "">("");
  const product = PRODUCTS.find((p) => p.symbol === pick) ?? PRODUCTS[0];
  const amount = Number(raw);
  const bag = held[product.mint] ?? (product.symbol === "JitoSOL" ? jito : 0);

  useEffect(() => {
    if (!owner) return;
    let live = true;
    const pull = () => {
      readChain(owner)
        .then((snap) => {
          if (!live) return;
          const next: Record<string, number> = {};
          for (const row of PRODUCTS) {
            next[row.mint] = snap.tokens.find((t) => t.mint === row.mint)?.ui ?? 0;
          }
          setHeld(next);
        })
        .catch(() => undefined);
    };
    pull();
    window.addEventListener("senda-chain", pull);
    return () => {
      live = false;
      window.removeEventListener("senda-chain", pull);
    };
  }, [owner]);

  async function run(way: "in" | "out") {
    if (!(amount > 0)) return toast.error("Enter an amount.");
    if (way === "in" && amount > sol + 1e-9) return toast.error("That is more SOL than this wallet holds.");
    if (way === "out" && amount > bag + 1e-9) return toast.error(`That is more ${product.symbol} than this wallet holds.`);
    setBusy(way);
    try {
      const existing = owner || wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address || "";
      const who = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const usd = Math.max(0.01, amount * (solPx > 0 ? solPx : 1));
      const done = await signRoute({
        owner: who,
        inputMint: way === "in" ? SOL : product.mint,
        outputMint: way === "in" ? product.mint : SOL,
        amountRaw: Math.floor(amount * 1e9),
        outDecimals: 9,
        usd,
      });
      toast.success(way === "in" ? `Staked into ${product.symbol}. ${done.signature.slice(0, 8)}…` : `Unstaked ${product.symbol}. ${done.signature.slice(0, 8)}…`);
      window.dispatchEvent(new Event("senda-chain"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The stake did not send.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-[28px] border border-[#c6f56a]/20 bg-[#070b08] p-4">
      <p className="text-[11px] tracking-[0.16em] text-[#c6f56a]">SAVINGS</p>
      <h2 className="mt-1 text-2xl font-semibold">Stake SOL. It stays in Phantom.</h2>
      <p className="mt-2 text-sm text-white/55">
        {product.via} takes the stake. Jupiter swaps SOL for {product.symbol} when you sign. The token earns while it sits. Senda does not hold it.
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {PRODUCTS.map((row) => (
          <button
            key={row.mint}
            type="button"
            onClick={() => setPick(row.symbol)}
            className={`shrink-0 rounded-full px-3 py-2 text-left ${pick === row.symbol ? "bg-white text-black" : "bg-black/40 text-white"}`}
          >
            <span className="block text-sm font-semibold">{row.symbol}</span>
            <span className={`block font-mono text-[11px] ${pick === row.symbol ? "text-black/60" : "text-white/45"}`}>{(held[row.mint] ?? 0) > 0 ? (held[row.mint] ?? 0).toFixed(4) : row.via}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-black/40 px-3 py-3">
          <p className="text-xs text-white/40">SOL</p>
          <p className="font-mono text-xl">{sol > 0 ? sol.toFixed(4) : "0"}</p>
        </div>
        <div className="rounded-2xl bg-black/40 px-3 py-3">
          <p className="text-xs text-white/40">{product.symbol}</p>
          <p className="font-mono text-xl">{bag > 0 ? bag.toFixed(4) : "0"}</p>
        </div>
      </div>
      <input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        inputMode="decimal"
        aria-label={`Amount of SOL to stake into ${product.symbol}`}
        className="mt-3 min-h-12 w-full rounded-full border border-white/10 bg-black/40 px-4 font-mono text-lg outline-none"
      />
      <button
        type="button"
        disabled={Boolean(busy)}
        onClick={() => void run("in")}
        className="mt-3 min-h-12 w-full rounded-full bg-[#c6f56a] text-sm font-semibold text-black disabled:opacity-40"
      >
        {busy === "in" ? "Waiting for Phantom…" : `Stake ${amount > 0 ? amount : ""} SOL → ${product.symbol}`}
      </button>
      <button
        type="button"
        disabled={Boolean(busy) || !(bag > 0)}
        onClick={() => void run("out")}
        className="mt-2 min-h-12 w-full rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40"
      >
        {busy === "out" ? "Waiting for Phantom…" : `Unstake ${product.symbol}`}
      </button>
    </section>
  );
}
