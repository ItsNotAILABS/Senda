import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { getMxnDesk, type MxnDesk } from "@/lib/mxn-rate";
import { loadPayees, savePayee, type MxPayee } from "@/lib/mx-payees";
import { sendCut } from "@/lib/desk-fee";
import { payUsdc } from "@/lib/solana-pay";
import { connectPhantom } from "@/lib/phantom";
import { rememberClear } from "@/lib/clear-tape";
import { bumpClears } from "@/components/clear-strip";
import { SignedReceipt } from "@/components/money-flow";
import { spendCap } from "@/lib/spend-cap";
import { cn } from "@/lib/utils";

type Unit = "USDC" | "MXN";
type Step = "who" | "amount" | "review";

function addressOf(raw: string): string | null {
  const t = raw.trim();
  try {
    return new PublicKey(t).toBase58();
  } catch {
    return null;
  }
}

function pesos(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n);
}

function usdc(n: number): string {
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
}

function short(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

export function MexicoSend({ owner }: { owner: string }) {
  const [step, setStep] = useState<Step>("who");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [unit, setUnit] = useState<Unit>("MXN");
  const [raw, setRaw] = useState("1000");
  const [note, setNote] = useState("");
  const [desk, setDesk] = useState<MxnDesk | null>(null);
  const [payees, setPayees] = useState<MxPayee[]>([]);
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");

  useEffect(() => {
    setPayees(loadPayees());
    let live = true;
    void getMxnDesk()
      .then((d) => {
        if (live) setDesk(d);
      })
      .catch(() => {
        if (live) setDesk({ market: null, marketDate: null, fix: null, fixDate: null, bitso: null, bitsoAt: null });
      });
    return () => {
      live = false;
    };
  }, []);

  const rate = desk?.market || desk?.fix || 0;
  const typed = Number(raw) || 0;
  const sendUsdc = unit === "USDC" ? Math.round(typed * 100) / 100 : rate > 0 ? Math.round((typed / rate) * 100) / 100 : 0;
  const quoteMxn = rate > 0 ? sendUsdc * rate : 0;
  const who = addressOf(address);
  const cap = spendCap();

  function pick(p: MxPayee) {
    setName(p.name);
    setAddress(p.address);
    setStep("amount");
  }

  function toAmount() {
    if (name.trim().length < 2) {
      toast.error("Name the person.");
      return;
    }
    if (!who) {
      toast.error("That is not a Solana address.");
      return;
    }
    setPayees(savePayee({ name, address: who }));
    setStep("amount");
  }

  function toReview() {
    if (!(sendUsdc >= 0.01)) {
      toast.error(rate > 0 ? "Enter an amount." : "The peso quote is down. Switch to USDC and enter the amount you will sign.");
      return;
    }
    if (sendUsdc > cap) {
      toast.error(`That is over the spend cap of ${cap} USDC.`);
      return;
    }
    setStep("review");
  }

  async function sign() {
    if (!who || !(sendUsdc >= 0.01)) return;
    setBusy(true);
    setSig("");
    try {
      const from = owner || (await connectPhantom());
      const memo = note.trim() || `USDC to ${name.trim()}`;
      const done = await payUsdc({ owner: from, to: who, usd: sendUsdc, memo, deskFee: true });
      setSig(done.signature);
      setPayees(savePayee({ name, address: who }));
      rememberClear({
        sig: done.signature,
        from,
        to: who,
        usd: sendUsdc,
        memo,
        kind: "send",
        status: "pending",
      });
      bumpClears();
      toast.success("Signed. USDC left your wallet.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The transfer did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 text-[11px] tracking-[0.14em] uppercase">
        {(["who", "amount", "review"] as const).map((id, i) => (
          <span key={id} className={step === id ? "text-accent" : "text-subtle"}>
            {i + 1} {id === "who" ? "Who" : id === "amount" ? "Amount" : "Review"}
          </span>
        ))}
      </div>

      {step === "who" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Their Solana address. A name here does not receive money.</p>
          {payees.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto">
              {payees.map((p) => (
                <button key={p.id} type="button" onClick={() => pick(p)} className="min-h-10 shrink-0 rounded-full border border-white/10 px-3 text-left">
                  <span className="block text-sm font-semibold">{p.name}</span>
                  <span className="block font-mono text-[10px] text-subtle">{short(p.address)}</span>
                </button>
              ))}
            </div>
          ) : null}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none" />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Solana address" spellCheck={false} aria-label="Solana address" className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-xs outline-none" />
          <p className="text-xs text-subtle">Bitso deposit addresses change. Paste the Solana USDC address the app is showing now. Do not reuse an old one.</p>
          <button type="button" onClick={toAmount} className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg">
            Continue
          </button>
        </div>
      ) : null}

      {step === "amount" ? (
        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => setStep("who")} className="self-start text-sm text-muted">
            {name.trim() || "Person"} · {who ? short(who) : ""}
          </button>
          <div className="flex items-end gap-3">
            <input
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              aria-label="Amount"
              className="min-h-14 w-full bg-transparent font-mono text-5xl tabular-nums outline-none"
            />
            <div className="mb-1 flex rounded-full border border-white/10 p-1">
              {(["MXN", "USDC"] as const).map((u) => (
                <button key={u} type="button" onClick={() => setUnit(u)} className={cn("min-h-9 rounded-full px-3 font-mono text-xs font-semibold", unit === u ? "bg-accent text-accent-fg" : "text-muted")}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {(unit === "MXN" ? [500, 1000, 2000, 5000] : [20, 50, 100, 200]).map((n) => (
              <button key={n} type="button" onClick={() => setRaw(String(n))} className={cn("min-h-10 flex-1 rounded-full font-mono text-xs font-semibold", Number(raw) === n ? "bg-accent text-accent-fg" : "border border-white/10")}>
                {unit === "MXN" ? n.toLocaleString("es-MX") : `$${n}`}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
            <p className="font-mono tabular-nums">You send {sendUsdc > 0 ? usdc(sendUsdc) : "—"}</p>
            <p className="mt-1 text-muted">
              {rate > 0 ? `Estimate ${pesos(quoteMxn)} · 1 USD ≈ ${rate.toFixed(4)} MXN. Not a Bitso fill and not a Ria quote. Nothing is converted.` : "Peso quote is down. Switch to USDC and enter the amount you will sign."}
            </p>
            <p className="mt-1 text-xs text-subtle">
              {desk?.market ? `Frankfurter ${desk.market.toFixed(4)}${desk.marketDate ? ` · ${desk.marketDate}` : ""}. ` : ""}
              {desk?.fix ? `Banxico FIX ${desk.fix.toFixed(4)}${desk.fixDate ? ` · ${desk.fixDate}` : ""}. ` : ""}
              {desk?.bitso ? `Bitso’s dollar book last ${desk.bitso.toFixed(4)} is not the price of USDC. ` : ""}
              Senda fee $0. The network fee is a fraction of a cent in SOL, from this wallet.
            </p>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, optional" aria-label="Note" className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none" />
          <button type="button" onClick={toReview} className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg">
            Review
          </button>
        </div>
      ) : null}

      {step === "review" && who ? (
        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => setStep("amount")} className="self-start text-sm text-muted">
            Back to the amount
          </button>
          <dl className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
            <div className="flex justify-between gap-3 py-1">
              <dt className="text-muted">To</dt>
              <dd className="text-right font-mono text-xs">{who}</dd>
            </div>
            <div className="flex justify-between gap-3 py-1">
              <dt className="text-muted">You sign</dt>
              <dd className="font-mono">{usdc(sendUsdc)}</dd>
            </div>
            <div className="flex justify-between gap-3 py-1">
              <dt className="text-muted">Peso quote</dt>
              <dd className="font-mono">{rate > 0 ? pesos(quoteMxn) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3 py-1">
              <dt className="text-muted">Fee</dt>
              <dd className="text-right">{sendCut(sendUsdc).why}</dd>
            </div>
            <div className="flex justify-between gap-3 py-1">
              <dt className="text-muted">Note</dt>
              <dd>{note.trim() || "None"}</dd>
            </div>
          </dl>
          <p className="text-sm text-muted">This app only sends USDC on Solana to the address you enter. It does not send pesos, it does not deposit to a bank account or CLABE, and it does not create a cash pickup at Ria, MoneyGram, Western Union, OXXO, or any other store. The person in Mexico receives USDC in their own wallet. Turning that into pesos or cash is something they do themselves, at their own cost, and it can fail.</p>
          <p className="text-sm text-muted">Esta aplicación solo envía USDC en la red Solana a la dirección que tú indiques. No envía pesos, no deposita a una cuenta bancaria ni a una CLABE, y no genera un código para cobrar en efectivo en Ria, MoneyGram, Western Union, OXXO ni en ninguna otra tienda. La persona en México recibe USDC en su propia cartera. Convertir eso en pesos o en efectivo lo hace ella por su cuenta, con su propio costo, y puede no funcionar.</p>
          <div className="rounded-2xl border border-white/10 px-4 py-3 text-xs text-subtle">
            <p className="font-semibold text-muted">How they can turn USDC into pesos. Senda does not do this.</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Bitso, if they have a Mexican bank and a CURP. In the Bitso app: Deposit, Crypto, USDC, network Solana. Paste that address above. It changes. Then they sell for MXN and send SPEI to their CLABE. Bitso’s peso withdrawal is on their account, not ours.</li>
              <li>Airtm, if they use Airtm.me. USDC on Solana can credit their Airtm balance. A bank withdrawal from there is Airtm’s, and Airtm holds it after the deposit.</li>
              <li>MoneyGram Ramps only if their wallet already has it. Sending USDC to a normal address does not create a pickup code.</li>
              <li>If they need cash at OXXO today, use Ria, MoneyGram, or Western Union. This signature cannot reach those counters.</li>
            </ol>
            <p className="mt-2">
              <a className="text-accent" href="https://bitso.com" target="_blank" rel="noreferrer">Bitso</a>
              {" · "}
              <a className="text-accent" href="https://support.bitso.com/hc/en-us/articles/4419901801748-Which-network-to-use-to-deposit-or-withdraw-crypto-on-Bitso" target="_blank" rel="noreferrer">Solana USDC on Bitso</a>
              {" · "}
              <a className="text-accent" href="https://www.riamoneytransfer.com/" target="_blank" rel="noreferrer">Ria</a>
              {" · "}
              <a className="text-accent" href="https://www.moneygram.com/" target="_blank" rel="noreferrer">MoneyGram</a>
              {" · "}
              <a className="text-accent" href="https://qqed.profeco.gob.mx" target="_blank" rel="noreferrer">PROFECO</a>
            </p>
          </div>
          <button type="button" disabled={busy} onClick={() => void sign()} className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40">
            {busy ? "Waiting on the wallet" : owner ? "Sign transfer" : "Open wallet and sign"}
          </button>
          {sig ? (
            <SignedReceipt title="Signed" amount={usdc(sendUsdc)} detail={`USDC left your wallet for ${name.trim() || short(who)}. The peso figure was a quote.`} sig={sig} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
