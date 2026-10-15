import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Bluetooth, Link2, Plus, RefreshCw } from "lucide-react";
import { AccountDetails } from "@/components/account-details";
import { ClearingCard } from "@/components/clearing-card";
import { ClearStrip } from "@/components/clear-strip";
import { CrossSend } from "@/components/cross-send";
import { MexicoSend } from "@/components/mexico-send";
import { MoneyBar } from "@/components/money-bar";
import { SpaceDesk } from "@/components/space-desk";
import { NearbyDesk } from "@/components/nearby-desk";
import { TabLead } from "@/components/tab-lead";
import { rememberClear } from "@/lib/clearing";
import { quoteRoute, signRoute, SOL, type RouteQuote } from "@/lib/jup-sign";
import { humanWalletError } from "@/lib/mobile-wallet";
import { connectPhantom } from "@/lib/phantom";
import { assetPayLink, payAsset, SEND_ASSETS, type SendAssetId } from "@/lib/solana-pay";
import { CCYS, CCY_META, formatMoney, type Ccy } from "@/lib/wallet";
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
const SWAP_USDC = `https://phantom.com/ul/v1/swap?sell=${encodeURIComponent(`solana:101/address:${SOL}`)}&buy=${encodeURIComponent(`solana:101/address:${USDC_MINT}`)}`;
const OPEN_USDC = `https://phantom.com/ul/v1/fungible?token=${encodeURIComponent(`solana:101/address:${USDC_MINT}`)}`;

export function PaymentsDesk({ initialAct }: { initialAct?: string; initialFrom?: string }) {
  const start: PayAct = ACTS.some((a) => a.id === initialAct) ? (initialAct as PayAct) : "send";
  const [act, setAct] = useState<PayAct>(start);
  const [pocket, setPocket] = useState<Ccy | null>(null);
  const w = useWallet();
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
        kicker="Account"
        title="USDC in your wallet."
        accent="That is the balance."
        line="Send it, request it, swap SOL for it, or load it. Each one hits the chain. The address on this page is the account."
        live={["Send", "Request", "SOL, USDC, USDT, PYUSD", "USDC onto Base, Ethereum, Arbitrum, or Polygon", "A clearing address on this device"]}
        coming={[]}
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
        {act === "exchange" ? <ExchangeForm key={pocket ?? "sol"} owner={owner} /> : null}
        {act === "add" ? <AddForm owner={owner} onExchange={() => setAct("exchange")} /> : null}
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
            <h2 className="text-sm font-semibold">Practice pockets</h2>
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
  const [asset, setAsset] = useState<SendAssetId>("USDC");
  const [usd, setUsd] = useState(1);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");
  const link = useMemo(() => (to.trim() ? assetPayLink(asset, to.trim(), usd, memo) : ""), [asset, to, usd, memo]);

  async function send() {
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = w.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "The wallet did not stay.");
      }
      const out = await payAsset({ owner: who, to, asset, amount: usd, memo: memo || `Senda ${asset}` });
      setSig(out.signature);
      rememberClear({
        desk: "send",
        title: `${asset} to ${to.slice(0, 4)}…`,
        legs: [{ side: "out", asset, amount: usd, where: to }],
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
      <p className="text-sm text-muted">The asset leaves the wallet you connect and lands in theirs. You sign. Senda does not hold it. SOL is priced in dollars only for the spend cap.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SEND_ASSETS.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setAsset(row.id)}
            className={cn("min-h-10 rounded-full px-3 text-sm font-semibold", asset === row.id ? "bg-accent text-accent-fg" : "border border-white/10 text-muted")}
          >
            {row.label}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs text-subtle">
        Their Solana address
        <input value={to} onChange={(e) => setTo(e.target.value)} className={`${field} mt-1 font-mono`} placeholder="Address" />
      </label>
      <label className="mt-3 block text-xs text-subtle">
        {asset}
        <input value={usd} onChange={(e) => setUsd(Math.max(0.01, Number(e.target.value) || 0))} inputMode="decimal" className={`${field} mt-1 font-mono`} />
      </label>
      <label className="mt-3 block text-xs text-subtle">
        Note
        <input value={memo} onChange={(e) => setMemo(e.target.value)} className={`${field} mt-1`} placeholder="What this is for" />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void send()} className="min-h-12 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50">
          {busy ? "Waiting for the wallet…" : `Send ${usd} ${asset}`}
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
      <CrossSend owner={owner} />
    </div>
  );
}

