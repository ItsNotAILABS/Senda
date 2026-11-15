import { useState } from "react";
import { toast } from "sonner";
import { addAd, dropAd, readEarn, saveFee, type DeskEarn } from "@/lib/desk-earn";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

/** The only money this shop can take: a signed USDC cut, a link you added, or a machine on someone else's map. */
export function DeskEarn() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [book, setBook] = useState<DeskEarn>(() => (typeof window === "undefined" ? { fee: "", ads: [] } : readEarn()));
  const [fee, setFee] = useState(book.fee);
  const [usd, setUsd] = useState("1");
  const [name, setName] = useState("");
  const [href, setHref] = useState("");
  const [line, setLine] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  async function pay() {
    const n = Number(usd);
    if (!(n > 0) || book.fee.length < 32) {
      toast.error("Save the fee address first, then an amount.");
      return;
    }
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
      }
      const paid = await payUsdc({ owner: who, to: book.fee, usd: n, memo: "Senda desk" });
      toast.success(`The desk was paid. ${paid.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The fee did not sign.");
    } finally {
      setBusy(false);
    }
  }

  function keepFee() {
    if (fee.trim().length < 32) {
      toast.error("That is not a Solana address.");
      return;
    }
    setBook(saveFee(fee));
    toast.success("Fee address saved on this browser.");
  }

  function postAd() {
    const next = addAd(name, href, line);
    if ("error" in next) {
      toast.error(next.error);
      return;
    }
    setBook(next);
    setName("");
    setHref("");
    setLine("");
  }

  const map = `https://coinatmradar.com/${city.trim() ? `?s=${encodeURIComponent(city.trim())}` : ""}`;

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">How this desk gets paid</p>
      <h2 className="mt-1 text-xl font-semibold">A signature, a link, or a machine.</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        A cut is USDC signed to an address you set. A card below is a link you added. This app is not paid for that click unless that company pays you. A Bitcoin ATM takes the cash in the machine. CoinATMRadar’s location feed is deprecated, and the operator API needs their key, so the machines are on their map, not listed here.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 p-3">
          <p className="text-sm font-semibold">The cut</p>
          <p className="mt-1 text-xs text-muted">Phantom signs it. It is not a balance stored as earnings.</p>
          <input value={fee} onChange={(e) => setFee(e.target.value.trim())} placeholder="Solana address that receives the fee" spellCheck={false} className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
          <button type="button" onClick={keepFee} className="mt-2 min-h-9 rounded-full border border-white/15 px-3 text-xs font-semibold">Save the address</button>
          <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Fee in USDC" className="mt-3 w-full bg-transparent font-mono text-3xl outline-none" />
          <button type="button" disabled={busy} onClick={() => void pay()} className="mt-2 min-h-10 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">{busy ? "Waiting on Phantom" : "Pay the desk"}</button>
        </div>
        <div className="rounded-2xl border border-white/10 p-3">
          <p className="text-sm font-semibold">A sponsored card</p>
          <p className="mt-1 text-xs text-muted">Only a company you can actually send someone to. Jupiter’s 0.2% swap fee is not on, because a wrong token account would break every trade.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company" className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
          <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://" spellCheck={false} className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
          <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="What they pay you for, in one line" className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
          <button type="button" onClick={postAd} className="mt-2 min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black">Put it on the desk</button>
        </div>
        <div className="rounded-2xl border border-white/10 p-3">
          <p className="text-sm font-semibold">Cash at a machine</p>
          <p className="mt-1 text-xs text-muted">The machine sells the coin. Type this Phantom address at the machine, or send the coin to it after. Senda does not run the machine and does not take its fee. Their location feed is deprecated, so the machines are on these maps.</p>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, for their search" className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={map} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-full bg-white px-3 text-xs font-semibold text-black">CoinATMRadar</a>
            <a href="https://www.bitcoindepot.com/locations/" target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-full border border-white/15 px-3 text-xs font-semibold">Bitcoin Depot</a>
            <a href="https://coinflip.tech/" target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-full border border-white/15 px-3 text-xs font-semibold">CoinFlip</a>
          </div>
        </div>
      </div>
      {book.ads.length > 0 ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {book.ads.map((ad) => (
            <li key={ad.id} className="rounded-2xl border border-white/10 p-3">
              <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Sponsored</p>
              <a href={ad.href} target="_blank" rel="noreferrer" className="mt-1 block text-sm font-semibold">{ad.name}</a>
              <p className="mt-1 text-xs text-muted">{ad.line || "Opens their site. This wallet does not pay them."}</p>
              <button type="button" onClick={() => setBook(dropAd(ad.id))} className="mt-2 text-xs text-subtle">Remove</button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
