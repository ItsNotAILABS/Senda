/** A passkey approves this visit. The key stays in the phone. This file stores the credential id only. */

const KEY = "senda.passkey.v1";
const VISIT = "senda.passkey.visit";

export type PasskeyRecord = { id: string; created: number };

export function parsePasskey(raw: string | null): PasskeyRecord | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<PasskeyRecord>;
    if (!p || typeof p.id !== "string" || p.id.length < 8) return null;
    return { id: p.id, created: Number(p.created) || 0 };
  } catch {
    return null;
  }
}

export function passkeyBlocksVisit(record: PasskeyRecord | null, visitId: string): boolean {
  return Boolean(record) && visitId !== record?.id;
}

export function mapPasskeyError(e: unknown, fallback: string): Error {
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError") return new Error("The phone dismissed the passkey. Nothing changed.");
    if (e.name === "InvalidStateError") return new Error("This phone already has that passkey.");
    if (e.name === "NotSupportedError") return new Error("This phone does not offer a passkey.");
    if (e.name === "SecurityError") return new Error("This page cannot ask for a passkey.");
    if (e.name === "AbortError") return new Error("The passkey prompt timed out.");
  }
  if (e instanceof Error && e.message) return e;
  return new Error(fallback);
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64ToBytes(id: string): Uint8Array {
  const pad = id.length % 4 === 0 ? "" : "=".repeat(4 - (id.length % 4));
  const bin = atob(id.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function passkeyReason(): string {
  if (typeof window === "undefined") return "This page cannot ask for a passkey.";
  if (!window.isSecureContext || typeof window.PublicKeyCredential !== "function") {
    return "This page cannot ask for a passkey. Use the https app, or localhost.";
  }
  const host = window.location.hostname;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    return "A passkey needs a hostname. This address is an IP. Open localhost or the https app.";
  }
  return "";
}

export function passkeyAvailable(): boolean {
  return passkeyReason() === "";
}

export function readPasskey(): PasskeyRecord | null {
  if (typeof localStorage === "undefined") return null;
  return parsePasskey(localStorage.getItem(KEY));
}

export function passkeyVisit(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return !passkeyBlocksVisit(readPasskey(), sessionStorage.getItem(VISIT) || "");
}

export function passkeyBlocks(): boolean {
  return passkeyBlocksVisit(readPasskey(), typeof sessionStorage === "undefined" ? "" : sessionStorage.getItem(VISIT) || "");
}

function markVisit(id: string) {
  sessionStorage.setItem(VISIT, id);
}

export function lockPasskeyVisit() {
  sessionStorage.removeItem(VISIT);
}

export function forgetPasskey() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(VISIT);
}

export async function registerPasskey(): Promise<PasskeyRecord> {
  if (!passkeyAvailable()) throw new Error("This page cannot ask for a passkey. Open it on https, or on localhost.");
  if (readPasskey()) throw new Error("A passkey is already on this phone. Unlock it, or forget the id first.");
  const user = crypto.getRandomValues(new Uint8Array(16));
  let cred: Credential | null;
  try {
    cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Senda", id: window.location.hostname },
        user: { id: user, name: "vault", displayName: "Senda vault" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          requireResidentKey: false,
          userVerification: "required",
        },
        attestation: "none",
        timeout: 60_000,
      },
    });
  } catch (e) {
    throw mapPasskeyError(e, "The phone did not create a passkey.");
  }
  if (!(cred instanceof PublicKeyCredential) || cred.rawId.byteLength < 8) throw new Error("The phone did not create a passkey.");
  const row: PasskeyRecord = { id: b64url(new Uint8Array(cred.rawId)), created: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(row));
  markVisit(row.id);
  return row;
}

export async function unlockPasskey(): Promise<PasskeyRecord> {
  const row = readPasskey();
  if (!row) throw new Error("No passkey on this phone.");
  if (!passkeyAvailable()) throw new Error("This page cannot ask for a passkey. Open it on https, or on localhost.");
  let cred: Credential | null;
  try {
    cred = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        userVerification: "required",
        timeout: 60_000,
        allowCredentials: [{ type: "public-key", id: b64ToBytes(row.id) as BufferSource }],
      },
    });
  } catch (e) {
    throw mapPasskeyError(e, "The phone did not approve.");
  }
  if (!(cred instanceof PublicKeyCredential)) throw new Error("The phone did not approve.");
  const got = b64url(new Uint8Array(cred.rawId));
  if (got !== row.id) throw new Error("That was a different passkey.");
  markVisit(row.id);
  return row;
}
