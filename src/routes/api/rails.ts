import { createFileRoute } from "@tanstack/react-router";
import { creditHouseOrder, listHouseOrders, openHouseOrder, quoteHouse, signHouseOrder } from "@/lib/house-book.server";
import { CORRIDORS, HOUSE_RULES } from "@/lib/house-rails";
import { readActor } from "@/lib/rail-actor.server";

function corridors() {
  return {
    rules: HOUSE_RULES,
    receive: process.env.HOUSE_USDC_ADDRESS?.trim() || "",
    corridors: CORRIDORS.map((row) => ({
      id: row.id,
      country: row.country,
      rail: row.rail,
      ccy: row.ccy,
      desk: row.desk,
      minUsd: row.minUsd,
      maxUsd: row.maxUsd,
      feeBps: row.feeBps,
      feeUsd: row.feeUsd,
      fields: row.fields,
    })),
  };
}

export const Route = createFileRoute("/api/rails")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("book") === "1") {
          try {
            const orders = await listHouseOrders();
            return Response.json({ orders });
          } catch (err) {
            return Response.json({ error: err instanceof Error ? err.message : "The book did not open." }, { status: 500 });
          }
        }
        return Response.json(corridors());
      },
      POST: async ({ request }) => {
        let body: {
          op?: string;
          corridor?: string;
          usd?: number;
          account?: Record<string, string>;
          direction?: string;
          id?: string;
          signature?: string;
          tracking?: string;
          actor?: string;
          text?: string;
        } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Send JSON." }, { status: 400 });
        }
        const direction = body.direction === "in" ? "in" : "out";
        const account = body.account && typeof body.account === "object" ? body.account : {};
        const usd = Number(body.usd);
        try {
          if (body.op === "open") {
            const opened = await openHouseOrder({ corridor: String(body.corridor || ""), usd, account, direction });
            if ("error" in opened) return Response.json({ error: opened.error }, { status: 400 });
            return Response.json(opened);
          }
          if (body.op === "sign") {
            const signed = await signHouseOrder(String(body.id || ""), String(body.signature || ""));
            if ("error" in signed) return Response.json({ error: signed.error }, { status: 400 });
            return Response.json(signed);
          }
          if (body.op === "actor" || body.op === "actor_open") {
            const actor = body.actor === "brazil" ? "brazil" : body.actor === "mexico" ? "mexico" : "";
            if (!actor) return Response.json({ error: "Name the Mexico actor or the Brazil actor." }, { status: 400 });
            const read = await readActor(actor, String(body.text || ""));
            if ("error" in read) return Response.json({ error: read.error }, { status: 400 });
            if (body.op === "actor_open") {
              const opened = await openHouseOrder({ corridor: read.ask.corridor, usd: read.ask.usd, account: read.ask.account, direction: "out" });
              if ("error" in opened) return Response.json({ error: opened.error }, { status: 400 });
              return Response.json({ from: read.from, signs: false, order: opened.order, quote: opened.quote });
            }
            const quote = await quoteHouse({ corridor: read.ask.corridor, usd: read.ask.usd, account: read.ask.account, direction: "out" });
            if ("error" in quote) return Response.json({ error: quote.error }, { status: 400 });
            return Response.json({ from: read.from, signs: false, quote });
          }
          if (body.op === "credit") {
            const marked = await creditHouseOrder(String(body.id || ""), String(body.tracking || ""));
            if ("error" in marked) return Response.json({ error: marked.error }, { status: 400 });
            return Response.json(marked);
          }
          const quote = await quoteHouse({ corridor: String(body.corridor || ""), usd, account, direction });
          if ("error" in quote) return Response.json({ error: quote.error }, { status: 400 });
          return Response.json(quote);
        } catch (err) {
          return Response.json({ error: err instanceof Error ? err.message : "The house book failed." }, { status: 500 });
        }
      },
    },
  },
});
