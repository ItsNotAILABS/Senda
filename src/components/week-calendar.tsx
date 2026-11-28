const WEEK: { day: string; names: string[] }[] = [
  { day: "Mon 26", names: ["VZ", "CLS", "CDNS", "NUE", "WELL", "HIG"] },
  { day: "Tue 27", names: ["HOOD", "V", "SOFI", "BA", "KO", "PYPL", "CMG", "STX", "WM"] },
  { day: "Wed 28", names: ["GOOGL", "MSFT", "NOW", "TMUS", "KLAC", "CVNA"] },
  { day: "Thu 29", names: ["AMZN", "INTC", "LLY", "COIN", "MSTR", "SNDK", "CAT", "MRK"] },
  { day: "Fri 30", names: ["XOM", "CVX", "ABBV", "AZN", "BP"] },
];

/** The week on the card. A name opens the book. Earnings figures are not invented here. */
export function WeekCalendar({ onOpen }: { onOpen: (symbol: string) => void }) {
  return (
    <div className="border-b border-white/10 px-3 py-2">
      <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">Oct 26–30</p>
      <div className="mt-2 flex gap-2 overflow-x-auto">
        {WEEK.map((col) => (
          <div key={col.day} className="min-w-[7.5rem] shrink-0">
            <p className="text-[11px] font-semibold text-white/70">{col.day}</p>
            <ul className="mt-1">
              {col.names.map((name) => (
                <li key={name}>
                  <button type="button" onClick={() => onOpen(name)} className="font-mono text-[11px] text-accent">{name}</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
