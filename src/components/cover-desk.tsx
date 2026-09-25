import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shield, TrendingDown } from "lucide-react";
import { WalletPicker } from "@/components/wallet-picker";
import { COVERS, formatCover } from "@/lib/cover";
import {
  cancelChainCover,
  coverPubkey,
  coverUsdc,
  listChainCovers,
  openChainCover,
  settleChainCover,
  type ChainCover,
} from "@/lib/cover-chain";
import { connectPhantom, readChain } from "@/lib/phantom";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { readUsing } from "@/lib/using";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const LOGO: Record<string, string> = {
  SPACEX: "/logos/spacex.png",
  OPENAI: "/logos/openai.png",
  ANTHROPIC: "/logos/anthropic.png",
  ANDURIL: "/logos/anduril.png",
  NEURALINK: "/logos/neuralink.png",
  FIGUREAI: "/logos/figureai.png",
  KALSHI: "/logos/kalshi.png",
  XAI: "/logos/xai.png",
};

export function CoverDesk({ names }: { names: HouseListing[] }) {
  const book = names.filter((n) => n.venue === "prestocks" && n.last > 0);
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [mode, setMode] = useState<"drop" | "life">("drop");
  const [symbol, setSymbol] = useState(book[0]?.symbol ?? "");
  const [lifeId, setLifeId] = useState(COVERS[0].id);
  const [usd, setUsd] = useState(100);
  const [usdc, setUsdc] = useState(0);
  const [locked, setLocked] = useState(0);
  const [rows, setRows] = useState<ChainCover[]>([]);
  const [busy, setBusy] = useState(false);
  const name = book.find((n) => n.symbol === symbol) ?? book[0];
  const life = COVERS.find((c) => c.id === lifeId) ?? COVERS[0];
  const premium = mode === "drop" ? Math.max(1, Math.round(usd * 0.04)) : life.premium;

  function refresh() {
    setRows(listChainCovers());
    void coverUsdc().then(setLocked).catch(() => setLocked(0));
  }

  useEffect(() => {
    refresh();
    const u = readUsing();
    if (u && names.some((n) => n.symbol === u.symbol)) setSymbol(u.symbol);
  }, [names]);

  useEffect(() => {
    if (!owner) return;
    let live = true;
    readChain(owner)
      .then((s) => live && setUsdc(s.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0))
      .catch(() => live && setUsdc(0));
    return () => {
      live = false;
    };
  }, [owner]);

  async function open() {
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      if (mode === "drop") {
        if (!name) throw new Error("No PreStock to cover.");
        await openChainCover({
          owner: who,
          kind: "drop",
          title: `${name.symbol} drop`,
          symbol: name.symbol,
          mint: name.mint,
          strike: name.last,
          cover: usd,
          premium,
          days: 1,
        });
        toast.success(`Premium left Phantom. If ${name.symbol} falls 10%, settle buys $${usd}.`);
      } else {
        await openChainCover({
          owner: who,
          kind: "life",
          title: life.title,
          cover: life.cover,
          premium: life.premium,
          days: 30,
        });
        toast.success(`${life.title} premium is on-chain. The payout is only what that account holds.`);
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The cover did not send.");
    } finally {
      setBusy(false);
    }
  }

  async function settle(row: ChainCover, cancel: boolean) {
    if (!owner) return toast.error("Connect the wallet that paid the premium.");
    setBusy(true);
    try {
      if (cancel) {
        const sig = await cancelChainCover(row, owner);
        toast.success(`USDC sent back. ${sig.slice(0, 8)}`);
      } else {
        const price = book.find((n) => n.symbol === row.symbol)?.last ?? 0;
        const out = await settleChainCover(row, owner, price);
        toast.success(out.bought ? "Premium returned. The buy is signed." : "Premium returned.");
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Settle did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <section className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[28px] border border-white/10 bg-[#0c0c14] p-6 lg:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Cover</p>
          <h1 className="mt-3 max-w-lg text-4xl leading-[1.05] tracking-tight lg:text-5xl">
            The premium <span className="text-accent">leaves Phantom</span>.
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted">
            One signature. USDC moves into a cover account, and the terms are written on the transaction. Senda does not invent the payout. If a PreStock falls 10%, settle sends the premium back and asks you to buy that size.
          </p>
          <div className="mt-6 flex gap-2">
            <button type="button" onClick={() => setMode("drop")} className={cn("min-h-11 rounded-full px-5 text-sm font-semibold", mode === "drop" ? "bg-accent text-accent-fg" : "border border-white/15")}>
              Drop
            </button>
            <button type="button" onClick={() => setMode("life")} className={cn("min-h-11 rounded-full px-5 text-sm font-semibold", mode === "life" ? "bg-accent text-accent-fg" : "border border-white/15")}>
              Life
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <figure className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
            <p className="text-xs text-subtle">Phantom USDC</p>
            <p className="mt-2 font-mono text-4xl">{owner ? usdc.toFixed(2) : "—"}</p>
            <p className="mt-1 text-xs text-muted">{owner ? "This is what can pay a premium." : "Connect Phantom. Nothing is covered until you sign."}</p>
          </figure>
          <figure className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
            <p className="text-xs text-subtle">Cover account</p>
            <p className="mt-2 font-mono text-4xl">{locked.toFixed(2)}</p>
            <p className="mt-1 break-all font-mono text-[11px] text-subtle">{coverPubkey()}</p>
          </figure>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => setMode("drop")} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101018] px-3 py-3 text-left">
          <span className="grid size-10 place-items-center rounded-xl bg-[#ff5d73]/15 text-[#ff8fa3]"><TrendingDown className="size-4" /></span>
          <span>
            <span className="block text-sm font-semibold">Drop</span>
            <span className="block text-[11px] text-muted">10% under this print</span>
          </span>
        </button>
        <button type="button" onClick={() => setMode("life")} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101018] px-3 py-3 text-left">
          <span className="grid size-10 place-items-center rounded-xl bg-[#14f195]/15 text-accent"><Shield className="size-4" /></span>
          <span>
            <span className="block text-sm font-semibold">Life</span>
            <span className="block text-[11px] text-muted">Phone, travel, rent, a haul</span>
          </span>
        </button>
        <div className="rounded-2xl border border-white/10 bg-[#101018] px-4 py-3">
          <p className="text-[11px] text-subtle">Premium</p>
          <p className="font-mono text-xl">${premium}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#101018] px-4 py-3">
          <p className="text-[11px] text-subtle">Open</p>
          <p className="font-mono text-xl">{rows.filter((r) => r.status === "open").length}</p>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-2">
          {mode === "drop"
            ? book.map((n) => (
                <button key={n.id} type="button" onClick={() => setSymbol(n.symbol)} className={cn("flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left", n.symbol === name?.symbol ? "bg-white/10" : "")}>
                  {LOGO[n.symbol] ? <img src={LOGO[n.symbol]} alt="" className="size-8 rounded-full bg-white object-contain p-1" /> : null}
                  <span className="flex-1 text-sm font-semibold">{n.symbol}</span>
                  <span className="font-mono text-[11px]">{formatUsd(n.last)}</span>
                </button>
              ))
            : COVERS.map((c) => (
                <button key={c.id} type="button" onClick={() => setLifeId(c.id)} className={cn("flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm", c.id === life.id ? "bg-white/10" : "")}>
                  <span className="font-semibold">{c.title}</span>
                  <span className="font-mono text-[11px] text-muted">${c.premium}</span>
                </button>
              ))}
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-6">
          {mode === "drop" && name ? (
            <>
              <p className="text-xs text-subtle">Locks this print for a day</p>
              <h2 className="mt-2 text-4xl">{name.symbol}</h2>
              <p className="mt-2 text-sm text-muted">
                Premium ${premium} USDC leaves now. Strike {formatUsd(name.last)}. If the token is at or under {formatUsd(name.last * 0.9)}, settle returns the premium and you sign a buy of ${usd}. If it does not fall, cancel returns the USDC. Nothing is paid from a local balance.
              </p>
              <input value={usd} onChange={(e) => setUsd(Math.max(1, Number(e.target.value) || 0))} inputMode="decimal" className="mt-4 min-h-12 w-full rounded-2xl bg-black/40 px-3 font-mono text-lg outline-none" />
            </>
          ) : (
            <>
              <p className="text-xs text-subtle">{life.term} · not a licensed policy</p>
              <h2 className="mt-2 text-4xl">{life.title}</h2>
              <p className="mt-2 text-sm text-muted">
                {life.blurb} The premium, ${life.premium} USDC, is what moves. A claim can only return what the cover account holds. It cannot pay {formatCover(life.cover)} out of nothing.
              </p>
            </>
          )}
          {owner ? (
            <button type="button" disabled={busy} onClick={() => void open()} className="mt-5 min-h-12 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg disabled:opacity-60">
              {busy ? "Waiting for Phantom…" : `Sign the premium · $${premium} USDC`}
            </button>
          ) : (
            <div className="mt-5"><WalletPicker /></div>
          )}
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-4">
          <p className="text-sm font-semibold">Signed covers</p>
          {rows.length === 0 ? <p className="mt-3 text-xs text-subtle">None. A cover does not exist until the USDC moves.</p> : null}
          <ul className="mt-2 space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl bg-black/40 px-3 py-3">
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-[11px] text-subtle">{r.status} · ${r.premium} USDC · {r.symbol || "life"}</p>
                <a href={`https://solscan.io/tx/${r.sig}`} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-[11px] text-accent">{r.sig}</a>
                {r.status === "open" ? (
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busy} onClick={() => void settle(r, false)} className="text-xs font-semibold text-accent">Settle</button>
                    <button type="button" disabled={busy} onClick={() => void settle(r, true)} className="text-xs font-semibold text-muted">Cancel</button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
