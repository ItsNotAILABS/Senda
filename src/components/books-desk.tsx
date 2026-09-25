import { FilmBand } from "@/components/film-band";
import { digestBooks } from "@/lib/books";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function BooksDesk() {
  const { w, usdPer } = useWallet();
  const d = digestBooks(w, usdPer);

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <header className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-6 lg:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Books</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-4xl leading-[1.05] tracking-tight lg:text-5xl">
            Digest <span className="font-mono text-accent">{d.id}</span>
          </h1>
          <p className={cn("rounded-full px-3 py-1 text-sm font-semibold", d.tied ? "bg-accent text-accent-fg" : "bg-down/20 text-down")}>
            {d.tied ? "The books tie" : "The books do not tie"}
          </p>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          This replays every send, card, cover, and buy in this account and checks it against the cash you can still spend. Suspense is the gap. Ghost is what a one-time number can still charge. It is the app's own book, not a chain balance.
        </p>
      </header>
      <FilmBand poster="/images/term-sheet.jpg" label="The books, replayed." />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat k="Assets" v={d.assets} line="Cash plus stock at cost" />
        <Stat k="Capital" v={d.equity} line="What the books say you own" />
        <Stat k="Suspense" v={d.suspense} line="Journal versus the balance" />
        <Stat k="Ghost" v={d.ghost} line="Still chargeable on a number" />
      </dl>
      <section className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#10131c]">
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

function Stat({ k, v, line }: { k: string; v: number; line: string }) {
  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-[#10131c] px-4 py-4">
      <dt className="text-xs text-subtle">{k}</dt>
      <dd className="mt-1 font-mono text-2xl">{v.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
      <p className="mt-1 text-xs text-muted">{line}</p>
    </div>
  );
}
