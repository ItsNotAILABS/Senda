/**
 * The login remembers a public Solana address. Never a key.
 */

import { createServerFn } from "@tanstack/react-start";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export const saveAccountAddress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        address: z.string().min(32).max(66),
        kind: z.enum(["solana", "evm"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const kind = data.kind ?? "solana";
    if (kind === "evm") {
      if (!/^0x[a-fA-F0-9]{40}$/.test(data.address)) return { ok: false as const, error: "Not a Base address." };
    } else {
      try {
        new PublicKey(data.address);
      } catch {
        return { ok: false as const, error: "Not a Solana address." };
      }
    }
    const { getSql } = await import("@/lib/db");
    const db = await getSql();
    if (kind === "evm") {
      await db`
        insert into account_address (user_id, address, evm)
        values (${context.userId}, '', ${data.address})
        on conflict (user_id) do update set evm = excluded.evm, updated_at = now()
      `;
    } else {
      await db`
        insert into account_address (user_id, address)
        values (${context.userId}, ${data.address})
        on conflict (user_id) do update set address = excluded.address, updated_at = now()
      `;
    }
    return { ok: true as const };
  });

export const loadAccountAddress = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const db = await getSql();
    const rows = await db<{ address: string; evm: string | null }>`
      select address, evm from account_address where user_id = ${context.userId}
    `;
    return { address: rows[0]?.address ?? "", evm: rows[0]?.evm ?? "" };
  });
