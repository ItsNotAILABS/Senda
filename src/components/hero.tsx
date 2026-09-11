import { ArrowDown, MapPin } from "lucide-react";
import { EVENT } from "@/lib/event";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/countdown";

export function Hero() {
  return (
    <section id="event" className="relative scroll-mt-16">
      <div className="relative isolate min-h-[calc(100dvh-4rem)] overflow-hidden">
        <img
          src="/images/hero.jpg"
          alt="Vice Park rooftop terrace in Dallas, empty before doors, pool reflecting ember light and the skyline."
          className="absolute inset-0 size-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
        />
        <div className="absolute inset-0 bg-linear-to-b from-bg/40 via-bg/55 to-bg" />
        <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col justify-end gap-8 px-4 pb-16 pt-20 sm:px-6 sm:pb-20">
          <div className="max-w-3xl space-y-5">
            <p className="font-mono text-xs tracking-widest text-accent uppercase">
              Shipaton 2026 · {EVENT.city}
            </p>
            <h1 className="font-display text-5xl font-semibold tracking-tight text-fg sm:text-6xl md:text-7xl">
              {EVENT.name}
            </h1>
            <p className="max-w-xl text-lg text-fg/90 sm:text-xl">
              {EVENT.tagline}
            </p>
            <p className="max-w-xl text-sm text-muted sm:text-base">
              {EVENT.blurb}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
              <span className="text-fg">{EVENT.dateLabel}</span>
              <span aria-hidden className="text-subtle">
                /
              </span>
              <span>{EVENT.timeLabel}</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-accent" aria-hidden />
                {EVENT.venue}, Dallas
              </span>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                size="lg"
                onClick={() =>
                  document.getElementById("rsvp")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                Reserve a seat
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() =>
                  document.getElementById("agenda")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                See the agenda
                <ArrowDown className="size-4" />
              </Button>
            </div>
          </div>
          <div className="max-w-xl">
            <Countdown />
          </div>
        </div>
      </div>
    </section>
  );
}
