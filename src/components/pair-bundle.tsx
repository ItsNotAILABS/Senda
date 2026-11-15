import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DERIVS, type DerivRow } from "@/lib/deriv-book";
import { USDC } from "@/lib/jup-exec";
import { signRoute } from "@/lib/jup-sign";
import { quoteHeld } from "@/lib/money-picture";
import { closePair, listPairs, rememberPair, type PairContract } from "@/lib/pair-contract";
import { connectPhantom, readChain, splHolding } from "@/lib/phantom";
import { rememberTrade } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

/** A pair is the token in the wallet. One signature. The contract is the fill. */

export function PairBundle({ rows }: { rows: DerivRow[] }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const book = rows.filter((r) => r.hold);
  const [id, setId] = useState(book[0]?.id || "eurusd");
  const [usd, setUsd] = useState("25");
  const [busy, setBusy] = useState("");
  const [tickets, setTickets] = useState<PairContract[]>(() => (typeof window === "undefined" ? [] : listPairs()));
  const row = book.find((r) => r.id === id) ?? book[0];

  async function who() {
    const addr = owner || (await connectPhantom());
    if (!owner) {
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
    }
    return addr;
  }

  async function open() {
    if (!row?.hold) return;
    const n = Number(usd);
    if (!(n >= 1)) {
      toast.error("A pair takes at least $1 of USDC.");
      return;
    }
    setBusy("open");
    try {
      const addr = await who();
      const signed = await signRoute({
        owner: addr,
        inputMint: USDC,
        outputMint: row.hold.mint,
        amountRaw: Math.round(n * 1_000_000),
        outDecimals: 6,
        usd: n,
      });
      const held = await splHolding(addr, row.hold.mint).catch(() => null);
      const got = held && held.ui > 0 ? held.ui : signed.outUi;
      const all = rememberPair({
        id: crypto.randomUUID(),
        pair: `${row.base}/${row.quote}`,
        symbol: row.hold.symbol,
        mint: row.hold.mint,
        usd: n,
        got,
        paid: got > 0 ? n / got : 0,
        signature: signed.signature,
        at: Date.now(),
      });
      rememberTrade({ symbol: row.hold.symbol, side: "buy", usd: n, mint: row.hold.mint, signature: signed.signature });
      setTickets(all);
      toast.success(`Long ${row.base}. The contract is the ${row.hold.symbol} in the wallet.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The pair did not sign.");
    } finally {
      setBusy("");
    }
  }

  async function close(ticket: PairContract) {
    setBusy(ticket.id);
    try {
      const addr = await who();
      const sold = await closePair(addr, ticket);
      rememberTrade({ symbol: ticket.symbol, side: "sell", usd: ticket.usd, mint: ticket.mint, signature: sold });
      setTickets(listPairs());
      toast.success(`${ticket.symbol} sold back to USDC.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The close did not sign.");
    } finally {
      setBusy("");
    }
  }

  if (!row?.hold) return null;

  return (
    <section className="mb-4 rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">The pair</p>
      <h2 className="mt-1 text-xl font-semibold">You hold the currency. The contract is that token.</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        EUR/USD is EURC. Gold is the gold token. One signature. Phantom shows the token. The same contract is on Contracts. Platinum, oil, and the yen have no token here, so they are not written as a contract.
      </p>
      <div className="mt-3 flex gap-1 overflow-x-auto">
        {book.map((item) => (
          <button key={item.id} type="button" onClick={() => setId(item.id)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${item.id === row.id ? "bg-white text-black" : "bg-white/10"}`}>
            {item.base}/{item.quote}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px]">
        <div>
          <p className="font-mono text-3xl">{row.base}/{row.quote}</p>
          <p className="mt-1 text-sm text-muted">{row.hold.note}</p>
          <p className="mt-2 font-mono text-sm text-white/70">
            Print {row.mid == null ? "not loaded" : row.mid.toLocaleString("en-US", { maximumFractionDigits: row.mid >= 20 ? 2 : 5 })}
            {row.spot != null ? ` · token $${row.spot.toLocaleString("en-US", { maximumFractionDigits: row.spot >= 20 ? 2 : 4 })}` : ""}
          </p>
        </div>
        <div>
          <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="USDC for the pair" className="w-full bg-transparent font-mono text-4xl outline-none" />
          <button type="button" disabled={busy !== ""} onClick={() => void open()} className="mt-2 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            {busy === "open" ? "Waiting on Phantom" : `Long ${row.base}`}
          </button>
        </div>
      </div>
      <PairHoldings owner={owner} />
      <ul className="mt-4 space-y-2">
        {tickets.length === 0 ? <li className="text-sm text-muted">No contract yet. A long writes one after the signature.</li> : null}
        {tickets.map((ticket) => (
          <li key={ticket.id} className="rounded-2xl border border-white/10 px-3 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-mono text-lg">{ticket.pair}</p>
              <p className="text-xs text-subtle">{ticket.closed ? "Closed" : "Open"} · {new Date(ticket.at).toLocaleString()}</p>
            </div>
            <p className="mt-1 text-sm">
              {ticket.got > 0 ? ticket.got.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—"} {ticket.symbol}
              {" · "}paid ${ticket.usd.toFixed(2)}
              {ticket.paid > 0 ? ` · ${ticket.paid.toLocaleString("en-US", { maximumFractionDigits: ticket.paid >= 20 ? 2 : 5 })} USDC each` : ""}
            </p>
            <p className="mt-1 text-xs text-muted">{ticket.terms}</p>
            <p className="mt-1 truncate font-mono text-[11px] text-subtle">{ticket.signature}</p>
            <div className="mt-2 flex gap-2">
              {ticket.closed ? <p className="truncate font-mono text-[11px] text-subtle">Sold · {ticket.closed}</p> : (
                <button type="button" disabled={busy !== ""} onClick={() => void close(ticket)} className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">
                  {busy === ticket.id ? "Waiting" : "Sell it back"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(`${ticket.terms} ${ticket.signature}`)}
                className="min-h-9 rounded-full border border-white/15 px-3 text-xs"
              >
                Copy the contract
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

type HoldRow = {
  tap: string;
  symbol: string;
  ui: number;
  usd: number;
  paid: number;
  each: number;
  signature: string;
};

/** What the wallet holds of each long, priced in dollars, with the fill when this browser signed it. */
export function PairHoldings({ owner }: { owner: string }) {
  const [rows, setRows] = useState<HoldRow[]>([]);
  const [sum, setSum] = useState(0);

  useEffect(() => {
    if (!owner) {
      setRows([]);
      setSum(0);
      return;
    }
    let live = true;
    const pull = () => {
      void readChain(owner)
        .then(async (chain) => {
          const tape = await quoteHeld(chain.tokens.map((token) => token.mint), []).catch(() => []);
          if (!live) return;
          const px = new Map(tape.map((row) => [row.mint, row.price]));
          const tickets = listPairs().filter((ticket) => !ticket.closed);
          const next: HoldRow[] = [];
          let dollars = 0;
          for (const pair of DERIVS) {
            if (!pair.hold) continue;
            const ui = pair.hold.symbol === "SOL" ? chain.sol : chain.tokens.find((token) => token.mint === pair.hold?.mint)?.ui || 0;
            if (!(ui > 0)) continue;
            const price = px.get(pair.hold.mint) || 0;
            const usd = ui * price;
            dollars += usd;
            const ticket = tickets.find((item) => item.mint === pair.hold?.mint);
            next.push({
              tap: `Long ${pair.base}`,
              symbol: pair.hold.symbol,
              ui,
              usd,
              paid: ticket?.usd || 0,
              each: ticket?.paid || price,
              signature: ticket?.signature || "",
            });
          }
          setRows(next);
          setSum(dollars);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  if (!owner || rows.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto">
      <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">In the wallet · ${sum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      <table className="mt-2 w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="text-[11px] tracking-[0.12em] text-subtle uppercase">
            <th className="pb-2 font-normal">You tapped</th>
            <th className="pb-2 font-normal">Phantom holds</th>
            <th className="pb-2 text-right font-normal">Dollars</th>
            <th className="pb-2 text-right font-normal">Paid</th>
            <th className="pb-2 text-right font-normal">Each</th>
            <th className="pb-2 font-normal">Signature</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-t border-white/10">
              <td className="py-2">{row.tap}</td>
              <td className="py-2 font-mono">{row.ui.toLocaleString("en-US", { maximumFractionDigits: 6 })} {row.symbol}</td>
              <td className="py-2 text-right font-mono">{row.usd > 0 ? `$${row.usd.toFixed(2)}` : "—"}</td>
              <td className="py-2 text-right font-mono">{row.paid > 0 ? `$${row.paid.toFixed(2)}` : "—"}</td>
              <td className="py-2 text-right font-mono">{row.each > 0 ? row.each.toLocaleString("en-US", { maximumFractionDigits: row.each >= 20 ? 2 : 5 }) : "—"}</td>
              <td className="py-2 font-mono text-[11px] text-subtle">{row.signature ? `${row.signature.slice(0, 8)}…` : "Held. No fill in this browser."}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
