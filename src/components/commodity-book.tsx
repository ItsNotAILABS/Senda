import { useEffect, useState } from "react";
import { FillButton } from "@/components/fill-button";
import { worldBook, type WorldRow } from "@/lib/world-book";
import { cn } from "@/lib/utils";

const NAME: Record<string, string> = {
  "XAU-USD": "Gold",
  "XAG-USD": "Silver",
  "XPT-USD": "Platinum",
  "XPD-USD": "Palladium",
  "XCU-USD": "Copper",
  "REMX-USD": "Rare earth",
  "DRAM-USD": "Memory",
  "WTI-USD": "WTI crude",
  "BRENT-USD": "Brent crude",
  "DIESEL-USD": "Diesel",
  "UNG-USD": "Natural gas",
  "XLE-USD": "Energy basket",
  "URA-USD": "Uranium miners",
  "XOM-USD": "Exxon",
  "CVX-USD": "Chevron",
  "SHEL-USD": "Shell",
  "COCOA-USD": "Cocoa",
  "COFFEE-USD": "Coffee",
  "COTTON-USD": "Cotton",
  "SUGAR-USD": "Sugar",
};

const GROUPS = [
  ["metals", "Metals"],
  ["energy", "Energy"],
  ["softs", "Softs"],
] as const;

function px(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n >= 100 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function CommodityBook() {
  const [rows, setRows] = useState<WorldRow[]>([]);
  const [note, setNote] = useState("Loading the prints…");
  const [usd, setUsd] = useState(5);
  const [sort, setSort] = useState<"book" | "name" | "price">("book");

  useEffect(() => {
    let live = true;
    const pull = () => {
      worldBook()
        .then((book) => {
          if (!live) return;
          setRows(book.filter((r) => r.lane === "metals" || r.lane === "energy" || r.lane === "softs"));
          setNote("");
        })
        .catch(() => live && setNote("The commodity prints did not load."));
    };
    pull();
    const id = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  const ordered = [...rows].sort((a, b) => {
    if (sort === "name") return a.base.localeCompare(b.base);
    if (sort === "price") return (b.mid ?? 0) - (a.mid ?? 0);
    return 0;
  });
  const groups = sort === "book" ? GROUPS.map(([id, label]) => ({ label, rows: ordered.filter((r) => r.lane === id) })) : [{ label: "Book", rows: ordered }];

  return (
    <div className="px-3 py-3">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Commodities</p>
      <h2 className="mt-1 text-2xl font-semibold">The book</h2>
      <p className="mt-1 text-sm text-white/55">{rows.length} prints. Gold and silver sign on Solana. The rest are the live print until a token is on the book.</p>
      <div className="mt-3 flex gap-2">
        {[1, 5, 25].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("grid size-11 place-items-center rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/15")}>
            ${n}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        {(
          [
            ["book", "Book"],
            ["name", "Name"],
            ["price", "Price"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSort(id)} className={cn("min-h-8 rounded-full px-3 text-xs font-semibold", sort === id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
            {label}
          </button>
        ))}
      </div>
      {note ? <p className="mt-3 text-sm text-white/45">{note}</p> : null}
      {groups.map((group) => (
        <section key={group.label} className="mt-4">
          <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">{group.label}</p>
          <ul className="mt-2 divide-y divide-white/10 rounded-[22px] bg-[#101114] px-3">
            {group.rows.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{NAME[r.id] ?? r.base}</p>
                    <p className="text-xs text-white/45">
                      {r.id}
                      {r.open === false ? " · Closed" : r.open ? " · Open" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{px(r.mid)}</p>
                    <p className="font-mono text-[11px] text-white/40">
                      {px(r.bid)} / {px(r.ask)}
                    </p>
                  </div>
                </div>
                {r.hold ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <FillButton mint={r.hold.mint} usd={usd} price={r.spot ?? r.mid ?? undefined} symbol={r.hold.symbol} label={`Buy $${usd} ${r.hold.symbol}`} className="min-h-10 rounded-full bg-[#d7e36a] text-sm font-semibold text-black" />
                    <FillButton mint={r.hold.mint} usd={usd} side="sell" price={r.spot ?? r.mid ?? undefined} symbol={r.hold.symbol} label={`Sell $${usd} ${r.hold.symbol}`} className="min-h-10 rounded-full border border-white/15 text-sm font-semibold" />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-white/40">Print only. No Solana token on this row.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
