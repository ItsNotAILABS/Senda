/**
 * Senda tools an agent can call without a key.
 * A buy, a pay, and a cover still need the person's wallet to sign.
 * These functions quote, read, and describe. They do not submit a transaction.
 */

import { CHAINS, SOLANA_MORE, SOL_MINT, USDC_MAINNET, mapChains, mapSolana } from "../src/lib/chain-tape-map.mjs";
import { clearingPosture } from "../src/lib/clearing-posture.mjs";
import { GIFT_WINDOWS, giftOpen } from "../src/lib/gift-link.mjs";
import { FILL_PROBE_USD, fillsAtProductionSlippage } from "../src/lib/jup-fill.mjs";
import {
  EVM_CHAINS,
  EVM_MARKETS,
  balanceOfCall,
  decodeBalance,
  evmMarketFor,
  pairAllowed,
  quoteIsSane,
  rawAmount,
  readLifi,
  solanaDecimals,
} from "../src/lib/trade-book.mjs";

export const USDC_MINT = USDC_MAINNET;
export const DEVNET_PROGRAM = "4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta";
export const SPEND_DEFAULT = 100;
export const SPEND_MAX = 5000;

const PRESTOCKS = "https://prestocks.com/api/prestocks";
const QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const QUOTE_API = "https://api.jup.ag/swap/v1/quote";
const PRICE = "https://lite-api.jup.ag/price/v3?ids=";
const LIFI = "https://li.quest/v1/quote";
const LLAMA = "https://coins.llama.fi";
const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
const TOKEN_PROGRAMS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
];

/** Same themes as src/lib/basket.ts. One amount, then the wallet signs each filled leg. */
export const BASKETS = [
  { id: "pre8", name: "PRE8", symbols: ["OPENAI", "ANTHROPIC", "SPACEX", "ANDURIL", "KALSHI", "NEURALINK", "FIGUREAI", "POLYMARKET"] },
  { id: "ai", name: "Frontier AI", symbols: ["OPENAI", "ANTHROPIC"] },
  { id: "space", name: "Space + defense", symbols: ["SPACEX", "ANDURIL"] },
  { id: "pred", name: "Prediction", symbols: ["KALSHI", "POLYMARKET"] },
];

export const DESK = [
  { path: "/", name: "Home", does: "The book, a buy, and what the connected wallet holds." },
  { path: "/pre", name: "PreStocks", does: "Live tokenized pre-IPO names. Buy is a Jupiter swap the wallet signs." },
  { path: "/wallet", name: "Convert", does: "SOL or USDC into a name, or the slice back. One route." },
  { path: "/wallets", name: "Wallets", does: "Phantom, Solflare, Backpack, and the other injected wallets. Ethereum is a different signature. Robinhood buying power aims USDC at the Solana address." },
  { path: "/social", name: "Play", does: "Games on the live print. Practice cash never touches the wallet." },
  { path: "/cards", name: "Shop", does: "A desk number shown once, a USDC payment, and a one-time Mastercard only when Commercial Connect is connected." },
  { path: "/make", name: "Make", does: "A listing. The price is USDC. The whole amount goes to the address on the listing." },
  { path: "/agents", name: "AI Agent", does: "An envelope with a cap. It can queue a trade. It cannot sign." },
  { path: "/payments", name: "Send", does: "USDC to a Solana address, a pay link, or one gift link with a 1 hour, 1 day, or 7 day window." },
  { path: "/vault", name: "Portfolio", does: "Token accounts in the wallet, marked at the last print." },
  { path: "/cover", name: "Cover", does: "Premium is 4% of the size. Pays if the print falls 10%. Not a licensed policy. The token stays." },
  { path: "/work", name: "Work", does: "A job paid in USDC to a worker address, or a Solana Pay link they open." },
  { path: "/invest", name: "Trade", does: "Size, side, a Jupiter quote, then the signature. Spot, options, perps, and the rest of the book sit under that ticket." },
  { path: "/equities", name: "Listed", does: "xStocks that filled a $100 Jupiter quote. OpenAI and SpaceX appear as PreStock SPVs only when that quote fills." },
  { path: "/solana", name: "Solana", does: "Live mints. A Solana row is listed after a $100 Jupiter quote fills inside 100 bps. A listed EVM market signs through LI.FI." },
  { path: "/books", name: "Books", does: "The ledger this browser already wrote." },
  { path: "/clearing", name: "Clearing", does: "Mastercard readiness and the PARALLAX receipt rule. No custody and no invented card." },
  { path: "/docs", name: "Docs", does: "The written desk." },
  { path: "/more", name: "Account", does: "Linked addresses and the cash that stays on this browser." },
];

