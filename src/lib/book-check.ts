/**
 * The swap is checked before a wallet is asked to sign.
 * Every refusal has one source. This is not a formal proof.
 * A quote that clears is the quote that may be signed.
 */

export type BookCode =
  | "CLEARS"
  | "EMPTY_IN"
  | "EMPTY_OUT"
  | "SAME_MINT"
  | "BAD_MINT"
  | "BAD_DECIMALS"
  | "NOT_INTEGER"
  | "MIN_ABOVE_OUT"
  | "IMPACT"
  | "SLIP_HIDDEN"
  | "ROUND_FAVOR"
  | "TRANSFER_FEE"
  | "PAUSED"
  | "FROZEN"
  | "ATA_RENT"
  | "PRIORITY"
  | "DRIFT"
  | "MARK_GAP";

export type FeeSchedule = { bps: number; maxRaw: string };

export type BookTicket = {
  inMint: string;
  outMint: string;
  inRaw: string | number;
  outRaw: string | number;
  minRaw: string | number;
  inDecimals: number;
  outDecimals: number;
  /** Already in percent. 1.5 means one and a half percent. */
  impactPct: number;
  slippageBps?: number;
  /** What the screen said the user pays, in input-token units. USDC means dollars. */
  shownIn?: number;
  /** What the screen said the user receives, in output-token units. */
  shownOut?: number;
  /** Screen price of the output, in input units per output token. */
  mark?: number;
  symbol?: string;
  paused?: boolean;
  /** New token accounts on this mint start frozen. */
  frozenDefault?: boolean;
  fees?: FeeSchedule[];
  needsAta?: boolean;
  solLamports?: number;
  priorityLamports?: number;
  pinnedIn?: string | number;
  pinnedOut?: string | number;
  /** Impact at or under this percent can clear. Default 5. */
  hardImpact?: number;
};

export type BookVerdict = {
  ok: boolean;
  code: BookCode;
  line: string;
  warn: string;
  checks: number;
  inRaw: string;
  outRaw: string;
  minRaw: string;
  netRaw: string;
  feeRaw: string;
  impactPct: number;
  slippageBps: number;
};

export type MintFlags = {
  ok: boolean;
  decimals: number;
  token2022: boolean;
  paused: boolean;
  frozenDefault: boolean;
  fees: FeeSchedule[];
};

const RENT = 2_039_280n;
const SIG = 5_000n;
const PRIORITY_CAP = 10_000_000n;

function rawOf(value: string | number | undefined | null): bigint | null {
  if (typeof value === "bigint") return value >= 0n ? value : null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) return null;
    return BigInt(value);
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function uiToRaw(ui: number, decimals: number): bigint | null {
  if (!Number.isFinite(ui) || ui < 0 || !Number.isInteger(decimals)) return null;
  const text = ui.toFixed(decimals);
  const [whole, frac = ""] = text.split(".");
  const digits = `${whole}${frac}`.replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(digits)) return null;
  return BigInt(digits);
}

/** Fee rounds up. A floor would leave a unit on the table. */
export function feeCeil(amount: bigint, bps: number, maxRaw: string): bigint {
  if (amount <= 0n || !Number.isInteger(bps) || bps <= 0) return 0n;
  const uncapped = (amount * BigInt(bps) + 9_999n) / 10_000n;
  const cap = rawOf(maxRaw);
  const fee = cap != null && cap < uncapped ? cap : uncapped;
  return fee > amount ? amount : fee;
}

function feeFloor(amount: bigint, bps: number, maxRaw: string): bigint {
  if (amount <= 0n || !Number.isInteger(bps) || bps <= 0) return 0n;
  const uncapped = (amount * BigInt(bps)) / 10_000n;
  const cap = rawOf(maxRaw);
  const fee = cap != null && cap < uncapped ? cap : uncapped;
  return fee > amount ? amount : fee;
}

function worseFee(amount: bigint, fees: FeeSchedule[] | undefined): { ceil: bigint; floor: bigint; bps: number } {
  let ceil = 0n;
  let floor = 0n;
  let bps = 0;
  for (const fee of fees ?? []) {
    if (!Number.isInteger(fee.bps) || fee.bps <= 0) continue;
    const up = feeCeil(amount, fee.bps, fee.maxRaw);
    if (up >= ceil) {
      ceil = up;
      floor = feeFloor(amount, fee.bps, fee.maxRaw);
      bps = fee.bps;
    }
  }
  return { ceil, floor, bps };
}

