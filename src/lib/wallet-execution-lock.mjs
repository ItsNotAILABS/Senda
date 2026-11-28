/** Prevent overlapping wallet-signing flows. Lock is advisory; server idempotency is still required. */
const active = new Set();
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export async function withWalletExecutionLock(owner, execute, locks = globalThis.navigator?.locks) {
  if (!ADDRESS.test(owner) || typeof execute !== 'function') {
    throw new Error('Cannot authorize an invalid wallet execution request.');
  }
  const name = `senda-wallet-execution:${owner}`;
  if (active.has(name)) throw new Error('Another wallet action is already in progress. Check its status before retrying.');
  active.add(name);
  try {
    if (locks && typeof locks.request === 'function') {
      return await locks.request(name, { ifAvailable: true }, async (lock) => {
        if (!lock) throw new Error('This wallet is busy in another tab. Check the other transaction before retrying.');
        return execute();
      });
    }
    // Older browsers: same-tab lock only. Cross-device safety requires server-side idempotency.
    return await execute();
  } finally {
    active.delete(name);
  }
}
