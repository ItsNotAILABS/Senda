/** One switch. Agents read it. Phantom is not this switch. */

const KEY = "senda.coffer.setting.v1";

export type CofferSetting = { on: boolean; network: "devnet" | "mainnet-beta" };

export function cofferSetting(): CofferSetting {
  if (typeof window === "undefined") return { on: true, network: "devnet" };
  try {
    const row = JSON.parse(window.localStorage.getItem(KEY) || "") as Partial<CofferSetting>;
    return { on: row.on !== false, network: row.network === "mainnet-beta" ? "mainnet-beta" : "devnet" };
  } catch {
    return { on: true, network: "devnet" };
  }
}

export function saveCofferSetting(next: CofferSetting) {
  window.localStorage.setItem(KEY, JSON.stringify({ on: next.on, network: next.network === "mainnet-beta" ? "mainnet-beta" : "devnet" }));
}

export async function solBalance(address: string, network: CofferSetting["network"]): Promise<number> {
  const url = network === "devnet" ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com";
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address, { commitment: "confirmed" }] }),
  });
  const json = (await res.json()) as { result?: { value?: number } };
  return (json.result?.value ?? 0) / 1_000_000_000;
}
