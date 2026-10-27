/** Robinhood Connect. Buying power is a payment method on their checkout. USDC is sent to the wallet address. */

export function robinhoodBuyingPowerUrl(wallet: string, usd: number): string {
  const params = new URLSearchParams({
    walletAddress: wallet,
    supportedAssets: "USDC",
    supportedNetworks: "SOLANA",
    paymentMethod: "buying_power",
    fiatCode: "USD",
    fiatAmount: String(Math.max(1, Math.round(usd) || 25)),
    connectId: crypto.randomUUID(),
    redirectUrl: `${window.location.origin}/wallet`,
  });
  const app = import.meta.env.VITE_ROBINHOOD_APP_ID as string | undefined;
  if (app) params.set("applicationId", app);
  return `https://applink.robinhood.com/u/connect?${params.toString()}`;
}
