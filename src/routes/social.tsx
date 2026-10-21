import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { DeskStake } from "@/components/desk-stake";
import { PlayFloor } from "@/components/play-floor";
import { getHouse, type HouseListing } from "@/lib/sol-house";

export const Route = createFileRoute("/social")({
  loader: () => getHouse(),
  component: SocialPage,
});

function SocialPage() {
  const seed = Route.useLoaderData();
  const [house, setHouse] = useState<HouseListing[]>(seed);
  useEffect(() => {
    const id = window.setInterval(() => {
      getHouse().then(setHouse).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);
  const names = house.filter((h) => h.venue === "prestocks");
  return (
    <AppShell>
      <div className="space-y-3 px-3 py-3 lg:px-4">
        <DeskStake names={names} mode="pred" />
        <PlayFloor names={names} />
      </div>
    </AppShell>
  );
}
