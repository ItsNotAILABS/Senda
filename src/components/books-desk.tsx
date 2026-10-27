import { useEffect, useState } from "react";
import { FilmBand } from "@/components/film-band";
import { InvoiceDesk } from "@/components/invoice-desk";
import { TabLead } from "@/components/tab-lead";
import { JumpStrip } from "@/components/jump-strip";
import { digestBooks, assembleLedger, type LedgerBookName, type LedgerLine } from "@/lib/books";
import { chainRpc, pickOwner, readChain, readUsdcMoves, type UsdcMove } from "@/lib/phantom";
import { listPairs } from "@/lib/pair-contract";
import { listTrades, onTrades } from "@/lib/trade-log";
import { formatMoney } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function BooksDesk() {
  const { w, usdPer } = useWallet();
  const d = digestBooks(w, usdPer);
  const lines = w.txs;

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <JumpStrip />
      <TabLead
        kicker="Books"
        title="Invoices and the ledger."
        accent=""
        line="Pay a bill in USDC, or copy one for someone else. The ledger under it is the record."
        live={["Invoice", "Chain USDC", "Fills", "Pairs"]}
        coming={["A CPA export of a broker statement."]}
        audit={{
          live: "A Solana signature is the payment. A fill is a signature this browser recorded. The journal is not the chain.",
          hold: "A card auth is a browser row. It is not a Visa charge.",
        }}
      />
      <InvoiceDesk owner={w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? ""} />
      <Ledger journal={w.txs} cards={w.cardAuths ?? []} />
      <ChainBook />
      <section className="grid items-stretch gap-3 lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.18fr)]">
        <div className="relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(120%_90%_at_0%_-10%,rgb(214_255_74/0.16),transparent_46%),linear-gradient(165deg,#1a1f2e,#0b0d14)] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgb(255_255_255/0.07)_48%,transparent_66%)]" />
          <div className="relative">
            <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Digest {d.id}</p>
            <p className="mt-3 font-mono text-6xl tracking-tight tabular-nums">{d.suspense.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="mt-2 text-sm text-white/65">Suspense. The gap between the journal and the cash this account can still spend. Zero means the books tie.</p>
          </div>
          <p className={cn("relative mt-4 inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold", d.tied ? "bg-accent text-accent-fg" : "bg-down/20 text-down")}>
            {d.tied ? "The books tie" : "The books do not tie"}
          </p>
        </div>
        <div className="grid grid-cols-2 content-start gap-2 rounded-[22px] border border-white/10 bg-[#10131c] p-3">
          <Stat k="Assets" v={d.assets} line="Cash plus stock at cost" />
          <Stat k="Capital" v={d.equity} line="What the books say you own" />
          <Stat k="Suspense" v={d.suspense} line="Journal versus the balance" />
          <Stat k="Ghost" v={d.ghost} line="Still chargeable on a number" />
        </div>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-3xl tracking-tight">The lines</h2>
            <p className="mt-1 text-sm text-muted">Stored on this account. Nothing filled in.</p>
          </div>
          <button
            type="button"
            disabled={lines.length === 0}
            onClick={() => {
              if (lines.length === 0) return;
              const header = "id,kind,counterparty,amount,ccy,note,time";
              const body = lines.map((t) =>
                [t.id, t.kind, t.counterparty, t.amount, t.ccy, t.note, t.createdAt]
                  .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
                  .join(","),
              );
              const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `senda-books-${d.id}.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-60"
          >
            {lines.length === 0 ? "The book is empty" : "Download"}
          </button>
        </div>
        {lines.length === 0 ? (
          <p className="mt-5 text-sm text-subtle">None.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {lines.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{t.counterparty || t.kind}</p>
                  <p className="truncate text-xs text-subtle">
                    {t.kind}
                    {t.note ? ` · ${t.note}` : ""} · {t.status}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-xl tabular-nums">{formatMoney(t.amount, t.ccy)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <header className="rounded-[22px] border border-white/10 bg-[#10131c] p-6 lg:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Books</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-4xl leading-[1.05] tracking-tight lg:text-5xl">
            Digest <span className="font-mono text-accent">{d.id}</span>
          </h1>
          <p className={cn("rounded-full px-3 py-1 text-sm font-semibold", d.tied ? "bg-accent text-accent-fg" : "bg-down/20 text-down")}>
            {d.tied ? "The books tie" : "The books do not tie"}
          </p>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted">What this account already wrote down.</p>
      </header>
      <FilmBand poster="/images/term-sheet.jpg" label="The books, replayed." />
      <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c]">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-subtle">
            <tr>
              <th className="px-4 py-3 font-medium">Token</th>
              <th className="px-2 py-3 font-medium">Role</th>
              <th className="px-2 py-3 text-right font-medium">Supply</th>
              <th className="px-4 py-3 text-right font-medium">USD</th>
            </tr>
          </thead>
          <tbody>
            {d.tokens.map((t) => (
              <tr key={t.code} className="border-t border-white/10">
                <td className="px-4 py-3">
                  <span className="font-mono">{t.code}</span>
                  <span className="mt-0.5 block text-xs text-muted">{t.name}</span>
                </td>
                <td className="px-2 py-3 text-muted">{t.role}</td>
                <td className="px-2 py-3 text-right font-mono">{t.supply.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                <td className="px-4 py-3 text-right font-mono">{t.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ChainBook() {
  const { w } = useWallet();
  const owner = pickOwner(w.links);
  const [sol, setSol] = useState(0);
  const [usdc, setUsdc] = useState(0);
  const [cash, setCash] = useState(0);
  const [sigs, setSigs] = useState<Array<{ signature: string; err: boolean; time: number | null }>>([]);
  const [moves, setMoves] = useState<UsdcMove[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!owner) return;
    let live = true;
    const pull = () => {
      readChain(owner)
        .then((chain) => {
          if (!live) return;
          setSol(chain.sol);
          setUsdc(chain.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
          setCash(chain.tokens.find((t) => t.symbol === "CASH")?.ui ?? 0);
          setErr("");
        })
        .catch((e: unknown) => {
          if (live) setErr(e instanceof Error ? e.message : "Could not read this address.");
        });
      void chainRpc("getSignaturesForAddress", [owner, { limit: 20 }])
        .then((rows) => {
          if (!live || !Array.isArray(rows)) return;
          setSigs(
            rows.map((row) => {
              const sig = row as { signature?: string; err?: unknown; blockTime?: number | null };
              return { signature: String(sig.signature || ""), err: Boolean(sig.err), time: sig.blockTime ?? null };
            }).filter((row) => row.signature),
          );
        })
        .catch(() => undefined);
      readUsdcMoves(owner)
        .then((rows) => {
          if (live) setMoves(rows);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">This Phantom</p>
      <h2 className="mt-1 text-2xl tracking-tight">What the chain wrote</h2>
      {!owner ? <p className="mt-3 text-sm text-subtle">Connect Phantom. These lines are that address.</p> : null}
      {owner ? (
        <p className="mt-2 font-mono text-sm text-muted">
          {owner.slice(0, 4)}…{owner.slice(-4)} · {sol.toFixed(4)} SOL · ${usdc.toFixed(2)} USDC · ${cash.toFixed(2)} CASH
        </p>
      ) : null}
      {err ? <p className="mt-2 text-sm text-down">{err}</p> : null}
      <h3 className="mt-4 text-sm font-semibold">Dollar moves</h3>
      {moves.length === 0 ? <p className="mt-1 text-xs text-subtle">No USDC in or out on the last signatures.</p> : null}
      <ul className="mt-2 space-y-2">
        {moves.map((move) => (
          <li key={move.signature} className="flex items-center justify-between gap-3 text-sm">
            <a href={`https://solscan.io/tx/${move.signature}`} target="_blank" rel="noreferrer" className="min-w-0 truncate font-mono text-xs text-accent">
              {move.signature.slice(0, 8)}…
            </a>
            <span className={cn("font-mono", move.delta < 0 ? "text-down" : "text-up")}>
              {move.delta < 0 ? "" : "+"}${move.delta.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 text-sm font-semibold">Signatures</h3>
      {sigs.length === 0 ? <p className="mt-1 text-xs text-subtle">None yet on this address.</p> : null}
      <ul className="mt-2 space-y-2">
        {sigs.map((sig) => (
          <li key={sig.signature} className="flex items-center justify-between gap-3 text-xs">
            <a href={`https://solscan.io/tx/${sig.signature}`} target="_blank" rel="noreferrer" className="truncate font-mono text-accent">
              {sig.signature.slice(0, 12)}…
            </a>
            <span className="text-subtle">{sig.err ? "Failed" : sig.time ? new Date(sig.time * 1000).toLocaleString() : "Confirmed"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ k, v, line }: { k: string; v: number; line: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-4">
      <dt className="text-xs text-subtle">{k}</dt>
      <dd className="mt-1 font-mono text-2xl">{v.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
      <p className="mt-1 text-xs text-muted">{line}</p>
    </div>
  );
}

const BOOKS: Array<LedgerBookName | "all"> = ["all", "chain", "fill", "pair", "journal", "card"];

function Ledger({
  journal,
  cards,
}: {
  journal: Array<{ id: string; kind: string; amount: number; ccy: string; counterparty: string; note: string; status: string; createdAt: string }>;
  cards: Array<{ id: string; last4: string; merchant: string; amount: number; status: string; at: string; rc?: string }>;
}) {
  const { w } = useWallet();
  const owner = pickOwner(w.links);
  const [book, setBook] = useState<LedgerBookName | "all">("all");
  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [fills, setFills] = useState(listTrades());

  useEffect(() => onTrades(() => setFills(listTrades())), []);

  useEffect(() => {
    let live = true;
    const pull = async () => {
      let sigs: Array<{ signature: string; err: boolean; time: number | null }> = [];
      let moves: UsdcMove[] = [];
      if (owner) {
        const [chain, moved] = await Promise.all([
          readChain(owner).catch(() => null),
          readUsdcMoves(owner).catch(() => [] as UsdcMove[]),
        ]);
        moves = moved;
        if (chain) sigs = chain.txs;
        else {
          const rows = await chainRpc("getSignaturesForAddress", [owner, { limit: 20 }]).catch(() => null);
          if (Array.isArray(rows)) {
            sigs = rows.map((row) => {
              const sig = row as { signature?: string; err?: unknown; blockTime?: number | null };
              return { signature: String(sig.signature || ""), err: Boolean(sig.err), time: sig.blockTime ?? null };
            }).filter((row) => row.signature);
          }
        }
      }
      if (!live) return;
      setLines(assembleLedger({ sigs, moves, fills, pairs: listPairs(), journal, cards }));
    };
    void pull();
    const id = window.setInterval(() => void pull(), 15_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner, fills, journal, cards]);

  const shown = lines.filter((line) => book === "all" || line.book === book);
  const counts = BOOKS.filter((id) => id !== "all").map((id) => ({ id, n: lines.filter((line) => line.book === id).length }));
  const inn = shown.filter((line) => line.side === "in" && line.unit === "USDC").reduce((s, line) => s + (line.amount || 0), 0);
  const out = shown.filter((line) => line.side === "out" && (line.unit === "USDC" || line.unit === "USD")).reduce((s, line) => s + (line.amount || 0), 0);

  function download() {
    const header = "when,book,side,title,detail,amount,unit,status,ref";
    const body = shown.map((line) =>
      [line.at ? new Date(line.at).toISOString() : "", line.book, line.side, line.title, line.detail, line.amount ?? "", line.unit, line.status, line.href]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "senda-ledger.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Ledger</p>
          <h2 className="mt-1 text-3xl tracking-tight">{shown.length} lines</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">USDC in ${inn.toFixed(2)} · posted out ${out.toFixed(2)}. Out mixes signed dollars and chain USDC. It is not one cash account. Chain lines are public. Fills and the journal are sealed on this desk until Phantom signs.</p>
        </div>
        <button type="button" disabled={shown.length === 0} onClick={download} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">
          Export
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {counts.map((row) => (
          <button key={row.id} type="button" onClick={() => setBook(row.id)} className={cn("rounded-2xl px-3 py-3 text-left", book === row.id ? "bg-accent text-accent-fg" : "bg-black/30")}>
            <p className="text-[11px] uppercase tracking-[0.14em] opacity-70">{row.id}</p>
            <p className="mt-1 font-mono text-2xl tabular-nums">{row.n}</p>
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-1 overflow-x-auto">
        {BOOKS.map((id) => (
          <button key={id} type="button" onClick={() => setBook(id)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold capitalize", book === id ? "bg-accent text-accent-fg" : "bg-white/10")}>
            {id}
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="mt-4 text-sm text-subtle">{owner ? "Nothing in this book yet." : "Connect Phantom. Chain lines need that address. Fills and the journal still show."}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-[11px] tracking-[0.12em] text-subtle uppercase">
              <th className="pb-2 font-normal">When</th>
              <th className="pb-2 font-normal">Book</th>
              <th className="pb-2 font-normal">Entry</th>
              <th className="pb-2 text-right font-normal">Amount</th>
              <th className="pb-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 80).map((line) => (
              <tr key={line.id} className="border-t border-white/10">
                <td className="py-2 font-mono text-xs text-subtle">{line.at ? new Date(line.at).toLocaleString() : "—"}</td>
                <td className="py-2 capitalize text-muted">{line.book}</td>
                <td className="py-2">
                  {line.href ? <a href={line.href} target="_blank" rel="noreferrer" className="font-semibold text-accent">{line.title}</a> : <span className="font-semibold">{line.title}</span>}
                  <span className="mt-0.5 block text-xs text-subtle">{line.detail}</span>
                </td>
                <td className={cn("py-2 text-right font-mono", line.side === "in" ? "text-up" : line.side === "out" ? "text-white" : "text-muted")}>
                  {line.amount == null ? "—" : `${line.side === "in" ? "+" : line.side === "out" ? "−" : ""}${line.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${line.unit}`}
                </td>
                <td className="py-2 text-xs text-subtle">{line.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
