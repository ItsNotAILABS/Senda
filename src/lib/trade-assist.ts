import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Setup = z.object({
  side: z.enum(["buy", "sell"]),
  usd: z.number().positive().max(5000),
  entry: z.number().positive(),
  stop: z.number().positive(),
  takeProfit: z.number().positive(),
  reason: z.string().max(280),
});

export type TradeSetup = z.infer<typeof Setup>;

const Ask = z.object({
  symbol: z.string().min(1).max(16),
  name: z.string().max(80),
  last: z.number().positive(),
  mark: z.number().nonnegative(),
  question: z.string().min(1).max(400),
});

function localSetup(last: number, mark: number, question: string): TradeSetup {
  const cheap = mark > 0 && last < mark;
  const wantSell = /sell|short|down/i.test(question);
  const side = wantSell && !cheap ? "sell" : "buy";
  const entry = last;
  const stop = side === "buy" ? round(last * 0.964) : round(last * 1.036);
  const risk = Math.abs(entry - stop);
  const takeProfit = side === "buy" ? round(entry + risk * 2.5) : round(entry - risk * 2.5);
  const usd = /small|tiny/i.test(question) ? 10 : 25;
  return {
    side,
    usd,
    entry,
    stop,
    takeProfit,
    reason:
      side === "buy"
        ? "Long the print. Stop is 3.6% under the last price. Target is 2.5 times that risk. You still sign."
        : "Sell the print. Stop is 3.6% over the last price. Target is 2.5 times that risk. You still sign.",
  };
}

function round(n: number): number {
  if (n >= 100) return Math.round(n * 100) / 100;
  if (n >= 1) return Math.round(n * 1000) / 1000;
  return Math.round(n * 10000) / 10000;
}

function parseSetup(text: string, last: number, mark: number, question: string): { reply: string; setup: TradeSetup } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const raw = JSON.parse(text.slice(start, end + 1)) as { reply?: string; setup?: unknown };
      const setup = Setup.parse(raw.setup);
      return { reply: String(raw.reply || setup.reason), setup };
    } catch {
      /* fall through */
    }
  }
  const setup = localSetup(last, mark, question);
  return { reply: text.trim() || setup.reason, setup };
}

export const askTrade = createServerFn({ method: "POST" })
  .validator((input: unknown) => Ask.parse(input))
  .handler(async ({ data }): Promise<{ reply: string; setup: TradeSetup; from: "grok" | "print" }> => {
    const fallback = localSetup(data.last, data.mark, data.question);
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return {
        reply: `${fallback.reason} Drafted from the live print. Nothing is placed until you sign.`,
        setup: fallback,
        from: "print",
      };
    }
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 320,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You draft a spot setup on a tokenized pre-IPO print. You do not place orders. Reply with JSON only: {\"reply\":\"short\",\"setup\":{\"side\":\"buy\"|\"sell\",\"usd\":number,\"entry\":number,\"stop\":number,\"takeProfit\":number,\"reason\":\"one sentence\"}}. Entry is the last print. Stop is about 3 to 4 percent away. Take profit is about 2.5 times the risk. usd is 10 to 100. Never claim the order is filled.",
          },
          {
            role: "user",
            content: `${data.symbol} ${data.name}. Last ${data.last}. Mark ${data.mark}. ${data.question}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      return { reply: fallback.reason, setup: fallback, from: "print" };
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content ?? "";
    const parsed = parseSetup(text, data.last, data.mark, data.question);
    return { ...parsed, from: "grok" };
  });
