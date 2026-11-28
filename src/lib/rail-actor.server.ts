import { cleanConcept, fieldsAreIn, readRailText, type RailAsk } from "@/lib/rail-read";

/** The actor reads the sentence. Grok is only asked when the local read fails, and only to copy words already there. */
export async function readActor(actor: "mexico" | "brazil", text: string): Promise<{ ask: RailAsk; from: "actor" | "grok" } | { error: string }> {
  const local = readRailText(actor, text);
  if (!("error" in local)) return { ask: local, from: "actor" };
  if (local.error.includes("does not run")) return local;
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return local;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 240,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              actor === "mexico"
                ? "Extract a Mexico SPEI payout. Reply with JSON only: {\"usd\":number,\"name\":\"\",\"concept\":\"\",\"clabe\":\"\",\"card\":\"\",\"phone\":\"\",\"bank\":\"\"}. Copy values from the sentence. Never invent an account number, a name, or a concept. Do not return a Pix key."
                : "Extract a Brazil Pix payout. Reply with JSON only: {\"usd\":number,\"name\":\"\",\"concept\":\"\",\"pix\":\"\"}. Copy values from the sentence. Never invent an account number, a name, or a concept. Do not return a CLABE.",
          },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return local;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content || "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < start) return local;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const account: Record<string, string> = {
      name: String(parsed.name || "").trim(),
      concept: String(parsed.concept || "").trim(),
      clabe: actor === "mexico" ? String(parsed.clabe || "").replace(/\D/g, "") : "",
      card: actor === "mexico" ? String(parsed.card || "").replace(/\D/g, "") : "",
      phone: actor === "mexico" ? String(parsed.phone || "").replace(/\D/g, "") : "",
      bank: actor === "mexico" ? String(parsed.bank || "").replace(/\D/g, "") : "",
      pix: actor === "brazil" ? String(parsed.pix || "").trim() : "",
    };
    if (!fieldsAreIn(text, account)) return { error: "The model used a detail that was not in the sentence." };
    account.concept = cleanConcept(account.concept);
    if (account.name.length < 2 || !account.concept) return local;
    const ask: RailAsk = {
      actor,
      corridor: actor === "mexico" ? "mx-spei" : "br-pix",
      usd: Number(parsed.usd),
      account,
    };
    if (!(ask.usd > 0)) return local;
    return { ask, from: "grok" };
  } catch {
    return local;
  }
}
