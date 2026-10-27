/** Detect when someone is asking for a new agent, instead of giving an order to the one that's open. */

export type SpawnAsk = { name: string; purpose: string };

export function parseSpawn(text: string): SpawnAsk | null {
  const raw = text.trim();
  const head = raw.match(/^(?:please\s+)?(?:make|create|spawn|build)(?:\s+me)?(?:\s+(?:an?|another))?\s+agents?\b[:\s,-]*(.*)$/i);
  if (!head) return null;
  let rest = head[1].trim();
  if (!rest) return null;
  let name = "";
  const named = rest.match(/^(?:named|called)\s+([A-Za-z0-9][A-Za-z0-9 _-]{0,32}?)\s+(?:that|to|which)\s+([\s\S]+)$/i);
  if (named) {
    name = named[1].trim();
    rest = named[2].trim();
  } else {
    rest = rest.replace(/^(?:that|to|which)\s+/i, "").trim();
  }
  if (!rest) return null;
  if (!name) name = rest.split(/[.\n]/)[0].trim().slice(0, 28);
  return { name: name || "Agent", purpose: rest.slice(0, 2000) };
}
