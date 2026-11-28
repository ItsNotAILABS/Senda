/** Agents ask Coffer for an address. They do not invent a key and they do not sign. */

import { cofferWallet } from "@/lib/coffer";
import { cofferSetting } from "@/lib/coffer-setting";
import { patchWorker } from "@/lib/agent-workspace";

export async function assignAgentWallet(id: string, name: string) {
  const setting = cofferSetting();
  if (!setting.on) return null;
  const label = `Senda ${name}`.trim().slice(0, 48);
  const row = await cofferWallet({ data: { label, network: setting.network, type: "agent" } });
  return patchWorker(id, {
    coffer: { id: row.id, address: row.address, network: row.network, type: "agent" },
  });
}
