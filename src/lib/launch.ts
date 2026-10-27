/** Pump.fun or Bonk builds the swap. Phantom signs it. */

export async function launchTrade(input: {
  owner: string;
  mint: string;
  sol: number;
  side: "buy" | "sell";
  pool: "pump" | "bonk" | "auto";
}): Promise<Uint8Array> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input.mint)) throw new Error("That is not a mint.");
  const body = {
    publicKey: input.owner,
    action: input.side,
    mint: input.mint,
    amount: input.side === "sell" ? "100%" : input.sol,
    denominatedInSol: input.side === "buy",
    slippage: 15,
    priorityFee: 0.00005,
    pool: input.pool,
  };
  const res = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/octet-stream" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = (await res.text()).trim();
    throw new Error(text || `The pool did not build a trade (${res.status}).`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
