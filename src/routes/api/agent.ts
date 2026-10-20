import { createFileRoute } from "@tanstack/react-router";
import { handleAgentHttp } from "@/lib/agent-http.mjs";

/**
 * Agents call this. They never receive a key.
 * A quote is a Jupiter route. A signature still happens in the user's Phantom.
 * `open` is the same handoff the phone uses: Phantom's in-app browser.
 * The first time that opens, Phantom creates the wallet.
 */

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const CASH = "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH";
const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const DOLLARS = [USDC, CASH, USDT];
const ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

const CONTRACT = {
  engine: "senda.wallet",
  sign: "The user signs in Phantom. This API does not return a key and cannot sign.",
  balances: "POST { action: 'balances', address }",
  quote: "POST { action: 'quote', address, mint, usd, side: 'buy' | 'sell' }",
  open: "POST { action: 'open', page } — Phantom browse URL. First open creates the wallet.",
  holds: ["SOL", "USDC", "CASH", "USDT", "any other SPL on that address"],
};

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  let last = "The chain did not answer.";
  for (const url of RPCS) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const j = (await r.json()) as { result?: unknown; error?: { message?: string } };
    if (j.error) {
      last = j.error.message || last;
      continue;
    }
    return j.result ?? null;
  }
  throw new Error(last);
}

function uiOf(t?: { uiAmount?: number | null; uiAmountString?: string; amount?: string; decimals?: number }): number {
  if (!t) return 0;
  if (typeof t.uiAmount === "number" && Number.isFinite(t.uiAmount)) return t.uiAmount;
  if (t.uiAmountString && Number.isFinite(Number(t.uiAmountString))) return Number(t.uiAmountString);
  if (t.amount && typeof t.decimals === "number") return Number(t.amount) / 10 ** t.decimals;
  return 0;
}

async function holding(owner: string, mint: string): Promise<number> {
  const result = (await rpc("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }])) as {
    value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number | null; uiAmountString?: string; amount?: string; decimals?: number } } } } } }>;
  };
  return (result?.value ?? []).reduce((s, row) => s + uiOf(row.account?.data?.parsed?.info?.tokenAmount), 0);
}

function browse(page: string): string {
  let target = "https://senda.pocketnova.app/";
  try {
    const u = new URL(page);
    if (u.protocol === "https:" && (u.hostname === "senda.pocketnova.app" || u.hostname === "www.senda.pocketnova.app")) {
      target = u.toString();
    }
  } catch {
    target = "https://senda.pocketnova.app/";
  }
  return `https://phantom.app/ul/browse/${encodeURIComponent(target)}?ref=${encodeURIComponent("https://senda.pocketnova.app")}`;
}

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      GET: async () => {
        const desk = await handleAgentHttp("GET");
        const tools = JSON.parse(desk.body) as Record<string, unknown>;
        return Response.json({ ...CONTRACT, ...tools });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        let body: { action?: string; name?: string; tool?: string; address?: string; mint?: string; usd?: number; side?: string; page?: string };
        try {
          body = raw ? (JSON.parse(raw) as typeof body) : {};
        } catch {
          return Response.json({ error: "Bad request." }, { status: 400 });
        }
        if (body.name || body.tool) {
          const result = await handleAgentHttp("POST", raw);
          return new Response(result.body, { status: result.status, headers: result.headers });
        }
        if (body.action === "open") {
          const page = typeof body.page === "string" && body.page.startsWith("https://") ? body.page : "https://senda.pocketnova.app/";
          return Response.json({
            ok: true,
            browse: browse(page),
            note: "Open this in the phone browser. Phantom creates the wallet if they do not have one, then Senda connects inside the app. The agent still cannot sign.",
          });
        }
        const address = String(body.address ?? "");
        if (!ADDR.test(address)) return Response.json({ error: "That is not a Solana address." }, { status: 400 });
        if (body.action === "balances") {
          try {
            const bal = await rpc("getBalance", [address]);
            const lamports = typeof bal === "number" ? bal : Number((bal as { value?: number } | null)?.value ?? 0);
            const [usdc, cash, usdt] = await Promise.all(DOLLARS.map((m) => holding(address, m)));
            return Response.json({
              ok: true,
              address,
              sol: lamports / 1e9,
              usdc,
              cash,
              usdt,
              spendable: usdc + cash + usdt,
              sign: CONTRACT.sign,
            });
          } catch (e) {
            return Response.json({ error: e instanceof Error ? e.message : "Could not read the wallet." }, { status: 502 });
          }
        }
        if (body.action === "quote") {
          const mint = String(body.mint ?? "");
          const usd = Number(body.usd);
          const side = body.side === "sell" ? "sell" : "buy";
          if (!ADDR.test(mint) || !(usd > 0) || usd > 5000) {
            return Response.json({ error: "Need a mint and a size from $0.01 to $5000." }, { status: 400 });
          }
          const amount = Math.max(1, Math.round(usd * 1e6));
          const inputMint = side === "buy" ? USDC : mint;
          const outputMint = side === "buy" ? mint : USDC;
          const qs = `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100`;
          let last = "Jupiter did not quote.";
          for (const base of ["https://lite-api.jup.ag/swap/v1/quote", "https://api.jup.ag/swap/v1/quote"]) {
            try {
              const r = await fetch(`${base}?${qs}`, { headers: { accept: "application/json" } });
              const parsed = (await r.json()) as { outAmount?: string; priceImpactPct?: string; error?: string };
              if (r.ok && parsed.outAmount) {
                return Response.json({
                  ok: true,
                  address,
                  side,
                  usd,
                  inMint: inputMint,
                  outMint: outputMint,
                  outAmount: parsed.outAmount,
                  priceImpactPct: parsed.priceImpactPct ?? "0",
                  sign: CONTRACT.sign,
                  browse: browse("https://senda.pocketnova.app/pre"),
                });
              }
              last = parsed.error || last;
            } catch {
              last = "Jupiter did not quote.";
            }
          }
          return Response.json({ error: last }, { status: 502 });
        }
        return Response.json({ error: "Use balances, quote, or open.", ...CONTRACT }, { status: 400 });
      },
    },
  },
});
