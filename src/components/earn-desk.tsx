import { useEffect, useMemo, useState } from "react";
import { FillButton } from "@/components/fill-button";
import { MarkFace } from "@/components/holding-cards";
import { apyText, loadEarnBook, type EarnRow } from "@/lib/earn-book";

function money(n: number): string {
  if (!(n > 0)) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function EarnDesk() {
  const [rows, setRows] = useState<EarnRow[]>([]);
  const [err, setErr] = useState("");
  const [usd, setUsd] = useState(1);
  const [q, setQ] = useState("");
  const [cap, setCap] = useState(16);

  useEffect(() => {
    let live = true;
    loadEarnBook()
      .then((next) => live && setRows(next))
      .catch((e) => live && setErr(e instanceof Error ? e.message : "Earn rates did not load."));
    return () => {
      live = false;
    };
  }, []);

  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () => rows.filter((row) => !query || `${row.name} ${row.symbol} ${row.chain}`.toLowerCase().includes(query)),
    [rows, query],
  );
  const signable = filtered.filter((row) => row.sign);
  const rates = filtered.filter((row) => !row.sign);
  const usdc = rates.find((row) => row.symbol === "USDC") ?? null;
  const hero = signable.find((row) => row.symbol === "USDC" && row.apy) ?? signable.find((row) => row.apy && row.tvlUsd >= 1_000_000) ?? signable.find((row) => row.apy) ?? signable[0];
  const rest = signable.filter((row) => row !== hero);

  return (
    <div className="bg-black text-white">
      <header className="px-4 pt-2 pb-4">
        <h2 className="text-[34px] leading-none font-semibold tracking-tight">Earn on your USDC.</h2>
        <p className="mt-2 text-[15px] text-white/55">
          {usdc
            ? `Kamino is paying ${apyText(usdc)} on ${money(usdc.tvlUsd)} of USDC. No lockup on their market. A withdrawal still depends on liquidity there. This desk does not hold the deposit, so there is no button that pretends a swap is one.`
            : "The Kamino USDC supply rate did not load. A swap into USDC is not a deposit."}
        </p>
      </header>

      <div className="flex items-center gap-2 px-4">
        <label className="text-xs text-white/45">
          Size
          <input
            inputMode="decimal"
            value={String(usd)}
            onChange={(e) => setUsd(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 block min-h-11 w-28 rounded-full bg-[#1c1c1e] px-4 font-mono text-sm outline-none"
          />
        </label>
        {[1, 5, 25].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={usd === n ? "mt-5 grid size-11 place-items-center rounded-full bg-white text-sm font-semibold text-black" : "mt-5 grid size-11 place-items-center rounded-full bg-[#1c1c1e] text-sm font-semibold"}>
            ${n}
          </button>
        ))}
      </div>

      {hero ? (
        <div className="mt-4 flex items-center gap-3 border-y border-white/10 px-4 py-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#6d7cff] text-lg font-semibold">$</div>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold">Savings</p>
            <p className="text-sm text-white/45">{hero.name}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[15px] font-semibold text-[#c6f56a]">{apyText(hero)} {hero.window}</p>
            {hero.mint ? (
              <FillButton mint={hero.mint} usd={usd} symbol={hero.symbol} label={usd > 0 ? `Get $${usd}` : "Set a size"} className="mt-1 text-xs font-semibold text-white/80" />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="px-4 pt-6">
        <h3 className="text-[28px] leading-none font-semibold tracking-tight">More ways to earn</h3>
        <p className="mt-2 text-[15px] text-white/50">Stake receipts and Kamino vault shares. A share buy is a Jupiter swap into the wallet. Rates move.</p>
        <input value={q} onChange={(e) => { setQ(e.target.value); setCap(16); }} placeholder="Search" className="mt-3 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
        {err ? <p className="mt-3 text-sm text-[#ff5d73]">{err}</p> : null}
        <ul>
          {rest.slice(0, cap).map((row) => (
            <li key={row.id} className="flex items-center gap-3 border-b border-white/10 py-3">
              <MarkFace symbol={row.symbol} mint={row.mint} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold">{row.name}</p>
                <p className="text-sm text-white/40">{row.symbol} · {row.chain}{row.tvlUsd ? ` · ${money(row.tvlUsd)}` : ""}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[15px] font-semibold text-[#c6f56a]">{apyText(row)} {row.apy ? row.window : ""}</p>
                <FillButton mint={row.mint} usd={usd} symbol={row.symbol} label={`Add $${usd || 0}`} className="text-xs font-semibold text-white/70" />
              </div>
            </li>
          ))}
        </ul>
        {rest.length > cap ? (
          <button type="button" onClick={() => setCap((n) => n + 20)} className="mt-3 min-h-10 rounded-full bg-white/10 px-4 text-sm font-semibold">
            Show more · {rest.length - cap} left
          </button>
        ) : null}
      </div>

      {rates.length ? (
        <div className="px-4 pt-8 pb-6">
          <h3 className="text-lg font-semibold">Kamino supply rates</h3>
          <p className="mt-1 text-sm text-white/45">Live supply APR on reserves with at least $1M. This desk does not deposit into them. There is no button, because a swap would not start the rate.</p>
          <ul>
            {rates.slice(0, 12).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 border-b border-white/10 py-3">
                <div>
                  <p className="font-semibold">{row.symbol}</p>
                  <p className="text-sm text-white/40">Solana · {money(row.tvlUsd)}</p>
                </div>
                <p className="font-mono font-semibold text-[#c6f56a]">{apyText(row)} APR</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
