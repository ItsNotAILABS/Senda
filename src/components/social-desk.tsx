import { useState } from "react";
import { toast } from "sonner";
import { PlayDesk } from "@/components/play-desk";
import { applyHouseDrop, loadHouseBook, saveHouseBook } from "@/lib/house-paper";
import { loadPlay } from "@/lib/play";
import { loadFeed, pushPost } from "@/lib/social";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { formatMoney } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function SocialDesk({ house }: { house: HouseListing[] }) {
  const w = useWallet();
  const pre = house.filter((h) => h.venue === "prestocks");
  const [tab, setTab] = useState<"feed" | "games" | "board">("feed");
  const [feed, setFeed] = useState(loadFeed);
  const games = loadPlay();
  const book = loadHouseBook();

  function copy(symbol: string, id: string, last: number) {
    const spend = 25;
    const r = w.investOut(spend, `copy ${symbol}`);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    saveHouseBook(applyHouseDrop(loadHouseBook(), id, "yes", spend, last));
    setFeed(pushPost(feed, { tag: w.w.tag, kind: "copy", text: `Copied ${symbol} · $25`, symbol }));
    toast.success(`Copied ${symbol}`);
  }

  const board = games.reduce<Record<string, number>>((acc, g) => {
    acc[g.tag] = (acc[g.tag] ?? 0) + g.pnl;
    return acc;
  }, {});
  const ranks = Object.entries(board).sort((a, b) => b[1] - a[1]);

  return (
    <main className="flex flex-1 flex-col">
      <header className="px-5 pt-6 pb-3">
        <h1 className="font-display text-4xl tracking-tight">Social</h1>
        <p className="mt-1 text-sm text-muted">
          Games, copy a name, tape of the book. Same cash. PreStocks only.
        </p>
      </header>
      <div className="flex gap-1 overflow-x-auto px-4 pb-3">
        {(
          [
            ["feed", "Tape"],
            ["games", "Games"],
            ["board", "Board"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold",
              tab === id ? "bg-fg text-bg" : "bg-elevated text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "games" ? <PlayDesk house={house} /> : null}
      {tab === "board" ? (
        <ul className="px-5">
          {ranks.length === 0 ? (
            <p className="py-8 text-sm text-subtle">Play a game to rank.</p>
          ) : (
            ranks.map(([tag, pnl], i) => (
              <li key={tag} className="flex items-center justify-between border-b border-border py-3">
                <p className="text-sm">
                  {i + 1}. {tag}
                </p>
                <p className={cn("font-mono text-sm", pnl < 0 ? "text-down" : "text-up")}>
                  {pnl >= 0 ? "+" : ""}
                  {formatMoney(pnl)}
                </p>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {tab === "feed" ? (
        <div className="px-4 pb-8">
          <p className="mb-3 text-xs font-medium tracking-wide text-subtle uppercase">Copy · $25</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {pre.slice(0, 10).map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => copy(h.symbol, h.id, h.last)}
                className="min-h-11 shrink-0 rounded-full bg-elevated px-4 text-sm font-semibold"
              >
                {h.symbol}
              </button>
            ))}
          </div>
          {feed.length === 0 && Object.keys(book).length === 0 ? (
            <p className="mt-8 text-sm text-subtle">Nothing on the tape yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {feed.map((p) => (
                <li key={p.id} className="py-3">
                  <p className="text-sm font-medium">{p.text}</p>
                  <p className="font-mono text-xs text-subtle">
                    {p.tag} · {p.kind}
                  </p>
                </li>
              ))}
              {pre
                .filter((h) => (book[h.id]?.shares ?? 0) !== 0)
                .map((h) => (
                  <li key={h.id} className="py-3">
                    <p className="text-sm font-medium">
                      Holding {h.symbol} · last {formatUsd(h.last)}
                    </p>
                    <p className="font-mono text-xs text-subtle">{w.w.tag} · book</p>
                  </li>
                ))}
            </ul>
          )}
        </div>
      ) : null}
    </main>
  );
}
