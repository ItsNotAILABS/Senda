import { createFileRoute } from "@tanstack/react-router";

const METHODS = new Set([
  "getBalance",
  "getTokenAccountsByOwner",
  "getAccountInfo",
  "getLatestBlockhash",
  "getSignaturesForAddress",
  "getTransaction",
  "getSignatureStatuses",
  "simulateTransaction",
  "sendTransaction",
]);

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

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
