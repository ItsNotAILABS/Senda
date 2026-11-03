/** Client-side agent authorization: timer ticks may plan, never sign. */
const ACTIONS = new Set(["swap", "pay"]);
const ORDERS = new Set(["market", "limit", "stop"]);
const CENT = 0.000001;

export function approveAgentQueue(env, capUsd, day) {
  const deny = (reason) => { throw new Error(reason + " Nothing was signed."); };
  if (!env || env.armed !== true || !env.queue) deny("The contract is paused or has no queued action.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) deny("Invalid execution date.");
  const { queue } = env;
  const action = env.action || "swap";
  const order = env.order || "market";
  if (!ACTIONS.has(action) || !ORDERS.has(order)) deny("Unsupported contract action or order.");
  if ((queue.action || "swap") !== action || (queue.order || "market") !== order) {
    deny("The queued action differs from the approved contract.");
  }
  if (queue.side !== env.side || (queue.side !== "buy" && queue.side !== "sell")) {
    deny("The queued trade side differs from the contract.");
  }
  if (env.job === "daily" && env.signedOn === day) deny("The daily contract already sent today.");
  const max = Number(env.maxUsd);
  const spent = Number(env.spentUsd ?? 0);
  const requested = Number(queue.usd);
  if (![max, spent, requested, capUsd].every(Number.isFinite) || max <= 0 || spent < 0 || requested <= 0 || capUsd <= 0) {
    deny("Invalid budget or spending history.");
  }
  const remaining = max - spent;
  if (remaining < requested - CENT || requested > capUsd + CENT || remaining <= 0) {
    deny("The queued amount exceeds the contract's remaining budget or wallet cap.");
  }
  if (action === "pay") {
    if (queue.symbol !== "USDC" || typeof env.payTo !== "string" ||
        !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(env.payTo) ||
        (queue.payTo || "") !== env.payTo) {
      deny("The payment recipient or asset differs from the approved contract.");
    }
  } else {
    if (typeof queue.symbol !== "string" || !queue.symbol.trim()) deny("No token was queued.");
    if (Array.isArray(env.symbols) && env.symbols.length &&
        !env.symbols.some((symbol) => symbol.toUpperCase() === queue.symbol.toUpperCase())) {
      deny("The queued token is not in the contract's authorized list.");
    }
    if (order !== "market") {
      const limit = Number(env.limitPx);
      if (!(limit > 0) || !Number.isFinite(limit) || queue.limitPx !== env.limitPx) {
        deny("The trigger price differs from the approved contract.");
      }
    }
  }
  return { action, order, side: queue.side, usd: requested, payTo: action === "pay" ? env.payTo : "" };
}
