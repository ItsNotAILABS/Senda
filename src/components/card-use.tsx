import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SignedReceipt } from "@/components/money-flow";
import { cardMemo, cardReceiveUri } from "@/lib/card-protocol";
import { findPay, payReference } from "@/lib/solana-pay";
import { openChainCover } from "@/lib/cover-chain";
import { humanWalletError } from "@/lib/mobile-wallet";
import { connectPhantom, readChain } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { paySol, payUsdc } from "@/lib/solana-pay";
import { getHouse, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import type { Card } from "@/lib/wallet";
import { cn } from "@/lib/utils";

type Product = "send" | "pre" | "cover";

/**
 * The card is the wallet. Receive is USDC in. Spend is a signature out to a product on this desk.
 */
export function CardUse({ card, owner }: { card: Card; owner: string }) {
  const { cardRail } = useWallet();
  const [mode, setMode] = useState<"receive" | "spend">("receive");
  const [who, setWho] = useState(owner);
  const [usd, setUsd] = useState("20");
  const [to, setTo] = useState("");
  const [product, setProduct] = useState<Product>("send");
  const [asset, setAsset] = useState<"USDC" | "SOL">("USDC");
  const [names, setNames] = useState<HouseListing[]>([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");
  const [held, setHeld] = useState<number | null>(null);
  const [solHeld, setSolHeld] = useState<number | null>(null);
  const [base, setBase] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [paidSig, setPaidSig] = useState("");
  const amount = Math.round(Number(usd) * 100) / 100;
  const live = names.filter((n) => n.venue === "prestocks" && n.last > 0);
  const name = live.find((n) => n.symbol === pick) ?? live[0];

  useEffect(() => {
    setWho(owner);
  }, [owner]);

  useEffect(() => {
    if (!who) return;
    setReference(payReference(`acct:${who}`));
  }, [who, card.last4]);

  useEffect(() => {
    if (mode !== "receive" || !reference) return;
    let stop = false;
    const tick = () => {
      void findPay(reference).then((sig) => {
        if (!stop && sig) setPaidSig(sig);
      }).catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 8000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [mode, reference]);

  useEffect(() => {
    if (mode !== "spend" || names.length) return;
    void getHouse()
      .then((rows) => setNames(rows))
      .catch(() => setNames([]));
  }, [mode, names.length]);

  useEffect(() => {
    if (mode !== "receive" || !who) return;
    let stop = false;
    const tick = () => {
      void readChain(who).then((w) => {
        if (stop) return;
        const usdc = w.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;
        const sol = w.sol;
        setHeld(usdc);
        setBase((b) => (b == null ? usdc : b));
        setSolHeld(sol);
      }).catch(() => {
        if (!stop) setHeld(null);
      });
    };
    tick();
    const id = window.setInterval(tick, 8000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [mode, who]);

  async function ensure(): Promise<string> {
    if (who) return who;
    const id = await connectPhantom();
    setWho(id);
    return id;
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied.");
    } catch {
      toast.error("Could not copy.");
    }
  }

  async function spend() {
    if (product === "send" && asset === "SOL") {
      if (!(Number(usd) >= 0.0001)) return toast.error("Enter the SOL.");
    } else if (!(amount >= 0.01)) return toast.error("Enter the USDC.");
    setBusy(true);
    setSig("");
    try {
      const id = await ensure();
      let signature = "";
      let merchant = "";
      if (product === "send") {
        if (to.trim().length < 32) throw new Error("Paste the Solana address that should receive it.");
        if (asset === "SOL") {
          const paid = await paySol({ owner: id, to: to.trim(), sol: Number(usd) });
          signature = paid;
          merchant = `SOL ${to.trim().slice(0, 4)}`;
        } else {
          const paid = await payUsdc({ owner: id, to: to.trim(), usd: amount, memo: cardMemo(card.last4, "OUT", "send") });
          signature = paid.signature;
          merchant = `USDC ${to.trim().slice(0, 4)}`;
        }
      } else if (product === "pre") {
        if (!name) throw new Error("No live name on the book.");
        const paid = await runPrestock({ owner: id, mint: name.mint, side: "buy", usd: amount, price: name.last });
        signature = paid.signature;
        merchant = name.symbol;
      } else {
        if (!name) throw new Error("No live name to cover.");
        const row = await openChainCover({
          owner: id,
          kind: "drop",
          title: `${name.symbol} cover`,
          symbol: name.symbol,
          mint: name.mint,
          strike: name.last,
          cover: Math.round(amount * 10),
          premium: amount,
          days: 30,
        });
        signature = row.sig;
        merchant = `${name.symbol} cover`;
      }
      if (product === "send" && asset === "SOL") {
        toast.success("Signed. SOL left this wallet. The card number was not charged.");
      } else {
        const r = cardRail(card.id, amount, merchant, signature, product === "pre" ? "6211" : product === "cover" ? "6300" : "6012");
        if (!r.ok) toast.error(r.error);
        toast.success("Signed. USDC left this wallet. The card number was not charged.");
      }
      setSig(signature);
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "The card did not spend."));
    } finally {
      setBusy(false);
    }
  }

  const arrived = base != null && held != null ? held - base : 0;
  const receive = who ? cardReceiveUri(who, card.last4, amount > 0 ? amount : undefined, reference || undefined) : "";

  return (
    <div className="rounded-[18px] border border-white/10 bg-black/30 p-3">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-black/40 p-1">
        {(["receive", "spend"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => { setMode(id); setSig(""); }}
            className={cn("min-h-10 rounded-full text-sm font-semibold capitalize", mode === id ? "bg-white text-black" : "text-muted")}
          >
            {id}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-subtle">•••• {card.last4} is this wallet. A store terminal still declines the number. Send signs USDC or SOL. PreStock and Cover still sign USDC.</p>
      {mode === "receive" ? (
        <div className="mt-3 flex flex-col gap-2">
          {!who ? (
            <button type="button" onClick={() => void ensure().catch((e: unknown) => toast.error(humanWalletError(e instanceof Error ? e.message : "Connect the wallet.")))} className="min-h-11 rounded-full bg-accent text-sm font-semibold text-accent-fg">
              Connect the wallet this card receives on
            </button>
          ) : (
            <>
              <p className="font-mono text-xs break-all text-muted">{who}</p>
              <p className="font-mono text-sm tabular-nums">{held == null ? "Reading the wallet…" : `${held.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC · ${solHeld == null ? "…" : solHeld.toFixed(4)} SOL`}</p>
              {arrived > 0.001 ? <p className="text-sm text-accent">+{arrived.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC received since this card was opened.</p> : null}
              {paidSig ? <p className="text-sm text-accent">Paid. The reference on this link has a signature.</p> : <p className="text-xs text-subtle">The link is a transfer request. Phantom builds the USDC transfer. This desk watches the reference.</p>}
              {paidSig ? <SignedReceipt title="Received" amount="USDC" detail={`•••• ${card.last4}`} sig={paidSig} /> : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void copy(who)} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black">Copy address</button>
                <button type="button" onClick={() => void copy(receive)} className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold">Copy pay link</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-1">
            {([
              ["send", "Send"],
              ["pre", "PreStock"],
              ["cover", "Cover"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setProduct(id)} className={cn("min-h-10 flex-1 rounded-full text-xs font-semibold", product === id ? "bg-accent text-accent-fg" : "border border-white/10 text-muted")}>
                {label}
              </button>
            ))}
          </div>
          <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" aria-label={asset === "SOL" && product === "send" ? "SOL" : "USDC"} placeholder={asset === "SOL" && product === "send" ? "SOL" : "USDC"} className="min-h-11 rounded-xl bg-[#10131c] px-3 font-mono text-sm outline-none" />
          {product === "send" ? (
            <>
              <div className="flex gap-1">
                {(["USDC", "SOL"] as const).map((id) => (
                  <button key={id} type="button" onClick={() => setAsset(id)} className={cn("min-h-9 flex-1 rounded-full text-xs font-semibold", asset === id ? "bg-white text-black" : "bg-white/10 text-muted")}>{id}</button>
                ))}
              </div>
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana address" aria-label="Pay to" spellCheck={false} className="min-h-11 rounded-xl bg-[#10131c] px-3 font-mono text-xs outline-none" />
            </>
          ) : (
            <div className="flex gap-1 overflow-x-auto">
              {live.slice(0, 8).map((n) => (
                <button key={n.mint} type="button" onClick={() => setPick(n.symbol)} className={cn("min-h-10 shrink-0 rounded-full px-3 font-mono text-[11px] font-semibold", (name?.symbol === n.symbol) ? "bg-accent text-accent-fg" : "border border-white/10 text-muted")}>
                  {n.symbol}
                </button>
              ))}
            </div>
          )}
          <button type="button" disabled={busy || card.frozen} onClick={() => void spend()} className="min-h-11 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
            {busy ? "Waiting on the wallet" : product === "pre" ? `Buy ${name?.symbol ?? ""}` : product === "cover" ? `Cover ${name?.symbol ?? ""}` : asset === "SOL" ? `Sign ${usd || "0"} SOL` : "Sign USDC"}
          </button>
          {sig ? <SignedReceipt title="Signed" amount={product === "send" && asset === "SOL" ? `${usd} SOL` : `${amount} USDC`} detail={`•••• ${card.last4} · the number was not charged`} sig={sig} /> : null}
        </div>
      )}
    </div>
  );
}
