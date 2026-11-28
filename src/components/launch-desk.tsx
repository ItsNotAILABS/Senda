import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { chainRpc, confirmSig, signAndBroadcast } from "@/lib/phantom";
import { buildAnchorTx } from "@/lib/solana-edge";
import { draftThing } from "@/lib/thing-route";
import { payBatch, payUsdc } from "@/lib/solana-pay";
import { spendCap } from "@/lib/spend-cap";
import { launchProgram, launchRent } from "@/lib/solana-native";
import { explainPayment } from "@/lib/payment-error";
import { passkeyBlocks } from "@/lib/passkey";
import {
  handoff,
  isSeat,
  loadIssues,
  markUse,
  payLegs,
  planIssue,
  ruleLegs,
  saveIssues,
  seatState,
  spendAgainst,
  splitAmounts,
  type Edition,
  type Issue,
  type IssueKind,
  type IssuePlan,
  type Leg,
} from "@/lib/product-issue";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const field = "min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none";

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function short(value: string): string {
  if (value.length < 12) return value || "—";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

async function anchor(owner: string, line: string): Promise<string> {
  const message = new TextEncoder().encode(line);
  const injected = (window as unknown as {
    phantom?: { solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> } };
    solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> };
  }).phantom?.solana ?? (window as unknown as { solana?: { signMessage?: (m: Uint8Array, d?: string) => Promise<{ signature: Uint8Array } | Uint8Array> } }).solana;
  if (!injected?.signMessage) throw new Error("This wallet cannot sign a message. Nothing was sent.");
  const signed = await injected.signMessage(message, "utf8");
  const signature = signed instanceof Uint8Array ? signed : signed.signature;
  if (!nacl.sign.detached.verify(message, signature, new PublicKey(owner).toBytes())) {
    throw new Error("The signature does not match the line. Nothing was sent.");
  }
  const block = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  const blockhash = block?.value?.blockhash;
  if (!blockhash) throw new Error("No blockhash.");
  const tx = buildAnchorTx({ owner: new PublicKey(owner), blockhash, message, signature });
  const sig = await signAndBroadcast(tx, "Issue");
  await confirmSig(sig);
  return sig;
}

async function settle(owner: string, rule: Leg[], hash: string): Promise<string> {
  const legs = payLegs(owner, rule);
  const memo = `senda.issue.1 ${hash.slice(0, 16)}`;
  if (legs.length === 0) throw new Error("Nothing leaves this wallet. Your own share is not a payment.");
  if (legs.length === 1) {
    const paid = await payUsdc({ owner, to: legs[0].to, usd: legs[0].usd, memo });
    return paid.signature;
  }
  return payBatch({ owner, rows: legs.map((row) => ({ to: row.to, usd: row.usd, memo })) });
}