export function rules() {
  return {
    account: "The wallet the person connects is the account. Senda does not custody.",
    sign: "A buy, a pay, a cover premium, and a job payment each ask that wallet to sign.",
    empty: "Do not invent a balance, a card, a position, or a fill.",
    mainnet: "Buys and USDC payments are mainnet Jupiter and SPL. There is no Senda mainnet program.",
    devnet: `The cover program on devnet is ${DEVNET_PROGRAM}. It does not hold the PreStock.`,
    share: "A PreStock is economic exposure, not a legal share, a vote, or a dividend.",
    card: "The shop number is shown once. It is not a Visa or Mastercard BIN. A card terminal will decline it. A one-time Mastercard stays closed until Commercial Connect has its four secrets.",
    list: "A Solana market is listed only after a $100 Jupiter quote fills inside 100 bps.",
    sanity: "A quote more than 5% under the dollars in is not offered.",
    spend: `The browser cap defaults to ${SPEND_DEFAULT} and cannot rise above ${SPEND_MAX}. An agent cannot raise it.`,
    gift: "A gift secret stays in the link hash. Do not send it to this tool or to /api/agent.",
    clearing: "PARALLAX has no deployed receipt address in this repo. This desk does not read a chain head.",
    agent: "An agent may read and queue. It may not sign.",
  };
}

export function spendLimits() {
  return {
    key: "senda.spendcap",
    defaultUsd: SPEND_DEFAULT,
    maxUsd: SPEND_MAX,
    note: "The cap lives in the person's browser. This tool cannot read it or raise it.",
  };
}

function dollars(usd) {
  const amount = Math.round(Number(usd) * 100) / 100;
  if (!(amount > 0)) throw new Error("Enter a USDC amount.");
  if (amount > SPEND_MAX) throw new Error(`That is above the ${SPEND_MAX} cap.`);
  return amount;
}

export function usdcPayLink(to, usd, memo = "Senda") {
  const dest = String(to || "").trim();
  if (dest.length < 32) throw new Error("Paste a Solana address.");
  const amount = dollars(usd);
  const q = new URLSearchParams({
    amount: amount.toFixed(2),
    "spl-token": USDC_MINT,
    memo: String(memo).slice(0, 80),
  });
  return `solana:${dest}?${q.toString()}`;
}

export function coverTerms(last, usd) {
  const print = Number(last);
  const size = dollars(usd);
  if (!(print > 0)) throw new Error("Need a live print.");
  const premium = Math.max(1, Math.round(size * 0.04));
  const trigger = Math.round(print * 0.9 * 1e6) / 1e6;
  return {
    premiumUsdc: premium,
    strike: print,
    paysAtOrUnder: trigger,
    distancePct: 10,
    note: "Premium leaves the wallet when the person signs. Settle is a second signature. Not a licensed policy.",
  };
}

export function giftWindow(args = {}) {
  if (args.secret || args.s) throw new Error("The gift secret stays in the link hash. Do not send it here.");
  const expiresAt = Number(args.expiresAt);
  const now = args.now == null ? Date.now() : Number(args.now);
  return {
    windows: GIFT_WINDOWS,
    open: Number.isFinite(expiresAt) ? giftOpen(now, expiresAt) : null,
    note: "The sender funds a vault. After the window the page will not claim, and the sender can reclaim what is left.",
  };
}

export function markets() {
  const solana = [
    { symbol: "SOL", name: "Solana", mint: SOL_MINT, decimals: 9, sign: "jupiter" },
    ...SOLANA_MORE.filter((row) => row[0] !== "USDC").map(([symbol, name, mint]) => ({
      symbol,
      name,
      mint,
      decimals: solanaDecimals(mint),
      sign: "jupiter",
      note: symbol === "PYUSD" ? "PYUSD can be frozen and uses Token-2022." : undefined,
    })),
  ];
  const evm = EVM_MARKETS.map((row) => ({
    tape: row.tape,
    symbol: row.symbol,
    name: row.name,
    chain: row.chain,
    chainId: row.chainId,
    sign: "lifi",
  }));
  const signedTape = new Set(evm.map((row) => row.tape));
  const priceOnly = CHAINS.filter((row) => !signedTape.has(row[0])).map(([symbol, name, chain]) => ({
    symbol,
    name,
    chain,
    sign: "price",
  }));
  return {
    probeUsd: FILL_PROBE_USD,
    slippageBps: 100,
    solana,
    evm,
    priceOnly,
    note: "A Solana row is listed only after a $100 Jupiter quote fills inside 100 bps. Monad mainnet stays a price. Wrapped MON is the Solana market.",
  };
}

