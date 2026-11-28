/** Pull a Mexico or Brazil payout out of a sentence. Missing numbers stay missing. */

export type RailAsk = {
  actor: "mexico" | "brazil";
  corridor: "mx-spei" | "br-pix";
  usd: number;
  account: Record<string, string>;
};

export function cleanConcept(value: string): string {
  return value
    .replace(/\s+\+?\d{10,}\b/g, " ")
    .replace(/\s+\d{3}\.\d{3}\.\d{3}-?\d{2}\b/g, " ")
    .replace(/\s+\d{2}\.\d{3}\.\d{3}\/\d{4}-?\d{2}\b/g, " ")
    .replace(/\s+[^\s@]+@[^\s@]+\.[^\s@]+/g, " ")
    .replace(/\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function grab(text: string, label: string): string {
  const match = text.match(
    new RegExp(
      `${label}\\s+(.+?)(?=\\s+(?:name|concept|clabe|pix|card|phone|bank)\\b|\\s+\\+?\\d{10,}\\b|\\s+\\+55\\b|\\s+[^\\s@]+@[^\\s@]+\\.[^\\s@]+|\\s+[0-9a-f]{8}-[0-9a-f]{4}-|$)`,
      "i",
    ),
  );
  return cleanConcept(match?.[1] || "");
}

export function readRailText(actor: "mexico" | "brazil", text: string): RailAsk | { error: string } {
  const said = text.trim();
  if (actor === "mexico" && /\bpix\b|\bbrazil\b|\bbrasil\b/i.test(said)) return { error: "The Mexico actor does not run Pix." };
  if (actor === "brazil" && /\bclabe\b|\bmexico\b|\bspei\b/i.test(said)) return { error: "The Brazil actor does not run SPEI." };
  const usd = Number(said.match(/(\d+(?:\.\d{1,2})?)/)?.[1] || "");
  if (!(usd > 0)) return { error: "Say the dollar amount." };
  const name = grab(said, "name");
  const concept = grab(said, "concept");
  if (name.length < 2) return { error: "Say the name on the account." };
  if (!concept) return { error: "Say the concept." };
  if (actor === "mexico") {
    const clabe = said.match(/\b(\d{18})\b/)?.[1] || "";
    const card = said.match(/\b(\d{16})\b/)?.[1] || "";
    const phone = said.match(/\b(\d{10})\b/)?.[1] || "";
    const bank = said.match(/\bbank\s+(\d{3})\b/i)?.[1] || "";
    if (!clabe && !card && !phone) return { error: "Say the CLABE, the card, or the phone." };
    return { actor, corridor: "mx-spei", usd, account: { name, concept, clabe, card, phone, bank } };
  }
  const email = said.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] || "";
  const evp = said.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] || "";
  const phone = said.match(/\+55[\d\s()-]{10,18}/)?.[0] || "";
  const cpf = said.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/)?.[0]?.replace(/\D/g, "") || "";
  const cnpj = said.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)?.[0]?.replace(/\D/g, "") || "";
  const pix = email || evp || phone || cpf || cnpj || said.match(/\b(\d{11}|\d{14})\b/)?.[1] || "";
  if (!pix) return { error: "Say the Pix key." };
  return { actor, corridor: "br-pix", usd, account: { name, concept, pix } };
}

export function fieldsAreIn(text: string, account: Record<string, string>): boolean {
  const hay = text.toLowerCase().replace(/\s+/g, "");
  for (const key of ["clabe", "card", "phone", "pix", "name", "concept"]) {
    const value = (account[key] || "").trim();
    if (!value) continue;
    if (!hay.includes(value.toLowerCase().replace(/\s+/g, ""))) return false;
  }
  return true;
}
