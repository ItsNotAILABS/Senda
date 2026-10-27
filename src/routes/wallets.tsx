import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/wallets")({
  component: WalletsPage,
});

function WalletsPage() {
  return <Navigate to="/wallet" search={{ lane: "wallets" }} />;
}
