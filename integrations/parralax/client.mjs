/** Server-only client. Do not import with public Vite client bundles. */
export function createParralaxClient({ gatewayUrl, callerToken, fetchImpl = globalThis.fetch, timeoutMs = 8000 }) {
  if (!gatewayUrl || !callerToken) throw new Error("Private gateway URL and token required");
  const base = new URL(gatewayUrl);
  if (base.protocol !== "https:" && base.hostname !== "127.0.0.1" && base.hostname !== "localhost")
    throw new Error("Gateway must be HTTPS or localhost");
  async function invoke(path, { method = "GET", principal, body } = {}) {
    const result = await fetchImpl(new URL(path, base), {
      method, headers: {
        "authorization": `Bearer ${callerToken}`, "content-type": "application/json",
        ...(principal ? { "x-senda-principal": principal } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs), redirect: "error"
    });
    const data = await result.json();
    if (!result.ok) throw new Error(data?.error || `Gateway HTTP ${result.status}`);
    return data;
  }
  return {
    capabilities: () => invoke("/v1/capabilities"),
    propose: (principal, request) => invoke("/v1/proposals", { method: "POST", principal, body: request })
  };
}
