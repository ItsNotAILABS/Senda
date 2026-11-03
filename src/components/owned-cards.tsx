import { Link } from "@tanstack/react-router";

const STABLES = new Set(["USDC", "USDT", "PYUSD", "EURC", "CASH"]);
const STAKED = new Set([
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
  "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",
  "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
]);

export type OwnedToken = { mint: string; symbol: string; ui: number };
export type OwnedMark = { mint: string; last: number; name?: string };

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n >= 1 ? 2 : 4 });
}

export function OwnedCards({
  sol,
  solPx,
  tokens,
  marks,
}: {
  sol: number;
  solPx: number;
  tokens: OwnedToken[];
  marks: OwnedMark[];
}) {
  const rows: { key: string; title: string; sub: string; qty: string; value: number | null; to: "/invest" | "/vault"; desk?: string }[] = [];
  if (sol > 0) {
    rows.push({
      key: "SOL",
      title: "SOL",
      sub: "Solana",
      qty: `${sol >= 1 ? sol.toFixed(4) : sol.toFixed(6)} SOL`,
      value: solPx > 0 ? sol * solPx : null,
      to: "/invest",
      desk: "spot",
    });
  }
  for (const token of tokens) {
    if (!(token.ui > 0)) continue;
    const mark = marks.find((m) => m.mint === token.mint);
    const stable = STABLES.has(token.symbol);
    const staked = STAKED.has(token.mint) || token.symbol === "JitoSOL";
    rows.push({
      key: token.mint,
      title: token.symbol.length > 12 ? `${token.symbol.slice(0, 4)}…${token.symbol.slice(-4)}` : token.symbol,
      sub: staked ? "Savings · staked SOL" : mark?.name || (stable ? "Cash" : "Held"),
      qty: `${token.ui >= 1 ? token.ui.toFixed(4) : token.ui.toFixed(6)}`,
      value: stable ? token.ui : mark && mark.last > 0 ? token.ui * mark.last : null,
      to: staked ? "/vault" : "/invest",
      desk: staked ? undefined : stable ? "spot" : "pre",
    });
  }
  if (rows.length === 0) {
    return <p className="text-sm text-white/45">Nothing in this wallet yet.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-2">
      {rows.map((row) => (
        <li key={row.key}>
          <Link
            to={row.to}
            search={row.desk ? { desk: row.desk } : undefined}
            className="block rounded-[22px] border border-white/10 bg-[#101114] px-3 py-3 active:scale-[0.98]"
          >
            <p className="text-[11px] tracking-[0.12em] text-white/40">{row.sub}</p>
            <p className="mt-1 text-base font-semibold">{row.title}</p>
            <p className="mt-2 font-mono text-sm tabular-nums">{row.value != null ? money(row.value) : row.qty}</p>
            <p className="font-mono text-[11px] text-white/40">{row.qty}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
