import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deriveRoundTripSellRaw, MAINNET_USDC } from "../src/lib/ecosystem-upgrade-core.mjs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sol = "So11111111111111111111111111111111111111112";
test("a dollar SELL preview uses verified mint quantity rather than 6-decimal USDC quantity", () => {
  const buy = { inputMint:MAINNET_USDC, outputMint:sol, inAmount:"25000000",
    outAmount:"100000000", otherAmountThreshold:"98000000" };
  assert.equal(deriveRoundTripSellRaw(buy,"25000000",sol),"100000000");
  for(const patch of [{inputMint:sol},{outputMint:MAINNET_USDC},{inAmount:"30000000"},
    {otherAmountThreshold:"110000000"},{outAmount:"0"}])
    assert.throws(()=>deriveRoundTripSellRaw({...buy,...patch},"25000000",sol));
});
test("SELL quote path verifies mint precision and uses two exact-mint observations", () => {
  const source = read("src/lib/jup-exec.ts");
  assert.match(source, /verifiedMintDecimals\(mint\)/);
  assert.match(source, /deriveRoundTripSellRaw\(reverse,usdcRaw,mint\)/);
  assert.match(source, /quoteExact\(USDC,mint,usdcRaw\)/);
  assert.match(source, /quoteExact\(inputMint,outputMint,inputRaw\)/);
  assert.match(source, /inputDecimals/);
});
test("ticket respects selected size; quote-only market listings are not fills", () => {
  const ticket = read("src/components/jup-ticket.tsx");
  assert.equal(ticket.includes("usd={25}"),false);
  assert.equal((ticket.match(/usd=\{usd\}/g)||[]).length>=3,true);
  const gate=read("src/lib/quote-gate.ts");
  assert.equal(gate.includes("did not fill"),false);
  assert.equal(gate.includes("names that filled"),false);
});
test("wallet signer stays separate from research quote preparation", () => {
  const quote=read("src/lib/jup-exec.ts");
  for(const primitive of ["sendRawTransaction(", "signTransaction(", "signAndSendTransaction("])
    assert.equal(quote.includes(primitive),false);
  const signer=read("src/lib/jup-sign.ts");
  assert.match(signer,/signRoute/);
});
