/**
 * Wallet-ownership proof for Bridge receive-account issuance, single-use nonces, and
 * Bridge error/timeout handling. Server-side; dependency-free so it is unit-testable.
 */
export const RECEIVE_AUTH_MAX_AGE_MS = 90_000;
export const RECEIVE_AUTH_MAX_SKEW_MS = 5_000;
const NONCE = /^[a-f0-9]{32}$/;

export function receiveAuthorizationMessage({ owner, currency, signedAt, userId, nonce }) {
  return `senda.receive-account:v1:${owner}:${currency}:${signedAt}:${userId}:${nonce}`;
}

function base64ToBytes(b64) {
  if (typeof b64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  try { return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); } catch { return null; }
}

/**
 * Verify a fresh, single-use Phantom Ed25519 signature binding wallet, currency, time, user and nonce.
 * The nonce is consumed only after the signature verifies, so it cannot be burned by a forger.
 */
export async function verifyReceiveAuthorization({ owner, ownerKeyBytes, currency, signedAt, nonce, signature, userId, nonceStore, now = Date.now() }) {
  if (!Number.isSafeInteger(signedAt) || signedAt > now + RECEIVE_AUTH_MAX_SKEW_MS || now - signedAt > RECEIVE_AUTH_MAX_AGE_MS)
    return { ok: false, error: "Wallet authorization expired. Sign again." };
  if (!NONCE.test(String(nonce))) return { ok: false, error: "Wallet authorization is malformed. Sign again." };
  const raw = base64ToBytes(signature);
  if (!raw || raw.length !== 64 || !(ownerKeyBytes instanceof Uint8Array) || ownerKeyBytes.length !== 32)
    return { ok: false, error: "Phantom wallet ownership authorization did not verify." };
  let verified = false;
  try {
    const key = await crypto.subtle.importKey("raw", ownerKeyBytes, { name: "Ed25519" }, false, ["verify"]);
    const message = new TextEncoder().encode(receiveAuthorizationMessage({ owner, currency, signedAt, userId, nonce }));
    verified = await crypto.subtle.verify("Ed25519", key, raw, message);
  } catch { verified = false; }
  if (!verified) return { ok: false, error: "Phantom wallet ownership authorization did not verify." };
  if (!nonceStore || typeof nonceStore.consume !== "function") return { ok: false, error: "Wallet authorization cannot be checked right now." };
  let fresh = false;
  try { fresh = await nonceStore.consume(nonce, signedAt + RECEIVE_AUTH_MAX_AGE_MS + RECEIVE_AUTH_MAX_SKEW_MS, now); }
  catch { return { ok: false, error: "Wallet authorization cannot be checked right now." }; }
  if (!fresh) return { ok: false, error: "This wallet authorization was already used. Sign again." };
  return { ok: true };
}

/** In-process store (tests / single instance only). consume() is true exactly once per unexpired nonce. */
export function createMemoryNonceStore() {
  const used = new Map();
  return {
    async consume(nonce, expiresAt, now = Date.now()) {
      for (const [k, exp] of used) if (exp <= now) used.delete(k);
      if (used.has(nonce)) return false;
      used.set(nonce, expiresAt);
      return true;
    },
  };
}

/**
 * Shared store backed by the app database (survives serverless instances).
 * `query(text, params)` must return rows. Table: migrations/0009_receive_auth_nonce.sql.
 */
export function createSqlNonceStore(query) {
  return {
    async consume(nonce, expiresAt, now = Date.now()) {
      await query("delete from receive_auth_nonce where expires_at < $1", [new Date(now).toISOString()]);
      const rows = await query(
        "insert into receive_auth_nonce (nonce, expires_at) values ($1, $2) on conflict (nonce) do nothing returning nonce",
        [nonce, new Date(expiresAt).toISOString()],
      );
      return Array.isArray(rows) && rows.length === 1;
    },
  };
}

export const BRIDGE_TIMEOUT_MS = 10_000;

/** fetch with a hard timeout. Throws an Error named "TimeoutError" on expiry. */
export async function fetchWithTimeout(url, init = {}, { timeoutMs = BRIDGE_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(Object.assign(new Error("Bridge request timed out"), { name: "TimeoutError" })), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) throw Object.assign(new Error("Bridge request timed out"), { name: "TimeoutError" });
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Map a Bridge failure to a user-safe message. Provider text, ids and keys never reach the client. */
export function bridgeUserError(status) {
  if (status === "timeout") return "The bank partner did not answer in time. Nothing was opened; try again shortly.";
  if (status === "network") return "Could not reach the bank partner. Nothing was opened; try again shortly.";
  if (status === 400 || status === 422) return "The bank partner could not open an account with these details.";
  if (status === 401 || status === 403) return "Bank account provisioning is not available right now.";
  if (status === 404) return "Bank account provisioning is not available for this customer.";
  if (status === 409) return "A matching account request is already in progress. Try again in a moment.";
  if (status === 429) return "The bank partner is busy. Try again in a minute.";
  return "The bank partner could not open the account right now.";
}
