import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/solana")({
  component: SolanaPage,
});

function SolanaPage() {
  return <Navigate to="/invest" search={{ lane: "solana" }} />;
}
