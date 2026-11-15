/** One reply shared by every open desk, so public nodes are not asked once per browser. */

type Hit = { at: number; status: number; body: unknown };

const mem = new Map<string, Hit>();

export async function cachedJson(
  url: string,
  ttlMs: number,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const key = `${init?.method || "GET"} ${url} ${typeof init?.body === "string" ? init.body : ""}`;
  const hit = mem.get(key);
  const fresh = hit && Date.now() - hit.at < ttlMs;
  if (fresh && hit) return { ok: hit.status < 400, status: hit.status, body: hit.body };
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
    const body = await r.json().catch(() => ({}));
    const limited = r.status === 429 || (body && typeof body === "object" && /rate limit/i.test(JSON.stringify(body).slice(0, 180)));
    if (limited && hit) return { ok: hit.status < 400, status: hit.status, body: hit.body };
    if (r.ok) mem.set(key, { at: Date.now(), status: r.status, body });
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    if (hit) return { ok: hit.status < 400, status: hit.status, body: hit.body };
    throw e;
  }
}
