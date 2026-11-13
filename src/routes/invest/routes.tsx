import { createFileRoute } from "@tanstack/react-router";
import { RoutesPage } from "@/components/trade-pages";
import { LiquifyRouteCompare } from "@/components/liquify-route-compare";
import { JupiterV2PreviewPanel } from "@/components/jupiter-v2-preview";
export const Route = createFileRoute("/invest/routes")({
  component: Page,
});

function Page() {
  return <><div className="mx-auto max-w-[1510px] px-4 pt-5"><JupiterV2PreviewPanel /><LiquifyRouteCompare /></div><RoutesPage /></>;
}
