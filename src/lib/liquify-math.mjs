/** Exact raw-unit analysis for quote-size curves. Never infer liquidity from market cap or fake books. */
const validRaw = (x) => typeof x === "string" && /^[1-9][0-9]*$/.test(x) && x.length < 80;

export function rawToUi(raw, decimals) {
  if (!validRaw(raw) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
  const n = BigInt(raw);
  const scale = 10n ** BigInt(decimals);
  const integer = n / scale;
  const frac = n % scale;
  const digits = decimals > 0 ? String(frac).padStart(decimals, "0").replace(/0+$/, "") : "";
  return String(integer) + (digits ? "." + digits : "");
}

export function describeCurve(sizes, decimals) {
  if (!Array.isArray(sizes)) return [];
  const mapped = sizes.map((row) => {
    const raw = row?.quote?.outAmount;
    const output = rawToUi(raw, decimals);
    const num = output == null ? null : Number(output);
    const usd = row?.usd;
    const usdPerToken = num != null && Number.isFinite(num) && num > 0 && Number.isFinite(usd) && usd > 0 ? usd / num : null;
    return {
      usd,
      status: row?.status === "available" && usdPerToken != null ? "available" : "unavailable",
      tokens: output,
      usdPerToken,
      router: row?.quote?.router ?? null,
      feeBps: row?.quote?.feeBps ?? null,
      impactPct: row?.quote?.impactPct ?? null,
      reason: row?.reason ?? null,
    };
  });
  const first = mapped.find((x) => x.status === "available");
  return mapped.map((row) => ({
    ...row,
    executionPremiumPct: row.usdPerToken != null && first?.usdPerToken != null ? (row.usdPerToken / first.usdPerToken - 1) * 100 : null,
  }));
}

export function curveCoverage(rows) {
  const n = Array.isArray(rows) ? rows : [];
  const actual = n.filter((x) => x.status === "available" && x.quote && validRaw(x.quote.outAmount));
  return {
    available: actual.length,
    total: n.length,
    maxQuotedUsd: actual.reduce((a, b) => Math.max(a, b.usd), 0),
    hasRoutableSize: actual.length > 0,
  };
}

/** A Jupiter quote body, checked. A missing router is not a failed quote. A different mint is. */
export function quoteFromJupiter(raw, amount, expect) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.errorCode != null || raw.errorMessage != null || raw.error) return null;
  if (raw.inAmount != null && String(raw.inAmount) !== String(amount)) return null;
  if (expect?.outputMint && raw.outputMint != null && String(raw.outputMint) !== expect.outputMint) return null;
  if (expect?.inputMint && raw.inputMint != null && String(raw.inputMint) !== expect.inputMint) return null;
  const out = String(raw.outAmount ?? "");
  if (!/^[1-9][0-9]{0,39}$/.test(out)) return null;
  const labels = Array.isArray(raw.routePlan)
    ? raw.routePlan.map((step) => step?.swapInfo?.label).filter((label) => typeof label === "string" && label.trim()).slice(0, 6)
    : [];
  const named = typeof raw.router === "string" && raw.router.trim() ? raw.router.trim() : labels.join(" → ");
  const fee = Number(raw.feeBps);
  const impact = Number(raw.priceImpactPct);
  const impactPct = Number.isFinite(impact) ? (Math.abs(impact) > 1 ? impact : impact * 100) : null;
  return {
    inAmount: String(amount),
    outAmount: out,
    router: (named || "Jupiter").slice(0, 60),
    mode: typeof raw.mode === "string" ? raw.mode.slice(0, 30) : "quote",
    feeBps: raw.feeBps != null && Number.isFinite(fee) && fee >= 0 && fee <= 10000 ? fee : null,
    impactPct: impactPct != null && Number.isFinite(impactPct) ? Math.round(impactPct * 100) / 100 : null,
    observedAt: new Date().toISOString(),
  };
}
