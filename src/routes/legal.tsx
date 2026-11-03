import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/legal")({
  component: LegalPage,
});

function LegalPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Legal</p>
        <h1 className="mt-2 text-4xl">What Senda keeps</h1>
        <p className="mt-3 text-sm text-muted">
          Plain version. This is not a bank, not a broker, and not a card network.
        </p>
        <section className="mt-6 space-y-4 text-sm text-muted">
          <p>
            <span className="text-fg">Your key. </span>
            Swaps are signed in Phantom or another Solana wallet you connect. Senda does not receive the private key and cannot move funds you did not sign.
          </p>
          <p>
            <span className="text-fg">On this device. </span>
            Cash balances, notes, agent logs, the vault wrap, and the send cap live in this browser. Clearing the site clears them.
          </p>
          <p>
            <span className="text-fg">Card numbers. </span>
            A one-time number is shown once. The account stores the last four digits and the cap, not the full number. These numbers are minted here. They are not a bank BIN and a store may decline them.
          </p>
          <p>
            <span className="text-fg">Prices. </span>
            PreStock marks come from the issuer’s public API. Routes come from Jupiter. Senda does not take the other side of your trade.
          </p>
          <p>
            <span className="text-fg">Account. </span>
            If you sign in, that account is for the session. It is not required to connect a wallet.
          </p>
        </section>
        <Link to="/more" className="mt-8 inline-flex text-sm text-accent">
          Back to account
        </Link>
      </main>
    </AppShell>
  );
}
