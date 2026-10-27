import { useEffect, useState } from "react";
import { toast } from "sonner";
import { readChain } from "@/lib/phantom";
import { revolutCheckout, revolutReady } from "@/lib/revolut-order";
import { clearRevolut, cleanTag, readRevolut, revolutMe, saveRevolut, type RevolutLink } from "@/lib/revolut-link";
import { isPhoneBrowser } from "@/lib/mobile-wallet";
import { FlowSteps } from "@/components/money-flow";

type Bag = { sol: number; usdc: number };

function bagOf(sol: number, tokens: { symbol: string; ui: number }[]): Bag {
  return { sol, usdc: tokens.find((t) => t.symbol === "USDC")?.ui ?? 0 };
}

function money(n: number, d = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function short(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

export function RevolutAccount({ owner }: { owner: string }) {
  const [link, setLink] = useState<RevolutLink | null>(null);
  const [tag, setTag] = useState("");
  const [bag, setBag] = useState<Bag | null>(null);
  const [base, setBase] = useState<Bag | null>(null);
  const [watching, setWatching] = useState(false);
  const [watched, setWatched] = useState(false);
  const [merchant, setMerchant] = useState(false);
  const [pay, setPay] = useState("20");
  const [ccy, setCcy] = useState<"USD" | "EUR" | "GBP" | "MXN">("USD");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState(false);
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    const row = readRevolut();
    setLink(row);
    if (row) setTag(row.tag);
    setPhone(isPhoneBrowser());
    setAndroid(/Android/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    let live = true;
    void revolutReady({ data: {} })
      .then((r) => live && setMerchant(r.merchant))
      .catch(() => live && setMerchant(false));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!owner) {
      setBag(null);
      return;
    }
    let live = true;
    readChain(owner)
      .then((w) => live && setBag(bagOf(w.sol, w.tokens)))
      .catch(() => live && setBag(null));
    return () => {
      live = false;
    };
  }, [owner]);

  useEffect(() => {
    if (!watching || !owner || !base) return;
    let n = 0;
    let live = true;
    const tick = () => {
      n += 1;
      readChain(owner)
        .then((w) => {
          if (!live) return;
          const next = bagOf(w.sol, w.tokens);
          setBag(next);
          const landed = next.usdc - base.usdc > 0.001 || next.sol - base.sol > 0.00001;
          if (landed || n >= 20) {
            setWatching(false);
            setWatched(true);
          }
        })
        .catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 6000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [watching, owner, base]);

  function copy(text: string, ok: string) {
    void navigator.clipboard?.writeText(text).then(
      () => toast.success(ok),
      () => toast.error("Could not copy."),
    );
  }

  function linkNow() {
    const row = saveRevolut(tag, owner);
    if (!row) {
      toast.error("A Revtag is 3–20 letters, numbers, or underscores.");
      return;
    }
    setLink(row);
    setTag(row.tag);
    toast.success(`@${row.tag} is linked on this device.`);
  }

  async function watch() {
    if (!owner) {
      toast.error("Connect the wallet this withdrawal should land in.");
      return;
    }
    const w = await readChain(owner).catch(() => null);
    if (!w) {
      toast.error("Could not read this address.");
      return;
    }
    const snap = bagOf(w.sol, w.tokens);
    setBag(snap);
    setBase(snap);
    setWatched(false);
    setWatching(true);
  }

  async function checkout() {
    const amount = Number(pay);
    if (!(amount >= 1)) {
      toast.error("Enter at least 1.");
      return;
    }
    setBusy(true);
    try {
      const origin = window.location.origin.startsWith("https://") ? `${window.location.origin}/payments?act=revolut` : undefined;
      const out = await revolutCheckout({
        data: {
          amount,
          currency: ccy,
          description: "Senda",
          redirectUrl: origin,
        },
      });
      if (!out.ok) {
        toast.error(out.error);
        return;
      }
      window.open(out.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revolut did not open.");
    } finally {
      setBusy(false);
    }
  }

  const step = !link ? 0 : !owner ? 1 : watching || watched ? 2 : 1;
  const dusdc = base && bag ? bag.usdc - base.usdc : 0;
  const dsol = base && bag ? bag.sol - base.sol : 0;
  const arrived = dusdc > 0.001 || dsol > 0.00001;

  return (
    <div className="flex flex-col gap-4">
      <FlowSteps steps={["Link", "Withdraw", "Arrived"]} current={step} />
      <p className="text-sm text-muted">
        Revolut’s first account was a prepaid balance at a licensed partner. They did not own the bank yet. The money was still real because it sat somewhere that could send it. This is that step. Fiat stays in their Revolut. What can move onto this desk is SOL, or USDC only when Revolut shows the Solana network.
      </p>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.14em] text-accent uppercase">Revolut</p>
            <p className="mt-1 text-lg font-semibold">{link ? `@${link.tag}` : "Not linked"}</p>
            <p className="mt-1 text-xs text-subtle">
              {link
                ? owner && link.wallet === owner
                  ? "Bound to this wallet. A product on Make or Shop can open Revolut in USD, EUR, GBP, or MXN."
                  : "Saved on this device. Bind it to the connected wallet before it can buy."
                : "The Revtag is the public name. It is not a balance."}
            </p>
          </div>
          {link ? (
            <button
              type="button"
              onClick={() => {
                clearRevolut();
                setLink(null);
              }}
              className="text-xs text-subtle"
            >
              Unlink
            </button>
          ) : null}
        </div>
        {link ? null : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="@revtag"
              aria-label="Revtag"
              spellCheck={false}
              className="min-h-12 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 font-mono text-sm outline-none"
            />
            <button type="button" onClick={linkNow} className="min-h-12 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
              Link Revolut
            </button>
          </div>
        )}
        {link ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={
                phone && android
                  ? "intent://open#Intent;scheme=revolut;package=com.revolut.revolut;S.browser_fallback_url=https%3A%2F%2Frevolut.me%2F;end"
                  : phone
                    ? "revolut://"
                    : "https://www.revolut.com/"
              }
              className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
            >
              Open Revolut
            </a>
            <a href={revolutMe(link.tag)} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
              Your pay page
            </a>
            <button
              type="button"
              onClick={() => copy(revolutMe(link.tag), "Revolut.me link copied.")}
              className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold"
            >
              Copy revolut.me
            </button>
            {owner && link.wallet !== owner ? (
              <button
                type="button"
                onClick={() => {
                  const row = saveRevolut(link.tag, owner);
                  if (row) setLink(row);
                }}
                className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold"
              >
                Bind to this wallet
              </button>
            ) : null}
          </div>
        ) : null}
        {link && !cleanTag(tag) ? null : link ? (
          <p className="mt-2 text-xs text-subtle">
            {revolutMe(link.tag)} pays their Revolut. It does not credit this wallet.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">Withdraw to this address</p>
        {owner ? (
          <>
            <p className="mt-2 break-all font-mono text-sm">{owner}</p>
            <p className="mt-1 text-xs text-muted">On this address now: {bag ? `${money(bag.usdc)} USDC · ${money(bag.sol, 4)} SOL` : "reading…"}</p>
            <button type="button" onClick={() => copy(owner, "Address copied. Paste it in Revolut.")} className="mt-3 min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">
              Copy {short(owner)}
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">Connect Phantom, Solflare, or Backpack. The withdrawal needs a Solana address you control.</p>
        )}
        <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-muted">
          <li>In Revolut, open Crypto, then Send.</li>
          <li>SOL is on the Solana network. Paste this address.</li>
          <li>USDC or USDT only if the network Revolut shows is Solana. Ethereum, Polygon, or Tron to this address is lost.</li>
          <li>Come back and watch. The new tokens are the balance. Nothing else is.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">Arrived</p>
        <button type="button" disabled={!owner || watching} onClick={() => void watch()} className="mt-3 min-h-12 rounded-full bg-white px-5 text-sm font-semibold text-black disabled:opacity-40">
          {watching ? "Watching this address…" : "I sent it from Revolut"}
        </button>
        {base && bag ? (
          <p className="mt-3 font-mono text-sm tabular-nums">
            {arrived
              ? `Arrived ${dusdc > 0.001 ? `+${money(dusdc)} USDC` : ""}${dusdc > 0.001 && dsol > 0.00001 ? " · " : ""}${dsol > 0.00001 ? `+${money(dsol, 4)} SOL` : ""}`
              : watched
                ? "Nothing new yet. Revolut can take a few minutes. Watch again."
                : "Waiting for a larger balance than the one just read."}
          </p>
        ) : null}
        {arrived ? <p className="mt-1 text-xs text-subtle">That is on this wallet. It is not a Revolut balance, and Senda does not hold it.</p> : null}
      </section>

      <section className="rounded-2xl border border-white/10 px-4 py-3 text-xs text-subtle">
        {merchant ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Merchant checkout is on. The payer uses Revolut. The money lands in the merchant Revolut account on this server. It does not become USDC here.
            </p>
            <div className="flex flex-wrap gap-2">
              <input value={pay} onChange={(e) => setPay(e.target.value)} inputMode="decimal" aria-label="Checkout amount" className="min-h-11 w-28 rounded-2xl border border-white/10 bg-black/30 px-3 font-mono text-sm outline-none" />
              <select value={ccy} onChange={(e) => setCcy(e.target.value as typeof ccy)} aria-label="Currency" className="min-h-11 rounded-2xl border border-white/10 bg-black/30 px-3 font-mono text-sm">
                {(["USD", "EUR", "GBP", "MXN"] as const).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <button type="button" disabled={busy} onClick={() => void checkout()} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold text-white disabled:opacity-40">
                {busy ? "Opening…" : "Open Revolut checkout"}
              </button>
            </div>
          </div>
        ) : (
          <p>
            A Revolut merchant checkout pays the business account that holds the secret. There is no secret on this server, so there is no checkout. The path that works today is the withdrawal above.
          </p>
        )}
      </section>
    </div>
  );
}
