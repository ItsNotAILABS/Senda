import test from "node:test";
import assert from "node:assert/strict";
import { createGateway } from "./gateway.mjs";
import { ACTIONS, DENIED_ACTIONS, validProposal } from "./contracts.mjs";
const base = { requestId: "request-1", organismId: "organism-1", action: "market.research", payload: { mint: "SOL" } };
const fakeResponse = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });
test("enumerates all declared capabilities", () => assert.equal(Object.keys(ACTIONS).length, 11));
test("all dangerous actions fail schema validation", () => {
  for (const action of DENIED_ACTIONS) assert.equal(validProposal({ ...base, action }), false);
});
test("requires explicit organism permission", async () => {
  const g = createGateway({ upstreamUrl: "https://parralax.example", upstreamToken: "server-token", approvedOrganisms: {} });
  assert.equal((await g.call(base, "owner-1")).error, "ORGANISM_PERMISSION_DENIED");
});
test("refuses missing upstream instead of fabricating data", async () => {
  const g = createGateway({ approvedOrganisms: { "organism-1": ["research"] } });
  assert.equal((await g.call(base, "owner-1")).error, "UPSTREAM_UNAVAILABLE");
});
test("refuses privileged clearing handoff even if permission granted", async () => {
  const g = createGateway({ upstreamUrl: "https://parralax.example", upstreamToken: "token", approvedOrganisms: { "organism-1": ["clearing"] } });
  assert.equal((await g.call({ ...base, action: "clearing.handoff" }, "owner-1")).error, "OPERATOR_REVIEW_REQUIRED");
});
test("forwards permitted research without exposing token in response", async () => {
  let captured;
  const g = createGateway({
    upstreamUrl: "https://parralax.example", upstreamToken: "private-token",
    approvedOrganisms: { "organism-1": ["research"] },
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return fakeResponse({ schema: "parralax.response.v1", requestId: "request-1", status: "accepted", artifactId: "artifact-1" });
    }
  });
  const result = await g.call(base, "owner-1");
  assert.equal(result.ok, true);
  assert.equal(result.financialExecution, false);
  assert.equal(captured.url, "https://parralax.example/v1/market/research");
  assert.equal(captured.options.headers.authorization, "Bearer private-token");
  assert.equal(JSON.stringify(result).includes("private-token"), false);
});
test("rejects mismatched upstream request", async () => {
  const g = createGateway({ upstreamUrl: "https://parralax.example", upstreamToken: "token", approvedOrganisms: { "organism-1": ["risk"] },
    fetchImpl: async () => fakeResponse({ schema: "parralax.response.v1", requestId: "not-the-request" }) });
  assert.equal((await g.call({ ...base, action: "risk.evaluate" }, "owner-1")).error, "UPSTREAM_CONTRACT_MISMATCH");
});
test("rejects transport errors", async () => {
  const g = createGateway({ upstreamUrl: "https://parralax.example", upstreamToken: "token", approvedOrganisms: { "organism-1": ["research"] },
    fetchImpl: async () => { throw Error("network down"); } });
  assert.equal((await g.call(base, "owner-1")).error, "UPSTREAM_TRANSPORT_ERROR");
});
test("fails on missing principal", async () => {
  const g = createGateway();
  assert.equal((await g.call(base, "")).error, "INVALID_PRINCIPAL");
});
test("rejects non-HTTPS upstream", () => assert.throws(() => createGateway({ upstreamUrl: "http://example.com", upstreamToken: "token" }), /HTTPS/));
test("rejects malformed and oversized payloads", () => {
  assert.equal(validProposal({ ...base, payload: [] }), false);
  assert.equal(validProposal({ ...base, payload: { huge: "x".repeat(70000) } }), false);
});