function fail(
  code: BookCode,
  line: string,
  checks: number,
  parts: { inRaw: bigint; outRaw: bigint; minRaw: bigint; netRaw: bigint; feeRaw: bigint; impactPct: number; slippageBps: number },
): BookVerdict {
  return {
    ok: false,
    code,
    line,
    warn: "",
    checks,
    inRaw: parts.inRaw.toString(),
    outRaw: parts.outRaw.toString(),
    minRaw: parts.minRaw.toString(),
    netRaw: parts.netRaw.toString(),
    feeRaw: parts.feeRaw.toString(),
    impactPct: parts.impactPct,
    slippageBps: parts.slippageBps,
  };
}

export function checkBook(ticket: BookTicket): BookVerdict {
  let checks = 0;
  const hard = ticket.hardImpact != null && ticket.hardImpact > 0 ? ticket.hardImpact : 5;
  const slip = ticket.slippageBps != null ? ticket.slippageBps : 100;
  const impact = Number(ticket.impactPct);
  const blank = { inRaw: 0n, outRaw: 0n, minRaw: 0n, netRaw: 0n, feeRaw: 0n, impactPct: Number.isFinite(impact) ? impact : 0, slippageBps: slip };
  const name = ticket.symbol ? ` for ${ticket.symbol}` : "";

  checks += 1;
  const inMint = ticket.inMint || "";
  const outMint = ticket.outMint || "";
  if (inMint.length < 32 || outMint.length < 32 || inMint.length > 48 || outMint.length > 48) {
    return fail("BAD_MINT", "That mint address is not a Solana mint. Nothing was sent.", checks, blank);
  }
  checks += 1;
  if (inMint === outMint) {
    return fail("SAME_MINT", "That pair is the same mint twice. Nothing was sent.", checks, blank);
  }
  checks += 1;
  const decOk = (n: number) => Number.isInteger(n) && n >= 0 && n <= 18;
  if (!decOk(ticket.inDecimals) || !decOk(ticket.outDecimals)) {
    return fail("BAD_DECIMALS", "The decimals on this mint are not usable. Nothing was sent.", checks, blank);
  }

  checks += 1;
  const inRaw = rawOf(ticket.inRaw);
  const outRaw = rawOf(ticket.outRaw);
  const minRaw = rawOf(ticket.minRaw);
  if (inRaw == null || outRaw == null || minRaw == null) {
    return fail("NOT_INTEGER", "An amount is not a whole token unit. Nothing was sent.", checks, blank);
  }
  const base = { ...blank, inRaw, outRaw, minRaw };
  checks += 1;
  if (inRaw <= 0n) return fail("EMPTY_IN", "The amount in is zero. Nothing was sent.", checks, base);
  checks += 1;
  if (outRaw <= 0n) return fail("EMPTY_OUT", "The quote pays nothing out. Nothing was sent.", checks, base);

  checks += 1;
  if (ticket.paused) return fail("PAUSED", "The issuer has paused this mint. A swap cannot land.", checks, base);
  checks += 1;
  if (ticket.frozenDefault) {
    return fail("FROZEN", "New accounts on this mint start frozen. The tokens could not move. Nothing was sent.", checks, base);
  }

  checks += 1;
  if (minRaw > outRaw) return fail("MIN_ABOVE_OUT", "The minimum is above the quote. That swap cannot land.", checks, base);
  checks += 1;
  if (!Number.isFinite(impact) || impact > hard) {
    const shown = Number.isFinite(impact) ? impact.toFixed(2) : "unknown";
    return fail("IMPACT", `Price impact is ${shown}%. Above the ${hard}% cap. Nothing was sent.`, checks, base);
  }
  checks += 1;
  if (!Number.isInteger(slip) || slip < 0 || slip > 5_000) {
    return fail("SLIP_HIDDEN", "The slippage on screen is not a real bound. Nothing was sent.", checks, base);
  }
  const floor = (outRaw * BigInt(10_000 - slip)) / 10_000n;
  if (minRaw + 1n < floor) {
    return fail("SLIP_HIDDEN", "The minimum is further below the quote than the slippage on screen. Nothing was sent.", checks, base);
  }

  checks += 1;
  if (ticket.shownIn != null) {
    const shown = uiToRaw(ticket.shownIn, ticket.inDecimals);
    if (shown != null && inRaw > shown + 1n) {
      return fail("ROUND_FAVOR", `The quote charges more${name} than the size on screen. Nothing was sent.`, checks, base);
    }
  }
  if (ticket.shownOut != null) {
    const shown = uiToRaw(ticket.shownOut, ticket.outDecimals);
    if (shown != null && shown > outRaw + 1n) {
      return fail("ROUND_FAVOR", `The screen shows more${name} than the quote pays. Nothing was sent.`, checks, base);
    }
  }

  checks += 1;
  const fee = worseFee(outRaw, ticket.fees);
  if (fee.ceil > fee.floor && outRaw - fee.ceil < minRaw && outRaw - fee.floor >= minRaw) {
    const extra = fee.ceil - fee.floor;
    return fail(
      "TRANSFER_FEE",
      `The transfer fee rounds up by ${extra.toString()} unit${extra === 1n ? "" : "s"} and that crosses the floor. Nothing was sent.`,
      checks,
      { ...base, feeRaw: fee.ceil, netRaw: outRaw - fee.ceil },
    );
  }

  checks += 1;
  if (ticket.needsAta && ticket.solLamports != null) {
    const have = rawOf(Math.max(0, Math.floor(ticket.solLamports)));
    if (have != null && have < RENT + SIG) {
      return fail("ATA_RENT", "Opening the token account needs about 0.002 SOL. This wallet does not have it.", checks, { ...base, feeRaw: fee.ceil, netRaw: outRaw - fee.ceil });
    }
  }

  checks += 1;
  if (ticket.priorityLamports != null) {
    const tip = rawOf(Math.max(0, Math.floor(ticket.priorityLamports)));
    if (tip != null && tip > PRIORITY_CAP) {
      return fail("PRIORITY", "The priority fee is over 0.01 SOL. The wallet was not asked to sign.", checks, { ...base, feeRaw: fee.ceil, netRaw: outRaw - fee.ceil });
    }
  }

  checks += 1;
  const pinnedIn = ticket.pinnedIn != null ? rawOf(ticket.pinnedIn) : null;
  const pinnedOut = ticket.pinnedOut != null ? rawOf(ticket.pinnedOut) : null;
  if ((ticket.pinnedIn != null && pinnedIn == null) || (ticket.pinnedOut != null && pinnedOut == null)) {
    return fail("DRIFT", "This is not the quote that was checked. The wallet was not asked to sign.", checks, { ...base, feeRaw: fee.ceil, netRaw: outRaw - fee.ceil });
  }
  if ((pinnedIn != null && (inRaw > pinnedIn + 1n || pinnedIn > inRaw + 1n)) || (pinnedOut != null && (outRaw > pinnedOut + 1n || pinnedOut > outRaw + 1n))) {
    return fail("DRIFT", "This is not the quote that was checked. The wallet was not asked to sign.", checks, { ...base, feeRaw: fee.ceil, netRaw: outRaw - fee.ceil });
  }

  let warn = "";
  if (ticket.mark != null && ticket.mark > 0 && ticket.shownIn != null && ticket.shownIn > 0) {
    const outUi = Number(outRaw) / 10 ** ticket.outDecimals;
    if (outUi > 0) {
      const executed = ticket.shownIn / outUi;
      const gap = ((executed - ticket.mark) / ticket.mark) * 100;
      const room = impact + slip / 100 + 0.5;
      if (Number.isFinite(gap) && gap > room) {
        warn = `This quote is ${gap.toFixed(2)}% worse than the screen price.`;
      }
    }
  }
  if (fee.bps > 0) {
    const feeNote = `This mint can charge ${fee.bps} bps on a transfer, rounded up. That fee is not taken off the floor a second time.`;
    warn = warn ? `${warn} ${feeNote}` : feeNote;
  }

  return {
    ok: true,
    code: "CLEARS",
    line: `This quote clears${name}. The floor holds. The wallet signs this quote.`,
    warn,
    checks,
    inRaw: inRaw.toString(),
    outRaw: outRaw.toString(),
    minRaw: minRaw.toString(),
    netRaw: (outRaw - fee.ceil).toString(),
    feeRaw: fee.ceil.toString(),
    impactPct: impact,
    slippageBps: slip,
  };
}

