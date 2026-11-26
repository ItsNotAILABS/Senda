import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=readFileSync(new URL("../src/components/live-agent.tsx",import.meta.url),"utf8");
const recovery=readFileSync(new URL("../src/lib/agent-live.ts",import.meta.url),"utf8");

test("legacy agent UI cannot fund browser-key address",()=>{
 assert.ok(!ui.includes("payUsdc("));
 assert.ok(!ui.includes("Fund the old address"));
 assert.ok(!ui.includes("async function fund("));
 assert.match(ui,/Legacy address · deposits disabled/);
});
test("legacy key recovery remains present; agent cannot auto-sign a trade",()=>{
 assert.match(recovery,/export async function agentWithdraw/);
 assert.match(recovery,/sendUsdcFromKey/);
 assert.match(recovery,/export async function agentPass/);
 assert.match(recovery,/cannot sign one/);
});
