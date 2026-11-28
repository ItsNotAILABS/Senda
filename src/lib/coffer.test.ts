import assert from "node:assert/strict";
import test from "node:test";
import { matchWallet } from "./coffer.ts";

test("an agent reuses its Coffer wallet instead of opening another", () => {
  const wallets = [
    { id: "wal_house", type: "operational", network: "devnet", label: "Senda devnet deploy", address: "FMn74h5jZMPXoKYYWSTxHiD5j6PeAVsAc6ftkxg6apvA" },
    { id: "wal_agent", type: "agent", network: "devnet", label: "Senda agent", address: "5MCbNsLHuGR1aghnEwWNLDnbRMVvQg1ThekF6mDNKtXs" },
  ];
  const hit = matchWallet(wallets, { type: "agent", network: "devnet", label: "Senda agent" });
  assert.equal(hit?.id, "wal_agent");
  assert.equal(matchWallet(wallets, { type: "agent", network: "mainnet-beta", label: "Senda agent" }), null);
});
