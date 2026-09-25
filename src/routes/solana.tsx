import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { SolanaFloor } from "@/components/solana-floor";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/solana")({
  loader: () => getHouse(),
  component: SolanaPage,
});

function SolanaPage() {
  const house = Route.useLoaderData().filter((h) => h.venue === "prestocks");
  return (
    <AppShell>
      <SolanaFloor house={house} />
    </AppShell>
  );
}
