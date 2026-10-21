/** The same contract as GET/POST /api/agent on this host and on senda.pocketnova.app. */

export type DeskPrint = {
  symbol: string;
  name: string;
  mint: string;
  last: number;
  mark: number;
  premium: number | null;
};

export async function pullPrints(): Promise<DeskPrint[]> {
  const r = await fetch("/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "list_prints" }),
  });
  if (!r.ok) return [];
  const body = (await r.json()) as { data?: { prints?: DeskPrint[] } };
  return Array.isArray(body.data?.prints) ? body.data.prints : [];
}
