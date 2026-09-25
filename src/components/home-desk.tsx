import { Link } from "@tanstack/react-router";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

const NEXT = [
  {
    to: "/pre",
    kicker: "Buy",
    title: "The book is open",
    body: "SpaceX, OpenAI, Anthropic. A Jupiter swap from the USDC or SOL already in Phantom.",
  },
  {
    to: "/social",
    kicker: "Play",
    title: "Which name moves",
    body: "A short window on the live print. The winner is the one that actually moves. The fill is still Jupiter.",
  },
  {
    to: "/agents",
    kicker: "Agents",
    title: "They can send. You sign.",
    body: "An agent picks a name off the mark. Your wallet approves the size. The key never leaves Phantom.",
  },
] as const;

export function HomeDesk({ names }: { names: HouseListing[] }) {
  const pre = names
    .filter((n) => n.venue === "prestocks" && n.last > 0)
    .sort((a, b) => Math.abs(b.premium ?? 0) - Math.abs(a.premium ?? 0));

  return (
    <main>
      <section className="border-b border-border px-6 py-10 lg:px-10">
        <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">
          <span className="mr-2 inline-block size-1.5 rounded-full bg-accent align-middle" />
          Solana · live · Jupiter
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl tracking-tight lg:text-6xl">
          Pre-IPO,{" "}
          <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">while the market sleeps.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          These companies are not on the NYSE. They already trade as tokens on Solana. Senda is where you buy one, then do something with it.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/pre" className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
            Open the book
          </Link>
          <Link to="/wallet" className="inline-flex min-h-11 items-center rounded-full bg-elevated px-5 text-sm font-semibold">
            Pay with the SOL you have
          </Link>
        </div>
        <ol className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
          {[
            ["01", "Connect", "Phantom stays the wallet. Senda never holds the key."],
            ["02", "Swap", "Jupiter turns USDC or SOL into the PreStock mint."],
            ["03", "Use it", "Hold it, play the move, or let an agent send a size you cap."],
          ].map(([n, t, d]) => (
            <li key={n} className="rounded-2xl border border-border bg-surface px-4 py-3">
              <p className="font-mono text-[11px] text-sol">{n}</p>
              <p className="mt-1 text-sm font-semibold">{t}</p>
              <p className="mt-1 text-xs text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-b border-border">
        <div className="flex items-baseline justify-between px-6 py-4 lg:px-10">
          <h2 className="text-lg">On the print now</h2>
          <Link to="/pre" className="text-sm text-accent">
            Full book
          </Link>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-subtle">
            <tr>
              <th className="px-6 py-2 font-medium lg:px-10">Name</th>
              <th className="px-2 py-2 text-right font-medium">Token</th>
              <th className="px-2 py-2 text-right font-medium">Mark</th>
              <th className="px-6 py-2 text-right font-medium lg:px-10">Vs mark</th>
            </tr>
          </thead>
          <tbody>
            {pre.slice(0, 6).map((n) => (
              <tr key={n.id} className="border-t border-border">
                <td className="px-6 py-3 lg:px-10">
                  <Link to="/pre" className="font-semibold hover:text-accent">
                    {n.symbol}
                  </Link>
                  <span className="mt-0.5 block font-mono text-[11px] text-subtle">
                    {n.mint.slice(0, 4)}…{n.mint.slice(-4)}
                  </span>
                </td>
                <td className="px-2 py-3 text-right font-mono tabular-nums">{formatUsd(n.last)}</td>
                <td className="px-2 py-3 text-right font-mono tabular-nums text-muted">{formatUsd(n.mark)}</td>
                <td className={cn("px-6 py-3 text-right font-mono tabular-nums lg:px-10", (n.premium ?? 0) < 0 ? "text-up" : "text-down")}>
                  {formatPremium(n.premium)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pre.length === 0 ? <p className="px-6 py-8 text-sm text-muted">PreStocks did not answer.</p> : null}
      </section>

      <section className="grid gap-3 px-6 py-8 lg:grid-cols-3 lg:px-10">
        {NEXT.map((c) => (
          <Link key={c.to} to={c.to} className="rounded-2xl border border-border bg-surface px-5 py-5 hover:border-[#9945FF]">
            <p className="font-mono text-[11px] tracking-widest text-accent uppercase">{c.kicker}</p>
            <p className="mt-2 text-xl">{c.title}</p>
            <p className="mt-2 text-sm text-muted">{c.body}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
