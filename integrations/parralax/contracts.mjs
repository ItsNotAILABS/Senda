/**
 * Senda <-> PARRALAX boundary. All organism proposals are non-executing.
 * Never infer financial authorization from an organism ID, prompt or model output.
 */
export const ACTIONS = Object.freeze({
  "market.research": { upstream: "/v1/market/research", method: "POST", permission: "research" },
  "risk.evaluate": { upstream: "/v1/risk/evaluate", method: "POST", permission: "risk" },
  "execution.plan": { upstream: "/v1/execution/plan", method: "POST", permission: "plan" },
  "receipt.verify": { upstream: "/v1/receipts/verify", method: "POST", permission: "audit" },
  "clearing.handoff": { upstream: "/v1/clearing/handoff", method: "POST", permission: "clearing", privileged: true },
  "clearing.trade_validate": { upstream: "/v1/clearing/trade-validate", method: "POST", permission: "audit" },
  "clearing.net": { upstream: "/v1/clearing/net", method: "POST", permission: "clearing", privileged: true },
  "clearing.margin_evaluate": { upstream: "/v1/clearing/margin-evaluate", method: "POST", permission: "risk" },
  "clearing.settlement_plan": { upstream: "/v1/clearing/settlement-plan", method: "POST", permission: "plan" },
  "clearing.receipt_verify": { upstream: "/v1/clearing/receipt-verify", method: "POST", permission: "audit" },
  "clearing.ledger_snapshot": { upstream: "/v1/clearing/ledger-snapshot", method: "POST", permission: "audit" }
});
export const DENIED_ACTIONS = Object.freeze([
  "execution.submit","execution.sign","wallet.transfer","wallet.sign",
  "clearing.settle","collateral.withdraw","cover.payout","agent.delegate"
]);
export function isRecord(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
export function validId(x) { return typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x); }
export function validProposal(x) {
  return isRecord(x) && validId(x.requestId) && validId(x.organismId) &&
    typeof x.action === "string" && Object.hasOwn(ACTIONS, x.action) &&
    isRecord(x.payload) && JSON.stringify(x.payload).length <= 65536;
}
export function publicCapabilities() {
  return Object.entries(ACTIONS).map(([name, spec]) => ({
    name, permission: spec.permission, mode: spec.privileged ? "operator-review" : "upstream-required",
    upstreamRequired: true
  }));
}
