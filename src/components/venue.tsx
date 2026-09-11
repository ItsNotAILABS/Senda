import { MapPin, Train, SquareParking } from "lucide-react";
import { EVENT } from "@/lib/event";

export function Venue() {
  return (
    <section
      id="venue"
      className="scroll-mt-16 border-t border-border bg-surface py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="mb-12 max-w-2xl">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Venue
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Vice Park, Dallas.
          </h2>
          <p className="mt-3 text-muted">
            Nightclub, rooftop, and pool club on Gaston. Doors on the estate
            drive. Keynotes in The House. Core Circle dinner in the Sky Club.
          </p>
        </header>
        <div className="grid gap-6 lg:grid-cols-5">
          <figure className="overflow-hidden rounded-2xl lg:col-span-3">
            <img
              src="/images/venue.jpg"
              alt="Night exterior of Vice Park on Gaston Avenue, rooftop terrace glowing over Dallas."
              className="aspect-wide size-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
            />
          </figure>
          <div className="flex flex-col gap-5 rounded-2xl bg-elevated p-5 shadow-panel lg:col-span-2">
            <div>
              <h3 className="font-display text-lg font-semibold tracking-tight">
                Wayfinding
              </h3>
              <p className="mt-1 text-sm text-muted">
                Schematic of the block — not a live map. The pin is the estate
                drive.
              </p>
            </div>
            <BlockMap />
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  <span className="block font-medium">{EVENT.venue}</span>
                  <span className="text-muted">{EVENT.address}</span>
                </span>
              </li>
              <li className="flex gap-3">
                <Train className="mt-0.5 size-4 shrink-0 text-accent" />
                <span className="text-muted">{EVENT.transit}</span>
              </li>
              <li className="flex gap-3">
                <SquareParking className="mt-0.5 size-4 shrink-0 text-accent" />
                <span className="text-muted">{EVENT.parking}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function BlockMap() {
  return (
    <div
      className="aspect-map overflow-hidden rounded-xl bg-bg"
      role="img"
      aria-label="Block schematic of Old East Dallas around Vice Park on Gaston Avenue, with DART Baylor station to the west."
    >
      <svg viewBox="0 0 320 240" className="size-full">
        <rect width="320" height="240" className="fill-bg" />
        <line x1="28" y1="120" x2="292" y2="120" className="stroke-border" strokeWidth="2" />
        <line x1="28" y1="168" x2="292" y2="168" className="stroke-border" strokeWidth="1.5" />
        <line x1="72" y1="36" x2="72" y2="208" className="stroke-border" strokeWidth="1.5" />
        <line x1="248" y1="36" x2="248" y2="208" className="stroke-border" strokeWidth="1.5" />
        <rect
          x="136"
          y="88"
          width="56"
          height="26"
          rx="4"
          className="fill-elevated stroke-accent"
          strokeWidth="1.5"
        />
        <circle cx="164" cy="101" r="4.5" className="fill-accent" />
        <text
          x="28"
          y="28"
          className="fill-subtle"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          WASHINGTON
        </text>
        <text
          x="248"
          y="28"
          className="fill-subtle"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          DART
        </text>
        <text
          x="80"
          y="114"
          className="fill-muted"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          GASTON
        </text>
        <text
          x="148"
          y="80"
          className="fill-accent"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          VICE PARK
        </text>
        <text
          x="80"
          y="162"
          className="fill-subtle"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          SWISS
        </text>
        <text
          x="292"
          y="224"
          className="fill-subtle"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
          textAnchor="end"
        >
          VALET
        </text>
      </svg>
    </div>
  );
}