async function getJson(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": "Senda/1.0 (no custody)" },
    });
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function listPrints() {
  const raw = await getJson(PRESTOCKS);
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((r) => {
      const mint = String(r.contract_address || "");
      const last = Number(r.tokenPrice) || Number(r.markPrice) || 0;
      const mark = Number(r.markPrice) || 0;
      if (!mint || !(last > 0 || mark > 0)) return null;
      const premium = mark > 0 ? (last - mark) / mark : null;
      return {
        symbol: String(r.symbol || ""),
        name: String(r.name || ""),
        mint,
        last,
        mark,
        premium,
      };
    })
    .filter(Boolean);
}

async function jupQuote(inputMint, outputMint, amount) {
  const qs = `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100&restrictIntermediateTokens=true`;
  let last = "Jupiter unreachable.";
  for (const base of [QUOTE_API, QUOTE]) {
    try {
      const r = await fetch(`${base}?${qs}`, { headers: { accept: "application/json", "user-agent": "Senda/1.0 (no custody)" } });
      const text = await r.text();
      if (!r.ok) {
        last = r.status === 429 ? "Jupiter is busy. Wait a moment." : `Jupiter ${r.status}`;
        continue;
      }
      const j = JSON.parse(text);
      if (!j.outAmount) {
        last = j.error || "No route.";
        continue;
      }
      return {
        inAmount: String(j.inAmount ?? amount),
        outAmount: String(j.outAmount),
        priceImpactPct: j.priceImpactPct ?? null,
        slippageBps: Number(j.slippageBps ?? 100),
        swapUsdValue: j.swapUsdValue != null ? String(j.swapUsdValue) : null,
        inMint: String(j.inputMint ?? inputMint),
        outMint: String(j.outputMint ?? outputMint),
      };
    } catch (e) {
      last = e instanceof Error && e.name === "AbortError" ? "Jupiter unreachable." : "Jupiter unreachable.";
    }
  }
  throw new Error(last);
}

function asFill(quote, inUsd) {
  return { ...quote, inUsd, slippageBps: quote.slippageBps };
}

async function mintDecimals(mint) {
  if (mint === SOL_MINT) return 9;
  const known = solanaDecimals(mint);
  if (known != null) return known;
  const info = await rpc("getAccountInfo", [mint, { encoding: "jsonParsed" }]);
  const decimals = info?.value?.data?.parsed?.info?.decimals;
  if (!Number.isInteger(decimals)) throw new Error("Need the mint decimals to size a sell.");
  return decimals;
}

export async function quoteSwap({ mint, usd, side }) {
  const token = String(mint || "").trim();
  if (token.length < 32) throw new Error("Need the mint.");
  if (token === USDC_MINT) throw new Error("USDC-to-USDC is not offered.");
  const size = dollars(usd);
  const way = side === "sell" ? "sell" : "buy";
  const book = markets();
  const onSolana = book.solana.some((row) => row.mint === token);
  const prints = onSolana ? [] : await listPrints();
  const prestock = prints.find((row) => row.mint === token);
  if (!onSolana && !prestock) throw new Error("That mint is not on the book.");
  const inputMint = way === "buy" ? USDC_MINT : token;
  const outputMint = way === "buy" ? token : USDC_MINT;
  if (!pairAllowed(inputMint, outputMint, prints.map((row) => row.mint))) {
    throw new Error("That pair is not on the book.");
  }
  let amount;
  if (way === "buy") {
    amount = rawAmount(size, 6).toString();
  } else {
    const decimals = await mintDecimals(token);
    const px = prestock?.last > 0 ? prestock.last : Number((await getJson(`${PRICE}${token}`))?.[token]?.usdPrice);
    if (!(px > 0)) throw new Error("Need a live print to size a sell.");
    amount = rawAmount(size / px, decimals).toString();
  }
  const quote = await jupQuote(inputMint, outputMint, amount);
  const inUsd = way === "buy" ? Number(quote.inAmount) / 1e6 : size;
  const received = Number(quote.swapUsdValue);
  const sane = !(received > 0) || quoteIsSane(inUsd, received);
  const probe = size === FILL_PROBE_USD && way === "buy"
    ? quote
    : await jupQuote(USDC_MINT, token, rawAmount(FILL_PROBE_USD, 6).toString());
  const listed = fillsAtProductionSlippage(asFill(probe, Number(probe.inAmount) / 1e6));
  const thisFill = fillsAtProductionSlippage(asFill(quote, inUsd));
  const outDecimals = way === "buy" ? await mintDecimals(token) : 6;
  return {
    side: way,
    inMint: quote.inMint,
    outMint: quote.outMint,
    inAmount: quote.inAmount,
    outAmount: quote.outAmount,
    out: Number(quote.outAmount) / 10 ** outDecimals,
    priceImpactPct: quote.priceImpactPct,
    slippageBps: quote.slippageBps,
    swapUsdValue: quote.swapUsdValue,
    listed,
    sane,
    offered: Boolean(listed && sane && thisFill),
    sign: "https://jup.ag/swap/" + (way === "buy" ? `${USDC_MINT}-${token}` : `${token}-${USDC_MINT}`),
    note: "This is a quote. The wallet still has to sign the swap. No transaction is in this response.",
  };
}

