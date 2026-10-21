/**
 * Shared work board. A gig is something a person or an agent will do.
 * Paying it is a USDC transfer to their wallet. The row only stores the receipt.
 */

import { createServerFn } from "@tanstack/react-start";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

export type Gig = {
  id: string;
  title: string;
  detail: string;
  usd: number;
  kind: string;
  role: "need" | "offer";
  poster: string;
  worker: string;
  agent: string;
  status: "open" | "claimed" | "paid";
  signature: string;
  createdAt: number;
};

const KINDS = ["hire", "build", "teach", "deliver", "research"] as const;

function addr(value: string) {
  const key = new PublicKey(value.trim());
  return key.toBase58();
}

async function db() {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`
    create table if not exists work_gig (
      id text primary key,
      title text not null,
      detail text not null default '',
      usd double precision not null,
      kind text not null,
      role text not null,
      poster text not null,
      worker text not null default '',
      agent text not null default '',
      status text not null,
      signature text not null default '',
      created_at bigint not null
    )
  `;
  return sql;
}

function row(r: {
  id: string;
  title: string;
  detail: string;
  usd: number | string;
  kind: string;
  role: string;
  poster: string;
  worker: string;
  agent: string;
  status: string;
  signature: string;
  created_at: number | string;
}): Gig {
  return {
    id: r.id,
    title: r.title,
    detail: r.detail,
    usd: Number(r.usd),
    kind: r.kind,
    role: r.role === "offer" ? "offer" : "need",
    poster: r.poster,
    worker: r.worker,
    agent: r.agent,
    status: r.status === "paid" || r.status === "claimed" ? r.status : "open",
    signature: r.signature,
    createdAt: Number(r.created_at),
  };
}

export const listWork = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const rows = await sql<Parameters<typeof row>[0]>`
    select id, title, detail, usd, kind, role, poster, worker, agent, status, signature, created_at
    from work_gig
    order by created_at desc
    limit 80
  `;
  return rows.map(row);
});

export const postWork = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(2).max(120),
        detail: z.string().trim().max(2000),
        usd: z.number().positive().max(50_000),
        kind: z.enum(KINDS),
        role: z.enum(["need", "offer"]),
        poster: z.string().min(32).max(48),
        agent: z.string().trim().max(48).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    let poster: string;
    try {
      poster = addr(data.poster);
    } catch {
      throw new Error("That wallet address is not valid.");
    }
    const id = `wk${crypto.randomUUID().slice(0, 8)}`;
    const sql = await db();
    const worker = data.role === "offer" ? poster : "";
    const status = data.role === "offer" ? "open" : "open";
    await sql`
      insert into work_gig (id, title, detail, usd, kind, role, poster, worker, agent, status, signature, created_at)
      values (
        ${id},
        ${data.title},
        ${data.detail},
        ${data.usd},
        ${data.kind},
        ${data.role},
        ${poster},
        ${worker},
        ${data.agent || ""},
        ${status},
        ${""},
        ${Date.now()}
      )
    `;
    return { id };
  });

export const claimWork = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().min(4).max(40),
        worker: z.string().min(32).max(48),
        agent: z.string().trim().max(48).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    let worker: string;
    try {
      worker = addr(data.worker);
    } catch {
      throw new Error("That wallet address is not valid.");
    }
    const sql = await db();
    const hit = await sql<{ status: string; role: string }>`
      select status, role from work_gig where id = ${data.id}
    `;
    if (!hit.length) throw new Error("That work is gone.");
    if (hit[0].role !== "need") throw new Error("This one already has an address to pay.");
    if (hit[0].status === "paid") throw new Error("This was already paid.");
    await sql`
      update work_gig
      set worker = ${worker}, agent = ${data.agent || ""}, status = ${"claimed"}
      where id = ${data.id}
    `;
    return { ok: true as const };
  });

export const markPaid = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().min(4).max(40),
        signature: z.string().min(32).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sql = await db();
    await sql`
      update work_gig
      set status = ${"paid"}, signature = ${data.signature}
      where id = ${data.id}
    `;
    return { ok: true as const };
  });
