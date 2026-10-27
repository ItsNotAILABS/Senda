import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { sendCut } from "@/lib/desk-fee";
import { ArrowDownLeft, ArrowUpRight, Bluetooth, Link2, Plus, RefreshCw } from "lucide-react";
import { AttachedAccounts, CousinPesos } from "@/components/attached-accounts";
import { BatchPay } from "@/components/batch-pay";
import { BitsoDesk } from "@/components/bitso-desk";
import { MerchantDesk } from "@/components/merchant-desk";
import { SpendCards } from "@/components/spend-cards";
import { TillDesk } from "@/components/till-desk";
import { MexicoSend } from "@/components/mexico-send";
import { OfflineRail } from "@/components/offline-rail";
import { DeskStatus } from "@/components/desk-status";
import { RevolutAccount } from "@/components/revolut-account";
import { SpaceDesk } from "@/components/space-desk";
import { NearbyDesk } from "@/components/nearby-desk";
import { TabLead } from "@/components/tab-lead";
import { JumpStrip } from "@/components/jump-strip";
import { bumpClears, ClearStrip } from "@/components/clear-strip";
import { SignedReceipt, solAddress } from "@/components/money-flow";
import { EnvelopeMaker, EnvelopeOpen } from "@/components/product-envelopes";
import { parseEnvelope } from "@/lib/envelope";
import { CCYS, CCY_META, formatMoney, revolutFee, type Ccy } from "@/lib/wallet";
import { rate } from "@/lib/wallet-fx";
import { PayQr } from "@/components/pay-qr";
import { cancelClaim, claimOf, markClaimPaid, openClaim } from "@/lib/pay-claim";
import { payUsdc, paySol, payToken, findPay, parseTransfer, payReference, transferRequest } from "@/lib/solana-pay";
import { PayScan } from "@/components/pay-scan";
import { stripeOnramp } from "@/lib/stripe-onramp";
import { rememberClear } from "@/lib/clear-tape";
import { BACKPACK } from "@/lib/backpack";
import { connectPhantom, invalidateChain, readChain, type ChainWallet } from "@/lib/phantom";
import { quoteRoute, signRoute, SOL, type RouteQuote } from "@/lib/jup-sign";
import { humanWalletError } from "@/lib/mobile-wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export type PayAct = "send" | "request" | "exchange" | "add" | "withdraw" | "nearby" | "link" | "revolut" | "wrap";

const ACTS: { id: PayAct; label: string; icon: typeof ArrowUpRight }[] = [
  { id: "wrap", label: "Wrap", icon: Link2 },
  { id: "revolut", label: "Revolut", icon: Link2 },
  { id: "link", label: "Link", icon: Link2 },
  { id: "send", label: "Send", icon: ArrowUpRight },
  { id: "request", label: "Request", icon: ArrowDownLeft },
  { id: "nearby", label: "Nearby", icon: Bluetooth },
  { id: "exchange", label: "Exchange", icon: RefreshCw },
  { id: "add", label: "Add", icon: Plus },
];

const field =
  "min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none placeholder:text-subtle";

