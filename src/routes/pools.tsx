import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PoolsDesk } from "@/components/pools-desk";
import { readSharedPools } from "@/lib/pools/read";

export const Route = createFileRoute("/pools")({
  loader: () => readSharedPools(),
  component: PoolsPage,
  errorComponent: PoolsError,
});

function PoolsPage() {
  const books = Route.useLoaderData();
  return (
    <AppShell>
      <PoolsDesk books={books} />
    </AppShell>
  );
}

function PoolsError({ error }: { error: Error }) {
  return (
    <AppShell>
      <p className="px-4 py-8 text-sm text-muted">{error.message || "The pool book did not load."}</p>
    </AppShell>
  );
}
