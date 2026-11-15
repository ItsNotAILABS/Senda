import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Plus, Send, TrendingUp } from "lucide-react";
import { MarkFace } from "@/components/holding-cards";
import { toast } from "sonner";
import { openDeposit } from "@/components/fund-sheet";
import { listFills } from "@/lib/account-book";
import { loadHoldTape, type HoldMove } from "@/lib/hold-tape";
import { buildPicture, type Picture } from "@/lib/money-picture";
import { connectPhantom, readChain, pickOwner } from "@/lib/phantom";
import { loadMarks, type TokenMark } from "@/lib/token-mark";
import { loadPulse, type TapeRow } from "@/lib/universe";
import { loadHeadlines, type Headline } from "@/lib/wire";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Book = "watch" | "crypto" | "stocks" | "pre" | "yours";

const BOOKS: { id: Book; label: string }[] = [
  { id: "watch", label: "Watchlist" },
  { id: "crypto", label: "Crypto" },
  { id: "stocks", label: "Stocks" },
  { id: "pre", label: "Pre-IPO" },
  { id: "yours", label: "Positions" },
];

/** Mobile home. One price pull, one wallet read. No chart, no video, no second desk. */
export function PhoneHome() {
  const wallet = useWallet();
  const owner = pickOwner(wallet.w.links);
  const [tape, setTape] = useState<TapeRow[]>([]);
  const [pic, setPic] = useState<Picture | null>(null);
  const [news, setNews] = useState<Headline[]>([]);
  const [marks, setMarks] = useState<Record<string, TokenMark>>({});
  const [moves, setMoves] = useState<Record<string, HoldMove>>({});
  const [book, setBook] = useState<Book>("watch");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    const pull = () => {
      Promise.all([
        loadPulse().catch(() => null),
        owner ? readChain(owner).catch(() => null) : Promise.resolve(null),
      ]).then(([pulse, chain]) => {
        if (!live) return;
        const rows = pulse?.rows || [];
        setTape(rows);
        if (!owner || !chain) {
          setPic(null);
          return;
        }
        setPic(
          buildPicture({
            owner,
            sol: chain.sol || 0,
            tokens: chain.tokens || [],
            tape: rows,
            cash: 0,
            house: null,
          }),
        );
      });
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  useEffect(() => {
    let live = true;
    loadHeadlines()
      .then((rows) => live && setNews(rows.slice(0, 6)))
      .catch(() => live && setNews([]));
    return () => {
      live = false;
    };
  }, []);

  const focus = focusMints(tape, pic);
  const focusKey = focus.join(",");
  useEffect(() => {
    if (!focusKey) return;
    let live = true;
    const mints = focusKey.split(",");
    loadMarks({ data: { mints } })
      .then((list) => {
        if (!live) return;
        const next: Record<string, TokenMark> = {};
        for (const row of list) next[row.mint] = row;
        setMarks(next);
      })
      .catch(() => undefined);
    loadHoldTape({ data: { mints } })
      .then((list) => {
        if (!live) return;
        const next: Record<string, HoldMove> = {};
        for (const row of list) next[row.mint] = row;
        setMoves(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [focusKey]);

  async function connect() {
    setBusy(true);
    try {
      const addr = await connectPhantom();
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") toast.error(linked.error || "Phantom did not stay.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Phantom did not open.");
    } finally {
      setBusy(false);
    }
  }

  const power = (pic?.usdc || 0) + (pic?.phantomCash || 0);
  const day = dayMove(pic, tape);
  const rows = shown(book, tape, pic);

  return (
    <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-white/50">{owner ? "Portfolio" : "Senda"}</p>
        {owner ? (
          <Link to="/wallet" className="text-[13px] font-medium text-white/70">
            {owner.slice(0, 4)}…{owner.slice(-4)}
          </Link>
        ) : (
          <button type="button" disabled={busy} onClick={() => void connect()} className="min-h-10 rounded-full bg-[#d7e36a] px-4 text-sm font-semibold text-black disabled:opacity-60">
            {busy ? "Opening…" : "Connect"}
          </button>
        )}
      </div>

      <p className="mt-2 font-mono text-[40px] leading-none tracking-tight tabular-nums">
        {money(pic ? pic.total : 0)}
      </p>
      <p className={cn("mt-2 text-[15px] font-medium tabular-nums", day == null ? "text-white/40" : day < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
        {day == null ? (owner ? "Today’s change comes in with the prices" : "Connect to see this wallet") : `${day >= 0 ? "+" : "−"}${money(Math.abs(day))} today`}
      </p>

      <div className="mt-5 grid grid-cols-4 gap-2">
        <Action icon={Plus} label="Deposit" onClick={openDeposit} />
        <ActionLink icon={TrendingUp} label="Trade" to="/invest" />
        <ActionLink icon={Send} label="Send" to="/payments" />
        <ActionLink icon={ArrowUpRight} label="Predict" to="/invest" search={{ desk: "kalshi" }} />
      </div>

      <Link to="/invest" search={{ desk: "slabs" }} className="mt-3 flex min-h-14 items-center justify-between rounded-2xl bg-white/[0.06] px-4">
        <span>
          <span className="block text-sm font-semibold">Graded cards</span>
          <span className="block text-xs text-white/45">Collector Crypt slabs and packs · USDC</span>
        </span>
        <span className="text-sm font-semibold text-[#d6ff4a]">Open</span>
      </Link>
      <Link to="/invest" search={{ desk: "private" }} className="mt-2 flex min-h-14 items-center justify-between rounded-2xl bg-white/[0.06] px-4">
        <span>
          <span className="block text-sm font-semibold">Private AI</span>
          <span className="block text-xs text-white/45">Senda signs the answer. You verify it.</span>
        </span>
        <span className="text-sm font-semibold text-[#d6ff4a]">Open</span>
      </Link>

      <div className="mt-4 rounded-2xl bg-white/[0.06] px-4 py-3">
        <Link to="/wallet" className="flex items-center justify-between">
          <span className="text-sm text-white/70">Buying power</span>
          <span className="font-mono text-sm tabular-nums">{owner ? money(power) : "—"}</span>
        </Link>
        <Mix usdc={pic?.usdc || 0} cash={pic?.phantomCash || 0} sol={pic?.solUsd || 0} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Cash k="USDC" v={owner && pic ? money(pic.usdc) : "—"} line="Spendable" />
          <Cash k="Cash" v={owner && pic ? money(pic.phantomCash) : "—"} line="Phantom Cash" />
          <Cash k="SOL" v={owner && pic ? `${pic.sol.toFixed(3)}` : "—"} line={pic && pic.solUsd > 0 ? money(pic.solUsd) : "Network"} />
        </div>
      </div>

      <Markets tape={tape} marks={marks} moves={moves} />
      <Positions pic={pic} tape={tape} owner={owner} marks={marks} moves={moves} />
      <Movers tape={tape} marks={marks} />
      <Activity txs={wallet.w.txs} />
      <News rows={news} tape={tape} />

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {BOOKS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setBook(item.id)}
            className={cn("min-h-9 shrink-0 rounded-full px-3 text-sm font-medium", book === item.id ? "bg-white text-black" : "bg-white/10 text-white/70")}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ul className="mt-1 divide-y divide-white/10">
        {rows.length === 0 ? (
          <li className="py-8 text-sm text-white/45">{book === "yours" ? "Nothing priced on this address yet." : "Prices have not come back yet."}</li>
        ) : (
          rows.map((row) => <NameRow key={row.mint} row={row} />)
        )}
      </ul>
    </div>
  );
}

function Action({ icon: Icon, label, onClick }: { icon: typeof Plus; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl bg-white/[0.06] text-[12px] font-medium active:bg-white/15">
      <Icon className="size-5" />
      {label}
    </button>
  );
}

function ActionLink({
  icon: Icon,
  label,
  to,
  search,
}: {
  icon: typeof Plus;
  label: string;
  to: "/invest" | "/payments";
  search?: { desk: "kalshi" };
}) {
  return (
    <Link to={to} search={search} className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl bg-white/[0.06] text-[12px] font-medium active:bg-white/15">
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

function NameRow({ row }: { row: TapeRow }) {
  const down = row.change < 0;
  const body = (
    <>
      <MarkFace symbol={row.symbol} mint={row.mint} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{row.symbol}</span>
        <span className="block text-[12px] text-white/40">{row.group === "company" ? "Pre-IPO" : row.group === "listed" ? "Listed" : row.group === "stake" ? "Stake" : "Crypto"}</span>
      </span>
      <span className="text-right">
        <span className="block font-mono text-[15px] tabular-nums">{px(row.price)}</span>
        <span className={cn("block font-mono text-[12px] tabular-nums", down ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
          {row.change >= 0 ? "+" : ""}
          {row.change.toFixed(2)}%
        </span>
      </span>
    </>
  );
  const cls = "flex min-h-14 items-center gap-3 py-2 active:bg-white/5";
  if (row.group === "company") {
    return (
      <li>
        <Link to="/invest/name/$symbol" params={{ symbol: row.symbol }} className={cls}>{body}</Link>
      </li>
    );
  }
  const search = row.group === "listed" ? ({ desk: "xstock" } as const) : ({ desk: "spot" } as const);
  return (
    <li>
      <Link to="/invest" search={search} className={cls}>{body}</Link>
    </li>
  );
}

function Cash({ k, v, line }: { k: string; v: string; line: string }) {
  return (
    <div>
      <p className="text-[11px] text-white/40">{k}</p>
      <p className="mt-0.5 font-mono text-[13px] tabular-nums">{v}</p>
      <p className="text-[11px] text-white/35">{line}</p>
    </div>
  );
}

function Mix({ usdc, cash, sol }: { usdc: number; cash: number; sol: number }) {
  const total = usdc + cash + sol;
  if (!(total > 0)) return null;
  const parts = [
    { n: usdc, color: "bg-[#c6f56a]" },
    { n: cash, color: "bg-white" },
    { n: sol, color: "bg-[#9945ff]" },
  ].filter((part) => part.n > 0);
  return (
    <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/10">
      {parts.map((part) => (
        <span key={part.color} className={part.color} style={{ width: `${(part.n / total) * 100}%` }} />
      ))}
    </div>
  );
}

function Head({ title, to, label }: { title: string; to?: "/invest" | "/payments" | "/wire" | "/vault" | "/books"; label?: string }) {
  return (
    <div className="mt-6 flex items-baseline justify-between">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {to ? (
        <Link to={to} className="text-[13px] text-white/50">{label || "See all"}</Link>
      ) : null}
    </div>
  );
}

const INDEXES = ["SPYx", "QQQx", "SOL", "BTC", "ETH"];

function Markets({ tape, marks, moves }: { tape: TapeRow[]; marks: Record<string, TokenMark>; moves: Record<string, HoldMove> }) {
  const live = tape.filter((row) => row.price > 0);
  const head = INDEXES.map((symbol) => live.find((row) => row.symbol === symbol)).filter((row): row is TapeRow => !!row);
  return (
    <section>
      <Head title="Markets" to="/wire" />
      {head.length === 0 ? (
        <p className="mt-2 text-sm text-white/45">Index prices have not come back yet.</p>
      ) : (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {head.map((row) => {
            const mark = marks[row.mint];
            const change = moves[row.mint]?.day ?? row.change;
            const down = change < 0;
            return (
              <Open key={row.mint} row={row} className="flex w-[148px] shrink-0 flex-col rounded-2xl bg-white/[0.05] p-3">
                <MarkFace icon={mark?.icon} symbol={row.symbol} mint={row.mint} size={36} />
                <span className="mt-3 truncate text-[13px] font-semibold">{row.symbol}</span>
                <span className="mt-0.5 font-mono text-[16px] tabular-nums">{px(row.price)}</span>
                <span className={cn("mt-1 font-mono text-[12px] font-semibold tabular-nums", down ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                  {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                </span>
              </Open>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Positions({ pic, tape, owner, marks, moves }: { pic: Picture | null; tape: TapeRow[]; owner: string; marks: Record<string, TokenMark>; moves: Record<string, HoldMove> }) {
  const rows = heldRows(pic, tape);
  const total = pic?.total || 0;
  return (
    <section>
      <Head title="Positions" to="/vault" label="Portfolio" />
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-white/45">{owner ? "Nothing priced on this address yet." : "Connect Phantom to see positions."}</p>
      ) : (
        <ul className="mt-1">
          {rows.map((row) => {
            const move = moves[row.mint];
            const day = move?.day ?? row.change;
            const dollars = row.usd > 0 ? (row.usd * day) / 100 : 0;
            const share = total > 0 ? Math.min(100, (row.usd / total) * 100) : 0;
            const mark = marks[row.mint];
            return (
              <li key={row.mint} className="border-b border-white/10">
                <Open row={row} className="flex items-center gap-3 py-3">
                  <MarkFace icon={mark?.icon} symbol={row.symbol} mint={row.mint} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-medium">{mark?.name || row.symbol}</span>
                      <span className="font-mono text-[15px] tabular-nums">{money(row.usd)}</span>
                    </span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="font-mono text-white/40">{qty(row.ui)} · {px(row.price)}</span>
                      <span className={cn("font-mono tabular-nums", day < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                        {dollars >= 0 ? "+" : "−"}{money(Math.abs(dollars))} ({day >= 0 ? "+" : ""}{day.toFixed(2)}%)
                      </span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full bg-white/50" style={{ width: `${share}%` }} />
                      </span>
                      <span className="font-mono text-[10px] text-white/35">{share.toFixed(0)}%</span>
                    </span>
                    <span className="mt-1 flex gap-3 font-mono text-[10px] text-white/35">
                      <span>1H {pct(move?.hour)}</span>
                      <span>1W {pct(move?.week)}</span>
                    </span>
                  </span>
                  <Spark line={mark?.line || []} down={day < 0} />
                </Open>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Movers({ tape, marks }: { tape: TapeRow[]; marks: Record<string, TokenMark> }) {
  const live = tape.filter((row) => row.price > 0 && row.change !== 0);
  const gain = [...live].sort((a, b) => b.change - a.change).slice(0, 4);
  const lose = [...live].sort((a, b) => a.change - b.change).slice(0, 4);
  return (
    <section>
      <Head title="Movers" to="/invest" />
      {gain.length === 0 ? (
        <p className="mt-2 text-sm text-white/45">Day moves show up when the tape has a change.</p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <MoverCol title="Gainers" rows={gain} marks={marks} />
          <MoverCol title="Losers" rows={lose} marks={marks} />
        </div>
      )}
    </section>
  );
}

function MoverCol({ title, rows, marks }: { title: string; rows: TapeRow[]; marks: Record<string, TokenMark> }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
      <p className="text-[12px] text-white/40">{title}</p>
      <ul>
        {rows.map((row) => {
          const dollars = (row.price * row.change) / 100;
          const vol = marks[row.mint]?.poolVol || marks[row.mint]?.vol24 || 0;
          return (
            <li key={row.mint}>
              <Open row={row} className="flex items-center gap-2 py-2">
                <MarkFace icon={marks[row.mint]?.icon} symbol={row.symbol} mint={row.mint} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{row.symbol}</span>
                    <span className={cn("font-mono text-[12px] tabular-nums", row.change < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                      {row.change >= 0 ? "+" : ""}{row.change.toFixed(2)}%
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-baseline justify-between gap-2 font-mono text-[11px] text-white/40">
                    <span>{px(row.price)}</span>
                    <span>{dollars >= 0 ? "+" : "−"}{money(Math.abs(dollars))}</span>
                  </span>
                  {vol > 0 ? <span className="block text-[10px] text-white/30">{compact(vol)} vol</span> : null}
                </span>
              </Open>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Activity({ txs }: { txs: { id: string; kind: string; amount: number; ccy: string; note: string; status: string; createdAt: string }[] }) {
  const fills = listFills().slice(0, 6).map((row) => ({
    id: row.id,
    at: row.at,
    side: row.side,
    title: row.symbol,
    desk: row.desk,
    detail: money(row.usd),
    status: row.sig ? "signed" : "noted",
    mark: true,
  }));
  const book = txs.slice(0, 4).map((row) => ({
    id: row.id,
    at: Date.parse(row.createdAt) || 0,
    side: row.kind,
    title: row.note || row.kind,
    desk: row.ccy,
    detail: `${row.amount} ${row.ccy}`,
    status: row.status,
    mark: false,
  }));
  const rows = [...fills, ...book].sort((a, b) => b.at - a.at).slice(0, 6);
  return (
    <section>
      <Head title="Orders" to="/books" label="Ledger" />
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-white/45">No orders from this account yet.</p>
      ) : (
        <ul className="mt-1 divide-y divide-white/10">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-2.5">
              {row.mark ? <MarkFace symbol={row.title} size={36} /> : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1c1c1e] text-[11px] font-semibold uppercase ring-1 ring-inset ring-white/15">{row.side.slice(0, 1)}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{row.title}</span>
                <span className="block text-[11px] text-white/35">{row.side} · {row.desk} · {ago(row.at)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-[12px]">{row.detail}</span>
                <span className="block text-[10px] text-white/35">{row.status}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function News({ rows, tape }: { rows: Headline[]; tape: TapeRow[] }) {
  const names = tape.map((row) => row.symbol).filter((symbol) => symbol.length > 2);
  return (
    <section>
      <Head title="News" to="/wire" />
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-white/45">No headlines yet.</p>
      ) : (
        <ul className="mt-1 divide-y divide-white/10">
          {rows.map((row) => {
            const hit = names.find((symbol) => row.title.toUpperCase().includes(symbol.toUpperCase()));
            return (
              <li key={row.link}>
                <a href={row.link} target="_blank" rel="noreferrer" className="block py-2.5">
                  <span className="flex items-center gap-2 text-[11px] text-white/40">
                    <span>{row.source}</span>
                    {hit ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 py-0.5 pr-2 pl-0.5 text-white/80">
                        <MarkFace symbol={hit} size={16} />
                        {hit}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm leading-snug">{row.title}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Open({ row, className, children }: { row: TapeRow; className: string; children: ReactNode }) {
  if (row.group === "company") {
    return (
      <Link to="/invest/name/$symbol" params={{ symbol: row.symbol }} className={className}>{children}</Link>
    );
  }
  const search = row.group === "listed" ? ({ desk: "xstock" } as const) : ({ desk: "spot" } as const);
  return (
    <Link to="/invest" search={search} className={className}>{children}</Link>
  );
}

type Held = TapeRow & { ui: number; usd: number };

function heldRows(pic: Picture | null, tape: TapeRow[]): Held[] {
  if (!pic) return [];
  const byMint = new Map(tape.map((row) => [row.mint, row]));
  const out: Held[] = [];
  if (pic.sol > 0) {
    const sol = tape.find((row) => row.symbol === "SOL");
    if (sol) out.push({ ...sol, ui: pic.sol, usd: pic.solUsd });
  }
  for (const line of pic.lines) {
    if (!(line.ui > 0)) continue;
    const mark = byMint.get(line.mint);
    out.push({
      symbol: line.symbol,
      mint: line.mint,
      group: line.group,
      price: mark?.price || (line.ui > 0 ? line.usd / line.ui : 0),
      change: mark?.change || 0,
      ui: line.ui,
      usd: line.usd,
    });
  }
  return out.filter((row) => row.usd > 0.005 || row.ui > 0);
}

function Spark({ line, down }: { line: number[]; down: boolean }) {
  if (line.length < 2) return null;
  const min = Math.min(...line);
  const max = Math.max(...line);
  const span = max - min || 1;
  const w = 72;
  const h = 32;
  const d = line
    .map((n, i) => {
      const x = (i / (line.length - 1)) * w;
      const y = h - ((n - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <path d={d} fill="none" stroke={down ? "#ff5d73" : "#c6f56a"} strokeWidth="1.6" />
    </svg>
  );
}

function focusMints(tape: TapeRow[], pic: Picture | null): string[] {
  const ids: string[] = [];
  const add = (mint: string | undefined) => {
    if (mint && mint.length >= 32 && !ids.includes(mint) && ids.length < 12) ids.push(mint);
  };
  for (const symbol of INDEXES) add(tape.find((row) => row.symbol === symbol)?.mint);
  if (pic && pic.sol > 0) add(tape.find((row) => row.symbol === "SOL")?.mint);
  for (const line of pic?.lines || []) add(line.mint);
  const live = tape.filter((row) => row.price > 0 && row.change !== 0).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  for (const row of live.slice(0, 4)) add(row.mint);
  return ids;
}

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function compact(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return money(n);
}

function ago(at: number) {
  if (!(at > 0)) return "";
  const s = Math.max(0, Date.now() - at) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function qty(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toPrecision(3);
}

function shown(book: Book, tape: TapeRow[], pic: Picture | null): TapeRow[] {
  const live = tape.filter((row) => row.price > 0);
  if (book === "yours") {
    const held = new Set((pic?.lines || []).filter((line) => line.ui > 0).map((line) => line.mint));
    return live.filter((row) => held.has(row.mint));
  }
  if (book === "crypto") return live.filter((row) => row.group === "crypto" || row.group === "stake").slice(0, 24);
  if (book === "stocks") return live.filter((row) => row.group === "listed").slice(0, 24);
  if (book === "pre") return live.filter((row) => row.group === "company").slice(0, 24);
  const want = ["SOL", "BTC", "ETH", "JUP", "AAPLx", "NVDAx", "TSLAx", "SPYx", "SPACEX", "OPENAI", "ANTHROPIC", "XAI"];
  const picked = want.map((symbol) => live.find((row) => row.symbol === symbol)).filter((row): row is TapeRow => !!row);
  return picked.length ? picked : live.slice(0, 12);
}

function dayMove(pic: Picture | null, tape: TapeRow[]): number | null {
  if (!pic) return null;
  const px = new Map(tape.map((row) => [row.mint, row.change]));
  let sum = 0;
  let any = false;
  for (const line of pic.lines) {
    const change = px.get(line.mint);
    if (change == null || !(line.usd > 0)) continue;
    sum += (line.usd * change) / 100;
    any = true;
  }
  if (pic.solUsd > 0 && px.has("So11111111111111111111111111111111111111112")) {
    const change = px.get("So11111111111111111111111111111111111111112") || 0;
    sum += (pic.solUsd * change) / 100;
    any = true;
  }
  return any ? Math.round(sum * 100) / 100 : null;
}

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function px(n: number) {
  if (!(n > 0)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  return `$${n.toPrecision(3)}`;
}
