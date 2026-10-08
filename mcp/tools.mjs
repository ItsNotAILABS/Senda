/**
 * Senda tools an agent can call without a key.
 * A buy, a pay, and a cover still need the person's wallet to sign.
 * These functions quote, read, and describe. They do not submit a transaction.
 */

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const DEVNET_PROGRAM = "4Zsghb1rMfxbM3hAECdTfZBq1wiRNi19V5J3Bm2A4Kta";
const PRESTOCKS = "https://prestocks.com/api/prestocks";
const QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

export const DESK = [
  { path: "/", name: "Home", does: "The book, a buy, and what the connected wallet holds." },
  { path: "/pre", name: "PreStocks", does: "Live tokenized pre-IPO names. Buy is a Jupiter swap the wallet signs." },
  { path: "/wallet", name: "Convert", does: "SOL or USDC into a name, or the slice back. One route." },
  { path: "/wallets", name: "Wallets", does: "Phantom, Solflare, Backpack, and the other injected wallets. Ethereum is a different signature. Robinhood buying power aims USDC at the Solana address." },
  { path: "/social", name: "Play", does: "Games on the live print. Practice cash never touches the wallet." },
  { path: "/cards", name: "Shop", does: "A number shown once, and a USDC payment a Solana merchant can clear." },
  { path: "/make", name: "Make", does: "A listing. The price is USDC. The whole amount goes to the address on the listing." },
  { path: "/agents", name: "AI Agent", does: "An envelope with a cap. It can queue a trade. It cannot sign." },
  { path: "/payments", name: "Send", does: "USDC to a Solana address, a pay link, a request, nearby, or exchange." },
  { path: "/vault", name: "Portfolio", does: "Token accounts in the wallet, marked at the last print." },
  { path: "/cover", name: "Cover", does: "Premium is 4% of the size. Pays if the print falls 10%. Not a licensed policy. The token stays." },
  { path: "/work", name: "Work", does: "A job paid in USDC to a worker address, or a Solana Pay link they open." },
  { path: "/invest", name: "Trade", does: "Size, side, a Jupiter quote, then the signature. Spot, options, perps, and the rest of the book sit under that ticket." },
  { path: "/solana", name: "Solana", does: "The live PreStock mints, one row at a time." },
  { path: "/books", name: "Books", does: "The ledger this browser already wrote." },
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
    card: "The shop number is shown once. It is not a Visa or Mastercard BIN. A card terminal will decline it.",
    agent: "An agent may read and queue. It may not sign.",
  };
}

export function usdcPayLink(to, usd, memo = "Senda") {
  const dest = String(to || "").trim();
  if (dest.length < 32) throw new Error("Paste a Solana address.");
  const amount = Math.round(Number(usd) * 100) / 100;
  if (!(amount > 0)) throw new Error("Enter a USDC amount.");
  const q = new URLSearchParams({
    amount: amount.toFixed(2),
    "spl-token": USDC_MINT,
    memo: String(memo).slice(0, 80),
  });
  return `solana:${dest}?${q.toString()}`;
}

export function coverTerms(last, usd) {
  const print = Number(last);
  const size = Number(usd);
  if (!(print > 0)) throw new Error("Need a live print.");
  if (!(size > 0)) throw new Error("Need a size in dollars.");
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

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda/1.0 (no custody)" } });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
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

export async function quoteSwap({ mint, usd, side }) {
  const token = String(mint || "").trim();
  if (token.length < 32) throw new Error("Need the PreStock mint.");
  const dollars = Number(usd);
  if (!(dollars > 0)) throw new Error("Need a size in dollars.");
  const way = side === "sell" ? "sell" : "buy";
  const amount = Math.max(1, Math.round(dollars * 1e6));
  const inputMint = way === "buy" ? USDC_MINT : token;
  const outputMint = way === "buy" ? token : USDC_MINT;
  const url = `${QUOTE}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100&restrictIntermediateTokens=true`;
  const j = await getJson(url);
  if (!j.outAmount) throw new Error(j.error || "No route.");
  const out = Number(j.outAmount) / 1e6;
  return {
    side: way,
    inMint: inputMint,
    outMint: outputMint,
    out,
    priceImpactPct: j.priceImpactPct ?? null,
    note: "This is a quote. The wallet still has to sign the swap.",
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

export async function readWallet(owner) {
  const address = String(owner || "").trim();
  if (address.length < 32) throw new Error("Need a Solana address.");
  const [lamports, classic] = await Promise.all([
    rpc("getBalance", [address]),
    rpc("getTokenAccountsByOwner", [address, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }]),
  ]);
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
  return {
    address,
    sol: (lamports || 0) / 1e9,
    tokens,
    note: "Read from the chain. Senda does not hold this.",
  };
}

export const TOOLS = [
  {
    name: "desk_map",
    description: "Every Senda page and what a person actually does there.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "rules",
    description: "What Senda will not do. Read this before suggesting a trade, a card, or a balance.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_prints",
    description: "Live PreStock prints from prestocks.com. Price only. Not a share.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "quote_swap",
    description: "Jupiter quote for USDC against a PreStock mint. Does not sign.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "PreStock mint address" },
        usd: { type: "number", description: "Size in dollars" },
        side: { type: "string", enum: ["buy", "sell"] },
      },
      required: ["mint", "usd"],
      additionalProperties: false,
    },
  },
  {
    name: "read_wallet",
    description: "SOL and token accounts for a Solana address. Read only.",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string" } },
      required: ["address"],
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
];

export async function callTool(name, args = {}) {
  if (name === "desk_map") return { pages: DESK };
  if (name === "rules") return rules();
  if (name === "list_prints") return { prints: await listPrints() };
  if (name === "quote_swap") return quoteSwap(args);
  if (name === "read_wallet") return readWallet(args.address);
  if (name === "usdc_pay_link") return { url: usdcPayLink(args.to, args.usd, args.memo) };
  if (name === "cover_terms") return coverTerms(args.last, args.usd);
  throw new Error(`Unknown tool ${name}`);
}
