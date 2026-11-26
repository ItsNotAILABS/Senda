/**
 * Senda source validation with hashed release evidence.
 * NOT a deployment, external venue validation or custody audit.
 * Run: node scripts/release-certify.mjs
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const output = resolve(process.env.SENDA_EVIDENCE_DIR || join(tmpdir(), "senda-release-evidence"));
mkdirSync(output, { recursive: true });
const sha256 = data => createHash("sha256").update(data).digest("hex");
const exec = (bin, args, cwd = root, timeout = 180000) =>
  spawnSync(bin, args, { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout, env: process.env });
const commit = exec("git", ["rev-parse", "HEAD"]).stdout?.trim() || null;
const steps = [
  { name: "npm-ci", bin: "npm", args: ["ci"], timeout: 300000 },
  { name: "money-tests", bin: "node", args: ["--test",
    "scripts/friend-payments.test.mjs", "scripts/usdc-amount.test.mjs",
    "scripts/spl-instructions.test.mjs", "scripts/journaled-send.test.mjs",
    "scripts/solana-pay-request.test.mjs", "scripts/money-settlement-core.test.mjs",
    "scripts/money-webhook.test.mjs", "scripts/receive-account-auth.test.mjs",
    "scripts/paper-money-policy.test.mjs", "scripts/verified-send-receipt.test.mjs"
  ] },
  { name: "research-tests", bin: "node", args: ["--test",
    "scripts/ecosystem-upgrade.test.mjs", "scripts/jupiter-endpoint-regression.test.mjs",
    "scripts/kalshi-history.test.mjs", "scripts/contingency-analysis.test.mjs"
  ] },
  { name: "typecheck", bin: "npm", args: ["run", "typecheck"] },
  { name: "build-dev", bin: "npm", args: ["run", "build:dev"], timeout: 300000 },
  { name: "liquify-tests", bin: "go", args: ["test", "-race", "./..."],
    cwd: join(root, "services/liquify"), timeout: 300000 },
  { name: "liquify-vet", bin: "go", args: ["vet", "./..."],
    cwd: join(root, "services/liquify") },
  { name: "parralax-client-tests", bin: "node", args: ["--test",
    "integrations/parralax-finance/client.test.mjs",
    "integrations/parralax-treasury/chain-client.test.mjs",
    "integrations/parralax-treasury/treasury-intent.test.mjs"
  ] }
];
const recordedAt = new Date().toISOString();
const results = [];
for (const step of steps) {
  const started = Date.now();
  const result = exec(step.bin, step.args, step.cwd || root, step.timeout);
  const exitCode = result.status === null ? 1 : result.status;
  const log = String(result.stdout || "") + "\n" + String(result.stderr || "");
  const file = join(output, String(results.length + 1).padStart(2, "0") + "-" + step.name + ".log");
  writeFileSync(file, log, { mode: 0o600 });
  results.push({
    gate: step.name,
    state: exitCode === 0 && !result.error ? "PASS" : "FAIL",
    exitCode,
    elapsedMs: Date.now() - started,
    logFile: file,
    logSha256: sha256(log),
    error: result.error ? result.error.code || "EXECUTION_ERROR" : null
  });
  process.stdout.write(step.name + ": " + results.at(-1).state + "\n");
  if (exitCode !== 0 || result.error) break;
}
const allPassed = results.length === steps.length && results.every(x => x.state === "PASS");
const receipt = {
  schema: "senda.release.source-gates.v1",
  createdAt: recordedAt,
  commit,
  node: process.version,
  state: allPassed ? "SOURCE_GATES_PASSED_NOT_PRODUCTION_CERTIFIED" : "BLOCKED",
  plannedGates: steps.map(x => x.name),
  executedGates: results,
  externalProvidersVerified: false,
  liveWalletTransactionVerified: false,
  devnetTreasuryDeployed: false,
  productionDeploymentVerified: false,
  independentSecurityAudit: false
};
const path = join(output, "release-receipt.json");
writeFileSync(path, JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600 });
process.stdout.write("Evidence: " + path + "\n");
if (!allPassed) process.exitCode = 1;
