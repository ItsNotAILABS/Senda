import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { TIERS, type TierId } from "@/lib/event";

const rsvpInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  affiliation: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(280).optional().or(z.literal("")),
  tier: z.enum(["signal", "kernel", "core"]),
});

export type RsvpInput = z.infer<typeof rsvpInput>;

export type CapacityMap = Record<
  TierId,
  { claimed: number; remaining: number; capacity: number; waitlist: boolean }
>;

function remainingFor(tier: TierId, dbCount: number) {
  const meta = TIERS.find((t) => t.id === tier)!;
  const claimed = meta.seedClaimed + dbCount;
  const remaining = Math.max(0, meta.capacity - claimed);
  return {
    claimed: Math.min(claimed, meta.capacity),
    remaining,
    capacity: meta.capacity,
    waitlist: remaining === 0,
  };
}

export const getCapacity = createServerFn({ method: "GET" }).handler(
  async (): Promise<CapacityMap> => {
    const sql = await getSql();
    const rows = await sql<{ tier: TierId; n: number }>`
      select tier, count(*)::int as n from rsvps group by tier
    `;
    const counts: Record<TierId, number> = { signal: 0, kernel: 0, core: 0 };
    for (const row of rows) counts[row.tier] = row.n;
    return {
      signal: remainingFor("signal", counts.signal),
      kernel: remainingFor("kernel", counts.kernel),
      core: remainingFor("core", counts.core),
    };
  },
);

export type RsvpResult =
  | {
      ok: true;
      already: boolean;
      status: "confirmed" | "waitlist";
      tier: TierId;
      name: string;
      email: string;
    }
  | { ok: false; error: string };

export const submitRsvp = createServerFn({ method: "POST" })
  .validator((input: unknown) => rsvpInput.parse(input))
  .handler(async ({ data }): Promise<RsvpResult> => {
    const sql = await getSql();
    const email = data.email.toLowerCase();

    const existing = await sql<{
      status: "confirmed" | "waitlist";
      tier: TierId;
      name: string;
      email: string;
    }>`
      select status, tier, name, email from rsvps where email = ${email} limit 1
    `;
    if (existing[0]) {
      return {
        ok: true,
        already: true,
        status: existing[0].status,
        tier: existing[0].tier,
        name: existing[0].name,
        email: existing[0].email,
      };
    }

    const countRows = await sql<{ n: number }>`
      select count(*)::int as n from rsvps where tier = ${data.tier}
    `;
    const cap = remainingFor(data.tier, countRows[0]?.n ?? 0);
    const status = cap.waitlist ? "waitlist" : "confirmed";
    const affiliation = data.affiliation?.trim() || null;
    const notes = data.notes?.trim() || null;

    await sql`
      insert into rsvps (name, email, affiliation, notes, tier, status)
      values (${data.name}, ${email}, ${affiliation}, ${notes}, ${data.tier}, ${status})
    `;

    return {
      ok: true,
      already: false,
      status,
      tier: data.tier,
      name: data.name,
      email,
    };
  });
