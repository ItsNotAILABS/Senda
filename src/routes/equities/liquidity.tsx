import { createFileRoute } from "@tanstack/react-router";
import { LiquidityDesk } from "@/components/liquidity-desk";

export const Route = createFileRoute("/equities/liquidity")({
  component: Page,
});

function Page() {
  return <LiquidityDesk />;
}
