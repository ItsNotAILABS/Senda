/** xStocks stay a token book. A brokerage ticket is a different asset. */

const TOKEN = new Set([
  "SPYX", "QQQX", "XLEX", "XOMX", "CVXX", "NVDAX", "AAPLX", "TSLAX", "MSFTX", "AMZNX",
  "METAX", "AMDX", "AVGOX", "NFLXX", "COINX", "HOODX", "PLTRX", "MSTRX", "INTCX", "ORCLX",
  "LLYX", "COSTX", "TSMX", "ASMLX", "ARMX", "CATX", "CRCLX", "DELLX", "MRNAX", "MRVLX",
  "MUX", "NVOX", "RIVNX", "SMCIX", "SPOTX",
]);

export const XSTOCK_LAW = [
  "One page can name the token, the share, and the perp. They are not one asset.",
  "AAPLx is not AAPL. The tickers are never merged.",
  "The brokerage book is not the default Buy. xStocks stay where they are.",
  "After the US cash session, the token can still trade. The share cannot pretend it is open.",
  "Banned: “upgrade to real stocks,” and any line that ranks the share above the token.",
] as const;

/** True when this string is an xStock ticker or a mint, not a brokerage symbol. */
export function isXStock(symbol: string): boolean {
  const raw = symbol.trim();
  if (raw.length >= 32) return true;
  if (/x$/.test(raw)) return true;
  return TOKEN.has(raw.toUpperCase());
}

export function brokerageSymbol(symbol: string): { ok: true; symbol: string } | { ok: false; reason: string } {
  const raw = symbol.trim();
  if (isXStock(raw)) return { ok: false, reason: "That is an xStock. This order does not buy it, and it does not replace it." };
  const symbolUp = raw.toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(symbolUp)) return { ok: false, reason: "A brokerage symbol is 1 to 5 letters. A mint is not one." };
  return { ok: true, symbol: symbolUp };
}
