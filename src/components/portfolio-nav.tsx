import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function PortfolioNav({ current }: { current: "holdings" | "loans" }) {
  const item = "min-h-10 rounded-full px-4 text-sm font-semibold";
  return (
    <div className="flex gap-1">
      <Link to="/vault" className={cn(item, current === "holdings" ? "bg-white text-black" : "border border-white/15 text-muted")}>
        Holdings
      </Link>
      <Link to="/loans" className={cn(item, current === "loans" ? "bg-white text-black" : "border border-white/15 text-muted")}>
        Loans
      </Link>
    </div>
  );
}
