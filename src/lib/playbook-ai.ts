/** One user tap. Grok may phrase the rule. The desk parser still has to agree. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parsePlay, specFromUnknown, type PlaySpec } from "@/lib/playbook";

export const compilePlay = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        text: z.string().min(8).max(600),
        symbols: z.array(z.string().min(1).max(16)).max(60),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true; spec: PlaySpec; via: "grok" | "desk" } | { ok: false; error: string }> => {
    const local = parsePlay(data.text, data.symbols);
    if (!("error" in local)) return { ok: true, spec: local, via: "desk" };
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: local.error };
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0,
          max_tokens: 220,
          messages: [
            {
              role: "user",
              content: `Turn one trading sentence into JSON for a Solana spot desk. The desk has pool price and volume only. It does not have open interest. Reply with JSON only, no markdown.
{"symbol":"SOL","side":"buy","usd":25,"span":"60","lookback":1,"changePct":3,"direction":"up","volumeMul":2,"fadeVolume":false,"takePct":2,"stopPct":2,"wantsOpenInterest":false}
span is "60", "15", or "1D". volumeMul, takePct, and stopPct are numbers or null.
Use a symbol from this list when the sentence names one: ${data.symbols.slice(0, 40).join(", ") || "SOL"}.
Sentence: ${data.text}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return { ok: false, error: local.error };
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = body.choices?.[0]?.message?.content ?? "";
      const json = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
      const parsed = specFromUnknown(JSON.parse(json) as unknown, data.text, data.symbols);
      if ("error" in parsed) return { ok: false, error: local.error };
      return { ok: true, spec: parsed, via: "grok" };
    } catch {
      return { ok: false, error: local.error };
    }
  });
