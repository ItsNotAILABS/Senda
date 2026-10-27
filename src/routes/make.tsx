import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/make")({
  component: MakePage,
});

function MakePage() {
  return <Navigate to="/work" />;
}