export type EvalCall = {
  take: boolean;
  code: BookCode;
  line: string;
  ms: number;
  checks: number;
  slipBps: number;
};

/** What an agent does with a quote. A failing check is never a take. */
export function evalQuote(
  verdict: BookVerdict,
  clock: { ms: number; queueImpact?: number },
): EvalCall {
  const ms = Number.isFinite(clock.ms) ? Math.max(1, Math.round(clock.ms)) : 1;
  const out = rawOf(verdict.outRaw) ?? 0n;
  const min = rawOf(verdict.minRaw) ?? 0n;
  const slipBps = out > 0n ? Number(((out - min) * 10_000n) / out) : 0;
  if (!verdict.ok) {
    return { take: false, code: verdict.code, line: `Pass. ${verdict.line}`, ms, checks: verdict.checks, slipBps };
  }
  const cap = clock.queueImpact;
  if (cap != null && cap > 0 && verdict.impactPct > cap) {
    return {
      take: false,
      code: "IMPACT",
      line: `Pass. Price impact is ${verdict.impactPct.toFixed(2)}%. A queue stops at ${cap}%. Nothing was queued.`,
      ms,
      checks: verdict.checks,
      slipBps,
    };
  }
  if (verdict.warn.includes("worse than the screen")) {
    return {
      take: false,
      code: "MARK_GAP",
      line: `Pass. ${verdict.warn} That is more than the impact and the slippage. Nothing was queued.`,
      ms,
      checks: verdict.checks,
      slipBps,
    };
  }
  const extra = verdict.warn ? ` ${verdict.warn}` : "";
  return {
    take: true,
    code: "CLEARS",
    line: `Take. Floor holds. Slippage used ${slipBps} bps. Impact ${verdict.impactPct.toFixed(2)}%. ${verdict.checks} checks. Jupiter answered in ${ms}ms.${extra}`,
    ms,
    checks: verdict.checks,
    slipBps,
  };
}

