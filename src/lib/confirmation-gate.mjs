/** Poll Solana signature status. Submission is not a successful fill. */
export async function waitForChainConfirmation(signature, getStatus, options = {}) {
  if (typeof signature !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(signature)) {
    throw new Error("The wallet did not return a valid Solana transaction signature.");
  }
  const attempts = Math.min(40, Math.max(1, Number(options.attempts) || 15));
  const pauseMs = Math.min(5000, Math.max(0, Number(options.pauseMs) || 1200));
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let i = 0; i < attempts; i++) {
    try {
      const status = await getStatus(signature);
      if (status?.err != null) {
        throw Object.assign(new Error(`Transaction failed on-chain: ${signature}. Check the explorer before retrying.`), { onChainFailure: true });
      }
      if (status?.err === null && (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized")) {
        return { signature, confirmationStatus: status.confirmationStatus };
      }
    } catch (error) {
      if (error?.onChainFailure) throw error;
      // Transient RPC errors do not prove settlement or on-chain failure.
    }
    if (i + 1 < attempts) await sleep(pauseMs);
  }
  throw new Error(`Transaction ${signature} was submitted but is not yet confirmed. Check the chain before retrying; never sign a duplicate blindly.`);
}