export async function quoteEvm({ tape, usd, side, tokenRaw }) {
  const market = evmMarketFor(String(tape || "").toUpperCase());
  if (!market) throw new Error("This desk cannot sign that chain.");
  const way = side === "sell" ? "sell" : "buy";
  const size = usd == null && way === "sell" ? null : dollars(usd);
  const cents = Math.round(Number(size) * 100);
  const bought = BigInt(cents) * 10n ** BigInt(Math.max(0, market.usdcDecimals - 2));
  const amount = way === "sell" ? BigInt(String(tokenRaw || "0")) : bought;
  if (amount <= 0n) throw new Error(way === "sell" ? "A sell needs tokenRaw, the raw balance to sell." : "Need a size in dollars.");
  const url = new URL(LIFI);
  url.searchParams.set("fromChain", String(market.chainId));
  url.searchParams.set("toChain", String(market.chainId));
  url.searchParams.set("fromToken", way === "sell" ? market.token : market.usdc);
  url.searchParams.set("toToken", way === "sell" ? market.usdc : market.token);
  url.searchParams.set("fromAmount", amount.toString());
  url.searchParams.set("slippage", "0.01");
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda/1.0 (no custody)" } });
  const text = await res.text();
  if (!res.ok) throw new Error(res.status === 429 ? "LI.FI is busy. Wait a moment." : `LI.FI ${res.status}`);
  const parsed = readLifi(JSON.parse(text));
  if (!parsed) throw new Error("LI.FI did not quote.");
  const sane = quoteIsSane(parsed.fromAmountUSD, parsed.toAmountUSD);
  return {
    tape: market.tape,
    symbol: market.symbol,
    chain: market.chain,
    chainId: market.chainId,
    side: way,
    toAmount: parsed.toAmount,
    toAmountMin: parsed.toAmountMin,
    fromAmountUSD: parsed.fromAmountUSD,
    toAmountUSD: parsed.toAmountUSD,
    approvalAddress: parsed.approvalAddress,
    sane,
    offered: sane,
    note: "Quote only. The wallet signs on this chain. No transaction is in this response.",
  };
}

async function rpc(method, params) {
  let last = "RPC failed";
  for (const url of RPCS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = await r.json();
      if (j.error) {
        last = j.error.message || last;
        continue;
      }
      return j.result;
    } catch (e) {
      last = e instanceof Error ? e.message : last;
    }
  }
  throw new Error(last);
}

function readTokens(classic) {
  const tokens = [];
  for (const row of classic?.value || []) {
    const info = row.account?.data?.parsed?.info;
    const ui = info?.tokenAmount?.uiAmount || 0;
    if (!info?.mint || !(ui > 0)) continue;
    tokens.push({
      mint: info.mint,
      symbol: info.mint === USDC_MINT ? "USDC" : `${info.mint.slice(0, 4)}…${info.mint.slice(-4)}`,
      ui,
    });
  }
  return tokens;
}

