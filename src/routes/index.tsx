import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { HomeDesk } from "@/components/home-desk";
import { PhoneHome } from "@/components/phone-home";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/")({
  loader: () => getHouse(),
  component: Home,
  errorComponent: HomeError,
});

function Home() {
  const names = Route.useLoaderData();
  const desktop = useDesktop();
  return <AppShell>{desktop ? <HomeDesk names={names} /> : <PhoneHome />}</AppShell>;
}

function useDesktop() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return wide;
}

function HomeError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "The book did not load.";
  return (
    <AppShell>
      <p className="px-6 py-10 text-sm text-down">{message}</p>
    </AppShell>
  );
}

