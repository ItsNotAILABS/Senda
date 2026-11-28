/** The only strategy language. It is not JavaScript, and it is not evaluated. */

import type { AdvisorMode, AdvisorOwner, AdvisorRank, AdvisorSide, AdvisorSpec, AdvisorSplit } from "@/lib/advisors/types";

const MODES = new Set<AdvisorMode>(["book", "wrap", "day-worst", "day-best"]);
const SIDES = new Set<AdvisorSide>(["buy", "sell"]);
const SPLITS = new Set<AdvisorSplit>(["equal", "one"]);
const RANKS = new Set<AdvisorRank>(["premium", "change", "liquidity"]);

function amount(raw: string): number | null {
  const text = raw.trim();
  const pct = text.endsWith("%");
  const n = Number(pct ? text.slice(0, -1).trim() : text);
  if (!Number.isFinite(n)) return null;
  return pct ? n / 100 : n;
}

export function parseAdvisor(source: string, id: string, owner: AdvisorOwner): { ok: true; spec: AdvisorSpec } | { ok: false; error: string } {
  const spec: AdvisorSpec = {
    id,
    owner,
    version: 1,
    title: "",
    line: "",
    mode: "book",
    side: "buy",
    premiumMin: null,
    premiumMax: null,
    changeMin: null,
    changeMax: null,
    minLiquidity: 0,
    take: 4,
    split: "equal",
    rank: "premium",
    source: source.replace(/\s+$/, ""),
  };
  const lines = source.split("\n");
  let sawRule = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const word = line.match(/^(title|line|mode|side|take|split|rank|version)\s+(.+)$/);
    const cmp = line.match(/^(premium|change|liquidity)\s*(<=|>=)\s*(\S+)$/);
    if (word) {
      const key = word[1];
      const value = word[2].trim();
      if (key === "title") spec.title = value.slice(0, 48);
      else if (key === "line") spec.line = value.slice(0, 180);
      else if (key === "mode") {
        if (!MODES.has(value as AdvisorMode)) return { ok: false, error: `Line ${i + 1}: mode is book, wrap, day-worst, or day-best.` };
        spec.mode = value as AdvisorMode;
      } else if (key === "side") {
        if (!SIDES.has(value as AdvisorSide)) return { ok: false, error: `Line ${i + 1}: side is buy or sell.` };
        spec.side = value as AdvisorSide;
      } else if (key === "split") {
        if (!SPLITS.has(value as AdvisorSplit)) return { ok: false, error: `Line ${i + 1}: split is equal or one.` };
        spec.split = value as AdvisorSplit;
      } else if (key === "rank") {
        if (!RANKS.has(value as AdvisorRank)) return { ok: false, error: `Line ${i + 1}: rank is premium, change, or liquidity.` };
        spec.rank = value as AdvisorRank;
      } else if (key === "take") {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 8) return { ok: false, error: `Line ${i + 1}: take is a whole number from 1 to 8.` };
        spec.take = n;
      } else if (key === "version") {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 999) return { ok: false, error: `Line ${i + 1}: version is a whole number.` };
        spec.version = n;
      }
      continue;
    }
    if (cmp) {
      const n = amount(cmp[3]);
      if (n == null) return { ok: false, error: `Line ${i + 1}: that number is not readable. Use -0.02 or -2%.` };
      const key = cmp[1];
      const op = cmp[2];
      if (key === "liquidity") {
        if (op !== ">=") return { ok: false, error: `Line ${i + 1}: liquidity is a minimum, written liquidity >= 25000.` };
        if (n < 0) return { ok: false, error: `Line ${i + 1}: liquidity cannot be negative.` };
        spec.minLiquidity = n;
      } else if (key === "premium") {
        if (op === "<=") spec.premiumMax = n;
        else spec.premiumMin = n;
      } else if (op === "<=") spec.changeMax = n;
      else spec.changeMin = n;
      sawRule = true;
      continue;
    }
    return { ok: false, error: `Line ${i + 1}: "${line.slice(0, 48)}" is not a rule.` };
  }
  if (!spec.title) return { ok: false, error: "Add a title." };
  if (spec.premiumMin != null && spec.premiumMax != null && spec.premiumMin > spec.premiumMax) {
    return { ok: false, error: "The premium band is empty." };
  }
  if (spec.changeMin != null && spec.changeMax != null && spec.changeMin > spec.changeMax) {
    return { ok: false, error: "The change band is empty." };
  }
  if (spec.mode === "book" && !sawRule) return { ok: false, error: "A book file needs a premium, change, or liquidity rule." };
  return { ok: true, spec };
}

export const NEW_TRADER = `version 1
title My trader
line What this file does, in one sentence. It does not sign.
mode book
side buy
premium <= -2%
liquidity >= 25000
take 4
split equal
rank premium
`;
