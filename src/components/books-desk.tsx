import { digestBooks } from "@/lib/books";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function BooksDesk() {
  const { w, usdPer } = useWallet();
  const d = digestBooks(w, usdPer);

  return (
    <main className="min-h-0 flex-1 overflow-auto px-6 py-6">
      <p className="text-xs tracking-wide text-subtle uppercase">Books</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl">Digest {d.id}</h1>
        <p className={cn("text-sm font-semibold", d.tied ? "text-up" : "text-down")}>{d.tied ? "Ties" : "Does not tie"}</p>
      </div>
      <p className="mt-2 max-w-xl text-sm text-muted">
        sUSD and the other cash tokens are the balances the app spends. sSTK is stock at cost. sGHOST is what live one-time numbers can still charge. sCAP is what remains. Suspense is the journal minus those balances.
      </p>
      <dl className="mt-6 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat k="Assets" v={d.assets} />
        <Stat k="Capital" v={d.equity} />
        <Stat k="Suspense" v={d.suspense} />
        <Stat k="Ghost" v={d.ghost} />
      </dl>
      <table className="mt-6 w-full max-w-3xl text-left text-sm">
        <thead className="text-xs text-subtle">
          <tr>
            <th className="py-2 font-medium">Token</th>
            <th className="py-2 font-medium">Role</th>
            <th className="py-2 text-right font-medium">Supply</th>
            <th className="py-2 text-right font-medium">USD</th>
          </tr>
        </thead>
        <tbody>
          {d.tokens.map((t) => (
            <tr key={t.code} className="border-t border-border">
              <td className="py-2">
                <span className="font-mono">{t.code}</span>
                <span className="ml-2 text-muted">{t.name}</span>
              </td>
              <td className="py-2 text-muted">{t.role}</td>
              <td className="py-2 text-right font-mono">{t.supply.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
              <td className="py-2 text-right font-mono">{t.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: number }) {
  return (
    <div className="rounded-xl bg-elevated px-3 py-3">
      <dt className="text-xs text-subtle">{k}</dt>
      <dd className="mt-1 font-mono text-lg">{v.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
    </div>
  );
}
