import { confirmSolanaPayment } from './payment-confirmation.mjs';
import { recordSubmission, observeTransaction } from './tx-journal.mjs';

/** Journal signature immediately after wallet/RPC broadcast, then verify chain outcome. */
export async function confirmTrackedSubmission(storage, draft, rpc, options = {}) {
  recordSubmission(storage, draft);
  try {
    const confirmed = await confirmSolanaPayment(draft.signature, rpc, options);
    observeTransaction(storage, draft.owner, draft.signature, {
      err: null,
      confirmationStatus: confirmed.confirmationStatus,
    });
    return confirmed;
  } catch (error) {
    // Only explicit on-chain execution errors are terminal.
    if (error?.onChainFailure) {
      observeTransaction(storage, draft.owner, draft.signature, {
        err: { onChainFailure: true },
        confirmationStatus: 'confirmed',
      });
    }
    throw error;
  }
}
