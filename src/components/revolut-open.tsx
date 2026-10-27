import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isPhoneBrowser } from "@/lib/mobile-wallet";
import { openSleeveOrder } from "@/lib/sleeve";
import { payNote, revolutPayUrl, type SleeveCcy } from "@/lib/revolut-link";

function inAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram|Line\/|Twitter|WhatsApp|Telegram|Snapchat|; wv|GSA\//i.test(navigator.userAgent);
}

function androidIntent(httpsUrl: string): string {
  const u = new URL(httpsUrl);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.revolut.revolut;S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`;
}

/**
 * A real anchor. iOS hands Revolut a universal link only when the person taps it.
 * Scripted location changes stay in the browser.
 */
export function RevolutOpen({
  tag,
  ccy,
  amount,
  note,
  wallet,
  product,
  usd,
  desk,
}: {
  tag: string;
  ccy: SleeveCcy;
  amount: number;
  note: string;
  wallet: string;
  product: string;
  usd: number;
  desk: string;
}) {
  const [opened, setOpened] = useState(false);
  const [phone, setPhone] = useState(false);
  const [android, setAndroid] = useState(false);
  const [trapped, setTrapped] = useState(false);
  const href = revolutPayUrl(tag, ccy, amount, note);
  const query = `https://revolut.me/${tag}?amount=${encodeURIComponent(String(amount))}&currency=${ccy}&note=${encodeURIComponent(payNote(note))}`;

  useEffect(() => {
    setPhone(isPhoneBrowser());
    setAndroid(/Android/i.test(navigator.userAgent));
    setTrapped(inAppBrowser());
  }, []);

  function remember() {
    if (wallet) {
      openSleeveOrder({
        wallet,
        buyerTag: "",
        sellerTag: tag,
        product,
        desk,
        usd,
        ccy,
        quoted: amount,
        ref: payNote(note),
      });
    }
    setOpened(true);
  }

  async function share() {
    const text = `${product}: ${amount} ${ccy} to @${tag}`;
    try {
      if (phone && navigator.share) {
        await navigator.share({ title: product, text, url: href });
        return;
      }
      await navigator.clipboard.writeText(href);
      toast.success("Revolut link copied.");
    } catch {
      /* dismissed */
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {trapped ? (
        <p className="text-xs text-down">This window is inside another app. Revolut will not open from here. Use Safari or Chrome, then tap the button.</p>
      ) : (
        <p className="text-xs text-subtle">
          {phone ? "Tap once. Revolut opens on this phone with the amount filled in, if the app is installed." : "Opens Revolut in a new tab."}
        </p>
      )}
      <a
        href={android ? androidIntent(href) : href}
        target={phone ? undefined : "_blank"}
        rel={phone ? undefined : "noreferrer"}
        onClick={remember}
        className="flex min-h-12 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-black"
      >
        Pay {amount} {ccy} in Revolut
      </a>
      {phone ? (
        <a href={query} onClick={remember} className="flex min-h-11 items-center justify-center rounded-full border border-white/15 px-4 text-sm font-semibold">
          Amount blank? Open this link
        </a>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void share()} className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold">
          Share
        </button>
        {phone ? (
          <a href={`sms:?&body=${encodeURIComponent(`${product} ${href}`)}`} className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
            Messages
          </a>
        ) : null}
      </div>
      {opened ? <p className="text-xs text-accent">Opened. Finish it in Revolut. This desk does not see that payment, so the order stays open.</p> : null}
    </div>
  );
}
