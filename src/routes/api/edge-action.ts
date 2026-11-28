import { createFileRoute } from "@tanstack/react-router";
import { PublicKey, Transaction } from "@solana/web3.js";
import { SLOT_LIFE, chainLine, memoInstruction } from "@/lib/solana-edge";

const RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];

function headers(extra?: Record<string, string>) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
    "content-type": "application/json",
    ...extra,
  };
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  let last = "The cluster did not answer.";
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
      if (body.error) {
        last = body.error.message || last;
        continue;
      }
      return body.result;
    } catch (err) {
      last = err instanceof Error ? err.message : last;
    }
  }
  throw new Error(last);
}

function asked(url: URL): { actor: "mexico" | "brazil"; hash: string; slot: number } | { error: string } {
  const actor = url.searchParams.get("actor");
  const hash = (url.searchParams.get("hash") || "").toLowerCase();
  const slot = Number(url.searchParams.get("slot") || "");
  if (actor !== "mexico" && actor !== "brazil") return { error: "Name the Mexico actor or the Brazil actor." };
  if (!/^[0-9a-f]{64}$/.test(hash)) return { error: "The hash is missing." };
  if (!Number.isInteger(slot) || slot <= 0) return { error: "The slot is missing." };
  return { actor, hash, slot };
}

export const Route = createFileRoute("/api/edge-action")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: headers() }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const input = asked(url);
        if ("error" in input) return Response.json({ message: input.error }, { status: 400, headers: headers() });
        const line = chainLine(input.actor, input.hash, input.slot);
        return Response.json(
          {
            type: "action",
            icon: `${url.origin}/images/orbit.jpg`,
            title: "Anchor a Senda hash",
            description: `${line}. This memo is not a bank receipt and it does not move USDC.`,
            label: "Sign the memo",
            links: { actions: [{ label: "Sign the memo", href: `${url.origin}${url.pathname}${url.search}` }] },
          },
          { headers: headers() },
        );
      },
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const input = asked(url);
        if ("error" in input) return Response.json({ message: input.error }, { status: 400, headers: headers() });
        let body: { account?: string } = {};
        try {
          body = (await request.json()) as { account?: string };
        } catch {
          return Response.json({ message: "Send the account." }, { status: 400, headers: headers() });
        }
        let payer: PublicKey;
        try {
          payer = new PublicKey(String(body.account || ""));
        } catch {
          return Response.json({ message: "That account is not a Solana address." }, { status: 400, headers: headers() });
        }
        try {
          const slot = Number(await rpc("getSlot", []));
          if (slot > input.slot + SLOT_LIFE) return Response.json({ message: "That slot expired. Read the clock again." }, { status: 400, headers: headers() });
          const block = (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
          const blockhash = block?.value?.blockhash;
          if (!blockhash) return Response.json({ message: "No blockhash." }, { status: 502, headers: headers() });
          const line = chainLine(input.actor, input.hash, input.slot);
          const tx = new Transaction();
          tx.feePayer = payer;
          tx.recentBlockhash = blockhash;
          tx.add(memoInstruction(payer, line));
          const raw = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
          return Response.json(
            { transaction: Buffer.from(raw).toString("base64"), message: "The memo is the hash. It is not a SPEI receipt or a Pix end-to-end id." },
            { headers: headers() },
          );
        } catch (err) {
          return Response.json({ message: err instanceof Error ? err.message : "The action could not be built." }, { status: 502, headers: headers() });
        }
      },
    },
  },
});
