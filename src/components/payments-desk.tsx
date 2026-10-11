import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Bluetooth, Link2, Plus, RefreshCw } from "lucide-react";
import { ClearStrip } from "@/components/clear-strip";
import { MexicoSend } from "@/components/mexico-send";
import { MoneyBar } from "@/components/money-bar";
import { SpaceDesk } from "@/components/space-desk";
import { NearbyDesk } from "@/components/nearby-desk";
import { TabLead } from "@/components/tab-lead";
import { rememberClear } from "@/lib/clearing";
import { humanWalletError } from "@/lib/mobile-wallet";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { CCYS, CCY_META, formatMoney, revolutFee, type Ccy } from "@/lib/wallet";
import { rate } from "@/lib/wallet-fx";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export type PayAct = "send" | "request" | "exchange" | "add" | "withdraw" | "nearby" | "chain";

const ACTS: { id: PayAct; label: string; icon: typeof ArrowUpRight }[] = [
  { id: "send", label: "Send", icon: ArrowUpRight },
  { id: "chain", label: "On chain", icon: Link2 },
  { id: "request", label: "Request", icon: ArrowDownLeft },
  { id: "nearby", label: "Nearby", icon: Bluetooth },
  { id: "exchange", label: "Exchange", icon: RefreshCw },
  { id: "add", label: "Add", icon: Plus },
];

const field =
  "min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none placeholder:text-subtle";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const PHANTOM_USDC = `https://phantom.app/ul/v1/swap?sell=solana%3A101%2Faddress%3A${SOL_MINT}&buy=solana%3A101%2Faddress%3A${USDC_MINT}`;

