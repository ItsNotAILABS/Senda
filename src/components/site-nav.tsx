import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { EVENT, NAV } from "@/lib/event";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("event");
  const [open, setOpen] = useState(false);
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = NAV.map((n) => n.id);
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.25, 0.5] },
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function go(id: string) {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-200",
        scrolled
          ? "border-border bg-bg/90 shadow-panel backdrop-blur-md"
          : "border-transparent bg-bg/40 backdrop-blur-sm",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <a
          href="#event"
          onClick={(e) => {
            e.preventDefault();
            go("event");
          }}
          className="flex shrink-0 items-center gap-2"
        >
          <span className="grid size-8 place-items-center rounded-md bg-elevated">
            <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
              <path
                d="M16 5 L26 16 L16 27 L6 16 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                className="text-accent"
              />
              <circle cx="16" cy="16" r="2.4" className="fill-fg" />
            </svg>
          </span>
          <span className="font-display text-sm font-semibold tracking-tight">
            {EVENT.name}
          </span>
        </a>

        <nav className="ml-4 hidden flex-1 items-center justify-center gap-1 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                go(item.id);
              }}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors duration-150",
                active === item.id
                  ? "bg-elevated text-fg"
                  : "text-muted hover:text-fg",
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isPending ? (
            <div className="size-8 animate-pulse rounded-full bg-elevated" />
          ) : (
            <>
              <SignedOut>
                <Link
                  to="/login"
                  className="hidden text-sm text-muted hover:text-fg sm:inline"
                >
                  Sign in
                </Link>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </>
          )}
          <Button
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => go("rsvp")}
          >
            Reserve a seat
          </Button>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-md text-fg lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border bg-bg px-4 py-3 lg:hidden">
          <nav className="flex flex-col">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(item.id);
                }}
                className={cn(
                  "rounded-md px-3 py-3 text-base",
                  active === item.id ? "bg-elevated text-fg" : "text-muted",
                )}
              >
                {item.label}
              </a>
            ))}
            {!user && !isPending ? (
              <Link to="/login" className="rounded-md px-3 py-3 text-base text-muted">
                Sign in
              </Link>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
