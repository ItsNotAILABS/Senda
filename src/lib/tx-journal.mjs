/** Recoverable, wallet-scoped record of Solana submissions. This is NOT an audited ledger. */
export const JOURNAL_KEY = 'senda.tx-journal.v1';
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const STATES = new Set(['pending', 'confirmed', 'finalized', 'failed']);
const KINDS = new Set(['swap', 'send']);
const LIMIT = 80;

function records(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new Error('Transaction recovery storage is unavailable. Do not repeat an uncertain transaction.');
  }
  let raw;
  try { raw = JSON.parse(storage.getItem(JOURNAL_KEY) || '[]'); }
  catch { throw new Error('Transaction recovery records are unreadable. Do not send again until checked.'); }
  if (!Array.isArray(raw)) throw new Error('Transaction recovery records are invalid.');
  return raw.filter((r) => r && typeof r === 'object' && SIGNATURE.test(r.signature) &&
    ADDRESS.test(r.owner) && STATES.has(r.status) && KINDS.has(r.kind) &&
    typeof r.amountRaw === 'string' && /^\d+$/.test(r.amountRaw) &&
    typeof r.asset === 'string' && typeof r.destination === 'string' &&
    Number.isSafeInteger(r.submittedAt) && r.submittedAt > 0);
}
function persist(storage, rows) {
  storage.setItem(JOURNAL_KEY, JSON.stringify(rows.sort((a, b) => b.submittedAt - a.submittedAt).slice(0, LIMIT)));
}
export function listTransactions(storage, owner) {
  if (owner != null && !ADDRESS.test(owner)) return [];
  const rows = records(storage);
  return owner ? rows.filter((r) => r.owner === owner) : rows;
}
export function assertNoPendingDuplicate(storage, candidate, now = Date.now()) {
  const rows = records(storage);
  for (const row of rows) {
    // Never auto-release an unknown submission merely because time passed.
    if (row.status !== 'pending') continue;
    if (row.owner === candidate.owner && row.kind === candidate.kind &&
        row.asset === candidate.asset && row.destination === candidate.destination &&
        row.amountRaw === String(candidate.amountRaw)) {
      throw new Error('A matching transfer may already be on-chain (' + row.signature + '). Check its status before signing again.');
    }
  }
}
export function recordSubmission(storage, candidate, now = Date.now()) {
  const { signature, owner, kind, asset, destination } = candidate;
  const amountRaw = String(candidate.amountRaw);
  if (!SIGNATURE.test(signature) || !ADDRESS.test(owner) || !KINDS.has(kind) ||
      typeof asset !== 'string' || !asset || typeof destination !== 'string' || !destination ||
      !/^\d+$/.test(amountRaw) || BigInt(amountRaw) <= 0n ||
      !Number.isSafeInteger(now) || now <= 0) {
    throw new Error('Invalid transaction metadata. Check the submitted signature on-chain.');
  }
  const rows = records(storage);
  const existing = rows.find((r) => r.signature === signature);
  if (existing) {
    if (existing.owner !== owner || existing.amountRaw !== amountRaw) throw new Error('Conflicting signature metadata.');
    return existing;
  }
  const entry = { signature, owner, kind, asset, destination, amountRaw, submittedAt: now, checkedAt: now, status: 'pending' };
  try { persist(storage, [entry, ...rows]); }
  catch { throw new Error('Transaction ' + signature + ' was submitted but could not be saved locally. Verify it on-chain before retrying.'); }
  return entry;
}
export function observeTransaction(storage, owner, signature, chainStatus, now = Date.now()) {
  const rows = records(storage);
  const index = rows.findIndex((r) => r.owner === owner && r.signature === signature);
  if (index < 0) return null;
  const old = rows[index];
  if (old.status === 'finalized' || old.status === 'failed') return old;
  let next = old.status;
  if (chainStatus && typeof chainStatus === 'object') {
    if (chainStatus.err != null) next = 'failed';
    else if (chainStatus.err === null && chainStatus.confirmationStatus === 'finalized') next = 'finalized';
    else if (chainStatus.err === null && chainStatus.confirmationStatus === 'confirmed') next = 'confirmed';
  }
  if (old.status === 'confirmed' && next === 'pending') next = 'confirmed';
  const updated = { ...old, status: next, checkedAt: now };
  rows[index] = updated;
  persist(storage, rows);
  return updated;
}
/** One RPC request for up to 20 signatures. Missing or malformed statuses never prove success. */
export async function reconcileTransactions(storage, owner, rpc, now = Date.now()) {
  if (!ADDRESS.test(owner)) return [];
  const open = listTransactions(storage, owner).filter((r) => r.status === 'pending' || r.status === 'confirmed').slice(0, 20);
  if (!open.length) return listTransactions(storage, owner);
  const response = await rpc('getSignatureStatuses', [open.map((r) => r.signature), { searchTransactionHistory: true }]);
  const values = response?.value;
  if (!Array.isArray(values) || values.length !== open.length) return listTransactions(storage, owner);
  open.forEach((r, index) => {
    const status = values[index];
    if (status && typeof status === 'object') observeTransaction(storage, owner, r.signature, status, now);
  });
  return listTransactions(storage, owner);
}