export function PaymentsDesk({ initialAct, initialFrom }: { initialAct?: string; initialFrom?: string }) {
  const start: PayAct = ACTS.some((a) => a.id === initialAct) ? (initialAct as PayAct) : "send";
  const [act, setAct] = useState<PayAct>(start);
  const [pocket, setPocket] = useState<Ccy | null>(null);
  const w = useWallet();
  const fromInit = CCYS.includes(initialFrom as Ccy) ? (initialFrom as Ccy) : "USD";
  const owner = w.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";

  const total = CCYS.reduce((s, c) => s + (w.w.balances[c] || 0) * (w.usdPer[c] || (c === "USD" || c === "USDC" ? 1 : 0)), 0);
  const open = CCYS.filter((c) => w.w.opened.includes(c) || (w.w.balances[c] || 0) > 0);
  const pockets = (open.length ? open : (["USD"] as Ccy[])).map((c) => ({
    c,
    v: w.w.balances[c] || 0,
  }));

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Send"
        title="Send USDC."
        accent="They get the token."
        line="A peso amount is a quote. The signature is USDC on Solana, to an address. Not a bank and not a cash pickup."
        live={["USDC to a Solana address", "Peso quote", "On-chain USDC", "Solana Pay request"]}
        coming={["Cash pickup", "SPEI", "A bank balance"]}
      />
      <MoneyBar />

      <SpaceDesk />

      <section className={cn("rounded-[22px] border border-white/10 bg-[#10131c]", act === "nearby" ? "py-4" : "p-5")}>
        {act === "send" ? (
          <MexicoSend
            owner={owner}
            onLinked={(addr) => {
              const linked = w.linkChain(addr, "Phantom", "phantom");
              if (!linked.ok && linked.error !== "Already linked.") toast.error(linked.error || "The wallet did not stay.");
            }}
          />
        ) : null}
        {act === "chain" ? <ChainPay w={w} /> : null}
        {act === "nearby" ? <NearbyDesk /> : null}
        {act === "request" ? <RequestForm owner={owner} /> : null}
        {act === "exchange" ? <ExchangeForm key={pocket ?? fromInit} w={w} fromInit={pocket ?? fromInit} /> : null}
        {act === "add" ? <AddForm onMexico={() => setAct("send")} /> : null}
        <div className={cn("flex flex-wrap gap-2", act === "nearby" ? "px-4 pt-2" : "mt-4 border-t border-white/10 pt-3")}>
          {ACTS.map((a) => {
            const Icon = a.icon;
            const on = act === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAct(a.id)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold",
                  on ? "bg-accent text-accent-fg" : "border border-white/10 text-muted",
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.9} />
                {a.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c]">
          <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold">Pockets</h2>
            <p className="font-mono text-[11px] text-subtle">This browser. Not a bank. {formatMoney(total, "USD")}</p>
          </div>
          <ul>
            {pockets.map((p) => {
              const meta = CCY_META[p.c];
              const px = w.usdPer[p.c] || (p.c === "USD" || p.c === "USDC" ? 1 : 0);
              return (
                <li key={p.c} className="border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setPocket(p.c);
                      setAct("exchange");
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-[11px]">
                      {meta.flag}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{meta.name}</span>
                      <span className="block font-mono text-[11px] text-subtle">{p.c}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-sm tabular-nums">{formatMoney(p.v, p.c)}</span>
                      {p.c !== "USD" && px > 0 ? (
                        <span className="block font-mono text-[11px] text-subtle tabular-nums">{formatMoney(p.v * px, "USD")}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <aside className="h-fit rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <h2 className="text-sm font-semibold">Activity</h2>
          {w.w.txs.length === 0 ? <p className="py-4 text-sm text-subtle">Nothing sent yet.</p> : null}
          <ul>
            {w.w.txs.slice(0, 8).map((t) => (
              <li key={t.id} className="border-t border-white/10 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">{t.counterparty}</p>
                  <p className="font-mono text-xs tabular-nums">{formatMoney(t.amount, t.ccy)}</p>
                </div>
                <p className="text-xs text-subtle">
                  {t.kind}
                  {t.note ? ` · ${t.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </section>
      <ClearStrip desk="send" />
    </div>
  );
}

function ChainPay({ w }: { w: ReturnType<typeof useWallet> }) {
  const owner = w.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [to, setTo] = useState("");
  const [usd, setUsd] = useState(1);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");
  const link = useMemo(() => {
    const dest = to.trim();
    if (!dest) return "";
    const params = new URLSearchParams({
      amount: String(usd),
      "spl-token": USDC_MINT,
    });
    if (memo.trim()) params.set("memo", memo.trim());
    return `solana:${dest}?${params.toString()}`;
  }, [to, usd, memo]);

  async function send() {
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = w.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "The wallet did not stay.");
      }
      const out = await payUsdc({ owner: who, to, usd, memo: memo || "Senda USDC" });
      setSig(out.signature);
      rememberClear({
        desk: "send",
        title: `USDC to ${to.slice(0, 4)}…`,
        legs: [{ side: "out", asset: "USDC", amount: usd, where: to }],
        feeUsd: 0,
        sig: out.signature,
        status: "signed",
      });
      toast.success(`Sent. ${out.signature.slice(0, 8)}`);
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "The send did not go."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-muted">USDC leaves the wallet you connect and lands in theirs. You sign. Senda does not hold it.</p>
      <label className="mt-3 block text-xs text-subtle">
        Their Solana address
        <input value={to} onChange={(e) => setTo(e.target.value)} className={`${field} mt-1 font-mono`} placeholder="Address" />
      </label>
      <label className="mt-3 block text-xs text-subtle">
        USDC
        <input value={usd} onChange={(e) => setUsd(Math.max(0.01, Number(e.target.value) || 0))} inputMode="decimal" className={`${field} mt-1 font-mono`} />
      </label>
      <label className="mt-3 block text-xs text-subtle">
        Note
        <input value={memo} onChange={(e) => setMemo(e.target.value)} className={`${field} mt-1`} placeholder="What this is for" />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void send()} className="min-h-12 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50">
          {busy ? "Waiting for the wallet…" : `Send ${usd} USDC`}
        </button>
        <button
          type="button"
          disabled={!link}
          onClick={() => {
            void navigator.clipboard.writeText(link);
            toast.success("Payment link copied.");
          }}
          className="min-h-12 rounded-full border border-white/15 px-5 text-sm font-semibold disabled:opacity-40"
        >
          Copy payment link
        </button>
      </div>
      {link ? <p className="mt-3 break-all font-mono text-[11px] text-subtle">{link}</p> : null}
      {sig ? (
        <a className="mt-2 block font-mono text-xs text-accent" href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer">
          {sig}
        </a>
      ) : null}
    </div>
  );
}

function RequestForm({ owner }: { owner: string }) {
  const [usd, setUsd] = useState(20);
  const [memo, setMemo] = useState("");
  const link = owner
    ? `solana:${owner}?amount=${usd}&spl-token=${USDC_MINT}&label=Senda&message=${encodeURIComponent(memo.trim() || "Senda")}`
    : "";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">This copies a Solana Pay link to the wallet you connected. It does not credit a tag, and nobody has paid until they sign.</p>
      {owner ? null : <p className="text-sm text-muted">Connect a wallet first. The link has to point at that address.</p>}
      <label className="block text-xs text-subtle">
        USDC they would send
        <input value={usd} onChange={(e) => setUsd(Math.max(0.01, Number(e.target.value) || 0))} inputMode="decimal" className={`${field} mt-1 font-mono`} />
      </label>
      <label className="block text-xs text-subtle">
        Note
        <input value={memo} onChange={(e) => setMemo(e.target.value)} className={field} placeholder="What this is for" aria-label="Note" />
      </label>
      <button
        type="button"
        disabled={!link}
        onClick={() => {
          void navigator.clipboard.writeText(link);
          toast.success("Request link copied. They still have to sign.");
        }}
        className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40"
      >
        Copy request link
      </button>
      {link ? <p className="break-all font-mono text-[11px] text-subtle">{link}</p> : null}
    </div>
  );
}

function ExchangeForm({ w, fromInit }: { w: ReturnType<typeof useWallet>; fromInit: Ccy }) {
  const opened: Ccy[] = w.w.opened?.length ? w.w.opened : ["USD"];
  const [from, setFrom] = useState<Ccy>(opened.includes(fromInit) ? fromInit : "USD");
  const [to, setTo] = useState<Ccy>("EUR");
  const [raw, setRaw] = useState("");
  const amount = Number(raw) || 0;
  const r = rate(from, to, w.usdPer);
  const got = amount * r;
  const amountUsd = amount * (w.usdPer[from] || 0);
  const rev = revolutFee("fx", amountUsd, w.weekend);

  function go() {
    toast.error("This pocket screen does not move USDC or pesos. Send is the signed transfer.");
  }

  const choices = Array.from(new Set([...opened, from, to]));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Not a conversion. These pockets are this browser. They are not a bank balance and they do not become pesos.</p>
      <div className="grid grid-cols-2 gap-2">
        <select value={from} onChange={(e) => setFrom(e.target.value as Ccy)} aria-label="From" className={cn(field, "font-mono")}>
          {choices.map((c) => (
            <option key={c} value={c}>
              From {c}
            </option>
          ))}
        </select>
        <select value={to} onChange={(e) => setTo(e.target.value as Ccy)} aria-label="Hold" className={cn(field, "font-mono")}>
          {CCYS.map((c) => (
            <option key={c} value={c}>
              Hold {c}
            </option>
          ))}
        </select>
      </div>
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="0"
        aria-label="Amount"
        className="min-h-14 w-full bg-transparent font-mono text-4xl tabular-nums outline-none placeholder:text-white/20"
      />
      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
        <p className="font-mono font-medium tabular-nums">Quote only {amount > 0 ? formatMoney(got, to) : "—"}</p>
        <p className="mt-1 text-muted">1 {from} ≈ {r.toFixed(4)} {to}. Nothing is exchanged.</p>
        {rev > 0 ? <p className="mt-1 text-muted">A retail FX desk can charge extra on the weekend. This screen does not.</p> : null}
      </div>
      <button
        type="button"
        onClick={go}
        className="min-h-12 rounded-full border border-white/15 text-base font-semibold"
      >
        This does not exchange
      </button>
    </div>
  );
}

function AddForm({ onMexico }: { onMexico: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">A card, Apple Pay, or a bank deposit would invent a balance in this browser. This screen does not take one.</p>
      <a href={PHANTOM_USDC} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-base font-semibold text-accent-fg">
        Swap SOL for USDC in Phantom
      </a>
      <button type="button" onClick={onMexico} className="min-h-12 rounded-full border border-white/15 text-sm font-semibold">
        Send USDC instead
      </button>
    </div>
  );
}
