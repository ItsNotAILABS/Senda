import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Agenda } from "@/components/agenda";
import { Hero } from "@/components/hero";
import { RsvpForm } from "@/components/rsvp-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { Speakers } from "@/components/speakers";
import { Tickets } from "@/components/tickets";
import { Venue } from "@/components/venue";
import { getCapacity, type CapacityMap } from "@/lib/rsvp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [capacity, setCapacity] = useState<CapacityMap | null>(null);

  const load = useCallback(() => {
    void getCapacity()
      .then(setCapacity)
      .catch(() => setCapacity(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav />
      <main>
        <Hero />
        <Agenda />
        <Speakers />
        <Tickets capacity={capacity} />
        <Venue />
        <RsvpForm capacity={capacity} onSubmitted={load} />
      </main>
      <SiteFooter />
    </div>
  );
}
