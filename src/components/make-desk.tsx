import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cleanTag, openRevolutPay, readRevolut, revolutPayUrl, saveRevolut } from "@/lib/revolut-link";
import { openSleeveOrder, signSleeveOrder } from "@/lib/sleeve";
import { KINDS, kindLabel, listListings, saveListing, type Listing, type MakeKind } from "@/lib/make-board";
import { payUsdc } from "@/lib/solana-pay";
import { humanWalletError } from "@/lib/mobile-wallet";
import { SignedReceipt } from "@/components/money-flow";
import { DeskAudit } from "@/components/money-flow";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";
import { JumpStrip } from "@/components/jump-strip";
import { allowanceFor, listAllowances, saveAllowance } from "@/lib/allowance";
import { PRESTOCK_MINTS } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";

export function MakeDesk({ embedded = false }: { embedded?: boolean }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [rows, setRows] = useState<Listing[]>(() => (typeof window === "undefined" ? [] : listListings()));
  const [kind, setKind] = useState<MakeKind>("payroll");
  const [mine, setMine] = useState("");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [usd, setUsd] = useState("200");
  const [payTo, setPayTo] = useState("");
  const [revtag, setRevtag] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [arm, setArm] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ id: string; sig: string; usd: number } | null>(null);
  const [filter, setFilter] = useState<MakeKind | "all">("all");
  const [other, setOther] = useState("");
  const [cap, setCap] = useState("25");
  const [grants, setGrants] = useState(() => (typeof window === "undefined" ? [] : listAllowances()));
  const [name, setName] = useState<(typeof PRESTOCK_MINTS)[number][0]>("SPACEX");
  const [grantUsd, setGrantUsd] = useState("1");
  const grant = owner ? allowanceFor(owner) : null;
  const shown = filter === "all" ? rows : rows.filter((r) => r.kind === filter);

  function post() {
    const n = Math.round(Number(usd) * 100) / 100;
    if (!title.trim()) return toast.error("Name what you are offering, or what you need.");
    if (!(n > 0)) return toast.error("Set a price in USDC.");
    if (payTo.trim().length < 32) return toast.error("Paste the Solana address that should receive the USDC.");
    const tag = cleanTag(revtag);
    const row = saveListing({ kind, title: title.trim(), detail: detail.trim(), usd: n, payTo: payTo.trim(), ...(tag ? { revtag: tag } : {}) });
    setRows((r) => [row, ...r]);
    setTitle("");
    setDetail("");
    setRevtag("");
    toast.success("It’s on the board. USDC goes to the address. Revolut goes to the Revtag, if you set one.");
  }

  return (
    <main className={embedded ? "space-y-4" : "space-y-4 px-5 py-4 lg:px-8"}>
      {embedded ? null : <JumpStrip />}
      {embedded ? null : <DeskAudit live="Paying a listing signs USDC from the wallet to the address on the card." hold="Posting a listing does not move money. The number on Shop is not this payment." />}
      <section className="rounded-[28px] bg-[#141824] p-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">Their wallet</p>
        <h2 className="mt-1 text-xl">A cap for a wallet they own</h2>
        {grant ? (
          <div className="mt-3">
            <p className="text-sm text-subtle">This wallet can buy up to ${grant.cap}. The token stays here.</p>
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {PRESTOCK_MINTS.map(([symbol]) => (
                <button key={symbol} type="button" onClick={() => setName(symbol)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold", name === symbol ? "bg-white text-black" : "bg-white/10")}>{symbol}</button>
              ))}
            </div>
            <input value={grantUsd} onChange={(e) => setGrantUsd(e.target.value)} inputMode="decimal" aria-label="Dollars" className="mt-3 w-full bg-transparent font-mono text-3xl outline-none" />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                const mint = PRESTOCK_MINTS.find((row) => row[0] === name)?.[1];
                const usd = Number(grantUsd);
                if (!mint || !owner) return;
                if (!(usd > 0) || usd > grant.cap) return toast.error(`The cap on this wallet is $${grant.cap}.`);
                setBusy("grant");
                void runPrestock({ owner, mint, side: "buy", usd })
                  .then((done) => toast.success(`${name} is in this wallet. ${done.signature.slice(0, 8)}…`))
                  .catch((e) => toast.error(e instanceof Error ? e.message : "The buy did not sign."))
                  .finally(() => setBusy(null));
              }}
              className="mt-3 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40"
            >
              {busy === "grant" ? "Waiting" : `Buy $${grantUsd || "0"} of ${name}`}
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Their Solana address" className="min-h-11 w-full rounded-2xl bg-black/30 px-3 text-sm outline-none" />
            <input value={cap} onChange={(e) => setCap(e.target.value)} inputMode="decimal" aria-label="Cap" className="min-h-11 w-full rounded-2xl bg-black/30 px-3 font-mono text-sm outline-none" />
            <button
              type="button"
              onClick={() => {
                if (!owner) return toast.error("Connect the wallet that is setting the cap.");
                const n = Number(cap);
                if (other.trim().length < 32) return toast.error("Paste their address.");
                if (!(n >= 1)) return toast.error("Set a cap of at least $1.");
                try {
                  saveAllowance(owner, other.trim(), n);
                  setGrants(listAllowances());
                  toast.success("Saved on this phone. They connect that wallet and buy. You never hold the key.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not save it.");
                }
              }}
              className="min-h-11 w-full rounded-full bg-white text-sm font-semibold text-black"
            >
              Save the cap
            </button>
            {grants.length > 0 ? <p className="text-xs text-subtle">{grants.length} wallet{grants.length === 1 ? "" : "s"} on this phone.</p> : null}
          </div>
        )}
      </section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div>
          <h1 className={embedded ? "font-display text-3xl tracking-tight" : "max-w-3xl font-display text-4xl leading-[1.02] font-medium tracking-[-0.03em] xl:text-6xl"}>
            Move real money.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/55">
            Payroll, a loan, a repayment, a bill, or a settlement. Phantom signs the USDC to the Solana address. Revolut pays the Revtag inside Revolut. Senda does not hold either balance.
          </p>
          <RevolutMine owner={owner} mine={mine} setMine={setMine} />
        </div>
        <form
          className="rounded-[28px] bg-[#14141c] p-5"
          onSubmit={(e) => {
            e.preventDefault();
            post();
          }}
        >
          <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Post</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={cn("rounded-2xl px-3 py-2 text-left text-sm", kind === k.id ? "bg-accent text-accent-fg" : "bg-black/30")}
              >
                {k.label}
              </button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What it is" className="mt-3 min-h-12 w-full rounded-2xl bg-black/30 px-4 text-sm outline-none" />
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Who it helps, and what they get" rows={3} className="mt-2 w-full rounded-2xl bg-black/30 px-4 py-3 text-sm outline-none" />
          <div className="mt-2 grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
            <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" aria-label="USDC" className="min-h-12 rounded-2xl bg-black/30 px-4 font-mono text-sm outline-none" />
            <input value={payTo} onChange={(e) => setPayTo(e.target.value)} placeholder="Solana address to pay" spellCheck={false} className="min-h-12 rounded-2xl bg-black/30 px-4 font-mono text-xs outline-none" />
          </div>
          <input value={revtag} onChange={(e) => setRevtag(e.target.value)} placeholder="Seller Revtag, so Revolut can pay them" spellCheck={false} aria-label="Revtag" className="mt-2 min-h-12 w-full rounded-2xl bg-black/30 px-4 font-mono text-sm outline-none" />
          <button type="submit" className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg">
            Put it on the board
          </button>
        </form>
      </section>

      <div className="flex flex-wrap gap-2">
        <Filter on={filter === "all"} label="All" set={() => setFilter("all")} />
        {KINDS.map((k) => (
          <Filter key={k.id} on={filter === k.id} label={k.label} set={() => setFilter(k.id)} />
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[28px] bg-[#14141c] px-5 py-10 text-sm text-white/50">Nothing in this lane yet. The first listing is the one you post.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((row) => {
            const meta = KINDS.find((k) => k.id === row.kind);
            return (
              <li key={row.id} className="flex flex-col rounded-[28px] bg-[#14141c] p-5">
                <p className="text-[11px] tracking-[0.16em] text-accent uppercase">{kindLabel(row.kind)}</p>
                <h2 className="mt-2 font-display text-2xl tracking-tight">{row.title}</h2>
                <p className="mt-2 flex-1 text-sm text-white/55">{row.detail || meta?.line}</p>
                <p className="mt-4 font-mono text-3xl tabular-nums">${row.usd}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-white/35">{row.payTo}{row.revtag ? ` · @${row.revtag}` : ""}</p>
                <button
                  type="button"
                  disabled={busy === row.id}
                  onClick={() => {
                    if (!owner) return toast.error("Connect a Solana wallet. It has to sign.");
                    if (arm !== row.id) {
                      setArm(row.id);
                      return;
                    }
                    setBusy(row.id);
                    void payUsdc({ owner, to: row.payTo, usd: row.usd })
                      .then((r) => {
                        setPaid({ id: row.id, sig: r.signature, usd: row.usd });
                        setArm(null);
                        const opened = openSleeveOrder({
                          wallet: owner,
                          buyerTag: readRevolut()?.tag || "",
                          sellerTag: row.revtag || "",
                          product: row.title,
                          desk: "make",
                          usd: row.usd,
                          ccy: "USD",
                          quoted: row.usd,
                          ref: "usdc",
                        });
                        signSleeveOrder(opened.id, r.signature);
                        toast.success("Signed. USDC left your wallet.");
                      })
                      .catch((e: unknown) => toast.error(humanWalletError(e instanceof Error ? e.message : "The transfer did not send.")))
                      .finally(() => setBusy(null));
                  }}
                  className="mt-4 min-h-11 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-50"
                >
                  {busy === row.id ? "Waiting on the wallet" : arm === row.id ? `Sign $${row.usd} USDC` : "Pay in USDC"}
                </button>
                {row.revtag ? (
                  <button
                    type="button"
                    onClick={() => openRevolutPay(revolutPayUrl(row.revtag!, "USD", row.usd, row.title))}
                    className="mt-2 min-h-11 rounded-full border border-white/15 text-sm font-semibold"
                  >
                    Pay @{row.revtag} in Revolut
                  </button>
                ) : null}
                {arm === row.id ? <p className="mt-2 text-xs text-white/55">Review: ${row.usd} USDC to {row.payTo}. Tap again to sign.</p> : null}
                {paid?.id === row.id ? <div className="mt-3"><SignedReceipt title="Signed" amount={`${paid.usd} USDC`} detail="Paid the address on this listing." sig={paid.sig} /></div> : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function RevolutMine({ owner, mine, setMine }: { owner: string; mine: string; setMine: (tag: string) => void }) {
  const [draft, setDraft] = useState("");
  useEffect(() => {
    const tag = readRevolut()?.tag || "";
    setMine(tag);
    setDraft(tag);
  }, [setMine]);

  function keep() {
    const row = saveRevolut(draft, owner);
    if (!row) {
      toast.error("A Revtag is 3–20 letters, numbers, or underscores.");
      return;
    }
    setMine(row.tag);
    setDraft(row.tag);
    toast.success(`This browser will use @${row.tag} when a Revolut payment names you.`);
  }

  return (
    <div className="mt-4 max-w-md rounded-2xl border border-white/10 p-3">
      <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Your Revolut</p>
      <p className="mt-1 text-sm text-white/55">{mine ? `@${mine} is the Revtag on this browser. It is not a balance.` : "Save your Revtag once. Payments to other people still go to their Revtag."}</p>
      <div className="mt-2 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="@revtag" spellCheck={false} aria-label="Your Revtag" className="min-h-11 flex-1 rounded-xl bg-black/30 px-3 font-mono text-sm outline-none" />
        <button type="button" onClick={keep} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black">Save</button>
      </div>
    </div>
  );
}

function Filter({ on, label, set }: { on: boolean; label: string; set: () => void }) {
  return (
    <button type="button" onClick={set} className={cn("min-h-10 rounded-full px-4 text-sm", on ? "bg-white text-black" : "bg-[#14141c] text-white/70")}>
      {label}
    </button>
  );
}
