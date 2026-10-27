import { readBook, type BotHit } from "@/lib/desk-bots";
import type { HouseListing } from "@/lib/sol-house";

/** Local read of the book on this page. It points at a name. It does not sign. */
export function DeskBots({ names, onOpen }: { names: HouseListing[]; onOpen?: (mint: string) => void }) {
  const { cheap, rich } = readBook(
    names
      .filter((row) => row.venue === "prestocks")
      .map((row) => ({ symbol: row.symbol, mint: row.mint, last: row.last, mark: row.mark })),
  );
  if (!cheap && !rich) return null;
  return (
    <div className="grid gap-2 border-b border-white/10 px-3 py-2 sm:grid-cols-2">
      <Hit title="Cheap vs mark" hit={cheap} onOpen={onOpen} />
      <Hit title="Rich vs mark" hit={rich} onOpen={onOpen} />
    </div>
  );
}

function Hit({ title, hit, onOpen }: { title: string; hit: BotHit | null; onOpen?: (mint: string) => void }) {
  if (!hit) return <p className="rounded-2xl bg-black/20 px-3 py-2 text-xs text-white/35">{title}. Nothing outside 20 bps.</p>;
  const line = `${hit.symbol} ${hit.bps > 0 ? "+" : ""}${hit.bps.toFixed(0)} bps`;
  return (
    <button type="button" onClick={() => onOpen?.(hit.mint)} className="rounded-2xl bg-black/20 px-3 py-2 text-left">
      <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">{title}</p>
      <p className="mt-1 text-sm font-semibold">{line}</p>
      <p className="text-[11px] text-white/35">Desk bot. Local. You still sign.</p>
    </button>
  );
}
