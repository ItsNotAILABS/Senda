import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { RevolutOpen } from "@/components/revolut-open";
import { SignedReceipt, solAddress } from "@/components/money-flow";
import { envelopeUrl, type Envelope, type EnvelopeRail } from "@/lib/envelope";
import { connectPhantom } from "@/lib/phantom";
import { humanWalletError, isPhoneBrowser } from "@/lib/mobile-wallet";
import { cleanTag, type SleeveCcy } from "@/lib/revolut-link";
import { payUsdc } from "@/lib/solana-pay";
import { sleeveAmount } from "@/lib/sleeve";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const RAILS: { id: EnvelopeRail; label: string; line: string }[] = [
  { id: "revolut", label: "Revolut", line: "Their Revtag. Your Revolut app pays it." },
  { id: "usdc", label: "USDC", line: "A Solana address. The wallet signs." },
  { id: "pre", label: "PreStock", line: "A live name. Jupiter, then a signature." },
  { id: "cover", label: "Cover", line: "A USDC premium. You sign it on Cover." },
];

const CCYS: SleeveCcy[] = ["USD", "EUR", "GBP", "MXN"];

/** Build a link that wraps one real product, then hand it to the phone. */
export function EnvelopeMaker() {
  const [rail, setRail] = useState<EnvelopeRail>("revolut");
  const [to, setTo] = useState("");
  const [usd, setUsd] = useState("20");
  const [ccy, setCcy] = useState<SleeveCcy>("USD");
  const [what, setWhat] = useState("");
  const [link, setLink] = useState("");
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    setPhone(isPhoneBrowser());
  }, []);

  function make() {
    const n = Math.round(Number(usd) * 100) / 100;
    const name = what.trim() || RAILS.find((r) => r.id === rail)?.label || "Senda";
    if (rail === "revolut" && !cleanTag(to)) return toast.error("That Revtag is not valid.");
    if (rail === "usdc" && !solAddress(to)) return toast.error("Paste a Solana address.");
    if (rail === "pre" && !/^[A-Za-z0-9.]{1,16}$/.test(to.trim())) return toast.error("Use the symbol on the book, like OPENAI.");
    if (rail !== "pre" && !(n > 0)) return toast.error("Set an amount.");
    const row: Envelope = {
      rail,
      to: rail === "revolut" ? cleanTag(to)! : to.trim(),
      usd: n > 0 ? n : 0,
      ccy,
      what: name,
    };
    const url = envelopeUrl(row, window.location.origin);
    setLink(url);
    toast.success("Link ready. It opens this product. It does not move money by itself.");
  }

  async function share() {
    if (!link) return;
    try {
      if (phone && navigator.share) {
        await navigator.share({ title: what || "Senda", url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast.success("Link copied.");
    } catch {
      /* dismissed */
    }
  }

  const hint = rail === "revolut" ? "@revtag" : rail === "usdc" ? "Solana address" : rail === "pre" ? "Symbol" : "Optional note";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">A link that wraps one product. On a phone it opens Revolut, or this desk so the wallet can sign. Nothing is paid when the link is made.</p>
      <div className="grid grid-cols-2 gap-2">
        {RAILS.map((r) => (
          <button key={r.id} type="button" onClick={() => { setRail(r.id); setLink(""); }} className={cn("rounded-2xl px-3 py-2 text-left", rail === r.id ? "bg-accent text-accent-fg" : "bg-black/30")}>
            <span className="block text-sm font-semibold">{r.label}</span>
            <span className={cn("mt-0.5 block text-[11px]", rail === r.id ? "text-accent-fg/80" : "text-subtle")}>{r.line}</span>
          </button>
        ))}
      </div>
      <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="What it is" aria-label="Product" className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none" />
      {rail !== "cover" ? (
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={hint} aria-label={hint} spellCheck={false} className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-sm outline-none" />
      ) : null}
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
        <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" aria-label="Amount in USD" className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-sm outline-none" />
        <div className="flex gap-1">
          {CCYS.map((c) => (
            <button key={c} type="button" onClick={() => setCcy(c)} className={cn("min-h-12 flex-1 rounded-full font-mono text-[11px] font-semibold", ccy === c ? "bg-accent text-accent-fg" : "border border-white/10 text-muted")}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={make} className="min-h-12 rounded-full bg-accent text-sm font-semibold text-accent-fg">
        Make the link
      </button>
      {link ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="break-all font-mono text-[11px] text-muted">{link}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => void share()} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black">
              {phone ? "Share" : "Copy"}
            </button>
            {phone ? (
              <a href={`sms:?&body=${encodeURIComponent(link)}`} className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
                Messages
              </a>
            ) : null}
            <a href={`https://wa.me/?text=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
              WhatsApp
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The page a phone lands on when it opens one of those links. */
export function EnvelopeOpen({
  rail,
  to,
  usd,
  ccy,
  what,
  owner,
}: {
  rail: EnvelopeRail;
  to: string;
  usd: number;
  ccy: SleeveCcy;
  what: string;
  owner: string;
}) {
  const { usdPer } = useWallet();
  const quoted = useMemo(() => sleeveAmount(usd, ccy, usdPer), [usd, ccy, usdPer]);
  const [phase, setPhase] = useState<"review" | "done">("review");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");
  const dest = rail === "usdc" ? solAddress(to) : null;

  async function sign() {
    if (!dest) return;
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      const paid = await payUsdc({ owner: who, to: dest, usd, memo: `Senda ${what}`.slice(0, 80) });
      setSig(paid.signature);
      setPhase("done");
      toast.success("Signed. USDC left the wallet.");
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "The transfer did not send."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Envelope</p>
      <h2 className="mt-1 text-xl">{what}</h2>
      <p className="mt-1 text-sm text-muted">
        {rail === "revolut" ? `Pay @${to} in Revolut. ${quoted > 0 ? `${quoted} ${ccy}` : "Quote down"} for $${usd}.` : null}
        {rail === "usdc" ? `Sign $${usd} USDC to ${dest ? `${dest.slice(0, 4)}…${dest.slice(-4)}` : "a bad address"}.` : null}
        {rail === "pre" ? `${to} on the live book. The buy is Jupiter. This link does not buy it.` : null}
        {rail === "cover" ? `Cover for $${usd}. The premium is USDC you sign on that desk.` : null}
      </p>
      {rail === "revolut" && cleanTag(to) && quoted > 0 ? (
        <RevolutOpen tag={cleanTag(to)!} ccy={ccy} amount={quoted} note={what} wallet={owner} product={what} usd={usd} desk="envelope" />
      ) : null}
      {rail === "usdc" && dest ? (
        phase === "done" && sig ? (
          <div className="mt-3">
            <SignedReceipt title="Signed" amount={`${usd} USDC`} detail="Paid the address in this envelope." sig={sig} />
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={() => void sign()} className="mt-3 min-h-12 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-50">
            {busy ? "Waiting on the wallet" : `Sign $${usd} USDC`}
          </button>
        )
      ) : null}
      {rail === "pre" ? (
        <Link to="/pre" search={{ q: to }} className="mt-3 flex min-h-12 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
          Open {to} on the book
        </Link>
      ) : null}
      {rail === "cover" ? (
        <Link to="/cover" className="mt-3 flex min-h-12 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
          Open Cover · ${usd}
        </Link>
      ) : null}
    </section>
  );
}
