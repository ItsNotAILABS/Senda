import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shield, TrendingDown } from "lucide-react";
import { ClearStrip } from "@/components/clear-strip";
import { LiveChart } from "@/components/price-chart";
import { FilmBand } from "@/components/film-band";
import { MoneyBar } from "@/components/money-bar";
import { rememberClear } from "@/lib/clearing";
import { TabLead } from "@/components/tab-lead";
import { WalletPicker } from "@/components/wallet-picker";
import { COVERS } from "@/lib/cover";
import {
  cancelChainCover,
  coverPubkey,
  listChainCovers,
  settleChainCover,
  type ChainCover,
} from "@/lib/cover-chain";
import { connectPhantom, readChain, splHolding } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
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

export function CoverDesk({ names, view = "all" }: { names: HouseListing[]; view?: "all" | "drop" | "life" | "open" }) {
  const book = names.filter((n) => n.venue === "prestocks" && n.last > 0);
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [mode, setMode] = useState<"drop" | "life">(view === "life" ? "life" : "drop");
  const [symbol, setSymbol] = useState(book[0]?.symbol ?? "");
  const [lifeId, setLifeId] = useState(COVERS[0].id);
  const [usd, setUsd] = useState(100);
  const [usdc, setUsdc] = useState(0);
  const [rows, setRows] = useState<ChainCover[]>([]);
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState<ChainCover | null>(null);
  const name = book.find((n) => n.symbol === symbol) ?? book[0];
  const life = COVERS.find((c) => c.id === lifeId) ?? COVERS[0];
  const shown = policy ? (rows.find((r) => r.id === policy.id) ?? policy) : null;

  function refresh() {
    setRows(listChainCovers());
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

  async function payer(): Promise<string> {
    const who = owner || (await connectPhantom());
    if (!owner) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
    }
    return who;
  }

  async function sellHeld(who: string, symbol: string, mint: string, last: number, size: number) {
    const held = await splHolding(who, mint);
    if (!(held.ui > 0)) throw new Error(`No ${symbol} in this wallet. There is no listed put.`);
    const done = await runPrestock({ owner: who, mint, side: "sell", usd: size, price: last });
    toast.success(`Sold about $${size} of ${symbol}. ${done.signature.slice(0, 8)}… That is the hedge. No premium was sent.`);
  }

  async function open() {
    setBusy(true);
    try {
      if (mode !== "drop") throw new Error("Life cover does not move USDC. There is no policy to sign.");
      const who = await payer();
      if (!name) throw new Error("No PreStock to sell.");
      await sellHeld(who, name.symbol, name.mint, name.last, usd);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The sell did not send.");
    } finally {
      setBusy(false);
    }
  }

  async function coverTen() {
    const live = name ?? book[0];
    if (!live) {
      toast.error("No PreStock to sell.");
      return;
    }
    setSymbol(live.symbol);
    setMode("drop");
    setBusy(true);
    try {
      const who = await payer();
      await sellHeld(who, live.symbol, live.mint, live.last, usd);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The sell did not send.");
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
        rememberClear({
          desk: "cover",
          title: `${row.symbol || row.title} returned`,
          legs: [{ side: "in", asset: "USDC", amount: row.premium, where: owner }],
          feeUsd: 0,
          sig,
          status: "signed",
        });
        toast.success(`USDC sent back. ${sig.slice(0, 8)}`);
      } else {
        const price = book.find((n) => n.symbol === row.symbol)?.last ?? 0;
        const out = await settleChainCover(row, owner, price);
        rememberClear({
          desk: "cover",
          title: `${row.symbol || row.title} settled`,
          legs: [{ side: "in", asset: "USDC", amount: row.premium, where: owner }],
          feeUsd: 0,
          sig: out.sig,
          status: "signed",
        });
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
      {view === "all" ? (
      <>
      <TabLead
        kicker="Cover"
        title="If you hold it"
        accent="you can sell it."
        line="There is no listed put. The hedge is a Jupiter sell of the token this wallet holds."
        live={["A sell of what you hold, signed in the wallet.", "No premium into a browser key."]}
        coming={["A listed option.", "A licensed insurer."]}
      />
      <MoneyBar />
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">10% drop</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl tracking-tight lg:text-5xl">{name ? name.symbol : "No PreStock"}</h2>
          <p className="font-mono text-sm text-muted">{name ? `${formatUsd(name.last)} last` : "Nothing priced."}</p>
        </div>
        {name?.mint ? (
          <div className="mt-3 overflow-hidden rounded-2xl bg-black/30">
            <LiveChart compact mint={name.mint} symbol={name.symbol} live={name.last} />
          </div>
        ) : null}
        <p className="mt-2 max-w-lg text-sm text-muted">
          There is no contract that pays if {name ? name.symbol : "a name"} drops 10%. Selling the token you hold is the hedge. USDC comes back to this wallet.
        </p>
        {book.length > 0 ? (
          <div className="mt-5 flex gap-2 overflow-x-auto">
            {book.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setSymbol(n.symbol);
                  setMode("drop");
                }}
                className={cn(
                  "min-h-12 shrink-0 rounded-full px-4 text-sm font-semibold",
                  n.symbol === name?.symbol ? "bg-accent text-accent-fg" : "border border-white/10 text-muted",
                )}
              >
                {n.symbol}
              </button>
            ))}
          </div>
        ) : null}
        <label className="mt-5 block">
          <span className="text-xs text-subtle">Size</span>
          <input
            value={usd}
            onChange={(e) => setUsd(Math.max(1, Number(e.target.value) || 0))}
            inputMode="decimal"
            className="mt-2 min-h-16 w-full rounded-[22px] border border-white/10 bg-black/40 px-5 font-mono text-3xl tabular-nums outline-none"
          />
        </label>
        <button
          type="button"
          disabled={busy || !name}
          onClick={() => void coverTen()}
          className="mt-4 flex min-h-16 w-full items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? "Waiting for the wallet…" : "Sell this size"}
        </button>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-4">
            <dt className="text-[11px] text-subtle">Size</dt>
            <dd className="font-mono text-3xl tabular-nums">{name ? `$${usd}` : "—"}</dd>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-4">
            <dt className="text-[11px] text-subtle">Strike</dt>
            <dd className="font-mono text-3xl tabular-nums">{shown ? formatUsd(shown.strike) : name ? formatUsd(name.last) : "—"}</dd>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-4">
            <dt className="text-[11px] text-subtle">Status</dt>
            <dd className="font-mono text-3xl">{shown ? shown.status : "—"}</dd>
          </div>
        </dl>
        {shown && shown.strike > 0 ? (
          <p className="mt-3 text-xs text-muted">
            An older cover still says it would pay under {formatUsd(shown.strike * 0.9)}. Settle only returns what that old transfer holds. It is not a new hedge.
          </p>
        ) : name ? (
          <p className="mt-3 text-xs text-muted">
            No listed product pays that line. Selling ${usd} of what you hold is the hedge.
          </p>
        ) : (
          <p className="mt-4 font-mono text-xs text-subtle">No cover yet. Status stays blank until Phantom signs.</p>
        )}
        {name && mode === "drop" ? (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] text-subtle">
              <span>10% under {formatUsd(name.last * 0.9)}</span>
              <span>Now {formatUsd(name.last)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[90%] bg-accent" />
            </div>
            <p className="mt-2 text-xs text-muted">
              The line is 10% under this print. Nothing here pays it. The button sells ${usd} of the token if the wallet holds it.
            </p>
          </div>
        ) : null}
      </section>
      <section className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-6 lg:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Cover</p>
          <h1 className="mt-3 max-w-lg text-4xl leading-[1.05] tracking-tight lg:text-5xl">
            The hedge is a <span className="text-accent">sell</span>.
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted">
            Jupiter sells the token this wallet already holds. Senda does not take a premium and does not keep a key. Life rows do not move USDC.
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
          <figure className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5">
            <p className="text-xs text-subtle">Phantom USDC</p>
            <p className="mt-2 font-mono text-4xl">{owner ? usdc.toFixed(2) : "—"}</p>
            <p className="mt-1 text-xs text-muted">{owner ? "USDC in the wallet. A sell brings more back. A hedge does not spend it." : "Connect a wallet to read the balance."}</p>
          </figure>
          <figure className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5">
            <p className="text-xs text-subtle">Old cover key</p>
            <p className="mt-2 text-sm text-muted">New hedges do not send USDC here. Older covers can still be settled below.</p>
            <p className="mt-1 break-all font-mono text-[11px] text-subtle">{coverPubkey()}</p>
          </figure>
        </div>
      </section>

      <FilmBand poster="/images/hero.jpg" label="The hedge is a sell." />

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => setMode("drop")} className="flex items-center gap-3 rounded-[22px] border border-white/[0.08] bg-[#10131c] px-3 py-3 text-left">
          <span className="grid size-10 place-items-center rounded-xl bg-[#ff5d73]/15 text-[#ff8fa3]"><TrendingDown className="size-4" /></span>
          <span>
            <span className="block text-sm font-semibold">Drop</span>
            <span className="block text-[11px] text-muted">10% under this print</span>
          </span>
        </button>
        <button type="button" onClick={() => setMode("life")} className="flex items-center gap-3 rounded-[22px] border border-white/[0.08] bg-[#10131c] px-3 py-3 text-left">
          <span className="grid size-10 place-items-center rounded-xl bg-[#14f195]/15 text-accent"><Shield className="size-4" /></span>
          <span>
            <span className="block text-sm font-semibold">Life</span>
            <span className="block text-[11px] text-muted">Phone, travel, rent, a haul</span>
          </span>
        </button>
        <div className="rounded-[22px] border border-white/[0.08] bg-[#10131c] px-4 py-3">
          <p className="text-[11px] text-subtle">Sell</p>
          <p className="font-mono text-xl">${usd}</p>
        </div>
        <div className="rounded-[22px] border border-white/[0.08] bg-[#10131c] px-4 py-3">
          <p className="text-[11px] text-subtle">Open</p>
          <p className="font-mono text-xl">{rows.filter((r) => r.status === "open").length}</p>
        </div>
      </section>
      </>
      ) : null}

      <section className={cn("grid gap-3", view === "open" ? "" : "xl:grid-cols-[280px_minmax(0,1fr)_320px]")}>
        <div className={cn("rounded-[22px] border border-white/[0.08] bg-[#10131c] p-2", view === "open" && "hidden")}>
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

        <div className={cn("rounded-[22px] border border-white/[0.08] bg-[#10131c] p-6", view === "open" && "hidden")}>
          {mode === "drop" && name ? (
            <>
              <p className="text-xs text-subtle">There is no listed put</p>
              <h2 className="mt-2 text-4xl">{name.symbol}</h2>
              <p className="mt-1 font-mono text-sm text-white/55">{formatUsd(name.last)} last</p>
              <div className="mt-3 overflow-hidden rounded-2xl bg-black/30">
                <LiveChart compact mint={name.mint} symbol={name.symbol} live={name.last} />
              </div>
              <p className="mt-2 text-sm text-muted">
                Selling about ${usd} of {name.symbol} is the hedge. The wallet has to hold it. No premium leaves.
              </p>
              <input value={usd} onChange={(e) => setUsd(Math.max(1, Number(e.target.value) || 0))} inputMode="decimal" className="mt-4 min-h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 font-mono text-lg outline-none" />
            </>
          ) : (
            <>
              <p className="text-xs text-subtle">{life.term} · not a licensed policy</p>
              <h2 className="mt-2 text-4xl">{life.title}</h2>
              <p className="mt-2 text-sm text-muted">
                {life.blurb} This does not move USDC. There is no chain policy and no payout from this page.
              </p>
            </>
          )}
          {owner ? (
            <button type="button" disabled={busy} onClick={() => void open()} className="mt-5 min-h-12 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg disabled:opacity-60">
              {busy ? "Waiting for the wallet…" : mode === "drop" ? `Sell $${usd}` : "Life does not move USDC"}
            </button>
          ) : (
            <div className="mt-5"><WalletPicker /></div>
          )}
        </div>

        <div className={cn("rounded-[22px] border border-white/[0.08] bg-[#10131c] p-4", view === "drop" || view === "life" ? "hidden" : "")}>
          <p className="text-sm font-semibold">Signed covers</p>
          {rows.length === 0 ? <p className="mt-3 text-xs text-subtle">None. A cover does not exist until the USDC moves.</p> : null}
          <ul className="mt-2 space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl bg-black/40 px-3 py-3">
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-[11px] text-subtle">{r.status} · ${r.premium} USDC · {r.symbol || "life"}</p>
                <a href={`https://solscan.io/tx/${r.sig}`} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-[11px] text-accent">{r.sig}</a>
                {r.status === "open" ? (
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={busy} onClick={() => void settle(r, false)} className="min-h-9 rounded-full bg-accent px-4 text-xs font-semibold text-accent-fg disabled:opacity-40">Settle</button>
                    <button type="button" disabled={busy} onClick={() => void settle(r, true)} className="min-h-9 rounded-full border border-white/15 px-4 text-xs font-semibold text-muted disabled:opacity-40">Cancel</button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <ClearStrip desk="cover" />
    </div>
  );
}
