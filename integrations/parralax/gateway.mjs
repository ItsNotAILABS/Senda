import { ACTIONS, DENIED_ACTIONS, validProposal, validId, publicCapabilities } from "./contracts.mjs";
import { createHash } from "node:crypto";

/** The gateway is not an execution engine and never turns model requests into signatures. */
export function createGateway({ upstreamUrl, upstreamToken, fetchImpl = globalThis.fetch, clock = () => Date.now(), timeoutMs = 8000, approvedOrganisms = {}, audit = () => {} } = {}) {
  const url = upstreamUrl ? new URL(upstreamUrl) : null;
  if (url && url.protocol !== "https:" && !(process.env.NODE_ENV === "test" && url.hostname === "127.0.0.1"))
    throw new Error("PARRALAX_UPSTREAM_URL must be HTTPS");
  if (url && (url.username || url.password || url.search || url.hash)) throw new Error("Upstream URL must not contain credentials, query or fragment");
  const basePath = url ? url.pathname.replace(/\/$/, "") : "";
  const configReady = Boolean(url && upstreamToken && typeof upstreamToken === "string");
  const permissionsFor = (id) => approvedOrganisms[id] || [];
  async function call(proposal, principal) {
    const started = clock();
    const digest = createHash("sha256").update(JSON.stringify(proposal)).digest("hex");
    const fail = (code, status = 403) => {
      audit({ requestId: proposal?.requestId, organismId: proposal?.organismId, principal, action: proposal?.action, decision: code, digest, at: started });
      return { ok: false, status, error: code };
    };
    if (!validProposal(proposal)) return fail("INVALID_PROPOSAL", 400);
    if (!validId(principal)) return fail("INVALID_PRINCIPAL", 401);
    if (DENIED_ACTIONS.includes(proposal.action)) return fail("EXECUTION_FORBIDDEN");
    const spec = ACTIONS[proposal.action];
    if (spec.privileged) return fail("OPERATOR_REVIEW_REQUIRED");
    if (!permissionsFor(proposal.organismId).includes(spec.permission)) return fail("ORGANISM_PERMISSION_DENIED");
    if (!configReady) return fail("UPSTREAM_UNAVAILABLE", 503);
    const target = new URL(basePath + spec.upstream, url.origin);
    try {
      const response = await fetchImpl(target, {
        method: spec.method,
        headers: {
          "content-type": "application/json", "authorization": `Bearer ${upstreamToken}`,
          "x-senda-request-id": proposal.requestId,
          "x-senda-organism-id": proposal.organismId,
          "x-senda-principal": principal,
          "x-senda-payload-sha256": digest
        },
        body: JSON.stringify({
          schema: "senda.parralax.request.v1", requestId: proposal.requestId,
          organismId: proposal.organismId, principal, action: proposal.action,
          payload: proposal.payload, requestedAt: new Date(started).toISOString()
        }),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error"
      });
      const raw = await response.text();
      if (raw.length > 262144) return fail("UPSTREAM_RESPONSE_TOO_LARGE", 502);
      let data; try { data = JSON.parse(raw); } catch { return fail("UPSTREAM_INVALID_JSON", 502); }
      if (!response.ok) return fail("UPSTREAM_REJECTED", 502);
      if (!data || typeof data !== "object" || data.requestId !== proposal.requestId || data.schema !== "parralax.response.v1")
        return fail("UPSTREAM_CONTRACT_MISMATCH", 502);
      audit({ requestId: proposal.requestId, organismId: proposal.organismId, principal, action: proposal.action, decision: "UPSTREAM_ACKNOWLEDGED", digest, at: clock() });
      return { ok: true, status: 200, data, provenance: "parralax-upstream", financialExecution: false };
    } catch {
      return fail("UPSTREAM_TRANSPORT_ERROR", 502);
    }
  }
  return {
    ready: () => configReady,
    capabilities: publicCapabilities,
    call
  };
}
