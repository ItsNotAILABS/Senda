import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ContractBoard, type BoardLane } from "@/components/contract-board";
import { PrintChart } from "@/components/print-chart";
import { HoldDesk, WorkContracts } from "@/components/hold-desk";
import { OptionChain } from "@/components/option-chain";
import { cancelChainCover, coverPremium, listChainCovers, openChainCover, type ChainCover, type CoverKind } from "@/lib/cover-chain";
import { getEquityBook, type ListedStock } from "@/lib/equities";
import { closePair, listPairs, type PairContract } from "@/lib/pair-contract";
import { connectPhantom, phantomProvider } from "@/lib/phantom";
import { type OptContract, type OptTenor } from "@/lib/option-chain";
import { runPrestock } from "@/lib/prestock";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Lane = BoardLane;

type Product = "chain" | "cover" | "share" | "xstock";

function chainDebit(ask: number, size: number): number {
  const raw = Math.round(size * ask * 100) / 100;
  return Math.max(0.25, raw);
}

function kindLabel(row: ChainCover): string {
  if (row.kind === "drop") return "10% cover";
  if (row.kind === "drop5") return "5% cover";
  return row.title.toLowerCase().includes("put") ? "Put" : "Call";
}

export function ContractsDesk({ names }: { names: HouseListing[] }) {
  const wallet = useWallet();
  const book = names.filter((n) => n.last > 0);
  const [symbol, setSymbol] = useState(book[0]?.symbol ?? "");
  const [tenor, setTenor] = useState<OptTenor>("1d");
  const [product, setProduct] = useState<Product>("chain");
  const [lane, setLane] = useState<Lane>("all");
  const [coverKind, setCoverKind] = useState<CoverKind>("drop");
  const [usd, setUsd] = useState(1);
  const [picked, setPicked] = useState<OptContract | null>(null);
  const [rows, setRows] = useState<ChainCover[]>([]);
  const [stocks, setStocks] = useState<ListedStock[]>([]);
  const [x, setX] = useState("");
  const [busy, setBusy] = useState(false);
  const stock = book.find((n) => n.symbol === symbol) ?? book[0] ?? null;
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";

  useEffect(() => {
    setRows(listChainCovers().filter((r) => r.status === "open"));
  }, [symbol]);

  async function signer() {
    const live = phantomProvider()?.publicKey?.toString();
    const who = live || owner || (await connectPhantom());
    if (who !== owner) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
    }
    return who;
  }

  async function buy(c: OptContract) {
    if (!stock) return;
    setBusy(true);
    try {
      const who = await signer();
      const premium = chainDebit(c.ask, usd);
      const row = await openChainCover({
        owner: who,
        kind: c.kind === "put" ? "drop" : "life",
        title: `${stock.symbol} ${c.kind} ${c.tenor}`,
        symbol: stock.symbol,
        mint: stock.mint,
        strike: c.strike,
        cover: usd,
        premium,
        days: c.tenor === "7d" ? 7 : 1,
      });
      setRows(listChainCovers().filter((r) => r.status === "open"));
      toast.success(`Premium signed. ${row.sig.slice(0, 8)}… Close returns it.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The contract did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function openCover() {
    if (!stock) return;
    setBusy(true);
    try {
      const who = await signer();
      const premium = coverPremium(coverKind, usd);
      const row = await openChainCover({
        owner: who,
        kind: coverKind,
        title: `${stock.symbol} ${coverKind === "drop5" ? "5%" : "10%"}`,
        symbol: stock.symbol,
        mint: stock.mint,
        strike: stock.last,
        cover: usd,
        premium,
        days: 1,
      });
      setRows(listChainCovers().filter((r) => r.status === "open"));
      toast.success(`Cover signed. Debit $${premium.toFixed(2)}. ${row.sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The cover did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function buyShare(mint: string, label: string) {
    setBusy(true);
    try {
      const who = await signer();
      const done = await runPrestock({ owner: who, mint, side: "buy", usd, price: stock?.last });
      toast.success(`Signed ${label}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The buy did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function showStocks() {
    setProduct("xstock");
    if (stocks.length) return;
    const book = await getEquityBook().catch(() => null);
    const list = book?.stocks ?? [];
    setStocks(list);
    setX(list[0]?.symbol ?? "");
  }

  async function close(row: ChainCover) {
    setBusy(true);
    try {
      const who = await signer();
      const sig = await cancelChainCover(row, who);
      setRows(listChainCovers().filter((r) => r.status === "open"));
      toast.success(`Closed. $${row.premium.toFixed(2)} is back. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The close did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto">
        {(
          [
            ["all", "All"],
            ["option", "Option"],
            ["pay", "Payment"],
            ["work", "Work"],
            ["gift", "Gift"],
            ["invest", "Invest"],
            ["pair", "Pair"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setLane(id)}
            className={cn("min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold", lane === id ? "bg-accent text-accent-fg" : "border border-white/15 text-muted")}
          >
            {label}
          </button>
        ))}
      </div>
      {lane === "all" ? <ContractBoard onOpen={setLane} /> : null}
      {lane === "pay" || lane === "gift" || lane === "invest" ? <HoldDesk names={names} kind={lane} /> : null}
      {lane === "work" ? <WorkContracts /> : null}
      {lane === "pair" ? <PairContracts owner={owner} connect={signer} /> : null}
      {lane === "option" ? (
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-3">
        <p className="px-2 font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Names</p>
        <ul className="mt-2 max-h-[32rem] space-y-1 overflow-y-auto">
          {book.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  setSymbol(n.symbol);
                  setPicked(null);
                }}
                className={cn("flex w-full items-center justify-between rounded-xl px-2 py-2 text-left", n.symbol === stock?.symbol ? "bg-accent/15" : "hover:bg-white/5")}
              >
                <span className="text-sm font-semibold">{n.symbol}</span>
                <span className="font-mono text-xs tabular-nums">{formatUsd(n.last)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        {stock?.mint ? <PrintChart mint={stock.mint} symbol={stock.symbol} className="mb-4 h-[220px]" /> : null}
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["chain", "Call / put"],
              ["cover", "Cover"],
              ["share", "The share"],
              ["xstock", "xStock"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => (id === "xstock" ? void showStocks() : setProduct(id))}
              className={cn("min-h-10 rounded-full px-3 text-sm font-semibold", product === id ? "bg-accent text-accent-fg" : "border border-white/15 text-muted")}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          {product === "chain" ? `${stock ? `${stock.symbol} last ${formatUsd(stock.last)}. ` : ""}The debit is the size times the price on the chain, and at least $0.25. Close returns it. Nothing extra is paid through the strike.` : null}
          {product === "cover" ? "A 10% cover pays attention if the last falls through 90% of this print. A 5% cover uses 95%. The debit is the premium. Close returns it before that." : null}
          {product === "share" ? "This buys the token through Jupiter. It lands in this Phantom. It is not a debit." : null}
          {product === "xstock" ? "A listed share. Same Jupiter signature. Phantom signs the buy." : null}
        </p>
        <div className="mt-3 flex gap-1">
          {[1, 5, 25].map((n) => (
            <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/15 text-muted")}>
              ${n}
            </button>
          ))}
        </div>
        {product === "chain" ? (
          <>
            <div className="mt-4">
              <OptionChain stock={stock} tenor={tenor} onTenor={setTenor} busy={busy} onBuy={setPicked} pickedId={picked?.id} />
            </div>
            <button
              type="button"
              disabled={!picked || !stock || busy}
              onClick={() => picked && void buy(picked)}
              className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
            >
              {picked ? `Sign ${picked.kind} · $${chainDebit(picked.ask, usd).toFixed(2)} debit` : "Tap a call or a put"}
            </button>
          </>
        ) : null}
        {product === "cover" && stock ? (
          <>
            <div className="mt-4 flex gap-1">
              <button type="button" onClick={() => setCoverKind("drop")} className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold", coverKind === "drop" ? "bg-white text-black" : "border border-white/15")}>
                10% · ${coverPremium("drop", usd).toFixed(2)}
              </button>
              <button type="button" onClick={() => setCoverKind("drop5")} className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold", coverKind === "drop5" ? "bg-white text-black" : "border border-white/15")}>
                5% · ${coverPremium("drop5", usd).toFixed(2)}
              </button>
            </div>
            <p className="mt-3 text-sm text-muted">Strike {formatUsd(stock.last)}. Size ${usd}. The share stays in the wallet until a settle that has actually fallen through.</p>
            <button type="button" disabled={busy} onClick={() => void openCover()} className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
              Sign the cover
            </button>
          </>
        ) : null}
        {product === "share" && stock ? (
          <button type="button" disabled={busy} onClick={() => void buyShare(stock.mint, stock.symbol)} className="mt-4 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            Sign ${usd} of {stock.symbol}
          </button>
        ) : null}
        {product === "xstock" ? (
          <>
            <select value={x} onChange={(e) => setX(e.target.value)} className="mt-4 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm">
              {stocks.map((s) => (
                <option key={s.mint} value={s.symbol}>
                  {s.symbol} · {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !stocks.find((s) => s.symbol === x)}
              onClick={() => {
                const stock = stocks.find((s) => s.symbol === x);
                if (stock) void buyShare(stock.mint, stock.symbol);
              }}
              className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
            >
              Sign ${usd} of {x || "the share"}
            </button>
          </>
        ) : null}
        <ul className="mt-4 space-y-2">
          {rows.length === 0 ? <li className="text-sm text-muted">No open contract in this browser.</li> : null}
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-3 py-3">
              <div>
                <p className="text-sm font-semibold">{kindLabel(row)} {row.symbol}</p>
                <p className="mt-1 text-xs text-muted">Strike {formatUsd(row.strike)} · debit ${row.premium.toFixed(2)} · size ${row.cover.toFixed(2)}</p>
              </div>
              <button type="button" disabled={busy} onClick={() => void close(row)} className="min-h-10 rounded-full border border-white/15 px-3 text-xs font-semibold">
                Close
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
    ) : null}
    </div>
  );
}

function PairContracts({ owner, connect }: { owner: string; connect: () => Promise<string> }) {
  const [rows, setRows] = useState<PairContract[]>(() => listPairs());
  const [busy, setBusy] = useState("");
  const open = rows.filter((row) => !row.closed);

  async function close(row: PairContract) {
    setBusy(row.id);
    try {
      await closePair(await connect(), row);
      setRows(listPairs());
      toast.success(`${row.symbol} sold back to USDC.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The close did not sign.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Pair</p>
      <h2 className="mt-1 text-xl font-semibold">The token is the contract.</h2>
      <p className="mt-2 text-sm text-muted">
        {owner ? "Opened on Trade. Close sells the token back to USDC." : "Connect Phantom to close one."} A pair with no token on Solana is not written here.
      </p>
      <a href="/invest" className="mt-3 inline-flex min-h-10 items-center rounded-full bg-white px-4 text-xs font-semibold text-black">Open a pair</a>
      <ul className="mt-4 space-y-2">
        {open.length === 0 ? <li className="text-sm text-muted">None open.</li> : null}
        {open.map((row) => (
          <li key={row.id} className="rounded-2xl border border-white/10 px-3 py-3">
            <p className="font-mono text-lg">{row.pair}</p>
            <p className="mt-1 text-sm">{row.got > 0 ? row.got.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—"} {row.symbol} · ${row.usd.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted">{row.terms}</p>
            <button type="button" disabled={busy !== ""} onClick={() => void close(row)} className="mt-2 min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">
              {busy === row.id ? "Waiting" : "Sell it back"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