export function PaymentsDesk({
  initialAct,
  initialFrom,
  initialTo,
  initialUsd,
  initialMemo,
  initialRail,
  initialCcy,
  initialWhat,
}: {
  initialAct?: string;
  initialFrom?: string;
  initialTo?: string;
  initialUsd?: string;
  initialMemo?: string;
  initialRail?: string;
  initialCcy?: string;
  initialWhat?: string;
}) {
  const opened = parseEnvelope({
    rail: initialRail,
    to: initialTo,
    usd: initialUsd,
    ccy: initialCcy,
    what: initialWhat,
  });
  const start: PayAct = opened ? "wrap" : ACTS.some((a) => a.id === initialAct) ? (initialAct as PayAct) : initialTo ? "link" : "send";
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
      <JumpStrip />
      <TabLead
        kicker="Send"
        title="Send USDC."
        accent="They get the token."
        line="A peso figure is a quote from Bitso’s dollar book and the ECB. The transfer is USDC. You sign it. Senda does not hold it."
        live={["USDC to a Solana address", "Bitso on Solana", "Peso quote", "Solana Pay request", "Revolut on this phone", "A link that wraps a product"]}
        coming={["Cash pickup", "SPEI", "A Revolut fiat balance"]}
        audit={{
          live: "Send, link, and shop sign USDC after a review. The peso line is a quote.",
          hold: "Revolut stays their app until SOL or USDC on Solana shows up on this address. Pockets on this browser are not money.",
        }}
      />

      <ChainPay
        owner={owner}
        onPick={(id) => {
          if (id === "usdc") return;
          setAct(id);
          document.getElementById("send-desk")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <SpaceDesk />

      <section id="send-desk" className={cn("rounded-[22px] border border-white/10 bg-[#10131c]", act === "nearby" ? "py-4" : "p-5")}>
        <div className={cn("flex flex-wrap gap-2", act === "nearby" ? "px-4" : "")}>
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
        <div className={act === "nearby" ? "" : "mt-4"}>
        {act === "send" ? (
          <div className="space-y-6">
            <SendTicket owner={owner} />
            <details className="rounded-2xl border border-white/10 px-3 py-2">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Accounts, cards, batch, Bitso</summary>
              <div className="space-y-6 pt-3">
                <AttachedAccounts owner={owner} />
                <TillDesk owner={owner} />
                <SpendCards owner={owner} />
                <CousinPesos />
                <MerchantDesk owner={owner} />
                <BatchPay owner={owner} />
                <BitsoDesk owner={owner} />
              </div>
            </details>
            <div className="border-t border-white/10 pt-4">
              <p className="text-sm font-semibold">Or pay a person</p>
              <p className="mt-1 mb-3 text-xs text-muted">Their address, not Bitso. A peso figure is a quote. The transfer is still USDC.</p>
              <MexicoSend owner={owner} />
              <DeskStatus />
              <OfflineRail />
            </div>
          </div>
        ) : null}
        {act === "revolut" ? <RevolutAccount owner={owner} /> : null}
        {act === "wrap" ? (
          <div className="flex flex-col gap-4">
            {opened ? (
              <EnvelopeOpen
                rail={opened.rail}
                to={opened.to}
                usd={opened.usd}
                ccy={opened.ccy}
                what={opened.what}
                owner={owner}
              />
            ) : null}
            <EnvelopeMaker />
          </div>
        ) : null}
        {act === "link" ? <LinkForm owner={owner} askTo={initialTo} askUsd={initialUsd} askMemo={initialMemo} /> : null}
        {act === "nearby" ? <NearbyDesk /> : null}
        {act === "request" ? <RequestForm owner={owner} /> : null}
        {act === "exchange" ? <ExchangeForm key={pocket ?? fromInit} w={w} fromInit={pocket ?? fromInit} /> : null}
        {act === "add" ? <AddForm onMexico={() => setAct("send")} onRevolut={() => setAct("revolut")} /> : null}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c]">
          <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold">Pockets</h2>
            <p className="font-mono text-[11px] text-subtle">
              {formatMoney(total, "USD")} · {w.w.tag}
            </p>
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
          <div className="mt-3">
            <ClearStrip />
          </div>
        </aside>
      </section>
    </div>
  );
}

