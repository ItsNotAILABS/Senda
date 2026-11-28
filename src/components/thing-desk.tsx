import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { chainRpc, confirmSig, signAndBroadcast } from "@/lib/phantom";
import { buildAnchorTx, readMintPolicy, type MintPolicy } from "@/lib/solana-edge";
import { draftThing, thingName, type ThingDraft, type ThingKind } from "@/lib/thing-route";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const KEY = "senda.things.v1";

const JOBS: { kind: ThingKind; label: string; hint: string; title: string; body: string; parent: string; to: string }[] = [
  {
    kind: "seal",
    label: "Seal",
    hint: "A paper, a photo note, a decision, a build.",
    title: "Lab note",
    body: "The batch exists. The PDF stays off the cluster.",
    parent: "",
    to: "",
  },
  {
    kind: "line",
    label: "Lineage",
    hint: "A memory or a handoff that names its parent.",
    title: "Memory",
    body: "This note follows the sealed batch. The earlier hash is the parent.",
    parent: "genesis",
    to: "",
  },
  {
    kind: "pass",
    label: "Pass",
    hint: "A crew key, a lab door, a device. Not a coin.",
    title: "Crew key",
    body: "Whoever signs this may open the lab desk. This pass cannot be sold from here.",
    parent: "",
    to: "",
  },
  {
    kind: "hand",
    label: "Handoff",
    hint: "Custody moves. No USDC moves.",
    title: "Lab node",
    body: "The lab node changes hands. The machine is not a payment.",
    parent: "",
    to: "",
  },
];

type Receipt = { kind: ThingKind; title: string; hash: string; line: string; slot: number; sig: string; at: number };

