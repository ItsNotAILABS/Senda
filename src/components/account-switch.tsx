import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const PANES = [
  { href: "/more", label: "This account" },
  { href: "/profile", label: "Profile" },
  { href: "/accounts", label: "Venue links" },
] as const;

/** One account. These are the pieces, not extra tabs. */
export function AccountSwitch() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const value = pathname.startsWith("/profile") ? "/profile" : pathname.startsWith("/accounts") ? "/accounts" : "/more";

  return (
    <div className="flex gap-1 overflow-x-auto px-3 pt-3 lg:px-4">
      {PANES.map((row) => (
        <Link
          key={row.href}
          to={row.href}
          className={cn("inline-flex h-9 shrink-0 items-center rounded-full px-3 text-xs font-semibold", value === row.href ? "bg-white text-black" : "bg-white/10 text-white/70")}
        >
          {row.label}
        </Link>
      ))}
    </div>
  );
}
