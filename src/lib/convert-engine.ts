/** Which engine a swap uses. Jupiter and DFlow are raced. A pair neither can route becomes two signatures through USDC. */

import type { SwapCoin } from "@/lib/swap-book";

export type ConvertEngine = "jupiter" | "dflow" | "stable" | "fx" | "stake" | "share" | "via-usdc";
export type EngineWin = "jupiter" | "dflow" | "via-usdc";

export function pickEngine(
  pay: SwapCoin | undefined,
  recv: SwapCoin | undefined,
  hops: number,
  winner: EngineWin = hops > 1 ? "via-usdc" : "jupiter",
): { id: ConvertEngine; line: string } {
  if (winner === "dflow") {
    return { id: "dflow", line: "DFlow pays more than Jupiter on this pair. One signature. The wallet signs the DFlow transaction." };
  }
  if (winner === "via-usdc" || hops > 1) {
    return { id: "via-usdc", line: "No direct route on Jupiter or DFlow. Convert to USDC, then into the token you picked. Two signatures. The wallet signs both." };
  }
  const paySol = pay?.symbol === "SOL";
  const recvSol = recv?.symbol === "SOL";
  if ((pay?.group === "Staked" && recvSol) || (recv?.group === "Staked" && paySol)) {
    return { id: "stake", line: "Stake wrap. Jupiter moves SOL and the staked token. One signature." };
  }
  if (pay?.group === "Cash" && recv?.group === "Cash") {
    if (pay.symbol === "EURC" || recv?.symbol === "EURC") {
      return { id: "fx", line: "FX convert. Jupiter prices the pair. One signature." };
    }
    return { id: "stable", line: "Stable convert. Jupiter. One signature." };
  }
  if (pay?.group === "FX" || recv?.group === "FX") {
    return { id: "fx", line: "FX convert. Jupiter prices the pair. One signature." };
  }
  if (pay?.group === "Stocks" || recv?.group === "Stocks" || pay?.group === "PreStocks" || recv?.group === "PreStocks") {
    return { id: "share", line: "Share convert. Jupiter. This token is not the brokerage share." };
  }
  if (pay?.group === "Metals" || recv?.group === "Metals" || pay?.group === "Commodities" || recv?.group === "Commodities") {
    return { id: "share", line: "Commodity convert. Jupiter. The token tracks the fund or the metal. It is not the bar." };
  }
  return { id: "jupiter", line: "Jupiter route. One signature." };
}