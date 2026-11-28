import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import nacl from "tweetnacl";
import { PublicKey, Transaction } from "@solana/web3.js";
import { chainRpc, confirmSig, signAndBroadcast } from "@/lib/phantom";
import { readRailText } from "@/lib/rail-read";
import {
  MACHINES,
  PYUSD_MINT,
  SLOT_LIFE,
  USDC_MINT,
  actorPda,
  buildAnchorTx,
  buildDurableMemo,
  buildNonceOpen,
  chainLine,
  edgeHash,
  edgePreimage,
  feeTape,
  freshNonce,
  lookupCount,
  readMintPolicy,
  readNonce,
  type MintPolicy,
} from "@/lib/solana-edge";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const NONCE_KEY = "senda.edge.nonce";

type Pulse = { slot: number; time: string; fee: ReturnType<typeof feeTape> };
type Ask = {
  actor: "mexico" | "brazil";
  concept: string;
  key: string;
  hash: string;
  line: string;
  slot: number;
  until: number;
  pda: string;
};
type Machine = { name: string; role: string; executable: boolean; owner: string; space: number };
type NonceView = { address: string; authority: string; nonce: string; yours: boolean };

function bytesFrom(value: { data?: [string, string] } | null): Uint8Array | null {
  const raw = value?.data?.[0];
  if (!raw) return null;
  const bin = atob(raw);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function accountOf(address: string) {
  const result = (await chainRpc("getAccountInfo", [address, { encoding: "base64" }])) as {
    value?: { data?: [string, string]; executable?: boolean; lamports?: number; owner?: string; space?: number } | null;
  } | null;
  const value = result?.value;
  if (!value) return null;
  return {
    data: bytesFrom(value),
    executable: Boolean(value.executable),
    owner: String(value.owner || ""),
    space: Number(value.space || 0),
    lamports: Number(value.lamports || 0),
  };
}

export function EdgeDesk() {
  const w = useWallet();
  const owner = w.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [pulseError, setPulseError] = useState("");
  const [line, setLine] = useState("");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState("");
  const [mint, setMint] = useState(PYUSD_MINT);
  const [policy, setPolicy] = useState<MintPolicy | null>(null);
  const [nonce, setNonce] = useState("");
  const [nonceView, setNonceView] = useState<NonceView | null>(null);
  const [rent, setRent] = useState("");
  const [held, setHeld] = useState("");
  const [table, setTable] = useState("");
  const [tableCount, setTableCount] = useState<number | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [anchored, setAnchored] = useState("");

  useEffect(() => {
    let stop = false;
    const pull = () => {
      void Promise.all([
        chainRpc("getSlot", []),
        chainRpc("getRecentPrioritizationFees", []),
      ])
        .then(async ([slotRaw, fees]) => {
          const slot = Number(slotRaw);
          if (!(slot > 0)) throw new Error("The cluster did not return a slot.");
          const timeRaw = (await chainRpc("getBlockTime", [slot]).catch(() => null)) as number | null;
          const time = timeRaw ? new Date(timeRaw * 1000).toISOString().slice(0, 19).replace("T", " ") + " UTC" : "The slot has no time yet.";
          const fee = feeTape(Array.isArray(fees) ? (fees as Array<{ prioritizationFee?: number }>) : []);
          if (!stop) {
            setPulse({ slot, time, fee });
            setPulseError("");
          }
        })
        .catch((err) => {
          if (!stop) setPulseError(err instanceof Error ? err.message : "The clock did not answer.");
        });
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(NONCE_KEY) || "";
    if (saved) setNonce(saved);
    void chainRpc("getMinimumBalanceForRentExemption", [80])
      .then((lamports) => setRent((Number(lamports) / 1e9).toFixed(6)))
      .catch(() => setRent(""));
  }, []);

  function readActor(actor: "mexico" | "brazil") {
    if (!pulse) return toast.error(pulseError || "The clock is not in yet.");
    const read = readRailText(actor, line);
    if ("error" in read) return toast.error(read.error);
    const key = read.account.clabe || read.account.pix || read.account.card || read.account.phone || "";
    const preimage = edgePreimage({
      actor,
      corridor: read.corridor,
      usd: read.usd,
      name: read.account.name || "",
      concept: read.account.concept || "",
      key,
      slot: pulse.slot,
    });
    const hash = edgeHash(preimage);
    let pda = "";
    if (owner) {
      try {
        const derived = actorPda(owner, actor);
        if (derived.onCurve) throw new Error("That address is on the curve. It was not used.");
        pda = derived.address;
      } catch (err) {
        return toast.error(err instanceof Error ? err.message : "The actor address could not be derived.");
      }
    }
    setAsk({ actor, concept: read.account.concept || "", key, hash, line: chainLine(actor, hash, pulse.slot), slot: pulse.slot, until: pulse.slot + SLOT_LIFE, pda });
    setAnchored("");
    setHeld("");
  }

  async function signHash() {
    if (!ask) return;
    if (!owner) return toast.error("Connect Phantom. It has to sign. Nothing was sent.");
    if (pulse && pulse.slot > ask.until) return toast.error("That slot expired. Read the sentence again.");
    setBusy("sign");
    try {
      const message = new TextEncoder().encode(ask.line);
      const injected = (window as unknown as {
        phantom?: { solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> } };
        solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> };
      }).phantom?.solana ?? (window as unknown as { solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> } }).solana;
      if (!injected?.signMessage) throw new Error("This wallet cannot sign a message. Nothing was sent.");
      const signed = await injected.signMessage(message, "utf8");
      const signature = signed instanceof Uint8Array ? signed : signed.signature;
      const pubkey = new PublicKey(owner).toBytes();
      if (!nacl.sign.detached.verify(message, signature, pubkey)) throw new Error("The signature does not match the hash line. Nothing was sent.");
      const block = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
      const blockhash = block?.value?.blockhash;
      if (!blockhash) throw new Error("No blockhash.");
      const tx = buildAnchorTx({ owner: new PublicKey(owner), blockhash, message, signature });
      const sig = await signAndBroadcast(tx);
      await confirmSig(sig);
      setAnchored(sig);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The hash was not anchored.");
    } finally {
      setBusy("");
    }
  }

  async function prepareDurable() {
    if (!ask || !owner || !nonce) return toast.error("Open a nonce account first, or paste one this wallet controls.");
    setBusy("hold");
    try {
      const got = await accountOf(nonce.trim());
      if (!got?.data) throw new Error("That nonce account is not on the cluster.");
      const view = readNonce(got.data);
      if (view.authority !== owner) throw new Error("This wallet is not the nonce authority.");
      const tx = buildDurableMemo({ owner: new PublicKey(owner), nonceAccount: new PublicKey(nonce.trim()), nonce: view.nonce, line: ask.line });
      const raw = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      setHeld(btoa(String.fromCharCode(...raw)));
      setNonceView({ address: nonce.trim(), authority: view.authority, nonce: view.nonce, yours: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The nonce could not hold the hash.");
    } finally {
      setBusy("");
    }
  }

  async function signHeld() {
    if (!held) return;
    setBusy("held");
    try {
      const bin = Uint8Array.from(atob(held), (c) => c.charCodeAt(0));
      const tx = Transaction.from(bin);
      const sig = await signAndBroadcast(tx);
      await confirmSig(sig);
      setAnchored(sig);
      setHeld("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The nonce transaction was not signed.");
    } finally {
      setBusy("");
    }
  }

  async function openNonce() {
    if (!owner) return toast.error("Connect the wallet that will own the nonce.");
    setBusy("nonce");
    try {
      const lamports = Number(await chainRpc("getMinimumBalanceForRentExemption", [80]));
      if (!(lamports > 0)) throw new Error("Rent did not come back.");
      const block = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
      const blockhash = block?.value?.blockhash;
      if (!blockhash) throw new Error("No blockhash.");
      const next = freshNonce();
      const tx = buildNonceOpen({ owner: new PublicKey(owner), nonce: next.publicKey, lamports, blockhash });
      tx.partialSign(next);
      const sig = await signAndBroadcast(tx);
      await confirmSig(sig);
      const address = next.publicKey.toBase58();
      window.localStorage.setItem(NONCE_KEY, address);
      setNonce(address);
      toast.success("The nonce account is open. The secret was only used to create it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The nonce account was not opened.");
    } finally {
      setBusy("");
    }
  }

  async function readNonceAccount() {
    if (!nonce.trim()) return;
    setBusy("read-nonce");
    try {
      const got = await accountOf(nonce.trim());
      if (!got?.data) throw new Error("No nonce account at that address.");
      const view = readNonce(got.data);
      setNonceView({ address: nonce.trim(), authority: view.authority, nonce: view.nonce, yours: view.authority === owner });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That account is not a nonce.");
    } finally {
      setBusy("");
    }
  }

  async function readMint() {
    setBusy("mint");
    setPolicy(null);
    try {
      const got = await accountOf(mint.trim());
      if (!got?.data) throw new Error("No account at that mint.");
      setPolicy(readMintPolicy(mint.trim(), got.data, got.owner));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That mint could not be read.");
    } finally {
      setBusy("");
    }
  }

  async function readTable() {
    setBusy("table");
    setTableCount(null);
    try {
      const got = await accountOf(table.trim());
      if (!got?.data) throw new Error("No account at that address.");
      setTableCount(lookupCount(got.data));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That account is not an address lookup table.");
    } finally {
      setBusy("");
    }
  }

  async function readMachines() {
    setBusy("machines");
    try {
      const result = (await chainRpc("getMultipleAccounts", [MACHINES.map((row) => row.id), { encoding: "base64" }])) as {
        value?: Array<{ executable?: boolean; owner?: string; space?: number } | null>;
      };
      const rows = MACHINES.map((row, i) => {
        const value = result?.value?.[i];
        return {
          name: row.name,
          role: row.role,
          executable: Boolean(value?.executable),
          owner: value?.owner || "missing",
          space: Number(value?.space || 0),
        };
      });
      setMachines(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The programs did not answer.");
    } finally {
      setBusy("");
    }
  }

  const actionHref = ask && typeof window !== "undefined"
    ? `${window.location.origin}/api/edge-action?actor=${ask.actor}&hash=${ask.hash}&slot=${ask.slot}`
    : "";
  const stale = Boolean(ask && pulse && pulse.slot > ask.until);

  return (
    <div className="space-y-3">
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Solana, not as a coin</p>
        <h2 className="mt-1 text-xl font-semibold">A clock, a notary, a policy, a nonce.</h2>
        <p className="mt-1 text-sm text-muted">The cluster orders time by slot. A mint can carry a rule. A nonce keeps a signature alive after the blockhash dies. None of this is a SPEI receipt, a Pix end-to-end id, or a USDC send.</p>
        <p className="mt-3 text-xs text-white/40"><Link to="/solana/things" className="underline">Things</Link> uses this clock for a paper, a pass, a lineage, or a handoff. Still not a trade.</p>
        <p className="mt-3 font-mono text-3xl tabular-nums">{pulse ? pulse.slot.toLocaleString("en-US") : "—"}</p>
        <p className="mt-1 text-xs text-white/55">{pulse ? `${pulse.time} · ${pulse.fee.line}` : pulseError || "Reading the clock."}</p>
        {pulse ? <p className="mt-1 text-xs text-white/40">Priority sample {pulse.fee.p50.toLocaleString("en-US")} / {pulse.fee.p90.toLocaleString("en-US")} microlamports. {pulse.fee.hold ? "Hold USDC." : "A send is not blocked by the fee market."}</p> : null}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Notary</p>
        <h2 className="mt-1 text-lg font-semibold">The chain sees the hash. Not the account.</h2>
        <p className="mt-1 text-sm text-muted">Mexico will not hash a Pix line. Brazil will not hash a SPEI line. The actor address is a Memo PDA. It is off the curve, so it has no secret and cannot spend.</p>
        <textarea value={line} onChange={(e) => setLine(e.target.value)} placeholder="100 name Ana Ruiz concept Rent then the CLABE or the Pix key" className="mt-3 min-h-24 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm" />
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => readActor("mexico")} className="min-h-12 flex-1 rounded-full bg-white/10 text-sm">Mexico</button>
          <button type="button" onClick={() => readActor("brazil")} className="min-h-12 flex-1 rounded-full bg-white/10 text-sm">Brazil</button>
        </div>
        {ask ? (
          <div className="mt-3 rounded-2xl bg-white/[0.04] p-3 text-sm">
            <p>{ask.actor === "mexico" ? "Mexico" : "Brazil"} · {ask.concept} · slot {ask.slot.toLocaleString("en-US")} through {ask.until.toLocaleString("en-US")}</p>
            <p className="mt-1 break-all font-mono text-xs text-white/70">{ask.line}</p>
            <p className="mt-1 break-all text-xs text-white/45">{ask.pda ? `Actor ${ask.pda}` : "Connect a wallet to name the actor address. It will be off the curve, so it cannot spend."}</p>
            <p className="mt-1 text-xs text-white/40">{stale ? "The slot expired. Read it again." : "The account number stays in this browser. It is not in the line above."}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={Boolean(busy) || stale} onClick={() => void signHash()} className="min-h-12 flex-1 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">{busy === "sign" ? "Waiting for the wallet" : "Sign the hash"}</button>
              <button type="button" disabled={Boolean(busy) || stale} onClick={() => void prepareDurable()} className="min-h-12 flex-1 rounded-full bg-white/10 px-4 text-sm">{busy === "hold" ? "Reading the nonce" : "Hold it on a nonce"}</button>
            </div>
            {held ? (
              <button type="button" disabled={Boolean(busy)} onClick={() => void signHeld()} className="mt-2 min-h-12 w-full rounded-full bg-white px-4 text-sm font-semibold text-black">{busy === "held" ? "Waiting for the wallet" : "Sign the held nonce"}</button>
            ) : null}
            {anchored ? <p className="mt-2 break-all text-xs text-white/70">Anchored {anchored}. The cluster checked the signature. This is not a bank receipt.</p> : null}
            {actionHref ? <p className="mt-2 break-all text-xs text-white/40">An Actions wallet can request this memo at {actionHref}. It still has to sign. The preview host is not the public link.</p> : null}
          </div>
        ) : null}
        <p className="mt-3 text-xs text-white/40"><Link to="/payments/house" className="underline">House rails</Link> still quote the peso and the real. This page does not.</p>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Nonce</p>
        <h2 className="mt-1 text-lg font-semibold">A signature that outlives the blockhash.</h2>
        <p className="mt-1 text-sm text-muted">A normal transaction dies in about a minute. A nonce account lets the hash wait until you sign. Opening one pays rent{rent ? `, about ${rent} SOL` : ""}. The new secret is used once, to create it. Your wallet is the authority after that.</p>
        <input value={nonce} onChange={(e) => setNonce(e.target.value)} placeholder="Nonce account" className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm" />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={Boolean(busy)} onClick={() => void openNonce()} className="min-h-12 flex-1 rounded-full bg-white px-4 text-sm font-semibold text-black">{busy === "nonce" ? "Waiting for the wallet" : "Open a nonce account"}</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void readNonceAccount()} className="min-h-12 flex-1 rounded-full bg-white/10 px-4 text-sm">Read it</button>
        </div>
        {nonceView ? <p className="mt-2 break-all text-xs text-white/55">Authority {nonceView.authority}. {nonceView.yours ? "This wallet can advance it." : "This wallet is not the authority."} Durable hash {nonceView.nonce.slice(0, 8)}…</p> : null}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Mint policy</p>
        <h2 className="mt-1 text-lg font-semibold">Token-2022 is a rule set.</h2>
        <p className="mt-1 text-sm text-muted">USDC on Solana is a plain balance. A Token-2022 mint can force a hook, take a fee, name a delegate, or refuse to move. Reading it does not send it.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setMint(USDC_MINT)} className="min-h-11 rounded-full bg-white/10 px-3 text-sm">USDC</button>
          <button type="button" onClick={() => setMint(PYUSD_MINT)} className="min-h-11 rounded-full bg-white/10 px-3 text-sm">PYUSD</button>
        </div>
        <input value={mint} onChange={(e) => setMint(e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-xs" />
        <button type="button" disabled={Boolean(busy)} onClick={() => void readMint()} className="mt-2 min-h-12 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">{busy === "mint" ? "Reading" : "Read the mint"}</button>
        {policy ? (
          <ul className="mt-3 space-y-1 text-sm text-white/70">
            {policy.lines.map((row) => <li key={row}>{row}</li>)}
          </ul>
        ) : null}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Lookup table</p>
        <h2 className="mt-1 text-lg font-semibold">Accounts, compressed into one address.</h2>
        <p className="mt-1 text-sm text-muted">A versioned transaction can point at a table. The message stays small. Paste a lookup table. A mint will not parse, and this desk will say so.</p>
        <input value={table} onChange={(e) => setTable(e.target.value)} placeholder="Lookup table address" className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm" />
        <button type="button" disabled={Boolean(busy)} onClick={() => void readTable()} className="mt-2 min-h-12 rounded-full bg-white/10 px-4 text-sm">{busy === "table" ? "Reading" : "Count the addresses"}</button>
        {tableCount != null ? <p className="mt-2 text-sm">{tableCount.toLocaleString("en-US")} addresses in the table.</p> : null}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">The machine</p>
        <h2 className="mt-1 text-lg font-semibold">Programs that are not a swap.</h2>
        <p className="mt-1 text-sm text-muted">These accounts are the cluster’s own tools. An agent can hash a sentence. It cannot sign this, and it cannot mark a bank credit.</p>
        <button type="button" disabled={Boolean(busy)} onClick={() => void readMachines()} className="mt-3 min-h-12 rounded-full bg-white/10 px-4 text-sm">{busy === "machines" ? "Reading" : "Read them"}</button>
        <ul className="mt-3 space-y-2">
          {machines.map((row) => (
            <li key={row.name} className="rounded-2xl bg-white/[0.04] px-3 py-2 text-sm">
              <p>{row.name} · {row.executable ? "executable" : "not executable"} · {row.space.toLocaleString("en-US")} bytes</p>
              <p className="text-xs text-white/45">{row.role}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
