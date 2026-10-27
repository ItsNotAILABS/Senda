import { createFileRoute } from "@tanstack/react-router";
import { DESK_FEE_BPS, deskFeeAccount, feeQuoteParam, feeSwapBody } from "@/lib/desk-fee";

const METHODS = new Set([
  "getBalance",
  "getTokenAccountsByOwner",
  "getAccountInfo",
  "getSlot",
  "getTokenAccountBalance",
  "getSignaturesForAddress",
  "getTransaction",
  "getLatestBlockhash",
  "simulateTransaction",
  "sendTransaction",
  "getSignatureStatuses",
  "holdings",
  "jupSwap",
]);

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
const ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const CASH = "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH";
const SOL_MINT = "So11111111111111111111111111111111111111112";

const NAMES: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH: "CASH",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  So11111111111111111111111111111111111111112: "SOL",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "JUP",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "BONK",
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: "WIF",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "RAY",
  PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB: "ANDURIL",
  Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw: "ANTHROPIC",
  PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd: "FIGUREAI",
  PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua: "KALSHI",
  PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S: "NEURALINK",
  PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF: "OPENAI",
  Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP: "POLYMARKET",
  PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh: "SPACEX",
  Pre9atBqkocK1QngFy7Q7zvyQictEFpXdLi6bZ2qnYy: "OURA",
};

type HoldRow = {
  uiAmount?: number | null;
  uiAmountString?: string;
  amount?: string;
  decimals?: number;
  isFrozen?: boolean;
  excludeFromNetWorth?: boolean;
};

const holdCache = new Map<string, { at: number; body: { sol: number; tokens: Array<{ mint: string; symbol: string; ui: number; decimals: number }> } }>();

function rowUi(row: HoldRow): number {
  if (typeof row.uiAmount === "number" && Number.isFinite(row.uiAmount)) return row.uiAmount;
  if (row.uiAmountString) {
    const n = Number(row.uiAmountString);
    if (Number.isFinite(n)) return n;
  }
  if (row.amount && typeof row.decimals === "number") return Number(row.amount) / 10 ** row.decimals;
  return 0;
}

function nativeSol(raw: { uiAmount?: number; uiAmountString?: string; amount?: string }): number {
  const ui = Number(raw.uiAmount);
  if (ui > 0) return ui;
  const text = Number(raw.uiAmountString);
  if (text > 0) return text;
  const rawAmount = Number(raw.amount);
  if (!(rawAmount > 0)) return 0;
  return rawAmount > 1_000 ? rawAmount / 1e9 : rawAmount;
}

function normalizeHoldings(raw: { uiAmount?: number; uiAmountString?: string; amount?: string; tokens?: Record<string, HoldRow[]> }) {
  const sol = nativeSol(raw);
  const tokens: Array<{ mint: string; symbol: string; ui: number; decimals: number }> = [];
  for (const [mint, rows] of Object.entries(raw.tokens ?? {})) {
    if (!Array.isArray(rows)) continue;
    let ui = 0;
    let decimals = 0;
    for (const row of rows) {
      if (!row || row.isFrozen) continue;
      const n = rowUi(row);
      if (!(n > 0)) continue;
      if (row.excludeFromNetWorth && !NAMES[mint]) continue;
      ui += n;
      if (typeof row.decimals === "number") decimals = row.decimals;
    }
    if (!(ui > 0)) continue;
    tokens.push({
      mint,
      symbol: NAMES[mint] || `${mint.slice(0, 4)}…${mint.slice(-4)}`,
      ui,
      decimals,
    });
  }
  const named = (s: string) => !s.includes("…");
  tokens.sort((a, b) => {
    if (a.symbol === "USDC") return -1;
    if (b.symbol === "USDC") return 1;
    if (named(a.symbol) !== named(b.symbol)) return named(a.symbol) ? -1 : 1;
    return b.ui - a.ui;
  });
  return { sol: Number.isFinite(sol) ? sol : 0, tokens: tokens.slice(0, 40) };
}

async function holdings(address: string) {
  const hit = holdCache.get(address);
  if (hit && Date.now() - hit.at < 12_000) return hit.body;
  let last = "Could not read this wallet.";
  for (const url of [
    `https://lite-api.jup.ag/ultra/v1/holdings/${address}`,
    `https://api.jup.ag/ultra/v1/holdings/${address}`,
  ]) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda/1.0" } });
      if (!r.ok) {
        last = `Holdings ${r.status}`;
        continue;
      }
      const body = normalizeHoldings((await r.json()) as { uiAmount?: number; tokens?: Record<string, HoldRow[]> });
      holdCache.set(address, { at: Date.now(), body });
      return body;
    } catch (e) {
      last = e instanceof Error ? e.message : last;
    }
  }
  throw new Error(last);
}

function routePrefs(raw?: string): { slippageBps: number; onlyDirect: boolean; maxImpact: number; feeBps: number } {
  const base = { slippageBps: 100, onlyDirect: false, maxImpact: 5, feeBps: 0 };
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as { slippageBps?: number; onlyDirect?: boolean; maxImpact?: number; feeBps?: number };
    const slippageBps = [30, 50, 80, 100].includes(Number(parsed.slippageBps)) ? Number(parsed.slippageBps) : 100;
    const maxImpact = [0.5, 1, 3, 5].includes(Number(parsed.maxImpact)) ? Number(parsed.maxImpact) : 5;
    const feeBps = deskFeeAccount() && Number(parsed.feeBps) === DESK_FEE_BPS ? DESK_FEE_BPS : 0;
    return { slippageBps, onlyDirect: parsed.onlyDirect === true, maxImpact, feeBps };
  } catch {
    return base;
  }
}

