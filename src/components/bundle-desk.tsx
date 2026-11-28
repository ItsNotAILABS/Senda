import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { connectPhantom } from "@/lib/phantom";
import { useHouse } from "@/lib/use-house";
import { jupTape } from "@/lib/world-book";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import {
  dropBundle,
  equalWeights,
  fillBundle,
  listBundles,
  presetLegs,
  saveBundle,
  weightOk,
  type Bundle,
  type BundleLeg,
  type Pickable,
} from "@/lib/bundle-book";
import { cn } from "@/lib/utils";

/** Launch and manage a basket of assets that already trade. Each leg is a wallet signature. */
export function BundleDesk({ mode = "full" }: { mode?: "full" | "sign" }) {
  const house = useHouse();
  const wallet = useWallet();
  const [tape, setTape] = useState<Pickable[]>([]);
  const [q, setQ] = useState("");
  const [legs, setLegs] = useState<BundleLeg[]>([]);
  const [name, setName] = useState("");
  const [usd, setUsd] = useState(10);
  const [rows, setRows] = useState<Bundle[]>(() => (typeof window === "undefined" ? [] : listBundles()));
  const [busy, setBusy] = useState("");

  useEffect(() => {
    jupTape()
      .then((book) => setTape(book.map((row) => ({ mint: row.id, symbol: row.symbol, name: row.name }))))
      .catch(() => undefined);
  }, []);

  const names: Pickable[] = useMemo(
    () => house.filter((h) => h.venue === "prestocks" && h.mint).map((h) => ({ mint: h.mint, symbol: h.symbol, name: h.name })),
    [house],
  );
  const book = useMemo(() => {
    const seen = new Set<string>();
    const out: Pickable[] = [];
    for (const row of [...names, ...tape]) {
      if (!row.mint || seen.has(row.mint)) continue;
      seen.add(row.mint);
      out.push(row);
    }
    return out;
  }, [names, tape]);

  const query = q.trim().toLowerCase();
  const hits = query ? book.filter((row) => `${row.symbol} ${row.name}`.toLowerCase().includes(query)).slice(0, 12) : [];
  const sum = legs.reduce((n, leg) => n + leg.weight, 0);

  function add(row: Pickable) {
    if (legs.some((leg) => leg.mint === row.mint)) return;
    if (legs.length >= 8) return toast.error("Eight assets is the basket limit.");
    setLegs((cur) => equalWeights([...cur, { ...row, weight: 0 }]));
    setQ("");
  }

  function setWeight(mint: string, weight: number) {
    setLegs((cur) => cur.map((leg) => (leg.mint === mint ? { ...leg, weight: Math.max(0, Math.round(weight)) } : leg)));
  }

  async function owner(): Promise<string> {
    const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
    const who = existing || (await connectPhantom());
    if (!existing) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
    }
    return who;
  }

  function launch() {
    try {
      const row = saveBundle({ name, usd, legs });
      setRows(listBundles());
      setLegs([]);
      setName("");
      toast.success(`${row.name} is saved. Buy it when you want the wallet to sign each leg.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That basket did not save.");
    }
  }

  async function trade(id: string, side: "buy" | "sell") {
    setBusy(`${id}:${side}`);
    try {
      const who = await owner();
      const fills = await fillBundle(who, id, side);
      setRows(listBundles());
      toast.success(`${fills.length} ${side === "buy" ? "buys" : "sells"} signed.`);
    } catch (e) {
      setRows(listBundles());
      toast.error(e instanceof Error ? e.message : "The basket stopped.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4 px-3 py-3">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">{mode === "sign" ? "Agent" : "Make"}</p>
        <h2 className="mt-1 text-2xl tracking-tight">{mode === "sign" ? "Launch a basket you already built" : "Launch a basket"}</h2>
        <p className="mt-1 max-w-xl text-sm text-white/55">
          {book.length.toLocaleString("en-US")} assets already on the book. A basket is weights on those. Phantom buys each one into your wallet. Nothing new is minted, and nothing is held for you.
        </p>
      </header>

      {mode === "full" ? (
        <section className="rounded-[22px] border border-white/10 bg-[#12141a] p-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["coins", "Liquid coins"],
                ["names", "PreStocks"],
                ["shares", "xStocks"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  const next = presetLegs(id, id === "names" ? names : book);
                  if (next.length < 2 && id !== "names") return toast.error("Those symbols are not on the book yet.");
                  if (!next.length) return toast.error("Nothing in that lane is on the book yet.");
                  setLegs(next);
                  if (!name) setName(id === "coins" ? "Liquid coins" : id === "names" ? "PreStock basket" : "Listed shares");
                }}
                className="min-h-9 rounded-full bg-white/10 px-3 text-sm"
              >
                {label}
              </button>
            ))}
            <button type="button" onClick={() => setLegs((cur) => equalWeights(cur))} className="min-h-9 rounded-full bg-white/10 px-3 text-sm">
              Equal weight
            </button>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name the basket" className="mt-3 min-h-11 w-full rounded-2xl bg-black/30 px-4 text-sm outline-none" />
          <label className="mt-2 block text-xs text-white/45">
            Dollars for the whole basket
            <input inputMode="decimal" value={String(usd)} onChange={(e) => setUsd(Math.max(0, Number(e.target.value) || 0))} className="mt-1 min-h-11 w-full rounded-2xl bg-black/30 px-4 font-mono text-sm outline-none" />
          </label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add SOL, NVDA, Anduril" className="mt-2 min-h-11 w-full rounded-2xl bg-black/30 px-4 text-sm outline-none" />
          {hits.length ? (
            <ul className="mt-2 overflow-hidden rounded-2xl bg-black/30">
              {hits.map((row) => (
                <li key={row.mint}>
                  <button type="button" onClick={() => add(row)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm">
                    <span className="font-semibold">{row.symbol}</span>
                    <span className="truncate pl-3 text-xs text-white/40">{row.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="mt-3 space-y-2">
            {legs.map((leg) => (
              <li key={leg.mint} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{leg.symbol}</span>
                <input
                  inputMode="numeric"
                  aria-label={`${leg.symbol} weight`}
                  value={String(leg.weight)}
                  onChange={(e) => setWeight(leg.mint, Number(e.target.value) || 0)}
                  className="h-10 w-16 rounded-xl bg-black/30 text-center font-mono text-sm outline-none"
                />
                <span className="w-14 text-right font-mono text-xs text-white/50">${((usd * leg.weight) / 100).toFixed(2)}</span>
                <button type="button" onClick={() => setLegs((cur) => equalWeights(cur.filter((row) => row.mint !== leg.mint)))} className="text-xs text-white/40">
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <p className={cn("mt-2 text-xs", sum === 100 ? "text-[#c6f56a]" : "text-white/45")}>Weights {sum}/100. Every leg has to be at least $1.</p>
          <button type="button" disabled={!weightOk(legs)} onClick={launch} className="mt-3 min-h-11 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
            Save the basket
          </button>
        </section>
      ) : (
        <p className="text-sm text-white/50">An agent can ask for the buy. You sign every leg. Build a new one on Make.</p>
      )}

      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-[22px] border border-white/10 bg-[#12141a] p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-semibold">{row.name}</h3>
              <span className="font-mono text-sm">${row.usd}</span>
            </div>
            <p className="mt-1 text-xs text-white/40">{row.kind === "index" ? "Index" : "Single asset"} · {row.legs.map((leg) => `${leg.symbol} ${leg.weight}%`).join(" · ")}</p>
            {row.fills[0] ? <p className="mt-2 text-xs text-[#c6f56a]">Last sign {row.fills[0].side} {row.fills[0].symbol} ${row.fills[0].usd} · {row.fills[0].signature.slice(0, 8)}…</p> : <p className="mt-2 text-xs text-white/35">Not bought yet.</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy !== ""} onClick={() => void trade(row.id, "buy")} className="min-h-11 rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
                {busy === `${row.id}:buy` ? "Waiting on the wallet" : "Buy the basket"}
              </button>
              <button type="button" disabled={busy !== ""} onClick={() => void trade(row.id, "sell")} className="min-h-11 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">
                {busy === `${row.id}:sell` ? "Waiting on the wallet" : "Sell the basket"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                dropBundle(row.id);
                setRows(listBundles());
              }}
              className="mt-2 text-xs text-white/35"
            >
              Remove this basket
            </button>
          </li>
        ))}
        {rows.length === 0 ? <li className="text-sm text-white/45">No basket on this browser yet.</li> : null}
      </ul>
    </div>
  );
}
