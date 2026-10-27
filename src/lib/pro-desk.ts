/** Pro risk and conflict. Pure. It does not sign and it does not store a key. */

export const PRO_TERMS = "pro-2";
const KEY = "senda.pro.v1";

export type ProIntent = {
  id: string;
  symbol: string;
  side: string;
  usd: number;
  status: string;
  at?: string;
};

export type ProRisk = {
  maxTradeUsd: number;
  maxImpact: number;
};

export type ProState = {
  version: string;
  acceptedAt: string;
  armed: boolean;
  maxTradeUsd: number;
  maxImpact: number;
};

export const PRO_POINTS = [
  "Pro asks your wallet to sign a buy that has already passed the risk checks. There is no second confirm button inside Senda. The wallet still has to approve. Senda never holds the key.",
  "Pro signs buys only. A queued sell is released. Two buys of the same name: the earlier one stays, the later one is released. A buy over your trade cap is released.",
  "A buy can lose money. The daily aim is not a promised profit. Turn Pro off and it stops opening the wallet. Clearing this site clears the acceptance.",
  "A new launch is scored, not sped. Mint authority, freeze authority, or a serial deployer refuses the buy before the wallet opens. If Jupiter cannot quote it, a market order is not queued. A limit waits. The 10 bps Pro fee is shown and is not taken.",
] as const;

export function settle(queued: ProIntent[], risk: ProRisk): { sign: ProIntent[]; release: { id: string; why: string }[] } {
  const release: { id: string; why: string }[] = [];
  const cap = Math.max(0.5, risk.maxTradeUsd);
  const buys: ProIntent[] = [];
  for (const row of queued) {
    if (row.status !== "queued") continue;
    if (row.side !== "buy") {
      release.push({ id: row.id, why: "Pro signs buys only. This order was released." });
      continue;
    }
    if (!(row.usd > 0) || row.usd > cap) {
      release.push({ id: row.id, why: `Over the $${cap} trade cap. Released before the wallet opened.` });
      continue;
    }
    buys.push(row);
  }
  const bySymbol = new Map<string, ProIntent[]>();
  for (const row of buys) {
    const list = bySymbol.get(row.symbol) ?? [];
    list.push(row);
    bySymbol.set(row.symbol, list);
  }
  const sign: ProIntent[] = [];
  for (const [symbol, list] of bySymbol) {
    const ordered = [...list].sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
    sign.push(ordered[0]);
    for (const extra of ordered.slice(1)) {
      release.push({ id: extra.id, why: `Already a buy of ${symbol} ahead of this one. Released.` });
    }
  }
  sign.sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
  return { sign, release };
}

export function loadPro(): ProState | null {
  if (typeof window === "undefined") return null;
  try {
    const row = JSON.parse(window.localStorage.getItem(KEY) || "null") as ProState | null;
    if (!row || row.version !== PRO_TERMS) return null;
    return row;
  } catch {
    return null;
  }
}

export function savePro(row: ProState) {
  window.localStorage.setItem(KEY, JSON.stringify({ ...row, version: PRO_TERMS }));
}

export function walletStopped(message: string): boolean {
  return /reject|declin|cancel|closed|dismiss/i.test(message);
}
