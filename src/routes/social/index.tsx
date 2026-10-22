import { createFileRoute } from "@tanstack/react-router";
import { PlayLobby } from "@/components/desk-views";
export const Route = createFileRoute("/social/")({
  component: Page,
});

function Page() {
  return <PlayLobby />;
}