async function jupSwap(owner: string, inputMint: string, outputMint: string, amountRaw: string, prefsRaw?: string) {
  const amount = Math.floor(Number(amountRaw));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount.");
  const prefs = routePrefs(prefsRaw);
  const lane = prefs.onlyDirect ? "&onlyDirectRoutes=true" : "&restrictIntermediateTokens=true";
  const qs = `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${prefs.slippageBps}${lane}${feeQuoteParam(prefs.feeBps)}`;
  let quote: Record<string, unknown> | null = null;
  let last = "Jupiter did not quote.";
  for (const base of ["https://api.jup.ag/swap/v1/quote", "https://lite-api.jup.ag/swap/v1/quote"]) {
    try {
      const r = await fetch(`${base}?${qs}`, { headers: { accept: "application/json" } });
      const text = await r.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (r.ok && parsed.outAmount) {
        const quotedIn = String(parsed.inputMint || "");
        const quotedOut = String(parsed.outputMint || "");
        const inn = Number(parsed.inAmount || 0);
        const impact = Math.abs(Number(parsed.priceImpactPct ?? 0));
        if (quotedIn && quotedIn !== inputMint) throw new Error("The quote is for a different mint.");
        if (quotedOut && quotedOut !== outputMint) throw new Error("The quote pays a different mint.");
        if (inn > 0 && Math.abs(inn - amount) > 1) throw new Error("The quote size does not match the ticket.");
        if (impact > prefs.maxImpact) throw new Error(`Price impact is ${impact.toFixed(1)}%. The wallet was not asked to sign.`);
        quote = parsed;
        break;
      }
      last = r.status === 429 ? "Jupiter is busy. Wait a moment." : String(parsed.error || `Jupiter quote ${r.status}`);
    } catch (e) {
      if (e instanceof Error && /wallet was not asked|different mint|does not match/.test(e.message)) throw e;
      last = "Jupiter did not quote.";
    }
  }
  if (!quote?.outAmount) throw new Error(last);
  let swapTx = "";
  for (const base of ["https://api.jup.ag/swap/v1/swap", "https://lite-api.jup.ag/swap/v1/swap"]) {
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: owner,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          dynamicSlippage: true,
          prioritizationFeeLamports: "auto",
          ...feeSwapBody(prefs.feeBps),
        }),
      });
      const parsed = (await r.json()) as { swapTransaction?: string; error?: string };
      if (parsed.swapTransaction) {
        swapTx = parsed.swapTransaction;
        break;
      }
      if (parsed.error) last = parsed.error;
    } catch {
      last = "Jupiter did not build a transaction.";
    }
  }
  if (!swapTx) throw new Error(last);
  return {
    swapTransaction: swapTx,
    outAmount: String(quote.outAmount),
    inAmount: String(quote.inAmount ?? amount),
    priceImpactPct: String(quote.priceImpactPct ?? "0"),
    inputMint,
    outputMint,
  };
}

export const Route = createFileRoute("/api/chain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { method?: string; params?: unknown[] };
        try {
          body = (await request.json()) as { method?: string; params?: unknown[] };
        } catch {
          return Response.json({ error: "Bad request." }, { status: 400 });
        }
        if (!body.method || !METHODS.has(body.method) || !Array.isArray(body.params) || body.params.length > 6) {
          return Response.json({ error: "That call is not allowed." }, { status: 400 });
        }
        try {
          if (body.method === "holdings") {
            const address = String(body.params[0] ?? "");
            if (!ADDR.test(address)) return Response.json({ error: "That is not a Solana address." }, { status: 400 });
            return Response.json({ result: await holdings(address) });
          }
            if (body.method === "jupSwap") {
            const [owner, inputMint, outputMint, amountRaw] = body.params.map((p) => String(p ?? ""));
            const prefs = body.params[4] != null ? String(body.params[4]) : "";
            const dollar = (m: string) => m === USDC || m === CASH || m === SOL_MINT;
            if (!ADDR.test(owner) || !ADDR.test(inputMint) || !ADDR.test(outputMint)) {
              return Response.json({ error: "That route is not a Solana mint." }, { status: 400 });
            }
            if (!dollar(inputMint) && !dollar(outputMint)) {
              return Response.json({ error: "A buy pays USDC or Phantom CASH. A sell returns USDC." }, { status: 400 });
            }
            return Response.json({ result: await jupSwap(owner, inputMint, outputMint, amountRaw, prefs) });
          }
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "The chain did not answer." }, { status: 502 });
        }
        let last = "The chain did not answer.";
        for (const url of RPCS) {
          try {
            const r = await fetch(url, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: body.method, params: body.params }),
            });
            const j = (await r.json()) as { result?: unknown; error?: { message?: string } };
            if (j.error) {
              last = j.error.message || last;
              continue;
            }
            return Response.json({ result: j.result ?? null });
          } catch (e) {
            last = e instanceof Error ? e.message : last;
          }
        }
        return Response.json({ error: last }, { status: 502 });
      },
    },
  },
});
