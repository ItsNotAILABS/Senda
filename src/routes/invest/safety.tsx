import { createFileRoute } from "@tanstack/react-router";
import { JupiterV2PreviewPanel } from "@/components/jupiter-v2-preview";
import { TokenSafetyPanel } from "@/components/token-safety-panel";

export const Route = createFileRoute("/invest/safety")({
  component: SendaSafetyResearch,
});

function SendaSafetyResearch() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-white">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[.22em] text-lime-300">Senda / Research</p>
        <h1 className="text-3xl font-semibold">Inspect before you sign</h1>
        <p className="max-w-3xl text-sm leading-6 text-white/60">
          Read-only Solana mint inspection and Jupiter V2 route previews. These results do not
          authorize swaps or replace wallet simulation, quoted minimum output and approval.
        </p>
      </header>
      <TokenSafetyPanel />
      <JupiterV2PreviewPanel />
      <p className="text-xs text-white/45">Unavailable sources stay unavailable. Senda never turns a research result into an automatic wallet signature.</p>
    </main>
  );
}
