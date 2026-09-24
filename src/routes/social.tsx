import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
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
      <PlayFloor names={names} />
    </AppShell>
  );
}