function RequestForm({ owner }: { owner: string }) {
  const [usd, setUsd] = useState(20);
  const [memo, setMemo] = useState("");
  const link = owner
    ? `solana:${owner}?amount=${usd}&spl-token=${USDC_MINT}&label=Senda&message=${encodeURIComponent(memo.trim() || "Senda")}`
    : "";

  async function share() {
    if (!link) return;
    try {
      if (typeof navigator.share === "function") await navigator.share({ title: "Pay USDC", text: link, url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast.success("Request link copied.");
      }
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">They pay the address on this account. The USDC shows up here when their signature confirms.</p>
      {owner ? <p className="break-all font-mono text-xs">{owner}</p> : <p className="text-sm text-muted">Show my account first. The request has to name that address.</p>}
      <label className="block text-xs text-subtle">
        USDC
        <input value={usd} onChange={(e) => setUsd(Math.max(0.01, Number(e.target.value) || 0))} inputMode="decimal" className={`${field} mt-1 font-mono`} />
      </label>
      <label className="block text-xs text-subtle">
        Note
        <input value={memo} onChange={(e) => setMemo(e.target.value)} className={field} placeholder="What this is for" aria-label="Note" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!link} onClick={() => void share()} className="min-h-12 rounded-full bg-accent px-5 text-base font-semibold text-accent-fg disabled:opacity-40">
          Share request
        </button>
        <button
          type="button"
          disabled={!link}
          onClick={() => {
            void navigator.clipboard.writeText(link);
            toast.success("Request link copied.");
          }}
          className="min-h-12 rounded-full border border-white/15 px-5 text-sm font-semibold disabled:opacity-40"
        >
          Copy link
        </button>
      </div>
      {link ? <p className="break-all font-mono text-[11px] text-subtle">{link}</p> : null}
    </div>
  );
}

function ExchangeForm({ owner }: { owner: string }) {
  const [side, setSide] = useState<"sol-usdc" | "usdc-sol">("sol-usdc");
  const [raw, setRaw] = useState("0.1");
  const [quote, setQuote] = useState<RouteQuote | null>(null);
  const [quoteErr, setQuoteErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");
  const sellingSol = side === "sol-usdc";

  useEffect(() => {
    const amount = Number(raw);
    if (!(amount > 0)) {
      setQuote(null);
      setQuoteErr("");
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      void quoteRoute({
        inputMint: sellingSol ? SOL : USDC_MINT,
        outputMint: sellingSol ? USDC_MINT : SOL,
        amountRaw: Math.round(amount * (sellingSol ? 1e9 : 1e6)),
        outDecimals: sellingSol ? 6 : 9,
      })
        .then((next) => {
          if (!live) return;
          setQuote(next);
          setQuoteErr("");
        })
        .catch((e) => {
          if (!live) return;
          setQuote(null);
          setQuoteErr(e instanceof Error ? e.message : "No quote.");
        });
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [raw, sellingSol]);

  async function go() {
    const amount = Number(raw);
    if (!(amount > 0) || !quote) return;
    setBusy(true);
    setSig("");
    try {
      const who = owner || (await connectPhantom());
      const done = await signRoute({
        owner: who,
        inputMint: sellingSol ? SOL : USDC_MINT,
        outputMint: sellingSol ? USDC_MINT : SOL,
        amountRaw: Math.round(amount * (sellingSol ? 1e9 : 1e6)),
        outDecimals: sellingSol ? 6 : 9,
        usd: sellingSol ? quote.outUi : amount,
      });
      setSig(done.signature);
      rememberClear({
        desk: "send",
        title: sellingSol ? "SOL to USDC" : "USDC to SOL",
        legs: [
          { side: "out", asset: sellingSol ? "SOL" : "USDC", amount, where: "Jupiter" },
          { side: "in", asset: sellingSol ? "USDC" : "SOL", amount: done.outUi, where: who },
        ],
        feeUsd: 0,
        sig: done.signature,
        status: "signed",
      });
      toast.success("Signed. The swap is on the chain.");
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "The swap did not sign."));
    } finally {
      setBusy(false);
    }
  }

  const impact = quote ? Math.abs(quote.impact) <= 1 ? quote.impact * 100 : quote.impact : 0;
  const outLabel = quote ? (sellingSol ? `${quote.outUi.toFixed(2)} USDC` : `${quote.outUi.toFixed(4)} SOL`) : "—";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Jupiter quotes. You sign. USDC or SOL moves in the wallet on this page.</p>
      <div className="grid grid-cols-2 gap-2">
        {([
          ["sol-usdc", "SOL → USDC"],
          ["usdc-sol", "USDC → SOL"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSide(id)}
            className={cn("min-h-11 rounded-full text-sm font-semibold", side === id ? "bg-accent text-accent-fg" : "border border-white/10")}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        aria-label="Amount"
        className="min-h-14 w-full bg-transparent font-mono text-5xl tabular-nums outline-none"
      />
      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
        <p className="font-mono tabular-nums">You receive about {outLabel}</p>
        <p className="mt-1 text-muted">
          {quote ? `${quote.route} · impact ${impact.toFixed(3)}% · minimum ${sellingSol ? quote.minUi.toFixed(2) + " USDC" : quote.minUi.toFixed(4) + " SOL"}` : quoteErr || "Quoting…"}
        </p>
      </div>
      <button type="button" disabled={busy || !quote} onClick={() => void go()} className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40">
        {busy ? "Waiting on the wallet…" : "Sign swap"}
      </button>
      {sig ? (
        <a className="truncate font-mono text-xs text-accent" href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer">
          {sig}
        </a>
      ) : null}
    </div>
  );
}

function AddForm({ owner, onExchange }: { owner: string; onExchange: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Load the wallet on this desk. USDC that lands there shows under In the wallet.</p>
      {owner ? <p className="break-all font-mono text-xs">{owner}</p> : <p className="text-sm text-muted">Show my account so loads have an address.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onExchange} className="min-h-12 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
          Swap SOL to USDC here
        </button>
        <a href={SWAP_USDC} className="inline-flex min-h-12 items-center rounded-full border border-white/15 px-5 text-sm font-semibold">
          Open Phantom swap
        </a>
        <a href={OPEN_USDC} className="inline-flex min-h-12 items-center rounded-full border border-white/15 px-5 text-sm font-semibold">
          Open USDC in Phantom
        </a>
      </div>
      <AccountDetails owner={owner} />
      <div className="mt-4">
        <ClearingCard />
      </div>
    </div>
  );
}