function ChainPay({ owner, onPick }: { owner: string; onPick: (id: PayAct | "usdc") => void }) {
  const [to, setTo] = useState("");
  const [usd, setUsd] = useState("20");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");
  const [phase, setPhase] = useState<"edit" | "review" | "done">("edit");
  const dest = solAddress(to);
  const amount = Number(usd);
  const tiles: { id: PayAct | "usdc"; label: string; who: string; cap: number; line: string }[] = [
    { id: "usdc", label: "USDC", who: "Solana Pay", cap: 20, line: "Their address. You sign." },
    { id: "revolut", label: "Revolut", who: "Their app", cap: 0, line: "Withdraw SOL or USDC here." },
    { id: "send", label: "Bitso", who: "Their deposit", cap: 0, line: "USDC, SOL, or pesos sold first." },
    { id: "nearby", label: "Nearby", who: "Bluetooth", cap: 20, line: "A payload, not a server" },
    { id: "exchange", label: "Exchange", who: "Pockets", cap: 50, line: "A quote. Not a conversion." },
    { id: "request", label: "Request", who: "A person", cap: 25, line: "They pay your address" },
    { id: "add", label: "Add", who: "Wallet or Revolut", cap: 0, line: "No card balance." },
  ];

  async function sign() {
    if (!owner || !dest || !(amount >= 0.01)) return;
    setBusy(true);
    setSig("");
    try {
      const r = await payUsdc({ owner, to: dest, usd: amount, deskFee: true });
      setSig(r.signature);
      setPhase("done");
      rememberClear({
        sig: r.signature,
        from: owner,
        to: dest,
        usd: amount,
        memo: "",
        kind: "send",
        status: "pending",
      });
      bumpClears();
      toast.success("Signed. USDC left your wallet.");
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "The transfer did not send."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid items-stretch gap-3 lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.18fr)]">
      <div className="flex min-h-[300px] flex-col justify-between rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <div>
          <p className="text-[11px] tracking-[0.14em] text-accent uppercase">Solana Pay</p>
          <p className="mt-2 text-sm text-muted">USDC leaves the wallet you connect. Review the address, then sign. Nothing sits in a Senda balance in the middle.</p>
        </div>
        <label className="mt-4 block">
          <span className="sr-only">Amount</span>
          <input value={usd} onChange={(e) => { setUsd(e.target.value); setPhase("edit"); setSig(""); }} inputMode="decimal" aria-label="USDC" className="w-full bg-transparent font-mono text-5xl tabular-nums outline-none" />
        </label>
        <div className="mt-2 flex gap-1">
          {["1", "5", "20", "100"].map((n) => (
            <button key={n} type="button" onClick={() => { setUsd(n); setPhase("edit"); setSig(""); }} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "bg-white/10 text-muted")}>${n}</button>
          ))}
        </div>
        <input
          value={to}
          onChange={(e) => { setTo(e.target.value); setPhase("edit"); setSig(""); }}
          placeholder="Their Solana address"
          spellCheck={false}
          className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-sm outline-none"
        />
        {phase === "review" && dest ? (
          <dl className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
            <div className="flex justify-between gap-3 py-1"><dt className="text-muted">To</dt><dd className="truncate font-mono text-xs">{dest}</dd></div>
            <div className="flex justify-between gap-3 py-1"><dt className="text-muted">You sign</dt><dd className="font-mono">{amount} USDC</dd></div>
            <div className="flex justify-between gap-3 py-1"><dt className="text-muted">Fee</dt><dd className="text-right">{sendCut(amount).why}</dd></div>
          </dl>
        ) : null}
        {phase === "done" && sig ? <div className="mt-3"><SignedReceipt title="Signed" amount={`${amount} USDC`} detail="Left your wallet. They have the token when the network confirms." sig={sig} /></div> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {phase === "review" ? (
            <button type="button" onClick={() => setPhase("edit")} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">Back</button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (phase === "done") {
                setPhase("edit");
                setSig("");
                return;
              }
              if (phase === "edit") {
                if (!owner) return toast.error("Connect a Solana wallet.");
                if (!dest) return toast.error("That is not a Solana address.");
                if (!(amount >= 0.01)) return toast.error("Enter the USDC you will sign.");
                setPhase("review");
                return;
              }
              void sign();
            }}
            className="min-h-11 flex-1 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            {busy ? "Waiting on the wallet" : phase === "done" ? "Send another" : phase === "review" ? `Sign ${amount} USDC` : "Review"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-[22px] border border-white/10 bg-[#10131c] p-3">
        {tiles.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              if (s.cap > 0) setUsd(String(s.cap));
              setPhase("edit");
              onPick(s.id);
            }}
            className="rounded-[22px] bg-black/30 px-3 py-3 text-left"
          >
            <span className="block text-sm font-semibold">{s.label}</span>
            <span className="mt-1 block truncate text-xs text-muted">{s.who}</span>
            <span className="mt-1 block truncate text-[11px] text-subtle">{s.line}</span>
            {s.cap > 0 ? <span className="mt-2 block font-mono text-sm">${s.cap}</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

type HeldAsset = {
  key: string;
  kind: "sol" | "usdc" | "spl";
  symbol: string;
  label: string;
  mint: string;
  ui: number;
  decimals: number;
};

function uiText(n: number, decimals: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const d = Math.min(9, Math.max(0, decimals));
  const scale = 10 ** d;
  const cut = Math.floor(n * scale + 1e-8) / scale;
  const text = cut.toFixed(d);
  if (!text.includes(".")) return text;
  return text.replace(/0+$/, "").replace(/\.$/, "");
}

function heldOf(chain: ChainWallet): HeldAsset[] {
  const out: HeldAsset[] = [];
  if (chain.sol > 0) {
    out.push({ key: "sol", kind: "sol", symbol: "SOL", label: "SOL", mint: "", ui: chain.sol, decimals: 9 });
  }
  for (const token of chain.tokens) {
    if (!(token.ui > 0)) continue;
    if (token.mint === USDC_MINT) {
      out.push({
        key: token.mint,
        kind: "usdc",
        symbol: "USDC",
        label: "USDC",
        mint: token.mint,
        ui: token.ui,
        decimals: token.decimals || 6,
      });
      continue;
    }
    const pack = BACKPACK.find((row) => row.mint === token.mint);
    out.push({
      key: token.mint,
      kind: "spl",
      symbol: pack?.symbol || token.symbol,
      label: pack ? `${pack.symbol} ${pack.name}` : token.symbol,
      mint: token.mint,
      ui: token.ui,
      decimals: token.decimals || pack?.decimals || 0,
    });
  }
  return out;
}

function payTokenBlocked(asset: HeldAsset): boolean {
  return asset.kind === "spl" && asset.decimals !== 6;
}

function SendTicket({ owner }: { owner: string }) {
  const [chain, setChain] = useState<ChainWallet | null>(null);
  const [miss, setMiss] = useState("");
  const [pick, setPick] = useState("");
  const [raw, setRaw] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [sig, setSig] = useState("");
  const [signed, setSigned] = useState("");
  const [tick, setTick] = useState(0);
  const seen = useRef("");

  useEffect(() => {
    if (!owner) {
      seen.current = "";
      setChain(null);
      setMiss("");
      return;
    }
    let live = true;
    if (seen.current !== owner) {
      seen.current = owner;
      setChain(null);
      setPick("");
      setSig("");
      setSigned("");
    }
    readChain(owner)
      .then((row) => {
        if (!live) return;
        setChain(row);
        setMiss("");
      })
      .catch((e) => {
        if (!live) return;
        setChain(null);
        setMiss(e instanceof Error ? e.message : "Could not read this wallet.");
      });
    return () => {
      live = false;
    };
  }, [owner, tick]);

  const assets = useMemo(() => (chain ? heldOf(chain) : []), [chain]);
  const asset = assets.find((row) => row.key === pick) ?? assets[0] ?? null;

  async function sign() {
    if (!owner || !asset) return;
    setFail("");
    const dest = to.trim();
    const amount = Number(raw);
    if (!dest) {
      setFail("Enter an address.");
      return;
    }
    const who = solAddress(dest);
    if (!who) {
      setFail("That is not a Solana address.");
      return;
    }
    if (!raw.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFail("Enter an amount.");
      return;
    }
    if (amount > asset.ui + 1e-9) {
      setFail("Above the balance.");
      return;
    }
    if (payTokenBlocked(asset)) {
      setFail("payToken cannot send this mint.");
      return;
    }
    setBusy(true);
    setSig("");
    try {
      let signature = "";
      if (asset.kind === "sol") signature = await paySol({ owner, to: who, sol: amount });
      else if (asset.kind === "usdc") signature = (await payUsdc({ owner, to: who, usd: amount, deskFee: true })).signature;
      else signature = (await payToken({ owner, to: who, mint: asset.mint, symbol: asset.symbol, amount })).signature;
      setSig(signature);
      setSigned(`${raw.trim()} ${asset.symbol}`);
      invalidateChain(owner);
      setTick((n) => n + 1);
    } catch (e) {
      setFail(humanWalletError(e instanceof Error ? e.message : "The transfer did not send."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.14em] text-accent uppercase">Send</p>
      {!owner ? <p className="mt-3 text-sm">Connect Phantom.</p> : null}
      {owner && !chain && !miss ? <p className="mt-3 text-sm text-muted">Reading this address.</p> : null}
      {miss ? <p className="mt-3 text-sm text-down">{miss}</p> : null}
      {owner && chain && assets.length === 0 ? <p className="mt-3 text-sm text-muted">Nothing held on this address.</p> : null}
      {asset ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {assets.map((row) => {
              const on = row.key === asset.key;
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => {
                    setPick(row.key);
                    setRaw("");
                    setFail("");
                    setSig("");
                  }}
                  className={cn(
                    "min-h-11 rounded-full px-3 text-left text-sm font-semibold",
                    on ? "bg-accent text-accent-fg" : "border border-white/10 text-muted",
                  )}
                >
                  <span className="block max-w-[16rem] truncate">{row.label}</span>
                  <span className="block font-mono text-[11px] tabular-nums">{uiText(row.ui, row.decimals)}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setFail("");
                setSig("");
              }}
              inputMode="decimal"
              aria-label="Amount"
              placeholder="0"
              className={cn(field, "font-mono text-lg tabular-nums")}
            />
            <button
              type="button"
              onClick={() => {
                setRaw(uiText(asset.ui, asset.decimals));
                setFail("");
                setSig("");
              }}
              className="min-h-11 shrink-0 rounded-full border border-white/15 px-4 text-sm font-semibold"
            >
              Max
            </button>
          </div>
          <input
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setFail("");
              setSig("");
            }}
            placeholder="Solana address"
            spellCheck={false}
            aria-label="Destination"
            className={cn(field, "font-mono text-xs")}
          />
          {payTokenBlocked(asset) ? <p className="text-sm text-down">payToken cannot send this mint.</p> : null}
          {fail ? <p className="text-sm text-down">{fail}</p> : null}
          {sig ? <SignedReceipt title="Signed" amount={signed} detail="Left this wallet." sig={sig} /> : null}
          <button
            type="button"
            disabled={busy || payTokenBlocked(asset)}
            onClick={() => void sign()}
            className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            {busy ? "Waiting on the wallet" : "Sign"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function payUrls(to: string, usd: string, memo: string, reference = "") {
  const page = new URLSearchParams({ act: "link", to: to.trim() });
  if (Number(usd) > 0) page.set("usd", usd);
  if (memo.trim()) page.set("memo", memo.trim().slice(0, 80));
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const solana = reference
    ? transferRequest({
        recipient: to.trim(),
        amount: Number(usd) > 0 ? Number(usd) : undefined,
        splToken: USDC_MINT,
        reference,
        label: "Senda",
        message: (memo.trim() || "Senda").slice(0, 80),
        memo: (memo.trim() || "Senda").slice(0, 80),
      })
    : "";
  return {
    page: `${origin}/payments?${page.toString()}`,
    solana,
  };
}

function LinkForm({ owner, askTo, askUsd, askMemo }: { owner: string; askTo?: string; askUsd?: string; askMemo?: string }) {
  const [to, setTo] = useState(askTo || owner);
  const [usd, setUsd] = useState(askUsd || "20");
  const [memo, setMemo] = useState(askMemo || "");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");
  const [phase, setPhase] = useState<"edit" | "review" | "done">("edit");
  const [reference, setReference] = useState("");
  const [seen, setSeen] = useState("");
  const [book, setBook] = useState(0);
  const [pasted, setPasted] = useState("");
  const [unit, setUnit] = useState("USDC");
  const [mint, setMint] = useState("");
  const dest = solAddress(to);
  const amount = Number(usd);
  const urls = dest && reference ? payUrls(dest, usd, memo, reference) : null;
  const paying = Boolean(askTo);

  useEffect(() => {
    if (!to && owner) setTo(owner);
  }, [owner, to]);

  useEffect(() => {
    if (!dest) return;
    setReference(payReference(`link:${dest}:${usd || "0"}`));
    setSeen("");
  }, [dest, usd]);

  useEffect(() => {
    if (!dest || !reference) return;
    openClaim({ id: reference, to: dest, amount: amount || 0, asset: "USDC", memo });
  }, [dest, reference, amount, memo]);

  useEffect(() => {
    if (!reference) return;
    let stop = false;
    const tick = () => {
      void findPay(reference).then((sig) => {
        if (!stop && sig) {
          setSeen(sig);
          markClaimPaid(reference, sig);
        }
      }).catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 8000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [reference]);

  function takeLink(raw = pasted) {
    const parsed = parseTransfer(raw);
    if ("error" in parsed) return toast.error(parsed.error);
    if (parsed.reference.some((ref) => claimOf(ref)?.status === "cancelled")) return toast.error("That claim was cancelled. It cannot be paid.");
    const token = parsed.splToken;
    const known: Record<string, string> = {
      EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
      HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr: "EURC",
      "6zYgzrT7X2wi9a9NeMtUvUWLLmf2a8vBsbYkocYdB9wa": "MXNe",
      Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
      "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo": "PYUSD",
    };
    if (token && !known[token]) return toast.error("That QR asks for a token this desk does not send.");
    setTo(parsed.recipient);
    if (parsed.amount) setUsd(String(parsed.amount));
    if (parsed.memo || parsed.message) setMemo(parsed.memo || parsed.message || "");
    if (!token) {
      setUnit(parsed.amount ? "SOL" : "USDC");
      setMint("");
    } else {
      setUnit(known[token]);
      setMint(known[token] === "USDC" ? "" : token);
    }
    setPhase("edit");
    toast.success(parsed.amount ? "The QR set the address and the amount." : "The QR is an address. Set the amount, then sign.");
  }

  async function pay() {
    if (!dest || !(amount > 0)) return;
    if (claimOf(reference)?.status === "cancelled") {
      toast.error("This claim was cancelled. It cannot be paid.");
      return;
    }
    setBusy(true);
    setSig("");
    try {
      const who = owner || (await connectPhantom());
      if (unit === "SOL") {
        const signature = await paySol({ owner: who, to: dest, sol: amount });
        setSig(signature);
      } else if (mint) {
        const paid = await payToken({ owner: who, to: dest, mint, symbol: unit, amount });
        setSig(paid.signature);
      } else {
        const r = await payUsdc({ owner: who, to: dest, usd: amount, memo: memo.trim() || undefined, deskFee: true });
        setSig(r.signature);
        rememberClear({
          sig: r.signature,
          from: who,
          to: dest,
          usd: amount,
          memo: memo.trim(),
          kind: "send",
          status: "pending",
        });
        bumpClears();
      }
      setPhase("done");
      toast.success(`Signed. ${amount} ${unit} left this wallet.`);
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "The transfer did not send."));
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text).then(
      () => toast.success("Copied."),
      () => toast.error("Could not copy."),
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{paying ? "This link is a transfer request for USDC. The recipient is the wallet. You sign." : "A transfer request. Their wallet builds the USDC transfer. This desk watches the reference."}</p>
        <div className="flex gap-2">
          <input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Address or solana: link from their QR" spellCheck={false} aria-label="Wallet QR" className={cn(field, "font-mono text-xs")} />
          <button type="button" onClick={() => takeLink()} className="min-h-12 shrink-0 rounded-full border border-white/15 px-4 text-sm font-semibold">Read</button>
        </div>
        <PayScan onCode={(text) => { setPasted(text); takeLink(text); }} />
        <input value={to} onChange={(e) => { setTo(e.target.value); setPhase("edit"); }} placeholder={owner || "The address that gets the USDC"} spellCheck={false} className={cn(field, "font-mono text-xs")} />
        <div className="flex gap-2">
          <input inputMode="decimal" value={usd} onChange={(e) => { setUsd(e.target.value); setPhase("edit"); }} aria-label="USDC" className={cn(field, "font-mono text-lg")} />
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What it's for" className={field} />
        </div>
        {urls ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="break-all font-mono text-xs text-white/80">{urls.solana || urls.page}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => copy(urls.solana)} className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black">Copy Solana Pay</button>
              <button type="button" onClick={() => copy(urls.page)} className="min-h-9 rounded-full border border-white/15 px-3 text-xs font-semibold">Copy page</button>
            </div>
            {seen ? <div className="mt-3"><SignedReceipt title="Paid" amount={`${amount || ""} USDC`.trim()} detail="The reference has a signature." sig={seen} /></div> : <p className="mt-2 text-xs text-subtle">Not paid yet. A signature that includes this reference will show here.</p>}
          </div>
        ) : (
          <p className="text-sm text-muted">Connect a wallet, or paste the address that should receive the USDC.</p>
        )}
        {phase === "review" && dest ? (
          <p className="text-sm text-muted">Review: {amount} {unit} to {dest}. You sign. Senda does not hold it.</p>
        ) : null}
        {phase === "done" && sig ? <SignedReceipt title="Signed" amount={`${amount} USDC`} detail="Left your wallet." sig={sig} /> : null}
        <div className="flex flex-wrap gap-2">
          {phase === "review" ? (
            <button type="button" onClick={() => setPhase("edit")} className="min-h-12 rounded-full border border-white/15 px-4 text-sm font-semibold">Back</button>
          ) : null}
          <button
            type="button"
            disabled={busy || !dest || !(amount > 0)}
            onClick={() => {
              if (phase === "done") {
                setPhase("edit");
                setSig("");
                return;
              }
              if (phase === "edit") {
                setPhase("review");
                return;
              }
              void pay();
            }}
            className="min-h-12 flex-1 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
          >
            {busy ? "Waiting on the wallet" : phase === "done" ? "Pay another" : phase === "review" ? `Sign ${amount} ${unit}` : "Review payment"}
          </button>
        </div>
      </div>
      {urls ? (
        <div className="flex flex-col items-start gap-3">
          <PayQr value={urls.solana || urls.page} />
          {reference && claimOf(reference)?.status !== "paid" && claimOf(reference)?.status !== "cancelled" ? (
            <button
              type="button"
              onClick={() => {
                if (seen) {
                  toast.error("Already paid. A signature cannot be cancelled.");
                  return;
                }
                const r = cancelClaim(reference);
                setBook((n) => n + 1);
                if (!r.ok) toast.error(r.error);
                else toast.success("Claim cancelled. This desk will not pay that code.");
              }}
              className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold"
            >
              Cancel this claim
            </button>
          ) : null}
          {book >= 0 && claimOf(reference)?.status === "cancelled" ? <p className="text-xs text-subtle">Cancelled. This desk will refuse the code.</p> : null}
          <p className="max-w-[220px] text-xs text-subtle">Cancel stops this desk from paying the code. It cannot reverse a transfer that already has a signature, and a wallet that ignores this book can still send to the address.</p>
        </div>
      ) : null}
    </div>
  );
}

function RequestForm({ owner }: { owner: string }) {
  const [usd, setUsd] = useState("20");
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");
  useEffect(() => {
    if (owner.length < 32) return;
    setReference(payReference(`req:${owner}:${usd || "0"}`));
  }, [owner, usd]);
  const urls = owner.length >= 32 ? payUrls(owner, usd, memo, reference) : null;
  const [book, setBook] = useState(0);

  useEffect(() => {
    if (!reference || owner.length < 32) return;
    openClaim({ id: reference, to: owner, amount: Number(usd) || 0, asset: "USDC", memo });
  }, [reference, owner, usd, memo]);

  function copy(text: string) {
    void navigator.clipboard?.writeText(text).then(
      () => toast.success("Copied."),
      () => toast.error("Could not copy."),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">This asks them to pay your Solana address in USDC. Nothing is added here until they sign their own transfer.</p>
      {owner ? <p className="truncate font-mono text-xs text-subtle">{owner}</p> : <p className="text-sm text-muted">Connect a wallet first. The request has to name an address.</p>}
      <div className="flex gap-2">
        <input inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} aria-label="USDC" className={cn(field, "font-mono text-lg")} />
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What it's for" className={field} />
      </div>
      {urls ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
          <p className="font-mono">{usd} USDC</p>
          <p className="mt-1 text-muted">They still have to sign. Copying this does not move money.</p>
        </div>
      ) : null}
      {urls ? (
        <div className="flex flex-col items-start gap-3">
          <PayQr value={urls.solana} />
          {reference && claimOf(reference)?.status === "open" ? (
            <button
              type="button"
              onClick={() => {
                const r = cancelClaim(reference);
                setBook((n) => n + 1);
                if (!r.ok) toast.error(r.error);
                else toast.success("Request cancelled. This desk will not pay that code.");
              }}
              className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold"
            >
              Cancel this claim
            </button>
          ) : null}
          {book >= 0 && claimOf(reference)?.status === "cancelled" ? <p className="text-xs text-subtle">Cancelled.</p> : null}
        </div>
      ) : null}
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

  async function go() {
    const pair = (from === "SOL" && to === "USDC") || (from === "USDC" && to === "SOL");
    if (!pair) {
      toast.message(`${from} to ${to} is a quote${amount > 0 ? ` of ${got.toFixed(2)} ${to}` : ""}. SOL and USDC are the pair this screen signs.`);
      return;
    }
    const owner = w.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
    const usd = from === "USDC" ? amount : amount * (w.usdPer.SOL || 0);
    if (!(usd > 0)) return toast.error("No SOL price, so the spend cap cannot be checked.");
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = w.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const signed = await signRoute({
        owner: who,
        inputMint: from === "SOL" ? SOL : USDC_MINT,
        outputMint: to === "SOL" ? SOL : USDC_MINT,
        amountRaw: from === "SOL" ? Math.floor(amount * 1e9) : Math.floor(amount * 1e6),
        outDecimals: to === "SOL" ? 9 : 6,
        usd,
      });
      rememberClear({
        sig: signed.signature,
        from: who,
        to: who,
        usd: signed.outUi,
        memo: `${from} to ${to}`,
        kind: "buy",
        status: "pending",
      });
      bumpClears();
      toast.success(`Signed. ${from} left the wallet for ${to}.`);
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "The swap did not send."));
    }
  }

  const choices = Array.from(new Set([...opened, from, to]));
  const pairLive = (from === "SOL" && to === "USDC") || (from === "USDC" && to === "SOL");

  return (
    <div className="flex flex-col gap-3">
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
      <p className="font-mono text-xs tabular-nums text-subtle">Available {formatMoney(w.w.balances[from] ?? 0, from)}</p>
      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
        <p className="font-mono font-medium tabular-nums">Quote only {amount > 0 ? formatMoney(got, to) : "—"}</p>
        <p className="mt-1 text-muted">These pockets are not USDC and not pesos. Send signs a USDC transfer. Convert swaps SOL.</p>
        {rev > 0 ? <p className="mt-1 text-muted">A retail FX desk can charge extra on the weekend. This screen does not.</p> : null}
      </div>
      <button
        type="button"
        disabled={!(amount > 0) || from === to}
        onClick={go}
        className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40"
      >
        {pairLive ? `Sign ${from} for ${to}` : "Quote"}
      </button>
    </div>
  );
}

function AddForm({ onMexico, onRevolut }: { onMexico: () => void; onRevolut: () => void }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [raw, setRaw] = useState("0.05");
  const [sol, setSol] = useState<number | null>(null);
  const [quote, setQuote] = useState<RouteQuote | null>(null);
  const [phase, setPhase] = useState<"edit" | "review" | "done">("edit");
  const [busy, setBusy] = useState(false);
  const [cardUsd, setCardUsd] = useState("50");
  const [cardBusy, setCardBusy] = useState(false);
  const [sig, setSig] = useState("");
  const [outUi, setOutUi] = useState(0);
  const amount = Number(raw);

  useEffect(() => {
    if (!owner) {
      setSol(null);
      return;
    }
    let live = true;
    readChain(owner)
      .then((chain) => {
        if (live) setSol(chain.sol);
      })
      .catch(() => {
        if (live) setSol(null);
      });
    return () => {
      live = false;
    };
  }, [owner]);

  async function review() {
    const n = Number(raw);
    if (!(n > 0)) {
      toast.error("Enter SOL to spend.");
      return;
    }
    if (sol != null && n > sol) {
      toast.error(`That is more than the ${sol.toLocaleString("en-US", { maximumFractionDigits: 6 })} SOL this wallet holds.`);
      return;
    }
    setBusy(true);
    try {
      const q = await quoteRoute({
        inputMint: SOL,
        outputMint: USDC_MINT,
        amountRaw: Math.floor(n * 1e9),
        outDecimals: 6,
      });
      if (q.impact > 5) {
        toast.error(`Price impact is ${q.impact.toFixed(2)}%.`);
        return;
      }
      setQuote(q);
      setSig("");
      setPhase("review");
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "Jupiter did not quote."));
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    if (!quote) return;
    const n = Number(raw);
    if (!(n > 0)) {
      toast.error("Enter SOL to spend.");
      return;
    }
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const r = await signRoute({
        owner: who,
        inputMint: SOL,
        outputMint: USDC_MINT,
        amountRaw: Math.floor(n * 1e9),
        outDecimals: 6,
        usd: quote.outUi,
      });
      rememberClear({
        sig: r.signature,
        from: who,
        to: who,
        usd: r.outUi,
        memo: "SOL to USDC",
        kind: "buy",
        status: "pending",
      });
      bumpClears();
      setSig(r.signature);
      setOutUi(r.outUi);
      setPhase("done");
      toast.success(`Signed ${r.signature.slice(0, 8)}…`);
      readChain(who)
        .then((chain) => setSol(chain.sol))
        .catch(() => undefined);
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "The swap did not send."));
    } finally {
      setBusy(false);
    }
  }

  async function card() {
    const usd = Number(cardUsd);
    if (!(usd >= 1)) return toast.error("Enter at least $1.");
    setCardBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const opened = await stripeOnramp({ data: { address: who, usd, source: "usd" } });
      if (!opened.ok) throw new Error(opened.error);
      window.location.assign(opened.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The card checkout did not open.");
      setCardBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Swap SOL you already hold, or buy USDC with a card. Both land on this address.</p>
      {owner ? <p className="truncate font-mono text-xs text-subtle">{owner}</p> : <p className="text-sm text-muted">Connect when you sign. The quote does not need a balance Senda holds.</p>}
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setPhase("edit");
          setQuote(null);
          setSig("");
        }}
        aria-label="SOL to spend"
        className={cn(field, "font-mono text-lg")}
      />
      <p className="font-mono text-xs tabular-nums text-subtle">
        {sol == null ? "SOL on this wallet —" : `${sol.toLocaleString("en-US", { maximumFractionDigits: 6 })} SOL on this wallet`}
      </p>
      {phase === "review" && quote ? (
        <dl className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
          <div className="flex justify-between gap-3 py-1"><dt className="text-muted">SOL in</dt><dd className="font-mono tabular-nums">{raw} SOL</dd></div>
          <div className="flex justify-between gap-3 py-1"><dt className="text-muted">USDC out</dt><dd className="font-mono tabular-nums">{quote.outUi.toLocaleString("en-US", { maximumFractionDigits: 2 })}</dd></div>
          <div className="flex justify-between gap-3 py-1"><dt className="text-muted">Minimum</dt><dd className="font-mono tabular-nums">{quote.minUi.toLocaleString("en-US", { maximumFractionDigits: 2 })}</dd></div>
          <div className="flex justify-between gap-3 py-1"><dt className="text-muted">Impact</dt><dd className="font-mono tabular-nums">{quote.impact.toFixed(2)}%</dd></div>
        </dl>
      ) : null}
      {phase === "done" && sig ? (
        <SignedReceipt title="Signed" amount={`${outUi.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`} detail="The signature is the receipt. USDC lands on this same address when the network confirms." sig={sig} />
      ) : null}
      <button
        type="button"
        disabled={busy || (phase === "review" && !quote)}
        onClick={() => {
          if (phase === "review") {
            void sign();
            return;
          }
          void review();
        }}
        className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40"
      >
        {busy ? (phase === "review" ? "Waiting on the wallet" : "Quoting…") : phase === "review" ? `Sign ${amount} SOL` : "Review"}
      </button>
      {phase === "review" ? (
        <button type="button" onClick={() => setPhase("edit")} className="min-h-12 rounded-full border border-white/15 text-sm font-semibold">
          Back
        </button>
      ) : null}
      <div className="rounded-2xl border border-white/10 px-3 py-3">
        <p className="text-sm font-semibold">Card or bank</p>
        <p className="mt-1 text-xs text-muted">Stripe takes the payment and sends USDC to this Solana address. They check identity. Not offered in New York.</p>
        <div className="mt-3 flex gap-2">
          <input value={cardUsd} onChange={(e) => setCardUsd(e.target.value)} inputMode="decimal" aria-label="Dollars" className={cn(field, "font-mono")} />
          <button type="button" disabled={cardBusy} onClick={() => void card()} className="min-h-12 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">
            {cardBusy ? "Opening…" : "Buy USDC"}
          </button>
        </div>
      </div>
      <button type="button" onClick={onRevolut} className="min-h-12 rounded-full text-sm font-semibold text-muted">
        Add from Revolut
      </button>
      <button type="button" onClick={onMexico} className="min-h-12 rounded-full text-sm font-semibold text-muted">
        Send USDC instead
      </button>
    </div>
  );
}
