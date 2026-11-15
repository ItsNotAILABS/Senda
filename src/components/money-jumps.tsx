import { useNavigate } from "@tanstack/react-router";

const JUMPS: { href: string; label: string }[] = [
  { href: "/vault/loans", label: "Loans" },
  { href: "/invest?desk=perps", label: "Leverage" },
  { href: "/invest/world", label: "FX" },
  { href: "/invest?desk=world", label: "FX leverage" },
  { href: "/invest?desk=kalshi", label: "Kalshi" },
  { href: "/invest?desk=slabs", label: "Slabs" },
  { href: "/invest?desk=poly", label: "Polymarket" },
  { href: "/social", label: "Games" },
  { href: "/invest?desk=prog", label: "Programs" },
  { href: "/cards", label: "Cards" },
  { href: "/payments/add", label: "On-ramp" },
  { href: "/payments/usdc", label: "Cash out" },
];

/** One strip so the money desks can see each other. Each href is a desk that already exists. */
export function MoneyJumps({ here }: { here?: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex gap-1 overflow-x-auto">
      {JUMPS.filter((row) => row.href !== here).map((row) => (
        <button
          key={row.href}
          type="button"
          onClick={() => void navigate({ href: row.href })}
          className="min-h-9 shrink-0 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/80"
        >
          {row.label}
        </button>
      ))}
    </div>
  );
}
