import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { SolanaFloor } from "@/components/solana-floor";
import { getChainTape } from "@/lib/chain-tape";
import { getHouse } from "@/lib/sol-house";

export const Route = createFileRoute("/solana")({
  loader: async () => {
    const [house, tape] = await Promise.all([getHouse(), getChainTape()]);
    return { house, tape };
  },
  component: SolanaPage,
});

function SolanaPage() {
  const { house, tape } = Route.useLoaderData();
  return (
    <AppShell>
      <SolanaFloor house={house.filter((h) => h.venue === "prestocks")} tape={tape} />
    </AppShell>
  );
}
