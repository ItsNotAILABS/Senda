import { useState } from "react";
import { toast } from "sonner";
import { FillButton } from "@/components/fill-button";
import { CctpLane } from "@/components/cctp-lane";
import { NetBrief, NetworkSheet } from "@/components/network-sheet";
import { addMonad, addRobinhood, CHAIN_LANES, KEPT_DESKS, PHANTOM_NETS } from "@/lib/chain-book";
import { PAIR_MARKETS } from "@/lib/market-catalog";
import { cn } from "@/lib/utils";

export function ChainDesk() {
  const [usd, setUsd] = useState(5);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [netId, setNetId] = useState("solana");
  const net = PHANTOM_NETS.find((n) => n.id === netId) ?? PHANTOM_NETS[0];
  const tradable = PAIR_MARKETS.filter((row) => row.mint);

  return (
    <div className="px-3 py-3">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Chains</p>
      <h2 className="mt-1 text-2xl font-semibold">Solana, Bitcoin, Ethereum, Robinhood, Monad</h2>
      <p className="mt-1 text-sm text-white/55">Nothing on the other desks was removed. This is the map, plus the majors you can sign from here.</p>
      <button type="button" onClick={() => setSheet(true)} className="mt-3 min-h-10 rounded-full bg-white/10 px-4 text-sm font-semibold">
        {net.mark} {net.name}{net.badge ? ` · ${net.badge}` : ""}
      </button>
      <NetworkSheet open={sheet} current={net.id} onClose={() => setSheet(false)} onPick={setNetId} />
      <NetBrief net={net} />
      <div className="mt-3 flex gap-2">
        {[1, 5, 25].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("grid size-11 place-items-center rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/15")}>
            ${n}
          </button>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-white/10 rounded-[22px] bg-[#101114] px-3">
        {CHAIN_LANES.map((lane) => (
          <li key={lane.id} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold">{lane.name}</p>
              <p className="text-[11px] text-white/45">{lane.live ? "Live" : "Chain only"}</p>
            </div>
            <p className="mt-1 text-xs text-white/55">{lane.clears}</p>
            <p className="mt-1 text-[11px] text-white/35">{lane.sign}</p>
            {lane.id === "monad" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  addMonad()
                    .then(() => toast.success("Monad is the active chain in the wallet."))
                    .catch((e) => toast.error(e instanceof Error ? e.message : "The wallet did not add Monad."))
                    .finally(() => setBusy(false));
                }}
                className="mt-3 min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black"
              >
                {busy ? "…" : "Add Monad in the wallet"}
              </button>
            ) : null}
            {lane.id === "robinhood" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  addRobinhood()
                    .then(() => toast.success("Robinhood Chain is the active chain in Phantom."))
                    .catch((e) => toast.error(e instanceof Error ? e.message : "The wallet did not add Robinhood Chain."))
                    .finally(() => setBusy(false));
                }}
                className="mt-3 min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black"
              >
                {busy ? "…" : "Add Robinhood Chain"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <CctpLane />
      <h3 className="mt-5 text-sm font-semibold">Majors you can buy</h3>
      <ul className="mt-2 divide-y divide-white/10 rounded-[22px] bg-[#101114] px-3">
        {tradable.map((row) => (
          <li key={row.id} className="py-3">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">{row.symbol}</p>
              <p className="text-xs text-white/45">{row.name}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <FillButton mint={row.mint!} usd={usd} symbol={row.symbol} label={`Buy $${usd}`} className="min-h-10 rounded-full bg-[#d7e36a] text-sm font-semibold text-black" />
              <FillButton mint={row.mint!} usd={usd} side="sell" symbol={row.symbol} label={`Sell $${usd}`} className="min-h-10 rounded-full border border-white/15 text-sm font-semibold" />
            </div>
          </li>
        ))}
      </ul>
      <h3 className="mt-5 text-sm font-semibold">Still on their own desks</h3>
      <ul className="mt-2 divide-y divide-white/10 rounded-[22px] bg-[#101114] px-3">
        {KEPT_DESKS.map((desk) => (
          <li key={desk.name} className="py-3">
            <p className="font-semibold">{desk.name}</p>
            <p className="text-xs text-white/45">{desk.where} · {desk.holds}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
