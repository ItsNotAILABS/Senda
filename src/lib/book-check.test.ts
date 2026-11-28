import assert from "node:assert/strict";
import test from "node:test";
import { checkBook, evalQuote, parseMintFlags, pickRoute } from "./book-check.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

const clear = {
  inMint: USDC,
  outMint: SOL,
  inRaw: "5000000",
  outRaw: "1000000000",
  minRaw: "990000000",
  inDecimals: 6,
  outDecimals: 9,
  impactPct: 0.2,
  slippageBps: 100,
  shownIn: 5,
  symbol: "SOL",
};

test("a valid swap clears and names the coin", () => {
  const row = checkBook(clear);
  assert.equal(row.ok, true);
  assert.equal(row.code, "CLEARS");
  assert.match(row.line, /clears for SOL/);
  assert.equal(row.netRaw, row.outRaw);
  assert.ok(row.checks >= 12);
});

test("every refusal has one source", () => {
  assert.equal(checkBook({ ...clear, outMint: USDC }).code, "SAME_MINT");
  assert.equal(checkBook({ ...clear, inMint: "short" }).code, "BAD_MINT");
  assert.equal(checkBook({ ...clear, outDecimals: 19 }).code, "BAD_DECIMALS");
  assert.equal(checkBook({ ...clear, inRaw: "1.5" }).code, "NOT_INTEGER");
  assert.equal(checkBook({ ...clear, inRaw: "0" }).code, "EMPTY_IN");
  assert.equal(checkBook({ ...clear, outRaw: "0", minRaw: "0" }).code, "EMPTY_OUT");
  assert.equal(checkBook({ ...clear, paused: true }).code, "PAUSED");
  assert.equal(checkBook({ ...clear, frozenDefault: true }).code, "FROZEN");
  assert.equal(checkBook({ ...clear, minRaw: "1000000001" }).code, "MIN_ABOVE_OUT");
  assert.equal(checkBook({ ...clear, impactPct: 5.1 }).code, "IMPACT");
  assert.match(checkBook({ ...clear, impactPct: 5.1 }).line, /5\.10%/);
  assert.equal(checkBook({ ...clear, minRaw: "900000000" }).code, "SLIP_HIDDEN");
  assert.equal(checkBook({ ...clear, shownOut: 1.1, outDecimals: 9 }).code, "ROUND_FAVOR");
  assert.equal(checkBook({ ...clear, shownIn: 4 }).code, "ROUND_FAVOR");
  assert.equal(checkBook({ ...clear, needsAta: true, solLamports: 1000 }).code, "ATA_RENT");
  assert.equal(checkBook({ ...clear, priorityLamports: 10_000_001 }).code, "PRIORITY");
  assert.equal(checkBook({ ...clear, pinnedOut: "1000000500" }).code, "DRIFT");
});

test("one raw unit of drift still clears", () => {
  const row = checkBook({ ...clear, pinnedOut: "1000000001", priorityLamports: 10_000_000, needsAta: true, solLamports: 3_000_000 });
  assert.equal(row.code, "CLEARS");
});

test("a transfer fee that rounds up across the floor is refused", () => {
  const row = checkBook({
    ...clear,
    outRaw: "10001",
    minRaw: "10000",
    outDecimals: 0,
    slippageBps: 0,
    shownIn: undefined,
    fees: [{ bps: 1, maxRaw: "100000" }],
  });
  assert.equal(row.code, "TRANSFER_FEE");
  assert.match(row.line, /rounds up by 1 unit/);
});

test("a fee that does not cross the floor is named, not refused", () => {
  const row = checkBook({ ...clear, fees: [{ bps: 50, maxRaw: "100000000000" }] });
  assert.equal(row.ok, true);
  assert.match(row.warn, /50 bps/);
  assert.notEqual(row.feeRaw, "0");
});

test("an agent passes on a named failure and takes a clear quote", () => {
  const bad = evalQuote(checkBook({ ...clear, impactPct: 9 }), { ms: 40, queueImpact: 1 });
  assert.equal(bad.take, false);
  assert.equal(bad.code, "IMPACT");
  assert.match(bad.line, /^Pass\./);
  const good = evalQuote(checkBook(clear), { ms: 40, queueImpact: 1 });
  assert.equal(good.take, true);
  assert.match(good.line, /40ms/);
  assert.equal(good.slipBps, 100);
});

test("a queue stops at 1% even when the quote itself cleared", () => {
  const row = evalQuote(checkBook({ ...clear, impactPct: 2, hardImpact: 5 }), { ms: 12, queueImpact: 1 });
  assert.equal(row.take, false);
  assert.equal(row.code, "IMPACT");
  assert.match(row.line, /stops at 1%/);
});

test("a quote far through the screen is not a take", () => {
  const row = evalQuote(checkBook({ ...clear, mark: 1, shownIn: 5, outRaw: "1000000000", outDecimals: 9 }), { ms: 8, queueImpact: 1 });
  assert.equal(row.code, "MARK_GAP");
  assert.equal(row.take, false);
});

test("the higher net wins, and a tie takes the faster quote", () => {
  const more = pickRoute(
    { id: "a", ok: true, netRaw: "10", ms: 5, line: "a" },
    { id: "b", ok: true, netRaw: "40", ms: 90, line: "b" },
  );
  assert.equal(more.id, "b");
  assert.match(more.line, /pays more/);
  const tie = pickRoute(
    { id: "a", ok: true, netRaw: "10", ms: 5, line: "a" },
    { id: "b", ok: true, netRaw: "11", ms: 90, line: "b" },
  );
  assert.equal(tie.id, "a");
  assert.match(tie.line, /faster/);
  const only = pickRoute(
    { id: "a", ok: false, netRaw: "99", ms: 1, line: "no" },
    { id: "b", ok: true, netRaw: "1", ms: 80, line: "yes" },
  );
  assert.equal(only.id, "b");
  const none = pickRoute(
    { id: "a", ok: false, netRaw: "1", ms: 1, line: "no" },
    { id: "b", ok: false, netRaw: "2", ms: 1, line: "also" },
  );
  assert.equal(none.id, "none");
});

test("a paused Token-2022 mint keeps its fee and is not a classic mint", () => {
  const row = parseMintFlags({
    value: {
      data: {
        program: "spl-token-2022",
        parsed: {
          info: {
            decimals: 6,
            extensions: [
              { extension: "pausableConfig", state: { paused: true } },
              { extension: "defaultAccountState", state: { state: "frozen" } },
              {
                extension: "transferFeeConfig",
                state: {
                  newerTransferFee: { transferFeeBasisPoints: 25, maximumFee: "1000" },
                  olderTransferFee: { transferFeeBasisPoints: 100, maximumFee: "5000" },
                },
              },
            ],
          },
        },
      },
    },
  });
  assert.equal(row.ok, true);
  assert.equal(row.token2022, true);
  assert.equal(row.paused, true);
  assert.equal(row.frozenDefault, true);
  assert.equal(row.fees.length, 2);
  assert.equal(row.fees[0]?.bps, 25);
});

test("a missing mint is not a zero-decimal token", () => {
  const row = parseMintFlags({ result: { value: null } });
  assert.equal(row.ok, false);
  assert.equal(row.paused, false);
});
