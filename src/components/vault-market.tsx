import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FillButton } from "@/components/fill-button";
import { loadKaminoVaults, VAULT_RECEIPTS, type KaminoVault } from "@/lib/vault-book";

function fee(bps: number): string {
  if (!(bps > 0)) return "no perf fee";
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}% perf fee`;
}

export function VaultMarket() {
  const [rows, setRows] = useState<KaminoVault[]>([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [cap, setCap] = useState(24);
  const [usd, setUsd] = useState(5);

  useEffect(() => {
    let live = true;
    loadKaminoVaults()
      .then((next) => live && setRows(next))
      .catch((e) => live && setErr(e instanceof Error ? e.message : "Kamino did not answer."));
    return () => {
      live = false;
    };
  }, []);

  const query = q.trim().toLowerCase();
  const shown = rows.filter((r) => !query || r.name.toLowerCase().includes(query));

  return (
    <div className="mt-3">
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Senda wrap</p>
        <h2 className="mt-1 text-xl font-semibold">One wrap, around every vault.</h2>
        <p className="mt-2 text-sm text-white/60">
          The wrap is a claim on USDC that never leaves the wallet. It is not a second balance. Stake receipts and Kamino shares stay in that same wallet. This desk does not hold them.
        </p>
        <Link to="/vault" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-black">
          Open the wrap
        </Link>
      </section>

      <div className="mt-3 flex gap-2">
        {[1, 5, 25].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={usd === n ? "grid size-11 place-items-center rounded-full bg-white text-sm font-semibold text-black" : "grid size-11 place-items-center rounded-full border border-white/15 text-sm font-semibold"}>
            ${n}
          </button>
        ))}
      </div>

      <h3 className="mt-4 text-sm font-semibold">Receipts Jupiter can quote</h3>
      <ul className="mt-2 grid grid-cols-2 gap-3">
        {VAULT_RECEIPTS.map((row) => (
          <li key={row.mint} className="flex min-h-[148px] flex-col rounded-[22px] border border-white/10 bg-[#10131c] p-3">
            <p className="font-semibold">{row.symbol}</p>
            <p className="mt-1 text-xs text-white/50">{row.note}</p>
            <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
              <FillButton mint={row.mint} usd={usd} symbol={row.symbol} label={`Buy $${usd}`} className="min-h-10 rounded-full bg-[#d7e36a] text-xs font-semibold text-black" />
              <FillButton mint={row.mint} usd={usd} side="sell" symbol={row.symbol} label={`Sell $${usd}`} className="min-h-10 rounded-full border border-white/15 text-xs font-semibold" />
            </div>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 text-sm font-semibold">Kamino vaults · {rows.length || "…"}</h3>
      <p className="mt-1 text-xs text-white/45">Buy share asks Jupiter for the share token. If there is no pool, the wallet is not asked. This is not a Kamino deposit.</p>
      <input value={q} onChange={(e) => { setQ(e.target.value); setCap(24); }} placeholder="Search vaults" className="mt-2 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
      {err ? <p className="mt-2 text-sm text-[#ff5d73]">{err}</p> : null}
      <ul className="mt-2 divide-y divide-white/10 rounded-[22px] bg-[#101114] px-3">
        {shown.slice(0, cap).map((row) => (
          <li key={row.address} className="py-3">
            <p className="font-semibold">{row.name}</p>
            <p className="mt-1 text-[11px] text-white/40">{fee(row.perfBps)}{row.mgmtBps ? ` · ${(row.mgmtBps / 100).toFixed(2)}% mgmt` : ""}</p>
            <div className="mt-2">
              <FillButton mint={row.sharesMint} usd={usd} symbol={row.name} label={`Buy $${usd} share`} className="min-h-10 rounded-full bg-[#d7e36a] px-4 text-xs font-semibold text-black" />
            </div>
          </li>
        ))}
        {shown.length === 0 && !err ? <li className="py-6 text-sm text-white/45">No vault matched.</li> : null}
      </ul>
      {shown.length > cap ? (
        <button type="button" onClick={() => setCap((n) => n + 40)} className="mt-3 min-h-10 rounded-full bg-white/10 px-4 text-sm font-semibold">
          Show more · {shown.length - cap} left
        </button>
      ) : null}
    </div>
  );
}
