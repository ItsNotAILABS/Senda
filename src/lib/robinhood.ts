/** Opens Robinhood Connect so buying power can land as USDC on a Solana address. */

export function robinhoodBuyingPowerUrl(input: { wallet: string; usd: number; origin: string }): string {
  const params = new URLSearchParams({
    walletAddress: input.wallet,
    supportedAssets: "USDC",
    supportedNetworks: "SOLANA",
    paymentMethod: "buying_power",
    assetCode: "USDC",
    fiatCode: "USD",
    fiatAmount: String(Math.max(1, Math.round(input.usd))),
    connectId: crypto.randomUUID(),
    redirectUrl: `${input.origin}/wallets`,
  });
  const app = import.meta.env.VITE_ROBINHOOD_APP_ID;
  if (app) params.set("applicationId", app);
  return `https://applink.robinhood.com/u/connect?${params}`;
}
