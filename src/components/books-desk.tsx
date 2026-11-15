import { useEffect, useState } from "react";
import { FilmBand } from "@/components/film-band";
import { MoneyBar } from "@/components/money-bar";
import { TabLead } from "@/components/tab-lead";
import { listFills } from "@/lib/account-book";
import { alphaOf, digestBooks, journalOf, type JournalLine } from "@/lib/books";
import { quoteRoute, SOL } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { readChain } from "@/lib/phantom";
import { formatMoney, type Ccy } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function BooksDesk({ view = "all" }: { view?: "all" | "journal" | "tokens" }) {
  const { w, usdPer } = useWallet();
  const d = digestBooks(w, usdPer);
  const alpha = alphaOf(w);
  const lines = [...journalOf(w), ...fillsAsLines()];

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Books"
        title="Alpha"
        accent="ledger."
        line="The journal, the token book, and the fills this account already signed. No invented lines."
        live={["Debits, credits, and the token balances this account stored."]}
        coming={["An export a CPA would take."]}
      />
      <MoneyBar />
      <LiveBook owner={w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? ""} />
      <AlphaStrip lines={alpha.lines + (lines.length - alpha.lines)} debit={sum(lines, "debit")} credit={sum(lines, "credit")} tied={d.tied} id={d.id} />
      {alpha.kinds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {alpha.kinds.map((row) => (
            <p key={row.kind} className="rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] text-white/70">
              {row.kind} · {row.n} · {row.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          ))}
        </div>
      ) : null}
      {view === "tokens" ? null : <Journal lines={lines} />}
      {view === "journal" ? null : <TokenBook d={d} />}
    </div>
  );
}

function fillsAsLines(): JournalLine[] {
  return listFills().map((row) => {
    const out = row.side === "buy" || row.side === "send";
    return {
      id: row.id,
      at: new Date(row.at).toISOString(),
      kind: row.desk,
      memo: `${row.side} ${row.symbol}`,
      ccy: "USDC",
      debit: out ? row.usd : 0,
      credit: out ? 0 : row.usd,
    };
  });
}

function sum(lines: JournalLine[], side: "debit" | "credit"): number {
  return Math.round(lines.reduce((n, row) => n + row[side], 0) * 100) / 100;
}

function LiveBook({ owner }: { owner: string }) {
  const [sol, setSol] = useState<number | null>(null);
  const [usdc, setUsdc] = useState<number | null>(null);
  const [cash, setCash] = useState<number | null>(null);
  const [mark, setMark] = useState<number | null>(null);
  const [at, setAt] = useState("");

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
          setAt(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        })
        .catch(() => undefined);
      quoteRoute({ inputMint: SOL, outputMint: USDC, amountRaw: 1e9, outDecimals: 6 })
        .then((q) => live && setMark(q.outUi))
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 12_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  const usd = sol != null && mark != null ? sol * mark + (usdc ?? 0) + (cash ?? 0) : null;
  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Live</p>
        <p className="font-mono text-[11px] text-subtle">{owner ? at || "Reading the wallet" : "Connect Phantom"}</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat k="Wallet" v={usd == null ? "—" : `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} line="SOL, USDC, and Cash at the last print" />
        <Stat k="SOL" v={sol == null ? "—" : sol.toFixed(4)} line={mark == null ? "Mark not in yet" : `$${mark.toFixed(2)}`} />
        <Stat k="USDC" v={usdc == null ? "—" : usdc.toFixed(2)} line="On this account" />
        <Stat k="Cash" v={cash == null ? "—" : cash.toFixed(2)} line="Phantom Cash on this account" />
      </dl>
    </section>
  );
}

function AlphaStrip({ lines, debit, credit, tied, id }: { lines: number; debit: number; credit: number; tied: boolean; id: string }) {
  const net = Math.round((credit - debit) * 100) / 100;
  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Alpha</p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">The ledger</h2>
        </div>
        <p className={cn("rounded-full px-3 py-1 text-sm font-semibold", tied ? "bg-accent text-accent-fg" : "bg-down/20 text-down")}>
          {tied ? "The books tie" : "The books do not tie"}
        </p>
      </div>
      <p className="mt-2 font-mono text-xs text-subtle">{id}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat k="Lines" v={String(lines)} line="Journal plus signed fills" />
        <Stat k="Debit" v={debit.toLocaleString(undefined, { maximumFractionDigits: 2 })} line="What left" />
        <Stat k="Credit" v={credit.toLocaleString(undefined, { maximumFractionDigits: 2 })} line="What came in" />
        <Stat k="Net" v={net.toLocaleString(undefined, { maximumFractionDigits: 2 })} line="Credit minus debit" />
      </dl>
    </section>
  );
}

function Journal({ lines }: { lines: JournalLine[] }) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c]">
      <div className="px-4 py-4">
        <h2 className="text-xl tracking-tight">Journal</h2>
        <p className="mt-1 text-sm text-muted">A debit is money out. A credit is money in. A fill from a desk sits on the same page.</p>
      </div>
      {lines.length === 0 ? (
        <p className="px-4 pb-6 text-sm text-subtle">None.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-subtle">
            <tr>
              <th className="px-4 py-2 font-medium">Line</th>
              <th className="px-2 py-2 font-medium">Kind</th>
              <th className="px-2 py-2 text-right font-medium">Debit</th>
              <th className="px-4 py-2 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((t) => (
              <tr key={t.id} className="border-t border-white/10">
                <td className="px-4 py-3">
                  <span className="block truncate font-semibold">{t.memo}</span>
                  <span className="font-mono text-[11px] text-subtle">{t.at.slice(0, 16).replace("T", " ")} · {t.ccy}</span>
                </td>
                <td className="px-2 py-3 text-muted">{t.kind}</td>
                <td className="px-2 py-3 text-right font-mono tabular-nums">{t.debit ? formatMoney(t.debit, (t.ccy === "USDC" ? "USDC" : "USD") as Ccy) : ""}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{t.credit ? formatMoney(t.credit, (t.ccy === "USDC" ? "USDC" : "USD") as Ccy) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function TokenBook({ d }: { d: ReturnType<typeof digestBooks> }) {
  return (
    <>
      <header className="rounded-[22px] border border-white/10 bg-[#10131c] p-6 lg:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Tokens</p>
        <h1 className="mt-2 text-3xl tracking-tight">
          Digest <span className="font-mono text-accent">{d.id}</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Same account as the journal. Cash, stock at cost, suspense, and what a one-time number can still charge.
        </p>
      </header>
      <FilmBand poster="/images/term-sheet.jpg" label="The books, replayed." />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat k="Assets" v={d.assets.toLocaleString(undefined, { maximumFractionDigits: 2 })} line="Cash plus stock at cost" />
        <Stat k="Capital" v={d.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })} line="What the books say you own" />
        <Stat k="Suspense" v={d.suspense.toLocaleString(undefined, { maximumFractionDigits: 2 })} line="Journal versus the balance" />
        <Stat k="Ghost" v={d.ghost.toLocaleString(undefined, { maximumFractionDigits: 2 })} line="Still chargeable on a number" />
      </dl>
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
    </>
  );
}

function Stat({ k, v, line }: { k: string; v: string; line: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-4">
      <dt className="text-xs text-subtle">{k}</dt>
      <dd className="mt-1 font-mono text-2xl">{v}</dd>
      <p className="mt-1 text-xs text-muted">{line}</p>
    </div>
  );
}