import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LanguageSwitch } from "@/components/language-switch";
import { EsimDesk } from "@/components/esim-desk";
import { CCTP_DEST, burnUsdc } from "@/lib/cctp-send";
import { useLang } from "@/lib/i18n";
import {
  CORRIDORS,
  blindQuote,
  cctpAttest,
  cctpFees,
  fxRates,
  issuingCards,
  laneStatus,
  wiseStatus,
  yellowRates,
} from "@/lib/global-rails";
import { rememberTrade } from "@/lib/trade-log";

type Status = {
  blindpay: boolean;
  stripe: boolean;
  wise: boolean;
  airwallex: boolean;
  esim: boolean;
  yellow: boolean;
};

function Pill({ on, off, live }: { on: string; off: string; live: boolean }) {
  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${live ? "bg-accent text-accent-fg" : "bg-white/10 text-white/50"}`}>{live ? on : off}</span>;
}

export function GlobalDesk() {
  const { t } = useLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [rates, setRates] = useState<{ date: string; rates: Record<string, number> } | null>(null);
  const [fees, setFees] = useState<Awaited<ReturnType<typeof cctpFees>>>([]);
  const [usd, setUsd] = useState("25");
  const [bank, setBank] = useState("");
  const [tx, setTx] = useState("");
  const [out, setOut] = useState("");
  const [domain, setDomain] = useState(0);
  const [evm, setEvm] = useState("");
  const [burning, setBurning] = useState(false);

  useEffect(() => {
    laneStatus().then(setStatus).catch(() => undefined);
    fxRates()
      .then((row) => {
        if (row.ok) setRates({ date: row.date, rates: row.rates });
      })
      .catch(() => undefined);
    cctpFees().then(setFees).catch(() => undefined);
  }, []);

  async function run(label: string, job: () => Promise<{ ok?: boolean; error?: string; body?: string; status?: number; count?: number; last4?: string[] }>) {
    try {
      const row = await job();
      if (row.error) {
        setOut(`${label}: ${row.error}`);
        toast.error(row.error);
        return;
      }
      const text = row.body || (row.last4 ? `${row.count} cards · ${row.last4.join(", ")}` : row.ok ? `${label} answered ${row.status ?? ""}`.trim() : `${label} refused`);
      setOut(text);
      toast.success(label);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The rail did not answer.";
      setOut(msg);
      toast.error(msg);
    }
  }

  async function burn() {
    setBurning(true);
    try {
      const signature = await burnUsdc({ usd: Number(usd) || 0, domain, recipient: evm });
      rememberTrade({ symbol: "USDC", side: "send", usd: Number(usd) || 0, mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", signature });
      setTx(signature);
      setOut(signature);
      toast.success("Burned. Circle attests, then the other chain can mint.");
      const look = await cctpAttest({ data: { domain: 5, tx: signature } });
      setOut(look.body || signature);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The burn did not send.";
      setOut(msg);
      toast.error(msg);
    } finally {
      setBurning(false);
    }
  }

  return (
    <main className="space-y-3 px-3 py-3 lg:px-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">{t.title}</p>
          <h1 className="mt-1 text-3xl tracking-tight">USDC out, in the local rail.</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">{t.line}</p>
        </div>
        <LanguageSwitch />
      </header>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg">1 · Bank payout</h2>
          <Pill on={t.on} off={t.off} live={Boolean(status?.blindpay)} />
        </div>
        <p className="mt-1 text-sm text-muted">BlindPay quotes a USDC send to a bank account id they already issued. Pix and SPEI are their route, not a number this desk invents.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" className="min-h-11 w-24 rounded-full border border-white/10 bg-black/40 px-3 font-mono text-sm" />
          <input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Their bank account id" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 text-sm" />
          <button
            type="button"
            onClick={() => void run("BlindPay", () => blindQuote({ data: { usd: Number(usd) || 0, bankAccountId: bank, network: "solana" } }))}
            className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
          >
            Quote
          </button>
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg">2 · Spend cards</h2>
          <Pill on={t.on} off={t.off} live={Boolean(status?.stripe)} />
        </div>
        <p className="mt-1 text-sm text-muted">Stripe Issuing, read only. This does not print a number. A terminal still will not clear the desk number on Pay.</p>
        <button type="button" onClick={() => void run("Stripe", () => issuingCards())} className="mt-3 min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">
          Read cards
        </button>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">3 · Currencies</h2>
          <div className="flex gap-1">
            <Pill on="Wise" off="Wise" live={Boolean(status?.wise)} />
            <Pill on="Airwallex" off="Airwallex" live={Boolean(status?.airwallex)} />
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          Mid-market from the European Central Bank feed, dated {rates?.date || "—"}. This is a rate, not an account number. No IBAN is shown until Wise answers.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["EUR", "GBP", "MXN", "BRL"].map((ccy) => (
            <li key={ccy} className="rounded-2xl bg-black/30 px-3 py-3">
              <p className="text-[11px] text-white/45">1 USD</p>
              <p className="mt-1 font-mono text-sm">{rates?.rates[ccy] ?? "—"} {ccy}</p>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => void run("Wise", () => wiseStatus())} className="mt-3 min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">
          Check Wise
        </button>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="text-lg">4 · Local rails</h2>
        <ul className="mt-3 divide-y divide-white/10">
          {CORRIDORS.map((row) => (
            <li key={row.id} className="py-3">
              <p className="text-sm font-semibold">{row.name} · {row.where}</p>
              <p className="text-xs text-white/50">{row.sample}</p>
              <p className="mt-1 text-sm text-muted">{row.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <EsimDesk />

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg">6 · Africa specialist</h2>
          <Pill on={t.on} off={t.off} live={Boolean(status?.yellow)} />
        </div>
        <p className="mt-1 text-sm text-muted">Yellow Card rates. Their API also checks the caller’s IP. A refusal is shown as they sent it.</p>
        <button type="button" onClick={() => void run("Yellow Card", () => yellowRates())} className="mt-3 min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">
          Read rates
        </button>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="text-lg">7 · Circle, signed here</h2>
        <p className="mt-1 text-sm text-muted">
          This burns USDC on Solana. Phantom signs. Circle mints the same USDC on the chain you pick after it attests. This app does not hold a key on that chain, so it cannot finish the mint.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CCTP_DEST.map((row) => (
            <button key={row.id} type="button" onClick={() => setDomain(row.domain)} className={`min-h-9 rounded-full px-3 text-xs font-semibold ${domain === row.domain ? "bg-white text-black" : "bg-white/10"}`}>
              {row.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={evm} onChange={(e) => setEvm(e.target.value)} placeholder="0x address that receives the mint" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 font-mono text-sm" />
          <button type="button" disabled={burning} onClick={() => void burn()} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
            {burning ? "Waiting for Phantom…" : `Burn $${usd}`}
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {fees.map((row) => (
            <li key={`${row.from}-${row.to}`} className="flex items-baseline justify-between gap-3 text-sm">
              <span>{row.from} → {row.to}</span>
              <span className="font-mono text-xs text-white/60">
                {row.error || row.fees.map((fee) => `${fee.finalityThreshold}:${fee.minimumFee}`).join(" · ") || "—"}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="Burn signature" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 font-mono text-sm" />
          <button type="button" onClick={() => void run("Circle", () => cctpAttest({ data: { domain: 5, tx } }))} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">
            Attest
          </button>
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="text-lg">8 · Language</h2>
        <p className="mt-1 text-sm text-muted">English and Spanish on this page and in Account. Prices above stay in the currency’s own code. The rest of the desk is still English.</p>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="text-lg">9 · US stocks for non-US users</h2>
        <p className="mt-1 text-sm text-muted">
          Not built. Ondo and xStocks, as broker products, are geofenced and need securities counsel. The xStocks already on Trade are the Solana tokens this wallet can hold. This page will not open a brokerage account.
        </p>
      </section>

      {out ? <pre className="overflow-x-auto rounded-[22px] bg-black/40 p-4 font-mono text-xs text-white/70 whitespace-pre-wrap">{out}</pre> : null}
    </main>
  );
}
