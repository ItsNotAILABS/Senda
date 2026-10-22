import { createFileRoute } from "@tanstack/react-router";
import { PlayGame } from "@/components/desk-views";

export const Route = createFileRoute("/social/$game")({
  component: Page,
});

function Page() {
  const { game } = Route.useParams();
  return <PlayGame game={game} />;
}
