/**
 * Journal-before-broadcast for wallet-signed Solana transfers.
 *
 * Order of operations for a sign-only wallet (Phantom signTransaction):
 *   sign -> read the transaction's own signature -> simulate -> write it to the recovery
 *   journal as pending -> broadcast -> confirm.
 * Once the journal row exists, every failure is reported as "uncertain" with that signature,
 * and a retry is only unlocked after checkSendRecovery() proves the transfer failed or expired.
 * Errors before the journal write are marked notBroadcast: nothing reached the network.
 */
import { recordSubmission, observeTransaction, listTransactions, reconcileTransactions } from "./tx-journal.mjs";
import { confirmSolanaPayment } from "./payment-confirmation.mjs";

export class SendOutcomeUncertain extends Error {
  constructor(message, signature = null, cause = undefined) {
    super(message);
    this.name = "SendOutcomeUncertain";
    this.uncertain = true;
    this.signature = signature;
    if (cause !== undefined) this.cause = cause;
  }
}

/** Tag an error raised before anything could have been broadcast. */
export function markNotBroadcast(error) {
  const e = error instanceof Error ? error : new Error(String(error ?? "Transfer was not sent."));
  e.notBroadcast = true;
  return e;
}

/**
 * Fail-closed classification. Only errors that provably happened before broadcast, or a
 * confirmed on-chain failure (funds did not move), unlock a retry. Everything else is uncertain.
 */
const SAFE_BEFORE_SIGNING = /user rejected|rejected the request|request was rejected|user denied|declined|cancell?ed by (the )?user|this wallet has no usdc account|over the spend cap|exceeds your wallet spend cap|that is not a solana address|enter an amount|enter an exact|pay someone else|send between \$0\.01/i;
export function classifySendError(error) {
  if (error && typeof error === "object") {
    if (error.uncertain === true) return { uncertain: true, signature: typeof error.signature === "string" ? error.signature : null };
    if (error.notBroadcast === true) return { uncertain: false, signature: null };
    if (error.onChainFailure === true) return { uncertain: false, signature: null, failedOnChain: true };
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (SAFE_BEFORE_SIGNING.test(message)) return { uncertain: false, signature: null };
  return { uncertain: true, signature: null };
}

/**
 * @param {object} p
 * @param {Pick<Storage,'getItem'|'setItem'>} p.storage
 * @param {object} p.draft journal draft (owner, kind, asset, destination, amountRaw, lastValidBlockHeight?)
 * @param {() => Promise<{mode:'signed', raw:Uint8Array, signature:string} | {mode:'sent', signature:string}>} p.sign
 * @param {(raw:Uint8Array) => Promise<void>} [p.preflight] simulation of the signed bytes
 * @param {(raw:Uint8Array) => Promise<string>} p.send raw broadcast, returns the RPC signature
 * @param {(method:string, params:unknown[]) => Promise<unknown>} p.rpc
 */
export async function journaledSend({ storage, draft, sign, preflight, send, rpc, confirmOptions, now = Date.now() }) {
  const prepared = await sign();
  if (!prepared || typeof prepared.signature !== "string") {
    throw new SendOutcomeUncertain("The wallet did not return a transaction signature. Check wallet activity before retrying.");
  }
  const signature = prepared.signature;
  const entry = { ...draft, signature };
  if (prepared.mode === "signed") {
    if (!(prepared.raw instanceof Uint8Array)) throw markNotBroadcast(new Error("The wallet returned no signed transaction. Nothing was sent."));
    if (preflight) {
      try { await preflight(prepared.raw); }
      catch (e) { throw markNotBroadcast(e); }
    }
    try { recordSubmission(storage, entry, now); }
    catch (e) {
      throw markNotBroadcast(new Error("Could not save this transfer to the recovery log, so it was not sent. " + (e instanceof Error ? e.message : "")));
    }
    let returned;
    try { returned = await send(prepared.raw); }
    catch (e) {
      throw new SendOutcomeUncertain(`Transfer ${signature} may have reached the network. Check its status before retrying.`, signature, e);
    }
    if (returned !== signature) {
      throw new SendOutcomeUncertain(`The network answered with an unexpected signature for ${signature}. Check its status before retrying.`, signature);
    }
  } else {
    // The wallet broadcast it already; journal immediately.
    try { recordSubmission(storage, entry, now); }
    catch (e) {
      throw new SendOutcomeUncertain(`Transfer ${signature} was sent but could not be saved locally. Check it on-chain before retrying.`, signature, e);
    }
  }
  try {
    const confirmed = await confirmSolanaPayment(signature, rpc, confirmOptions);
    observeTransaction(storage, draft.owner, signature, { err: null, confirmationStatus: confirmed.confirmationStatus });
    return { signature, confirmationStatus: confirmed.confirmationStatus };
  } catch (e) {
    if (e?.onChainFailure) {
      observeTransaction(storage, draft.owner, signature, { err: { onChainFailure: true }, confirmationStatus: "confirmed" });
      throw e;
    }
    throw new SendOutcomeUncertain(`Transfer ${signature} is not confirmed yet. Check its status before retrying.`, signature, e);
  }
}

/**
 * Before allowing a retry: reconcile the journal with getSignatureStatuses and expire
 * never-landed transactions whose blockhash can no longer be processed.
 * Returns state 'paid' | 'pending' | 'clear' for the given signature (or for every
 * unresolved send of this owner when no signature is known).
 */
export async function checkSendRecovery({ storage, owner, rpc, signature = null, now = Date.now() }) {
  await reconcileTransactions(storage, owner, rpc, now);
  let rows = listTransactions(storage, owner).filter((r) => r.kind === "send");
  if (signature) rows = rows.filter((r) => r.signature === signature);
  const stillPending = rows.filter((r) => r.status === "pending");
  const expirable = stillPending.filter((r) => Number.isSafeInteger(r.lastValidBlockHeight));
  if (expirable.length) {
    const height = await rpc("getBlockHeight", [{ commitment: "finalized" }]);
    if (Number.isSafeInteger(height)) {
      const expired = expirable.filter((r) => height > r.lastValidBlockHeight);
      if (expired.length) {
        // Re-check after observing the height: a landed tx would now have a status.
        const response = await rpc("getSignatureStatuses", [expired.map((r) => r.signature), { searchTransactionHistory: true }]);
        const values = response?.value;
        if (Array.isArray(values) && values.length === expired.length) {
          expired.forEach((r, i) => {
            const status = values[i];
            if (status && typeof status === "object") observeTransaction(storage, owner, r.signature, status, now);
            else if (status === null) observeTransaction(storage, owner, r.signature, { err: { blockhashExpired: true } }, now);
          });
        }
      }
    }
  }
  let after = listTransactions(storage, owner).filter((r) => r.kind === "send");
  if (signature) after = after.filter((r) => r.signature === signature);
  if (signature && !after.length) return { state: "pending", rows: after };
  if (after.some((r) => r.status === "confirmed" || r.status === "finalized") && signature) return { state: "paid", rows: after };
  if (after.some((r) => r.status === "pending")) return { state: "pending", rows: after };
  return { state: "clear", rows: after };
}