export async function readWallet(owner) {
  const address = String(owner || "").trim();
  if (address.length < 32) throw new Error("Need a Solana address.");
  const [lamports, ...accounts] = await Promise.all([
    rpc("getBalance", [address]),
    ...TOKEN_PROGRAMS.map((programId) =>
      rpc("getTokenAccountsByOwner", [address, { programId }, { encoding: "jsonParsed" }]),
    ),
  ]);
  const tokens = accounts.flatMap(readTokens);
  return {
    address,
    sol: (lamports || 0) / 1e9,
    tokens,
    note: "Read from the chain. Senda does not hold this. PYUSD is Token-2022.",
  };
}

export async function readEvm({ tape, chainId, token, owner }) {
  const market = tape ? evmMarketFor(String(tape).toUpperCase()) : null;
  const id = Number(market?.chainId || chainId);
  const chain = EVM_CHAINS[id];
  const asset = String(market?.token || token || "");
  const who = String(owner || "");
  const data = balanceOfCall(who);
  if (!chain || !/^0x[a-fA-F0-9]{40}$/.test(asset) || !data) throw new Error("Need a listed chain and an address.");
  const res = await fetch(chain.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: asset, data }, "latest"] }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const body = await res.json();
  const raw = decodeBalance(body.result).toString();
  const decimals = market?.decimals;
  return {
    chainId: id,
    chain: chain.name,
    token: asset,
    symbol: market?.symbol || null,
    owner: who,
    raw,
    ui: decimals != null ? Number(raw) / 10 ** decimals : null,
    note: "Read from the chain. Senda does not hold this.",
  };
}

export async function chainTape() {
  const mints = SOLANA_MORE.map((row) => row[2]).join(",");
  const ids = CHAINS.map((row) => `coingecko:${row[3]}`).join(",");
  let solana = [];
  let chains = [];
  try {
    solana = mapSolana(await getJson(`${PRICE}${mints}`)).map((row) => ({
      ...row,
      sign: row.symbol === "USDC" ? "hold" : "jupiter",
      listed: null,
    }));
  } catch {
    solana = [];
  }
  try {
    const [prices, changes] = await Promise.all([
      getJson(`${LLAMA}/prices/current/${ids}`),
      getJson(`${LLAMA}/percentage/${ids}`),
    ]);
    chains = mapChains(prices, changes).map((row) => {
      const market = evmMarketFor(row.symbol);
      return { ...row, sign: market ? "lifi" : "price", market: market?.symbol || null };
    });
  } catch {
    chains = [];
  }
  return {
    ok: solana.length + chains.length > 0,
    rows: [...solana, ...chains],
    note: "A price is not a fill. Call quote_swap or quote_evm before telling the person a market can be signed.",
  };
}

const empty = { type: "object", properties: {}, additionalProperties: false };

export const TOOLS = [
  { name: "desk_map", description: "Every Senda page and what a person actually does there.", inputSchema: empty },
  { name: "rules", description: "What Senda will not do. Read this before suggesting a trade, a card, or a balance.", inputSchema: empty },
  { name: "markets", description: "Which markets Jupiter or LI.FI can sign, and which rows stay prices.", inputSchema: empty },
  { name: "baskets", description: "PreStock themes. The wallet signs each filled Jupiter leg.", inputSchema: empty },
  { name: "spend_limits", description: "The browser spend cap. Default 100, maximum 5000. An agent cannot change it.", inputSchema: empty },
  { name: "clearing", description: "Commercial Connect and PARALLAX posture. No card number and no chain head.", inputSchema: empty },
  { name: "list_prints", description: "Live PreStock prints from prestocks.com. Price only. Not a share.", inputSchema: empty },
  { name: "chain_tape", description: "Live Jupiter and DefiLlama prices. A row is not a position.", inputSchema: empty },
  {
    name: "quote_swap",
    description: "Jupiter quote for USDC against a book mint. Does not sign. A Solana market stays off the book until a $100 quote fills inside 100 bps.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Solana mint on the book" },
        usd: { type: "number", description: "Size in dollars, at most 5000" },
        side: { type: "string", enum: ["buy", "sell"] },
      },
      required: ["mint", "usd"],
      additionalProperties: false,
    },
  },
  {
    name: "quote_evm",
    description: "LI.FI quote for a listed EVM market. Returns amounts only. The wallet signs.",
    inputSchema: {
      type: "object",
      properties: {
        tape: { type: "string", description: "ETH, BTC, LINK, UNI, AAVE, ARB, OP, BNB, or AVAX" },
        usd: { type: "number" },
        side: { type: "string", enum: ["buy", "sell"] },
        tokenRaw: { type: "string", description: "Raw token units to sell. Required for a sell." },
      },
      required: ["tape"],
      additionalProperties: false,
    },
  },
  {
    name: "read_wallet",
    description: "SOL and token accounts for a Solana address, including Token-2022. Read only.",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string" } },
      required: ["address"],
      additionalProperties: false,
    },
  },
  {
    name: "read_evm",
    description: "Token balance for an address on a listed EVM chain. Read only.",
    inputSchema: {
      type: "object",
      properties: {
        tape: { type: "string" },
        chainId: { type: "number" },
        token: { type: "string" },
        owner: { type: "string" },
      },
      required: ["owner"],
      additionalProperties: false,
    },
  },
  {
    name: "usdc_pay_link",
    description: "A Solana Pay link. The recipient's wallet asks to sign. Senda never sees the key.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        usd: { type: "number" },
        memo: { type: "string" },
      },
      required: ["to", "usd"],
      additionalProperties: false,
    },
  },
  {
    name: "cover_terms",
    description: "Premium and the 10% line for a size against a live print.",
    inputSchema: {
      type: "object",
      properties: {
        last: { type: "number", description: "Live token price" },
        usd: { type: "number", description: "Size to cover, in dollars" },
      },
      required: ["last", "usd"],
      additionalProperties: false,
    },
  },
  {
    name: "gift_window",
    description: "Gift windows and whether one is still open. Refuses a secret.",
    inputSchema: {
      type: "object",
      properties: {
        expiresAt: { type: "number" },
        now: { type: "number" },
      },
      additionalProperties: false,
    },
  },
];

