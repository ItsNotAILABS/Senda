import { useEffect, useState } from "react";
import { Buffer } from "buffer";
import { VersionedTransaction } from "@solana/web3.js";
import { toast } from "sonner";
import { loadPacks, loadSlabs, packLook, packSend, packTx, slabTx, type Pack, type Slab } from "@/lib/slab-book";
import { connectPhantom, liveSolAddress, sendPartial, signSerializedTx, splHolding } from "@/lib/phantom";
import { injectedWallet, insideWalletApp, isPhoneBrowser, openInWallet } from "@/lib/mobile-wallet";
import { spendCap } from "@/lib/spend-cap";
import { cn } from "@/lib/utils";

const KINDS = [
  ["Card", "Cards"],
  ["Sealed", "Sealed"],
  ["Merch", "Merch"],
  ["Comic", "Comics"],
  ["Watch", "Watches"],
] as const;

const CATS = ["Pokemon", "One Piece", "Baseball", "Basketball", "Football", "Soccer", "Lorcana", "Dragon Ball", "Marvel", "Yu-Gi-Oh!", "Moonbirds", "Riftbound", "Gundam"] as const;
const GRADES = ["PSA", "CGC", "Beckett", "BGS"] as const;
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

type Kind = (typeof KINDS)[number][0];

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function txOf(b64: string) {
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
  return VersionedTransaction.deserialize(Buffer.from(b64, "base64"));
}

function needWallet(): boolean {
  if (injectedWallet() || insideWalletApp()) return false;
  if (isPhoneBrowser()) {
    openInWallet("phantom");
    toast.message("Phantom has this page. Tap the buy again there. That window can sign.");
    return true;
  }
  return false;
}

function Shot({ src, alt, tall }: { src: string; alt: string; tall?: boolean }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <div className={cn("w-full bg-elevated", tall ? "h-72" : "aspect-[3/4]")} />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBad(true)}
      className={cn("w-full bg-elevated object-contain", tall ? "h-72" : "aspect-[3/4]")}
    />
  );
}

export function SlabDesk() {
  const [lane, setLane] = useState<"slabs" | "packs">("slabs");
  return (
    <div className="bg-bg text-fg">
      <div className="sticky top-0 z-10 border-b border-border bg-bg/95 px-3 py-3 backdrop-blur">
        <p className="text-[11px] font-medium tracking-[0.16em] text-subtle uppercase">Collector Crypt</p>
        <div className="mt-2 flex gap-1">
          {(["slabs", "packs"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setLane(id)}
              className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", lane === id ? "bg-fg text-bg" : "bg-elevated text-muted")}
            >
              {id === "slabs" ? "Slabs" : "Packs"}
            </button>
          ))}
        </div>
      </div>
      {lane === "slabs" ? <SlabBook /> : <PackBook />}
    </div>
  );
}

