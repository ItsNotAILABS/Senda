import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { LabDesk } from "@/components/lab-desk";
import { getHouse, type HouseListing } from "@/lib/sol-house";

export const Route = createFileRoute("/lab")({
  loader: () => getHouse(),
  component: LabPage,
});

function LabPage() {
  const seed = Route.useLoaderData();
  const [house, setHouse] = useState<HouseListing[]>(seed);
  useEffect(() => {
    const id = window.setInterval(() => {
      getHouse()
        .then(setHouse)
        .catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <AppShell>
      <LabDesk house={house} />
    </AppShell>
  );
}
