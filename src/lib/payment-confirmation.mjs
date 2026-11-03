import { waitForChainConfirmation } from "./confirmation-gate.mjs";

/** Confirm an SPL or native SOL payment before returning a successful receipt. */
export async function confirmSolanaPayment(signature, rpc, options = {}) {
  return waitForChainConfirmation(signature, async (sig) => {
    const response = await rpc("getSignatureStatuses", [[sig], { searchTransactionHistory: true }]);
    return response?.value?.[0] ?? null;
  }, options);
}
