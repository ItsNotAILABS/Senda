import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { flexaReady, helioCharge, moonpayBuy } from "@/lib/onramps";
import { listHolds } from "@/lib/hold-contract";
import { shortPk } from "@/lib/senda-keys";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const PK = "senda.moonpay.pk";

function https(raw: string, hosts: string[]): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    if (!hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Cash and card on-ramps into the Phantom address. Nothing here is a fee Senda collects. */
export function FundRails() {
  const wallet = useWallet();
  const phantom = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const mask = wallet.w.links.find((l) => l.kind === "evm");
  const [holds, setHolds] = useState(() => (typeof window === "undefined" ? [] : listHolds()));
  const [dest, setDest] = useState("");
  const [pk, setPk] = useState("");
  const [paylink, setPaylink] = useState("");
  const [helioUrl, setHelioUrl] = useState("");
  const [flexaUrl, setFlexaUrl] = useState("");
  const [flexa, setFlexa] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    try {
      setPk(localStorage.getItem(PK) || "");
    } catch {
      /* private */
    }
    void flexaReady().then((row) => setFlexa(row.ready)).catch(() => setFlexa(false));
  }, []);

  const chosen = dest || phantom?.address || holds[0]?.id || "";
  const onBase = chosen.startsWith("0x");
  const currency = onBase ? "usdc_base" : "usdc_sol";
  async function moonpay() {
    if (!chosen) {
      toast.error("Pick a wallet. Phantom, MetaMask, or a new funding wallet.");
      return;
    }
    setBusy("moon");
    try {
      const got = await moonpayBuy({ data: { address: chosen, currency } });
      if (got.ok) {
        window.open(got.url, "_blank", "noopener");
        toast.success(got.locked ? "MoonPay has this address." : "MoonPay is open. Paste the address. Locking it needs the secret.");
        return;
      }
      const key = pk.trim();
      if (!key.startsWith("pk_")) throw new Error(got.error);
      const url = `https://buy.moonpay.com?apiKey=${encodeURIComponent(key)}&currencyCode=${currency}&baseCurrencyCode=usd`;
      window.open(url, "_blank", "noopener");
      toast.message("MoonPay is open. Paste the address. A secret on the server locks it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MoonPay did not open.");
    } finally {
      setBusy("");
    }
  }

  async function helio() {
    const pasted = https(helioUrl, ["hel.io"]);
    if (pasted) {
      window.open(pasted, "_blank", "noopener");
      return;
    }
    if (!paylink.trim()) {
      toast.error("Paste a Helio pay link, or the pay link id from their dashboard.");
      return;
    }
    setBusy("helio");
    try {
      const got = await helioCharge({ data: { paymentRequestId: paylink.trim(), amount: "25.00" } });
      if (!got.ok) throw new Error(got.error);
      window.open(got.url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Helio did not open.");
    } finally {
      setBusy("");
    }
  }

  function flexaOpen() {
    const url = https(flexaUrl, ["flexa.co", "flexa.network"]);
    if (!url) {
      toast.error("Paste the payment page Flexa returned. Their docs do not publish the create-link path.");
      return;
    }
    window.open(url, "_blank", "noopener");
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Fund the wallet</p>
      <h2 className="mt-1 text-xl font-semibold">Cash lands on the wallet you pick.</h2>
      <p className="mt-2 text-sm text-muted">Phantom or MetaMask. Cash lands on the wallet you pick. This page does not mint a second key.</p>
      <div className="mt-3 flex gap-1 overflow-x-auto">
        {phantom ? <button type="button" onClick={() => setDest(phantom.address)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${chosen === phantom.address ? "bg-white text-black" : "bg-white/10"}`}>Phantom</button> : null}
        {mask ? <button type="button" onClick={() => setDest(mask.address)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${chosen === mask.address ? "bg-white text-black" : "bg-white/10"}`}>MetaMask</button> : null}
        {holds.map((hold) => (
          <button key={hold.id} type="button" onClick={() => setDest(hold.id)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${chosen === hold.id ? "bg-white text-black" : "bg-white/10"}`}>{hold.name}</button>
        ))}
        <button
          type="button"
          onClick={() => toast.error("A funding wallet does not get a key in this browser. Pick Phantom.")}
          className="shrink-0 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold"
        >
          No second key
        </button>
      </div>
      <p className="mt-2 font-mono text-sm text-white/80">{chosen ? `${onBase ? "Base USDC" : "Solana USDC"} · ${shortPk(chosen)}` : "No wallet picked."}</p>
      {chosen ? (
        <button type="button" onClick={() => void navigator.clipboard.writeText(chosen)} className="mt-2 min-h-9 rounded-full border border-white/15 px-3 text-xs font-semibold">Copy the address</button>
      ) : null}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-white/10 p-3">
          <p className="text-sm font-semibold">MoonPay</p>
          <p className="mt-1 text-xs text-muted">Buys USDC on Solana. The publishable key can live on the server. Pasting a pk_ key opens it too. The address is locked into the page only when the secret is set.</p>
          <input value={pk} onChange={(e) => setPk(e.target.value.trim())} onBlur={() => localStorage.setItem(PK, pk.trim())} placeholder="pk_live_… if it is not on the server" spellCheck={false} className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
          <button type="button" disabled={busy !== ""} onClick={() => void moonpay()} className="mt-2 min-h-10 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">{busy === "moon" ? "Opening" : "Buy USDC"}</button>
        </article>
        <article className="rounded-2xl border border-white/10 p-3">
          <p className="text-sm font-semibold">Helio</p>
          <p className="mt-1 text-xs text-muted">A pay link they already gave you opens now. Creating a charge calls api.hel.io once both keys are on the server.</p>
          <input value={helioUrl} onChange={(e) => setHelioUrl(e.target.value)} placeholder="https://app.hel.io/…" spellCheck={false} className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
          <input value={paylink} onChange={(e) => setPaylink(e.target.value.trim())} placeholder="Pay link id" spellCheck={false} className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
          <button type="button" disabled={busy !== ""} onClick={() => void helio()} className="mt-2 min-h-10 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">{busy === "helio" ? "Opening" : "Open Helio"}</button>
        </article>
        <article className="rounded-2xl border border-white/10 p-3">
          <p className="text-sm font-semibold">Flexa</p>
          <p className="mt-1 text-xs text-muted">{flexa ? "A Flexa key is on the server." : "No Flexa key on the server."} Their docs describe a payment page and do not publish the path that creates it. Paste the page they return. Spending at a store still happens in that page, from the customer’s wallet.</p>
          <input value={flexaUrl} onChange={(e) => setFlexaUrl(e.target.value)} placeholder="https://….flexa.co/…" spellCheck={false} className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
          <button type="button" onClick={flexaOpen} className="mt-2 min-h-10 rounded-full bg-white px-3 text-xs font-semibold text-black">Open the Flexa page</button>
        </article>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Link to="/invest" search={{ lane: "solana" }} className="rounded-full bg-white/10 px-3 py-2 font-semibold">Jupiter, Phantom signs</Link>
        <Link to="/invest" search={{ desk: "prog" }} className="rounded-full bg-white/10 px-3 py-2 font-semibold">Jito, Meteora, a perp</Link>
        <Link to="/invest" search={{ desk: "world" }} className="rounded-full bg-white/10 px-3 py-2 font-semibold">Metals, MetaMask on Base</Link>
      </div>
    </section>
  );
}
