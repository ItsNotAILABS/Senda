/**
 * Standalone private Senda gateway. Not public/browser-facing and not a signer.
 * Requires mTLS or authenticated private ingress in deployment in addition to shared key.
 */
import http from "node:http";
import { timingSafeEqual, createHash } from "node:crypto";
import { createGateway } from "./gateway.mjs";

function equalKey(a, b) {
  if (!a || !b) return false;
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}
function reply(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(data));
}
export function createServer(config) {
  if (!config?.callerToken || config.callerToken.length < 32) throw new Error("At least 32 characters of caller token are required");
  const gateway = createGateway(config);
  return http.createServer(async (req, res) => {
    const endpoint = new URL(req.url || "/", "http://internal");
    if (req.method === "GET" && endpoint.pathname === "/healthz")
      return reply(res, 200, { service: "senda-parralax-gateway", state: "running", upstreamConfigured: gateway.ready(), executionEnabled: false });
    if (!equalKey(req.headers.authorization?.replace(/^Bearer /, ""), config.callerToken))
      return reply(res, 401, { ok: false, error: "UNAUTHORIZED" });
    if (req.method === "GET" && endpoint.pathname === "/v1/capabilities")
      return reply(res, 200, { schema: "senda.parralax.capabilities.v1", actions: gateway.capabilities() });
    if (req.method !== "POST" || endpoint.pathname !== "/v1/proposals")
      return reply(res, 404, { ok: false, error: "NOT_FOUND" });
    let body = ""; let overflow = false;
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 70000) { overflow = true; break; }
    }
    if (overflow) return reply(res, 413, { ok: false, error: "PAYLOAD_TOO_LARGE" });
    let proposal;
    try { proposal = JSON.parse(body); } catch { return reply(res, 400, { ok: false, error: "INVALID_JSON" }); }
    const principal = req.headers["x-senda-principal"];
    const result = await gateway.call(proposal, principal);
    return reply(res, result.status, result);
  });
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  let approvedOrganisms = {};
  try { approvedOrganisms = JSON.parse(process.env.SENDA_ORGANISM_PERMISSIONS_JSON || "{}"); }
  catch { throw new Error("Invalid SENDA_ORGANISM_PERMISSIONS_JSON"); }
  const server = createServer({
    callerToken: process.env.SENDA_GATEWAY_CALLER_TOKEN,
    upstreamUrl: process.env.PARRALAX_UPSTREAM_URL,
    upstreamToken: process.env.PARRALAX_UPSTREAM_TOKEN,
    approvedOrganisms,
    audit: (event) => process.stdout.write(JSON.stringify({ kind: "gateway-audit", ...event }) + "\n")
  });
  server.listen(Number(process.env.PORT || 8787), process.env.HOST || "127.0.0.1");
}
