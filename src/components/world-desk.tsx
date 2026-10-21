import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LiveChart } from "@/components/price-chart";
import { WORLD, worldPrices, type WorldAsset, type WorldLane, type WorldMark } from "@/lib/world-book";
import { connectPhantom, mintDecimals } from "@/lib/phantom";
import { signRoute, PAY, payAsset, payRaw } from "@/lib/jup-sign";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

function px(asset: WorldAsset, mark?: WorldMark) {
  if (!mark || !(mark.usd > 0)) return "—";
  if (asset.lane === "fx") return mark.usd.toFixed(4);
  if (mark.usd >= 1000) return `$${mark.usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${mark.usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function WorldDesk({
  lane,
  onLane,
  picked,
  onPick,
  marks,
}: {
  lane: WorldLane;
  onLane: (lane: WorldLane) => void;
  picked: string;
  onPick: (id: string) => void;
  marks: Record<string, WorldMark>;
}) {
  const rows = WORLD.filter((a) => a.lane === lane);
  return (
    <div className="p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Book</p>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Buy it and it stays in the wallet. Bitcoin and Ether come through Portal. Gold is the ounce. Euro is the rate.
          </p>
        </div>
        <div className="flex gap-1">
          {(
            [
              ["crypto", "Crypto"],
              ["metals", "Metals"],
              ["fx", "FX"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onLane(id)}
              className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", lane === id ? "bg-white text-black" : "bg-black/40 text-muted")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="font-mono text-[10px] tracking-[0.14em] text-subtle uppercase">
            <tr>
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium">From</th>
              <th className="px-2 py-2 font-medium">Door</th>
              <th className="px-2 py-2 text-right font-medium">Last</th>
              <th className="px-2 py-2 text-right font-medium">24h</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const mark = marks[row.id];
              const on = row.id === picked;
              return (
                <tr
                  key={row.id}
                  onClick={() => onPick(row.id)}
                  className={cn("cursor-pointer border-t border-white/8", on ? "bg-white/8" : "hover:bg-white/5")}
                >
                  <td className="px-2 py-3">
                    <span className="font-semibold">{row.symbol}</span>
                    <span className="ml-2 text-muted">{row.name}</span>
                  </td>
                  <td className="px-2 py-3 text-muted">{row.chain}</td>
                  <td className="px-2 py-3 text-muted">{row.via}</td>
                  <td className="px-2 py-3 text-right font-mono tabular-nums">{px(row, mark)}</td>
                  <td className={cn("px-2 py-3 text-right font-mono tabular-nums", (mark?.chg ?? 0) < 0 ? "text-down" : "text-accent")}>
                    {mark ? `${mark.chg >= 0 ? "+" : ""}${mark.chg.toFixed(2)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lane === "fx" ? (
        <p className="mt-3 text-xs text-subtle">Pound, yen, and peso are not on a book that can be filled from here. Euro is.</p>
      ) : null}
    </div>
  );
}

/** Spot gold, silver, copper, and the other wallet tokens. Jupiter fills them. */
export function SpotCards({ lane, only }: { lane: WorldLane | "all"; only?: string[] }) {
  const wallet = useWallet();
  const rows = (lane === "all" ? WORLD : WORLD.filter((asset) => asset.lane === lane)).filter((asset) => !only || only.includes(asset.id));
  const [marks, setMarks] = useState<Record<string, WorldMark>>({});
  const [usd, setUsd] = useState(25);
  const [pay, setPay] = useState("USDC");
  const [busy, setBusy] = useState("");
  const [pick, setPick] = useState("");
  const open = rows.find((asset) => asset.id === pick) ?? rows[0];
  useEffect(() => {
    let live = true;
    const pull = () => {
      worldPrices()
        .then((next) => live && setMarks(next))
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 8_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  async function buy(asset: WorldAsset) {
    setBusy(asset.id);
    try {
      const existing = wallet.w.links.find((link) => link.kind === "phantom" || link.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const kept = wallet.linkChain(owner, "Phantom", "phantom");
        if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "The wallet did not stay.");
      }
      const paying = payAsset(pay);
      if (asset.mint === paying.mint) throw new Error(`That is already ${paying.symbol}. Pick another asset to pay with.`);
      const dec = await mintDecimals(asset.mint);
      const mark = marks[asset.id]?.usd ?? 0;
      const done = await signRoute({
        owner,
        inputMint: paying.mint,
        outputMint: asset.mint,
        amountRaw: payRaw(paying.symbol, usd, marks.sol?.usd || 0),
        outDecimals: dec,
        usd,
        symbol: asset.symbol,
        extraMints: [paying.mint],
      });
      toast.success(`${asset.symbol} signed. ${done.signature.slice(0, 8)}…`);
      if (!(mark > 0)) toast.message(`${asset.symbol} is in the wallet after the swap confirms.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The swap did not send.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="px-3 py-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">{lane === "metals" ? "Spot metal" : "Spot"}</p>
          <p className="mt-1 text-sm text-white/55">Held in the wallet. Not the perpetual.</p>
        </div>
        <div className="flex gap-1">
          {[5, 25, 100].map((n) => (
            <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-8 rounded-md px-2 text-xs", usd === n ? "bg-white text-black" : "bg-white/5 text-white/60")}>
              ${n}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-1 overflow-x-auto">
        {PAY.map((row) => (
          <button key={row.symbol} type="button" onClick={() => setPay(row.symbol)} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", pay === row.symbol ? "bg-white text-black" : "bg-white/5 text-white/60")}>
            {row.symbol}
          </button>
        ))}
      </div>
      {open ? (
        <div className="mt-3 overflow-hidden rounded-2xl bg-black/40">
          <p className="px-3 pt-3 text-sm font-semibold">{open.symbol} · {open.name}</p>
          <LiveChart mint={open.mint} symbol={open.symbol} live={marks[open.id]?.usd} />
        </div>
      ) : null}
      <ul className="mt-3 grid gap-2">
        {rows.map((asset) => {
          const mark = marks[asset.id];
          const last = mark && mark.usd > 0 ? (mark.usd >= 1000 ? `$${mark.usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${mark.usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : "—";
          return (
            <li key={asset.id} className={cn("rounded-2xl border bg-[#12141a] px-3 py-3", asset.id === open?.id ? "border-[#d7e36a]" : "border-white/10")}>
              <button type="button" onClick={() => setPick(asset.id)} className="flex w-full items-start gap-3 text-left">
                <img
                  src={`https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${asset.mint}/logo.png`}
                  alt=""
                  className="size-9 shrink-0 rounded-full bg-white object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{asset.symbol}</p>
                  <p className="truncate text-xs text-white/45">{asset.name} · {asset.via}</p>
                  <p className="mt-1 text-xs text-white/35">{asset.note}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm tabular-nums">{last}</p>
                  <p className={cn("font-mono text-[11px]", (mark?.chg ?? 0) < 0 ? "text-[#ff5d73]" : "text-[#3dd68c]")}>
                    {mark ? `${mark.chg >= 0 ? "+" : ""}${mark.chg.toFixed(2)}%` : ""}
                  </p>
                </div>
              </button>
              <button type="button" disabled={busy !== ""} onClick={() => void buy(asset)} className="mt-3 min-h-10 w-full rounded-xl bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-50">
                {busy === asset.id ? "Signing" : `Buy $${usd} · ${pay}`}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