function SlabBook() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Pokemon");
  const [kind, setKind] = useState<Kind | "">("Card");
  const [grade, setGrade] = useState("");
  const [order, setOrder] = useState<"listedPriceAsc" | "listedPriceDesc" | "dateDesc">("listedPriceAsc");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Slab[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [pick, setPick] = useState<Slab | null>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(q.trim()), 280);
    return () => window.clearTimeout(id);
  }, [q]);

  useEffect(() => {
    setPage(1);
    setRows([]);
  }, [query, cat, grade, order, kind]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setNote("");
    loadSlabs({
      data: {
        q: query || undefined,
        category: (cat || undefined) as (typeof CATS)[number] | undefined,
        grade: (grade || undefined) as (typeof GRADES)[number] | undefined,
        cardType: kind || undefined,
        orderBy: order,
        page,
      },
    })
      .then((res) => {
        if (!live) return;
        setTotal(res.total);
        setRows((cur) => (page === 1 ? res.rows : [...cur, ...res.rows.filter((row) => !cur.some((have) => have.mint === row.mint))]));
        setMore(res.rows.length >= 8);
      })
      .catch((err) => {
        if (!live) return;
        setNote(err instanceof Error ? err.message : "The book did not load.");
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [query, cat, grade, order, page, kind]);

  if (pick) return <SlabBuy slab={pick} onBack={() => setPick(null)} />;

  return (
    <div className="px-3 py-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the vault"
        aria-label="Search slabs"
        className="min-h-11 w-full rounded-full bg-surface px-4 text-sm outline-none"
      />
      <div className="mt-3 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
        {KINDS.map(([id, label]) => (
          <Chip
            key={id}
            on={kind === id}
            label={label}
            onClick={() => {
              setKind(id);
              if (id !== "Card") setCat("");
              if (id === "Card" && !cat) setCat("Pokemon");
            }}
          />
        ))}
      </div>
      {kind === "Card" || kind === "" ? (
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
          <Chip on={!cat} label="All" onClick={() => setCat("")} />
          {CATS.map((id) => (
            <Chip key={id} on={cat === id} label={id} onClick={() => setCat(id)} />
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex gap-1 overflow-x-auto [scrollbar-width:none]">
        <Chip on={!grade} label="Any grade" onClick={() => setGrade("")} />
        {GRADES.map((id) => (
          <Chip key={id} on={grade === id} label={id} onClick={() => setGrade(id)} />
        ))}
        {(
          [
            ["listedPriceAsc", "Lowest"],
            ["listedPriceDesc", "Highest"],
            ["dateDesc", "New"],
          ] as const
        ).map(([id, label]) => (
          <Chip key={id} on={order === id} label={label} onClick={() => setOrder(id)} />
        ))}
      </div>
      <p className="mt-3 text-xs text-subtle">
        {total > 0 ? `${total.toLocaleString("en-US")} in this filter. ` : ""}
        USDC asks from their marketplace. Phantom signs the buy.
      </p>
      {note ? <p className="mt-3 text-sm text-down">{note}</p> : null}
      {rows.length === 0 && loading ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-elevated" />
          ))}
        </div>
      ) : null}
      {rows.length === 0 && !loading ? <p className="py-10 text-center text-sm text-muted">Nothing listed in this lane.</p> : null}
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {rows.map((row) => (
          <li key={row.mint}>
            <button type="button" onClick={() => setPick(row)} className="w-full overflow-hidden rounded-2xl bg-surface text-left">
              <Shot src={row.image || row.full} alt={row.name} />
              <span className="block px-2.5 pt-2 text-[11px] text-subtle">{[row.company, row.grade].filter(Boolean).join(" ") || row.kind}</span>
              <span className="line-clamp-2 block px-2.5 pt-0.5 text-sm leading-snug">{row.name}</span>
              <span className="block px-2.5 pt-1 pb-2.5 font-mono text-sm text-up">{money(row.ask)}</span>
            </button>
          </li>
        ))}
      </ul>
      {more ? (
        <button type="button" disabled={loading} onClick={() => setPage((n) => n + 1)} className="mt-3 min-h-11 w-full rounded-full bg-elevated text-sm font-semibold text-fg disabled:opacity-50">
          {loading ? "Loading…" : "More slabs"}
        </button>
      ) : null}
    </div>
  );
}

function SlabBuy({ slab, onBack }: { slab: Slab; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [face, setFace] = useState<"front" | "back">("front");
  const [bal, setBal] = useState<number | null>(null);
  const cap = spendCap();
  const over = slab.ask > cap;

  useEffect(() => {
    const who = liveSolAddress();
    if (!who) return;
    let live = true;
    splHolding(who, USDC)
      .then((held) => live && setBal(held.ui))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  async function buy() {
    if (over) return;
    if (needWallet()) return;
    setBusy(true);
    try {
      const wallet = await connectPhantom();
      const built = await slabTx({ data: { wallet, nft: slab.mint, ask: slab.ask } });
      if (built.usdc > spendCap()) throw new Error(`This ask is ${money(built.usdc)}. The cap is ${money(spendCap())}. Raise it on Wallet, then sign.`);
      const sig = await sendPartial(txOf(built.tx));
      toast.success(`Phantom signed. solscan.io/tx/${sig}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col px-4 pt-3 pb-4">
      <button type="button" onClick={onBack} className="min-h-11 self-start text-sm text-muted">
        Back
      </button>
      <Shot src={face === "back" && slab.back ? slab.back : slab.full || slab.image} alt={slab.name} tall />
      {slab.back ? (
        <div className="mt-2 flex justify-center gap-2">
          <button type="button" onClick={() => setFace("front")} className={cn("min-h-9 rounded-full px-3 text-sm", face === "front" ? "bg-fg text-bg" : "text-muted")}>
            Front
          </button>
          <button type="button" onClick={() => setFace("back")} className={cn("min-h-9 rounded-full px-3 text-sm", face === "back" ? "bg-fg text-bg" : "text-muted")}>
            Back
          </button>
        </div>
      ) : null}
      <p className="mt-4 text-center font-display text-5xl tracking-tight">{money(slab.ask)}</p>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-muted">{slab.name}</p>
      <p className="mt-3 text-center text-sm">
        {[slab.company, slab.grade].filter(Boolean).join(" ")}
        {slab.insured != null && slab.insured > 0 ? ` · insured ${money(slab.insured)}` : ""}
      </p>
      <p className="mt-1 text-center text-xs text-subtle">{[slab.year, slab.set, slab.vault ? `Vault ${slab.vault}` : ""].filter(Boolean).join(" · ")}</p>
      <div className="mt-auto space-y-3 pt-6">
        <p className="text-sm text-muted">{bal == null ? "USDC shows once Phantom is connected." : `${bal.toFixed(2)} USDC in this wallet`}</p>
        <p className="text-xs leading-relaxed text-subtle">
          Phantom signs a Collector Crypt buy for {money(slab.ask)} USDC. Their marketplace already co-signed. Senda never holds the card.
        </p>
        {over ? <p className="text-sm text-down">This ask is over the {money(cap)} send cap. Raise it on Wallet.</p> : null}
        <button type="button" disabled={busy || over} onClick={() => void buy()} className="min-h-12 w-full rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-50">
          {busy ? "Waiting for Phantom…" : `Buy · ${money(slab.ask)}`}
        </button>
      </div>
    </div>
  );
}

function PackBook() {
  const [rows, setRows] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [pick, setPick] = useState<Pack | null>(null);

  useEffect(() => {
    let live = true;
    loadPacks()
      .then((res) => live && setRows(res.rows))
      .catch((err) => live && setNote(err instanceof Error ? err.message : "The machines did not load."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  if (pick) return <PackBuy pack={pick} onBack={() => setPick(null)} />;

  return (
    <div className="px-3 py-3">
      <p className="text-xs leading-relaxed text-subtle">Public machines only. The price is what their pack transaction moves in USDC. Odds and stock are theirs.</p>
      {note ? <p className="mt-3 text-sm text-down">{note}</p> : null}
      {loading && rows.length === 0 ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-elevated" />
          ))}
        </div>
      ) : null}
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.code}>
            <button type="button" onClick={() => setPick(row)} className="flex w-full gap-3 rounded-2xl bg-surface p-2 text-left">
              <span className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-elevated">
                {row.image ? <img src={row.image} alt="" className="h-full w-full object-cover" /> : null}
              </span>
              <span className="min-w-0 flex-1 py-1">
                <span className="block text-[11px] text-subtle">{row.category}</span>
                <span className="block truncate text-sm font-medium">{row.name}</span>
                <span className="mt-1 block font-mono text-sm text-up">{money(row.price)}</span>
                <Odds odds={row.odds} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PackBuy({ pack, onBack }: { pack: Pack; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [pulled, setPulled] = useState<{ name: string; image: string; grade: string; nft: string } | null>(null);
  const cap = spendCap();
  const over = pack.price > cap;

  async function buy() {
    if (over) return;
    if (needWallet()) return;
    setBusy(true);
    try {
      const wallet = await connectPhantom();
      const built = await packTx({ data: { wallet, code: pack.code, ask: pack.price } });
      if (built.usdc > spendCap()) throw new Error(`This pack is ${money(built.usdc)}. The cap is ${money(spendCap())}. Raise it on Wallet, then sign.`);
      const signed = await signSerializedTx(built.tx);
      const sent = await packSend({ data: { signed, memo: built.memo } });
      let opened = sent;
      for (let i = 0; i < 6 && !opened.nft; i += 1) {
        await new Promise((r) => setTimeout(r, 2000));
        opened = { ...opened, ...(await packLook({ data: { memo: built.memo } })) };
      }
      if (opened.nft || opened.name) setPulled({ name: opened.name || "Pack opened", image: opened.image, grade: opened.grade, nft: opened.nft });
      toast.success(sent.signature ? `Phantom signed. solscan.io/tx/${sent.signature}` : "Phantom signed. Collector Crypt has the pack.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col px-4 pt-3 pb-4">
      <button type="button" onClick={onBack} className="min-h-11 self-start text-sm text-muted">
        Back
      </button>
      {pack.image ? <img src={pack.image} alt="" className="mx-auto mt-4 h-40 w-32 rounded-2xl object-cover" /> : null}
      <p className="mt-4 text-center font-display text-5xl tracking-tight">{money(pack.price)}</p>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm text-muted">{pack.name}</p>
      <div className="mt-4">
        <Odds odds={pack.odds} wide />
      </div>
      <p className="mt-3 text-center text-xs text-subtle">
        {pack.stock > 0 ? `${pack.stock.toLocaleString("en-US")} still in the machine` : "Stock not listed"}
        {pack.ev != null ? ` · EV ${money(pack.ev)}` : ""}
        {pack.buyback != null ? ` · ${pack.buyback}% instant buyback` : ""}
      </p>
      {pulled ? (
        <div className="mt-4 rounded-2xl bg-surface p-3 text-center">
          {pulled.image ? <img src={pulled.image} alt="" className="mx-auto h-40 object-contain" /> : null}
          <p className="mt-2 text-sm">{pulled.name}</p>
          <p className="text-xs text-subtle">{[pulled.grade, pulled.nft ? `${pulled.nft.slice(0, 4)}…${pulled.nft.slice(-4)}` : ""].filter(Boolean).join(" · ")}</p>
        </div>
      ) : null}
      <div className="mt-auto space-y-3 pt-6">
        <p className="text-xs leading-relaxed text-subtle">Phantom signs their pack transaction. Collector Crypt submits it and opens the pack. Senda does not pick the card.</p>
        {over ? <p className="text-sm text-down">This pack is over the {money(cap)} send cap. Raise it on Wallet.</p> : null}
        <button type="button" disabled={busy || over} onClick={() => void buy()} className="min-h-12 w-full rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-50">
          {busy ? "Waiting for Phantom…" : `Open · ${money(pack.price)}`}
        </button>
      </div>
    </div>
  );
}

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("min-h-9 shrink-0 rounded-full px-3 text-sm font-medium", on ? "bg-fg text-bg" : "bg-elevated text-muted")}>
      {label}
    </button>
  );
}

function Odds({ odds, wide }: { odds: Pack["odds"]; wide?: boolean }) {
  const parts = [
    ["Common", odds.common, "bg-subtle"],
    ["Uncommon", odds.uncommon, "bg-muted"],
    ["Rare", odds.rare, "bg-fg"],
    ["Epic", odds.epic, "bg-accent"],
  ] as const;
  const sum = parts.reduce((n, part) => n + part[1], 0);
  if (!(sum > 0)) return null;
  return (
    <span className={cn("mt-2 block", wide && "px-2")}>
      <span className="flex h-1.5 overflow-hidden rounded-full bg-elevated">
        {parts.map(([name, n, color]) => (n > 0 ? <span key={name} className={cn("block h-full", color)} style={{ width: `${(n / sum) * 100}%` }} /> : null))}
      </span>
      <span className="mt-1 block text-[10px] text-subtle">
        {parts
          .filter((part) => part[1] > 0)
          .map(([name, n]) => `${name} ${n}%`)
          .join(" · ")}
      </span>
    </span>
  );
}
