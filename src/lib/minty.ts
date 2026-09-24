/** Minty — launch a token onto Solana (Pump) or Ethereum. */

export type Chain = "solana" | "ethereum";

export function pumpCreate(name: string, ticker: string): string {
  const q = new URLSearchParams({ name, ticker });
  return `https://pump.fun/create?${q.toString()}`;
}

export function letsbonk(name: string, ticker: string): string {
  return `https://letsbonk.fun/?name=${encodeURIComponent(name)}&ticker=${encodeURIComponent(ticker)}`;
}

export function clankerEth(name: string, ticker: string): string {
  return `https://clanker.world/clanker/deploy?name=${encodeURIComponent(name)}&symbol=${encodeURIComponent(ticker)}`;
}

export function flaunch(name: string, ticker: string): string {
  return `https://flaunch.gg/create?name=${encodeURIComponent(name)}&symbol=${encodeURIComponent(ticker)}`;
}

export function uniswapCreate(): string {
  return "https://app.uniswap.org/positions/create";
}

export const MINTY_RAILS: { id: Chain; label: string; hint: string }[] = [
  { id: "solana", label: "Solana", hint: "Pump.fun + LetsBonk. Same mint machine the ecosystem already uses." },
  { id: "ethereum", label: "Ethereum", hint: "Clanker / Flaunch, then Uniswap v4." },
];
