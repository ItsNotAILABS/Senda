import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FlowSteps } from "@/components/money-flow";
import { RevolutOpen } from "@/components/revolut-open";
import { isPhoneBrowser } from "@/lib/mobile-wallet";
import { cleanTag, readRevolut, saveRevolut, type SleeveCcy } from "@/lib/revolut-link";
import { sleeveAmount } from "@/lib/sleeve";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const CCYS: SleeveCcy[] = ["USD", "EUR", "GBP", "MXN"];

/**
 * Buy a product with the Revolut on this phone.
 * The pay control is a link. iOS will not open the app from a script.
 */
export function RevolutBuy({
  owner,
  product,
  usd,
  sellerTag,
  desk,
}: {
  owner: string;
  product: string;
  usd: number;
  sellerTag: string;
  desk: string;
}) {
  const { usdPer } = useWallet();
  const seller = cleanTag(sellerTag);
  const [phone, setPhone] = useState(false);
  const [link, setLink] = useState<ReturnType<typeof readRevolut>>(null);
  const [tag, setTag] = useState("");
  const [ccy, setCcy] = useState<SleeveCcy>("USD");
  const [phase, setPhase] = useState<"pick" | "review">("pick");
  const quoted = sleeveAmount(usd, ccy, usdPer);
  const bound = Boolean(link && owner && link.wallet === owner);

  useEffect(() => {
    setPhone(isPhoneBrowser());
    setLink(readRevolut());
  }, []);

  function linkNow() {
    const row = saveRevolut(tag, owner);
    if (!row) {
      toast.error("A Revtag is 3–20 letters, numbers, or underscores.");
      return;
    }
    setLink(row);
    toast.success(owner ? `@${row.tag} is bound to this wallet.` : `@${row.tag} is saved on this phone.`);
  }

  if (!seller) {
    return <p className="text-xs text-subtle">No Revtag on this product. USDC can still be signed to the address.</p>;
  }

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
      <FlowSteps steps={["Card", "Review", "Revolut"]} current={phase === "pick" ? 0 : 1} />
      <p className="mt-2 text-sm text-muted">
        {phone ? "Your Revolut on this phone pays @" : "Revolut pays @"}
        {seller}. {quoted > 0 ? `${quoted} ${ccy}` : "Quote down"} for ${usd}. The wallet is not required for this.
      </p>
      {!bound ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="@your revtag, optional" aria-label="Your Revtag" spellCheck={false} className="min-h-11 flex-1 rounded-2xl border border-white/10 bg-black/40 px-3 font-mono text-sm outline-none" />
          <button type="button" onClick={linkNow} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">
            Save
          </button>
        </div>
      ) : (
        <p className="mt-1 font-mono text-[11px] text-subtle">@{link?.tag}{owner ? ` · ${owner.slice(0, 4)}…${owner.slice(-4)}` : ""}</p>
      )}
      <div className="mt-2 flex gap-1">
        {CCYS.map((c) => (
          <button key={c} type="button" onClick={() => { setCcy(c); setPhase("pick"); }} className={cn("min-h-9 flex-1 rounded-full font-mono text-[11px] font-semibold", ccy === c ? "bg-accent text-accent-fg" : "border border-white/10 text-muted")}>
            {c}
          </button>
        ))}
      </div>
      {phase === "pick" ? (
        <button type="button" disabled={!(quoted > 0)} onClick={() => setPhase("review")} className="mt-2 min-h-11 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
          Review
        </button>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted">
            Review: {quoted} {ccy} to @{seller} for {product}. Tap the link. Revolut takes the payment. This desk does not.
          </p>
          <RevolutOpen tag={seller} ccy={ccy} amount={quoted} note={product} wallet={owner} product={product} usd={usd} desk={desk} />
          <button type="button" onClick={() => setPhase("pick")} className="mt-2 min-h-10 text-sm text-subtle">
            Back
          </button>
        </>
      )}
    </div>
  );
}
