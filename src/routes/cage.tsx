import { createFileRoute } from "@tanstack/react-router";
import { Cage } from "@/components/cage";
import { PitShell } from "@/components/pit-shell";
import { getPit } from "@/lib/pit";
import { usePit } from "@/lib/use-pit";

export const Route = createFileRoute("/cage")({
  loader: () => getPit(),
  component: CagePage,
});

function CagePage() {
  const seed = Route.useLoaderData();
  const pit = usePit(seed);
  return (
    <PitShell chips={pit.chips} frozen={pit.frozen}>
      <Cage pit={pit} />
    </PitShell>
  );
}