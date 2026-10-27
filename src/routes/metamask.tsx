import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MaskDesk } from "@/components/mask-desk";

export const Route = createFileRoute("/metamask")({
  component: MetaMaskPage,
});

function MetaMaskPage() {
  return (
    <AppShell>
      <MaskDesk />
    </AppShell>
  );
}