function readReceipts(): Receipt[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Receipt[];
    return Array.isArray(rows) ? rows.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function bytesFrom(value: { data?: [string, string] } | null): Uint8Array | null {
  const raw = value?.data?.[0];
  if (!raw) return null;
  const bin = atob(raw);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function ThingDesk() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((link) => link.kind === "phantom" || link.kind === "solana")?.address ?? "";
  const [kind, setKind] = useState<ThingKind>("seal");
  const [title, setTitle] = useState(JOBS[0].title);
  const [body, setBody] = useState(JOBS[0].body);
  const [parent, setParent] = useState("");
  const [to, setTo] = useState("");
  const [slot, setSlot] = useState(0);
  const [clock, setClock] = useState("");
  const [draft, setDraft] = useState<ThingDraft | null>(null);
  const [busy, setBusy] = useState("");
  const [sig, setSig] = useState("");
  const [receipts, setReceipts] = useState<Receipt[]>(() => readReceipts());
  const [mint, setMint] = useState("");
  const [policy, setPolicy] = useState<MintPolicy | null>(null);
  const shown = useRef<HTMLDivElement>(null);
  const job = JOBS.find((row) => row.kind === kind) ?? JOBS[0];
  const stale = Boolean(draft && slot > draft.until);
  let name = "";
  if (owner && draft) {
    try {
      const named = thingName(owner, draft.kind, draft.title);
      if (!named.onCurve) name = named.address;
    } catch {
      name = "";
    }
  }

  useEffect(() => {
    let stop = false;
    const pull = () => {
      void chainRpc("getSlot", [])
        .then(async (raw) => {
          const next = Number(raw);
          if (!(next > 0)) throw new Error("The cluster did not return a slot.");
          if (!stop) setSlot(next);
          const timeRaw = (await Promise.race([
            chainRpc("getBlockTime", [next]).catch(() => null),
            new Promise((resolve) => window.setTimeout(() => resolve(null), 4000)),
          ])) as number | null;
          const time = timeRaw ? new Date(timeRaw * 1000).toISOString().slice(0, 19).replace("T", " ") + " UTC" : "The slot has no time yet.";
          if (!stop) setClock(time);
        })
        .catch(() => {
          if (!stop) setClock("The clock did not answer.");
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
    if (!draft) return;
    shown.current?.scrollIntoView({ block: "center" });
  }, [draft]);

  function pick(next: (typeof JOBS)[number]) {
    setKind(next.kind);
    setTitle(next.title);
    setBody(next.body);
    setParent(next.parent);
    setTo(next.to);
    setDraft(null);
    setSig("");
  }

  function hashIt() {
    if (!(slot > 0)) return toast.error(clock || "The clock is not in yet.");
    const next = draftThing({ kind, title, body, parent, to, slot });
    if ("error" in next) return toast.error(next.error);
    setDraft(next);
    setSig("");
  }

  async function sign() {
    if (!draft) return;
    if (!owner) return toast.error("Connect Phantom. It has to sign. Nothing was sent.");
    if (slot > draft.until) return toast.error("That slot expired. Hash it again.");
    setBusy("sign");
    try {
      const message = new TextEncoder().encode(draft.line);
      const injected = (window as unknown as {
        phantom?: { solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> } };
        solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> };
      }).phantom?.solana ?? (window as unknown as { solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> } }).solana;
      if (!injected?.signMessage) throw new Error("This wallet cannot sign a message. Nothing was sent.");
      const signed = await injected.signMessage(message, "utf8");
      const signature = signed instanceof Uint8Array ? signed : signed.signature;
      const pubkey = new PublicKey(owner).toBytes();
      if (!nacl.sign.detached.verify(message, signature, pubkey)) throw new Error("The signature does not match the line. Nothing was sent.");
      const block = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
      const blockhash = block?.value?.blockhash;
      if (!blockhash) throw new Error("No blockhash.");
      const tx = buildAnchorTx({ owner: new PublicKey(owner), blockhash, message, signature });
      const anchored = await signAndBroadcast(tx, "Thing");
      await confirmSig(anchored);
      const row: Receipt = { kind: draft.kind, title: draft.title, hash: draft.hash, line: draft.line, slot: draft.slot, sig: anchored, at: Date.now() };
      const kept = [row, ...readReceipts()].slice(0, 8);
      window.localStorage.setItem(KEY, JSON.stringify(kept));
      setReceipts(kept);
      setSig(anchored);
      toast.success("Anchored. The cluster has the hash, not the words.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The thing was not anchored.");
    } finally {
      setBusy("");
    }
  }

  async function readMint() {
    setBusy("mint");
    setPolicy(null);
    try {
      const result = (await chainRpc("getAccountInfo", [mint.trim(), { encoding: "base64" }])) as {
        value?: { data?: [string, string]; owner?: string } | null;
      } | null;
      const value = result?.value;
      const data = bytesFrom(value ?? null);
      if (!data || !value?.owner) throw new Error("No mint at that address.");
      setPolicy(readMintPolicy(mint.trim(), data, value.owner));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That mint could not be read.");
    } finally {
      setBusy("");
    }
  }

  const identity = policy?.lines.some((row) => /non-transferable/i.test(row)) ?? false;

  return (
    <div className="space-y-3 pb-28">
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Solana, as a record</p>
        <h2 className="mt-1 text-xl font-semibold">A thing. Not a trade.</h2>
        <p className="mt-1 text-sm text-muted">A seal, a lineage, a pass, or a handoff. The memo carries the hash. The words stay here. No USDC moves.</p>
        <p className="mt-2 font-mono text-sm text-white/70">{slot ? `Slot ${slot.toLocaleString("en-US")}` : "Reading the clock."}{clock && slot ? ` · ${clock}` : ""}</p>
        <p className="mt-3 text-xs text-white/40">
          <Link to="/solana/edges" className="underline">Edges</Link> is the same clock, used on a payment sentence. <Link to="/solana/launch" className="underline">Launch</Link> is a product or a piece of software, with a price and a split. This page is not a payment.
        </p>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {JOBS.map((row) => (
            <button key={row.kind} type="button" onClick={() => pick(row)} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${kind === row.kind ? "bg-white text-black" : "bg-white/10 text-white/80"}`}>
              {row.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-white/55">{job.hint}</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name" className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="What it is. This does not go on the cluster." className="mt-2 min-h-20 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm" />
        {kind === "line" ? (
          <input value={parent} onChange={(e) => setParent(e.target.value)} placeholder="genesis, or the parent hash" className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-xs" />
        ) : null}
        {kind === "hand" ? (
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="The other wallet. It is not paid." className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-xs" />
        ) : null}
        <button type="button" onClick={hashIt} className="sticky bottom-[5.75rem] z-10 mt-3 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black">
          Hash it against the slot
        </button>
        {draft ? (
          <div ref={shown} className="mt-3 rounded-2xl bg-white/[0.04] p-3 text-sm">
            <p className="font-semibold">{draft.title}</p>
            <p className="mt-1 text-xs text-white/45">Slot {draft.slot.toLocaleString("en-US")} through {draft.until.toLocaleString("en-US")}. The title is not in the line.</p>
            <p className="mt-2 break-all font-mono text-xs text-white/70">{draft.line}</p>
            <p className="mt-2 break-all text-xs text-white/45">{name ? `Name ${name}. Off the curve, so it cannot spend.` : "Connect a wallet to name it. The name cannot spend."}</p>
            <p className="mt-1 text-xs text-white/40">{stale ? "The slot expired. Hash it again." : "Nothing is sent until Phantom signs."}</p>
            <button type="button" disabled={Boolean(busy) || stale} onClick={() => void sign()} className="mt-3 min-h-12 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
              {busy === "sign" ? "Waiting for Phantom" : "Sign with Phantom"}
            </button>
            {sig ? <p className="mt-2 break-all text-xs text-white/70">Anchored {sig}. <a className="underline" href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer">View the memo</a>. This is not a payment.</p> : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Already a mint</p>
        <h2 className="mt-1 text-lg font-semibold">A pass does not spend.</h2>
        <p className="mt-1 text-sm text-muted">Paste a mint. If Token-2022 marked it non-transferable, it is an identity. A plain mint is a balance. Reading it does not send it, and this desk does not mint one.</p>
        <input value={mint} onChange={(e) => setMint(e.target.value)} placeholder="Mint address" className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-xs" />
        <button type="button" disabled={Boolean(busy) || mint.trim().length < 32} onClick={() => void readMint()} className="mt-2 min-h-12 rounded-full bg-white/10 px-4 text-sm">
          {busy === "mint" ? "Reading" : "Read the mint"}
        </button>
        {policy ? (
          <div className="mt-3 text-sm text-white/70">
            <p className="font-semibold text-white">{identity ? "This mint is an identity. It is not a coin you can send." : "This mint can move. It is not a pass."}</p>
            <ul className="mt-2 space-y-1">
              {policy.lines.map((row) => <li key={row}>{row}</li>)}
            </ul>
          </div>
        ) : null}
      </section>

      {receipts.length ? (
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Anchored from this phone</p>
          <ul className="mt-3 space-y-2">
            {receipts.map((row) => (
              <li key={row.sig} className="rounded-2xl bg-white/[0.04] px-3 py-3">
                <p className="text-sm font-semibold">{row.title} · {row.kind}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-white/45">{row.hash}</p>
                <a className="mt-1 inline-block text-xs text-white/55 underline" href={`https://solscan.io/tx/${row.sig}`} target="_blank" rel="noreferrer">Memo {row.sig.slice(0, 8)}…</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
