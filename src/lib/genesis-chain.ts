/** Server-only DAS lookup. Public wallet ownership, not signed user authentication. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isSolanaAddress, parseRegistry, resolveOwnedGenesisAssets } from "@/lib/genesis-ownership.mjs";

type GenesisOwnerResult = {
  state: "unconfigured" | "verified" | "unavailable";
  owner: string;
  ownedIds: string[];
  count: number;
  note: string;
};
const memo = new Map<string, { at: number; result: GenesisOwnerResult }>();
const ttlMs = 30_000;

export const readGenesisOwnership = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ owner: z.string().min(32).max(44) }).parse(input))
  .handler(async ({ data }): Promise<GenesisOwnerResult> => {
    const owner = data.owner;
    if (!isSolanaAddress(owner)) throw new Error("A valid Solana wallet address is required.");
    const url = process.env.SENDA_GENESIS_DAS_RPC_URL ?? "";
    const collection = process.env.SENDA_GENESIS_COLLECTION ?? "";
    const registryJson = process.env.SENDA_GENESIS_ASSETS_JSON ?? "";
    if (!url || !isSolanaAddress(collection) || !registryJson) {
      return { state: "unconfigured", owner, ownedIds: [], count: 0,
        note: "Genesis collectibles have not been configured or minted on this installation." };
    }
    const endpoint = new URL(url);
    if (endpoint.protocol !== "https:") {
      return { state: "unavailable", owner, ownedIds: [], count: 0, note: "DAS endpoint must use HTTPS." };
    }
    let registry: Record<string, string>;
    try { registry = parseRegistry(registryJson); }
    catch { return { state: "unavailable", owner, ownedIds: [], count: 0, note: "Genesis mint registry is invalid." }; }
    if (!Object.keys(registry).length) {
      return { state: "unconfigured", owner, ownedIds: [], count: 0, note: "No Genesis NFT mints have been registered." };
    }
    const cacheKey = [owner, collection, registryJson].join(":");
    const old = memo.get(cacheKey);
    if (old && Date.now() - old.at < ttlMs) return old.result;

    const entries = Object.entries(registry);
    const assets: Record<string, unknown> = {};
    try {
      // Bounded batches; no wallet credentials or private keys reach the DAS endpoint.
      for (let start = 0; start < entries.length; start += 4) {
        const chunk = entries.slice(start, start + 4);
        const values = await Promise.all(chunk.map(async ([id, mint]) => {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            signal: AbortSignal.timeout(7000),
            body: JSON.stringify({ jsonrpc: "2.0", id, method: "getAsset", params: { id: mint } }),
          });
          if (!response.ok) throw new Error("DAS provider could not verify ownership.");
          const payload = (await response.json()) as { result?: unknown; error?: unknown };
          if (payload.error || !payload.result) throw new Error("DAS provider returned an unverified response.");
          return { id, asset: payload.result };
        }));
        for (const {id, asset} of values) assets[id] = asset;
      }
      const ownedIds = resolveOwnedGenesisAssets(owner, collection, registry, assets);
      const result: GenesisOwnerResult = {
        state: "verified", owner, ownedIds, count: ownedIds.length,
        note: ownedIds.length
          ? "Ownership was checked against registered mints and the configured Solana collection."
          : "No registered Genesis collectibles were found in this wallet.",
      };
      if (memo.size >= 250) memo.clear();
      memo.set(cacheKey, { at: Date.now(), result });
      return result;
    } catch {
      return { state: "unavailable", owner, ownedIds: [], count: 0,
        note: "The Solana asset provider did not verify ownership. No NFT utilities were unlocked." };
    }
  });
