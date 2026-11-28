import { createFileRoute } from "@tanstack/react-router";
import { loadTape } from "@/lib/world-book";

const METHODS = new Set([
  "getBalance",
  "getTokenAccountsByOwner",
  "getAccountInfo",
  "getLatestBlockhash",
  "getSlot",
  "getBlockTime",
  "getRecentPrioritizationFees",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getSignaturesForAddress",
  "getTransaction",
  "getSignatureStatuses",
  "simulateTransaction",
  "sendTransaction",
]);

const RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com", "https://rpc.ankr.com/solana"];

function tokenUi(amount: { uiAmount?: number | null; uiAmountString?: string; amount?: string; decimals?: number } | undefined): number {
  if (!amount) return 0;
  if (typeof amount.uiAmount === "number" && amount.uiAmount > 0) return amount.uiAmount;
  const fromString = Number(amount.uiAmountString || "");
  if (fromString > 0) return fromString;
  if (amount.amount && typeof amount.decimals === "number") return Number(amount.amount) / 10 ** amount.decimals;
  return 0;
}

/** Drop rent, owners, and zero balances. The phone only needs mint and amount. */
function slimTokenAccounts(result: unknown): unknown {
  if (!result || typeof result !== "object" || !Array.isArray((result as { value?: unknown }).value)) return result;
  const value = (result as { value: Array<{ account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number | null; uiAmountString?: string; amount?: string; decimals?: number } } } } } }> }).value;
  const slim = [];
  for (const row of value) {
    const info = row?.account?.data?.parsed?.info;
    const amount = info?.tokenAmount;
    const ui = tokenUi(amount);
    if (!info?.mint || !(ui > 0)) continue;
    slim.push({
      account: {
        data: {
          parsed: {
            info: {
              mint: info.mint,
              tokenAmount: { uiAmount: ui, amount: String(amount?.amount || "0"), decimals: amount?.decimals ?? 0 },
            },
          },
        },
      },
    });
  }
  return { value: slim };
}

export const Route = createFileRoute("/api/chain")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        let rows = await loadTape();
        if (url.searchParams.get("slim") === "1") {
          rows = rows.map(({ id, symbol, name, price, change, volume }) => ({ id, symbol, name, price, change, volume }));
        }
        const limit = Number(url.searchParams.get("limit") || 0);
        if (limit > 0) {
          const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
          rows = rows.slice(offset, offset + Math.min(limit, 500));
        }
        return Response.json(rows);
      },
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
            const result = body.method === "getTokenAccountsByOwner" ? slimTokenAccounts(j.result ?? null) : (j.result ?? null);
            return Response.json({ result });
          } catch (e) {
            last = e instanceof Error ? e.message : last;
          }
        }
        return Response.json({ error: last }, { status: 502 });
      },
    },
  },
});