export function LaunchDesk() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((link) => link.kind === "phantom" || link.kind === "solana")?.address ?? "";
  const [kind, setKind] = useState<IssueKind>("product");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState("25");
  const [makerPct, setMakerPct] = useState("70");
  const [contribPct, setContribPct] = useState("20");
  const [heldPct, setHeldPct] = useState("10");
  const [contributor, setContributor] = useState("");
  const [reserve, setReserve] = useState("");
  const [allow, setAllow] = useState("Use it.");
  const [quota, setQuota] = useState("100");
  const [days, setDays] = useState("30");
  const [parent, setParent] = useState("");
  const [slot, setSlot] = useState(0);
  const [plan, setPlan] = useState<IssuePlan | null>(null);
  const [rows, setRows] = useState<Issue[]>(() => loadIssues());
  const [busy, setBusy] = useState("");
  const [grantTo, setGrantTo] = useState("");
  const [handTo, setHandTo] = useState("");
  const [capText, setCapText] = useState("20");
  const [agentUsd, setAgentUsd] = useState("5");
  const [cliLine, setCliLine] = useState("");
  const [programKey, setProgramKey] = useState("");
  const [programRent, setProgramRent] = useState<number | null>(null);
  const cap = spendCap();

  useEffect(() => {
    let stop = false;
    const pull = () => {
      void chainRpc("getSlot", [])
        .then((raw) => {
          const next = Number(raw);
          if (!stop && next > 0) setSlot(next);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    void launchRent({ data: { bytes: 69944 } })
      .then((row) => setProgramRent(row.sol))
      .catch(() => setProgramRent(null));
  }, []);

  function keep(next: Issue[]) {
    saveIssues(next);
    setRows(next);
  }

  function hashIt() {
    if (!owner) return toast.error("Connect Phantom. The maker is that wallet.");
    if (!(slot > 0)) return toast.error("The clock is not in yet.");
    const next = planIssue({
      kind,
      title,
      body,
      priceUsd: Number(price),
      maker: owner,
      makerBps: Math.round(Number(makerPct) * 100),
      contributorBps: Math.round(Number(contribPct) * 100),
      heldBps: Math.round(Number(heldPct) * 100),
      contributor,
      reserve,
      allow,
      quota: Number(quota),
      days: Number(days),
      parent,
      slot,
    });
    if ("error" in next) return toast.error(next.error);
    setPlan(next);
  }

  async function publish() {
    if (!plan || !owner) return;
    if (slot > plan.draft.until) return toast.error("That slot expired. Hash it again.");
    setBusy("publish");
    try {
      const sig = await anchor(owner, plan.draft.line);
      const row: Issue = {
        id: plan.draft.hash.slice(0, 16),
        kind: plan.kind,
        title: plan.title,
        body: plan.body,
        priceUsd: plan.priceUsd,
        maker: plan.maker,
        contributor: plan.contributor,
        reserve: plan.reserve,
        makerBps: plan.makerBps,
        contributorBps: plan.contributorBps,
        heldBps: plan.heldBps,
        allow: plan.allow,
        quota: plan.quota,
        days: plan.days,
        parent: plan.parent,
        hash: plan.draft.hash,
        line: plan.draft.line,
        thing: plan.thing,
        slot: plan.draft.slot,
        sig,
        editions: [],
        capUsd: 0,
        capSpent: 0,
        at: Date.now(),
      };
      keep([row, ...loadIssues().filter((item) => item.hash !== row.hash)]);
      toast.success("Anchored. The cluster has the hash, not the name.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nothing was anchored.");
    } finally {
      setBusy("");
    }
  }

  function editionFrom(issue: Issue, buyer: string, sig: string, usd: number, sold: boolean, paid: Leg[]): Edition {
    const until = isSeat(issue.kind) ? Date.now() + issue.days * 86_400_000 : 0;
    return {
      serial: issue.editions.length + 1,
      buyer,
      owner: buyer,
      sig,
      handSig: "",
      at: Date.now(),
      usd,
      sold,
      paid,
      seat: isSeat(issue.kind) ? { quota: issue.quota, left: issue.quota, until, revoked: false } : null,
    };
  }

  async function buy(issue: Issue) {
    if (!owner) return toast.error("Connect Phantom. The buyer is that wallet.");
    if (!issue.sig) return toast.error("Publish it before anyone pays.");
    setBusy(issue.id);
    try {
      const amounts = splitAmounts(issue.priceUsd, issue.makerBps, issue.contributorBps, issue.heldBps);
      if ("error" in amounts) throw new Error(amounts.error);
      const rule = ruleLegs({
        maker: issue.maker,
        contributor: issue.contributor,
        reserve: issue.reserve,
        ...amounts,
      });
      if ("error" in rule) throw new Error(rule.error);
      const sig = await settle(owner, rule, issue.hash);
      const next = loadIssues().map((row) =>
        row.hash === issue.hash ? { ...row, editions: [...row.editions, editionFrom(row, owner, sig, issue.priceUsd, true, rule)] } : row,
      );
      keep(next);
      toast.success("Paid. The edition is this signature, not a coin.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nothing was paid.");
    } finally {
      setBusy("");
    }
  }

  function grant(issue: Issue) {
    if (owner !== issue.maker) return toast.error("Only the maker can issue a seat.");
    let to = "";
    try {
      to = new PublicKey(grantTo.trim()).toBase58();
    } catch {
      return toast.error("That is not a Solana address. Nothing was issued.");
    }
    const next = loadIssues().map((row) =>
      row.hash === issue.hash ? { ...row, editions: [...row.editions, editionFrom(row, to, "", 0, false, [])] } : row,
    );
    keep(next);
    setGrantTo("");
    toast.success(isSeat(issue.kind) ? "Seat issued. No USDC moved. This is not a Token-2022 mint." : "Unit recorded. No USDC moved.");
  }

  async function hand(issue: Issue, edition: Edition) {
    if (!owner) return toast.error("Connect Phantom.");
    if (owner !== edition.owner) return toast.error("Only the current holder can hand this off.");
    const moved = handoff(issue.kind, edition.owner, handTo);
    if ("error" in moved) return toast.error(moved.error);
    if (!(slot > 0)) return toast.error("The clock is not in yet.");
    setBusy(`hand-${edition.serial}`);
    try {
      const draft = draftThing({
        kind: "hand",
        title: issue.title,
        body: "Title moves to the other wallet. This handoff is not a payment.",
        to: moved.to,
        slot,
      });
      if ("error" in draft) throw new Error(draft.error);
      const sig = await anchor(owner, draft.line);
      const next = loadIssues().map((row) =>
        row.hash === issue.hash
          ? { ...row, editions: row.editions.map((item) => (item.serial === edition.serial ? { ...item, owner: moved.to, handSig: sig } : item)) }
          : row,
      );
      keep(next);
      setHandTo("");
      toast.success("Handed off. No USDC moved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The handoff was not signed.");
    } finally {
      setBusy("");
    }
  }

  function revoke(issue: Issue, edition: Edition) {
    if (owner !== issue.maker) return toast.error("Only the maker can revoke this seat.");
    if (!edition.seat) return;
    const next = loadIssues().map((row) =>
      row.hash === issue.hash
        ? {
            ...row,
            editions: row.editions.map((item) =>
              item.serial === edition.serial && item.seat ? { ...item, seat: { ...item.seat, revoked: true } } : item,
            ),
          }
        : row,
    );
    keep(next);
    toast.success("Revoked on this desk. Another app will not see it. This did not burn a mint.");
  }

  function useOnce(issue: Issue, edition: Edition) {
    if (!edition.seat) return;
    const seat = markUse(edition.seat, Date.now());
    if ("error" in seat) return toast.error(seat.error);
    const next = loadIssues().map((row) =>
      row.hash === issue.hash
        ? { ...row, editions: row.editions.map((item) => (item.serial === edition.serial ? { ...item, seat } : item)) }
        : row,
    );
    keep(next);
  }

  function arm(issue: Issue) {
    if (passkeyBlocks()) return toast.error("Unlock the passkey on Portfolio. It approves this visit. It does not sign.");
    if (owner !== issue.maker) return toast.error("Only the maker sets the agent cap.");
    const usd = Number(capText);
    if (!(usd > 0)) return toast.error("Set a cap.");
    keep(loadIssues().map((row) => (row.hash === issue.hash ? { ...row, capUsd: Math.round(usd * 100) / 100 } : row)));
    toast.success("Cap set. Nothing was spent.");
  }

  async function agentPay(issue: Issue) {
    if (passkeyBlocks()) return toast.error("Unlock the passkey on Portfolio. It approves this visit. It does not sign.");
    if (!owner) return toast.error("Connect Phantom. The agent does not sign.");
    const usd = Number(agentUsd);
    const room = spendAgainst(issue.capUsd, issue.capSpent, usd);
    if ("error" in room) return toast.error(room.error);
    setBusy(`cap-${issue.id}`);
    try {
      const amounts = splitAmounts(usd, issue.makerBps, issue.contributorBps, issue.heldBps);
      if ("error" in amounts) throw new Error(amounts.error);
      const rule = ruleLegs({ maker: issue.maker, contributor: issue.contributor, reserve: issue.reserve, ...amounts });
      if ("error" in rule) throw new Error(rule.error);
      await settle(owner, rule, issue.hash);
      keep(loadIssues().map((row) => (row.hash === issue.hash ? { ...row, capSpent: room.spent } : row)));
      toast.success("Paid inside the cap. The split is this payment, not a yield token.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nothing was paid.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-3 pb-28">
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Launch</p>
        <h2 className="mt-1 text-xl font-semibold">A thing, a price, a split.</h2>
        <p className="mt-1 text-sm text-muted">
          A product or a piece of software. The memo carries the hash. The name stays here. USDC moves only when Phantom signs, and only for a price already set. This is not a coin and not a claim on future revenue.
        </p>
        <p className="mt-2 font-mono text-xs text-white/55">{slot ? `Slot ${slot.toLocaleString("en-US")}` : "Reading the clock."} · Send cap {money(cap)}</p>
        <p className="mt-3 text-xs text-white/45">
          <Link to="/solana/things" className="underline">Things</Link> still seals a paper, a pass, a lineage, or a handoff. This page is the price and the split.
        </p>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Solana CLI</p>
        <h2 className="mt-1 text-lg font-semibold">An agent can open a program account.</h2>
        <p className="mt-1 text-sm text-muted">A new program address is free. Deploy puts the treasury program on that address and the house wallet pays the rent{programRent == null ? "" : `, about ${programRent.toFixed(3)} SOL`}. Draw on the program stays closed.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy === "cli"} onClick={() => {
            setBusy("cli");
            void launchRent({ data: { bytes: 92 } })
              .then((row) => setCliLine(`Rent for 92 bytes is ${row.sol.toFixed(6)} SOL.`))
              .catch((error) => toast.error(error instanceof Error ? error.message : "Rent was not read."))
              .finally(() => setBusy(""));
          }} className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold">Rent</button>
          <button type="button" disabled={busy === "cli"} onClick={() => {
            setBusy("cli");
            void launchProgram({ data: {} })
              .then((row) => {
                if (!("keyFile" in row)) return;
                setProgramKey(row.keyFile);
                setCliLine(`Program address ${row.programId}. Not deployed.`);
              })
              .catch((error) => toast.error(error instanceof Error ? error.message : "No program address."))
              .finally(() => setBusy(""));
          }} className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold">New program address</button>
          <button type="button" disabled={busy === "cli" || !programKey} onClick={() => {
            setBusy("cli");
            void launchProgram({ data: { deploy: true, keyFile: programKey } })
              .then((row) => setCliLine("programId" in row ? `Deployed ${row.programId}.` : "Deployed."))
              .catch((error) => toast.error(explainPayment(error)))
              .finally(() => setBusy(""));
          }} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">Deploy{programRent == null ? "" : ` · ${programRent.toFixed(3)} SOL`}</button>
        </div>
        {cliLine ? <p className="mt-3 break-all font-mono text-[11px] text-white/55">{cliLine}</p> : null}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <div className="flex flex-wrap gap-2">
          {([
            ["product", "Product"],
            ["file", "File"],
            ["software", "Software"],
            ["license", "License"],
            ["service", "Service"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setKind(id); setPlan(null); }} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${kind === id ? "bg-white text-black" : "bg-white/10 text-white/80"}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-white/55">
          {isSeat(kind)
            ? "A seat. This many uses, until the date. It does not resell."
            : "One unit. It can be handed to a new holder. The handoff does not pay anyone."}
        </p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name" aria-label="Name" className={`mt-3 ${field}`} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="What it is. This does not go on the cluster." aria-label="What it is" className="mt-2 min-h-20 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none" />
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" aria-label="Price in USDC" placeholder="Price, USDC" className={`mt-2 ${field} font-mono`} />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <label className="text-[11px] text-white/45">Maker %
            <input value={makerPct} onChange={(e) => setMakerPct(e.target.value)} inputMode="numeric" aria-label="Maker percent" className={`mt-1 ${field} font-mono`} />
          </label>
          <label className="text-[11px] text-white/45">Contributor %
            <input value={contribPct} onChange={(e) => setContribPct(e.target.value)} inputMode="numeric" aria-label="Contributor percent" className={`mt-1 ${field} font-mono`} />
          </label>
          <label className="text-[11px] text-white/45">Held %
            <input value={heldPct} onChange={(e) => setHeldPct(e.target.value)} inputMode="numeric" aria-label="Held percent" className={`mt-1 ${field} font-mono`} />
          </label>
        </div>
        <input value={contributor} onChange={(e) => setContributor(e.target.value)} placeholder="Contributor wallet, if their share is not zero" aria-label="Contributor wallet" className={`mt-2 ${field} font-mono text-xs`} />
        <input value={reserve} onChange={(e) => setReserve(e.target.value)} placeholder="Reserve wallet. Blank holds that share with the maker." aria-label="Reserve wallet" className={`mt-2 ${field} font-mono text-xs`} />
        <input value={allow} onChange={(e) => setAllow(e.target.value)} placeholder="What the holder may do" aria-label="What the holder may do" className={`mt-2 ${field}`} />
        {isSeat(kind) ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input value={quota} onChange={(e) => setQuota(e.target.value)} inputMode="numeric" aria-label="Uses" placeholder="Uses" className={`${field} font-mono`} />
            <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" aria-label="Days" placeholder="Days" className={`${field} font-mono`} />
          </div>
        ) : null}
        <label className="mt-2 block text-[11px] text-white/45">Follows
          <select value={parent} onChange={(e) => setParent(e.target.value)} aria-label="Parent" className={`mt-1 ${field}`}>
            <option value="">First. No parent.</option>
            {rows.map((row) => (
              <option key={row.hash} value={row.hash}>{row.title} · {row.hash.slice(0, 8)}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={hashIt} className="mt-3 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black">
          Hash it against the slot
        </button>
        {plan ? (
          <div className="mt-3 rounded-2xl bg-white/[0.04] p-3 text-sm">
            <p className="font-semibold">{plan.title} · {plan.thing}</p>
            <p className="mt-1 text-xs text-white/55">
              {money(plan.makerUsd)} maker · {money(plan.contributorUsd)} contributor · {money(plan.heldUsd)} held
            </p>
            <p className="mt-2 break-all font-mono text-[11px] text-white/70">{plan.draft.line}</p>
            <p className="mt-2 text-xs text-white/40">{slot > plan.draft.until ? "The slot expired. Hash it again." : "Nothing is on the cluster until Phantom signs."}</p>
            <button type="button" disabled={Boolean(busy) || slot > plan.draft.until} onClick={() => void publish()} className="mt-3 min-h-12 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
              {busy === "publish" ? "Waiting for Phantom" : "Sign with Phantom"}
            </button>
          </div>
        ) : null}
      </section>

      {rows.map((issue) => (
        <section key={issue.hash} className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">{issue.kind} · {issue.thing}</p>
          <h3 className="mt-1 text-lg font-semibold">{issue.title}</h3>
          <p className="mt-1 text-sm text-white/60">{issue.allow}</p>
          <p className="mt-2 font-mono text-sm">{money(issue.priceUsd)} · {issue.makerBps / 100}% / {issue.contributorBps / 100}% / {issue.heldBps / 100}%</p>
          <p className="mt-1 text-xs text-white/45">Maker {short(issue.maker)}{issue.contributor ? ` · Contributor ${short(issue.contributor)}` : ""}{issue.parent ? ` · Follows ${issue.parent.slice(0, 8)}` : ""}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-white/40">{issue.hash}</p>
          {issue.sig ? (
            <a className="mt-1 inline-block text-xs text-white/55 underline" href={`https://solscan.io/tx/${issue.sig}`} target="_blank" rel="noreferrer">Memo {issue.sig.slice(0, 8)}…</a>
          ) : (
            <p className="mt-1 text-xs text-[#ff5d73]">Not on the cluster yet.</p>
          )}
          <button type="button" disabled={Boolean(busy) || !issue.sig} onClick={() => void buy(issue)} className="mt-3 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
            {busy === issue.id ? "Waiting for Phantom" : `Buy one edition · ${money(issue.priceUsd)}`}
          </button>
          {owner === issue.maker ? (
            <div className="mt-2 flex gap-2">
              <input value={grantTo} onChange={(e) => setGrantTo(e.target.value)} placeholder={isSeat(issue.kind) ? "Seat for this wallet" : "Record a unit for this wallet"} aria-label="Grant to" className={`${field} font-mono text-xs`} />
              <button type="button" onClick={() => grant(issue)} className="min-h-12 shrink-0 rounded-full bg-white/10 px-4 text-sm font-semibold">
                {isSeat(issue.kind) ? "Issue seat" : "Record unit"}
              </button>
            </div>
          ) : null}
          <ul className="mt-3 space-y-2">
            {issue.editions.map((edition) => {
              const state = edition.seat ? seatState(edition.seat, Date.now()) : null;
              return (
                <li key={edition.serial} className="rounded-2xl bg-white/[0.04] px-3 py-3 text-sm">
                  <p className="font-semibold">#{edition.serial} · {short(edition.owner)}{edition.sold ? "" : " · not a sale"}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {edition.sold ? `Paid ${money(edition.usd)}` : "No USDC moved."}
                    {edition.sig ? ` · ${edition.sig.slice(0, 8)}…` : ""}
                    {edition.handSig ? ` · hand ${edition.handSig.slice(0, 8)}…` : ""}
                    {state ? ` · ${state}${edition.seat ? ` · ${edition.seat.left} left` : ""}` : ""}
                  </p>
                  {issue.kind === "product" && owner === edition.owner ? (
                    <div className="mt-2 flex gap-2">
                      <input value={handTo} onChange={(e) => setHandTo(e.target.value)} placeholder="New holder. Not a payment." aria-label="New holder" className={`${field} font-mono text-xs`} />
                      <button type="button" disabled={Boolean(busy)} onClick={() => void hand(issue, edition)} className="min-h-12 shrink-0 rounded-full bg-white/10 px-4 text-sm font-semibold">
                        Hand off
                      </button>
                    </div>
                  ) : null}
                  {edition.seat && state === "live" ? (
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => useOnce(issue, edition)} className="min-h-11 flex-1 rounded-full bg-white/10 text-sm font-semibold">Mark a use</button>
                      {owner === issue.maker ? (
                        <button type="button" onClick={() => revoke(issue, edition)} className="min-h-11 flex-1 rounded-full border border-white/15 text-sm font-semibold">Revoke</button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Agent cap</p>
            <p className="mt-1 text-xs text-white/45">
              {issue.capUsd > 0 ? `${money(issue.capSpent)} of ${money(issue.capUsd)} used.` : "No cap yet."} A passkey, if this phone has one, has to be open. The agent does not sign.
            </p>
            {owner === issue.maker ? (
              <div className="mt-2 flex gap-2">
                <input value={capText} onChange={(e) => setCapText(e.target.value)} inputMode="decimal" aria-label="Cap" className={`${field} font-mono`} />
                <button type="button" onClick={() => arm(issue)} className="min-h-12 shrink-0 rounded-full bg-white/10 px-4 text-sm font-semibold">Set cap</button>
              </div>
            ) : null}
            <div className="mt-2 flex gap-2">
              <input value={agentUsd} onChange={(e) => setAgentUsd(e.target.value)} inputMode="decimal" aria-label="Pay inside the cap" className={`${field} font-mono`} />
              <button type="button" disabled={Boolean(busy)} onClick={() => void agentPay(issue)} className="min-h-12 shrink-0 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
                Pay
              </button>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