export async function callTool(name, args = {}) {
  if (name === "desk_map") return { pages: DESK };
  if (name === "rules") return rules();
  if (name === "markets") return markets();
  if (name === "baskets") return { packs: BASKETS, note: "One theme and one amount. The wallet signs each filled Jupiter leg. A leg that cannot fill is dropped." };
  if (name === "spend_limits") return spendLimits();
  if (name === "clearing") return clearingPosture();
  if (name === "list_prints") return { prints: await listPrints() };
  if (name === "chain_tape") return chainTape();
  if (name === "quote_swap") return quoteSwap(args);
  if (name === "quote_evm") return quoteEvm(args);
  if (name === "read_wallet") return readWallet(args.address);
  if (name === "read_evm") return readEvm(args);
  if (name === "usdc_pay_link") return { url: usdcPayLink(args.to, args.usd, args.memo) };
  if (name === "cover_terms") return coverTerms(args.last, args.usd);
  if (name === "gift_window") return giftWindow(args);
  throw new Error(`Unknown tool ${name}`);
}

function httpHeaders(extra = {}) {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    ...extra,
  };
}

/** GET lists the tools. POST runs one. The body never comes back with a transaction. */
export async function handleAgentHttp(method, rawBody = "") {
  const verb = String(method || "GET").toUpperCase();
  if (verb === "OPTIONS") {
    return {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type",
      },
      body: "",
    };
  }
  if (verb === "GET") {
    return {
      status: 200,
      headers: httpHeaders(),
      body: JSON.stringify({
        tools: TOOLS.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })),
        rules: rules(),
        sign: false,
      }),
    };
  }
  if (verb !== "POST") {
    return { status: 405, headers: httpHeaders(), body: JSON.stringify({ ok: false, error: "Use GET or POST." }) };
  }
  let msg;
  try {
    msg = JSON.parse(rawBody || "{}");
  } catch {
    return { status: 400, headers: httpHeaders(), body: JSON.stringify({ ok: false, error: "Send JSON." }) };
  }
  const name = String(msg.name || msg.tool || "");
  const args = msg.arguments && typeof msg.arguments === "object" ? msg.arguments : {};
  if (!TOOLS.some((tool) => tool.name === name)) {
    return { status: 404, headers: httpHeaders(), body: JSON.stringify({ ok: false, error: `Unknown tool ${name}` }) };
  }
  try {
    const data = await callTool(name, args);
    return { status: 200, headers: httpHeaders(), body: JSON.stringify({ ok: true, name, data }) };
  } catch (e) {
    return {
      status: 400,
      headers: httpHeaders(),
      body: JSON.stringify({ ok: false, name, error: e instanceof Error ? e.message : "Tool failed." }),
    };
  }
}