export type RouteCandidate = { id: string; ok: boolean; netRaw: string; ms: number; line: string };

/** A route that does not clear never wins. Within 1 unit, the faster quote wins. */
export function pickRoute(a: RouteCandidate, b: RouteCandidate): { id: string; line: string } {
  if (!a.ok && !b.ok) return { id: "none", line: a.line };
  if (a.ok && !b.ok) return { id: a.id, line: a.line };
  if (!a.ok && b.ok) return { id: b.id, line: b.line };
  const an = rawOf(a.netRaw) ?? 0n;
  const bn = rawOf(b.netRaw) ?? 0n;
  const diff = an > bn ? an - bn : bn - an;
  if (diff <= 1n) {
    const id = a.ms <= b.ms ? a.id : b.id;
    return { id, line: "Both clear. The amounts match within 1 unit, so the faster quote is the one to sign." };
  }
  return { id: an > bn ? a.id : b.id, line: "Both clear. The quote that pays more, after the fee, is the one to sign." };
}

type Ext = {
  extension?: string;
  state?: {
    paused?: boolean;
    state?: string;
    accountState?: string;
    newerTransferFee?: { transferFeeBasisPoints?: number; maximumFee?: string | number };
    olderTransferFee?: { transferFeeBasisPoints?: number; maximumFee?: string | number };
  };
};

function feeFrom(row: { transferFeeBasisPoints?: number; maximumFee?: string | number } | undefined): FeeSchedule | null {
  const bps = Number(row?.transferFeeBasisPoints);
  if (!Number.isInteger(bps) || bps <= 0) return null;
  const max = row?.maximumFee;
  const maxRaw = typeof max === "number" || typeof max === "string" ? String(max) : "0";
  if (!/^\d+$/.test(maxRaw)) return { bps, maxRaw: "0" };
  return { bps, maxRaw };
}

/** jsonParsed mint account, or the getAccountInfo envelope around it. A missing account is not a zero balance. */
export function parseMintFlags(body: unknown): MintFlags {
  const empty: MintFlags = { ok: false, decimals: 0, token2022: false, paused: false, frozenDefault: false, fees: [] };
  const root = body as {
    result?: { value?: unknown };
    value?: unknown;
    data?: { program?: string; parsed?: { info?: { decimals?: number; extensions?: Ext[] } } };
  };
  const value = (root?.result?.value ?? root?.value ?? (root?.data ? root : null)) as {
    data?: { program?: string; parsed?: { info?: { decimals?: number; extensions?: Ext[] } } };
  } | null;
  const info = value?.data?.parsed?.info;
  if (!info || !Number.isInteger(info.decimals)) return empty;
  const extensions = info.extensions ?? [];
  const paused = extensions.some((row) => row.extension === "pausableConfig" && row.state?.paused === true);
  const frozenDefault = extensions.some((row) => {
    if (row.extension !== "defaultAccountState") return false;
    const state = row.state?.state || row.state?.accountState;
    return state === "frozen";
  });
  const feeExt = extensions.find((row) => row.extension === "transferFeeConfig");
  const fees = [feeFrom(feeExt?.state?.newerTransferFee), feeFrom(feeExt?.state?.olderTransferFee)].filter((row): row is FeeSchedule => !!row);
  return {
    ok: true,
    decimals: info.decimals as number,
    token2022: value?.data?.program === "spl-token-2022",
    paused,
    frozenDefault,
    fees,
  };
}
