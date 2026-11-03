import type { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type ProductPage = { href: string; label: string; hint: string };

function lit(path: string, href: string, pages: ProductPage[]) {
  if (path === href) return true;
  const child = pages.some((p) => p.href !== href && (path === p.href || path.startsWith(`${p.href}/`)));
  if (child) return false;
  return path.startsWith(`${href}/`);
}

export function ProductShell({
  title,
  pages,
  children,
}: {
  title: string;
  pages: ProductPage[];
  children: ReactNode;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[calc(100dvh-4.25rem)] flex-col lg:flex-row">
      <nav className="hidden shrink-0 lg:flex lg:w-56 lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:border-r lg:border-white/10 lg:bg-[#090b10] lg:px-2 lg:py-3">
        <p className="hidden px-2 pt-1 pb-2 text-[10px] tracking-[0.18em] text-subtle uppercase lg:block">{title}</p>
        {pages.map((p) => {
          const on = lit(path, p.href, pages);
          return (
            <button
              key={p.href}
              type="button"
              onClick={() => void navigate({ href: p.href })}
              className={cn(
                "shrink-0 rounded-xl px-3 py-2 text-left lg:w-full",
                on ? "bg-white/10" : "hover:bg-white/5",
              )}
            >
              <span className={cn("block text-[13px]", on ? "font-semibold text-fg" : "text-muted")}>{p.label}</span>
              <span className="hidden text-[11px] leading-snug text-subtle lg:block">{p.hint}</span>
            </button>
          );
        })}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
