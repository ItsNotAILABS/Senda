import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="flex min-h-dvh flex-col bg-bg text-fg">
      <p className="border-b border-border bg-elevated px-3 py-1.5 text-center text-xs text-muted">
        Paper wallet · not real money
      </p>
      <div className="grid flex-1 place-items-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-subtle">Senda</p>
            <h1 className="text-3xl font-semibold tracking-tight">Keep your wallet</h1>
            <p className="text-sm text-muted">
              Guests stay on this phone. Sign in to keep balances, sends, and PreStocks.
            </p>
          </div>
          {authEnabled ? (
            <div className="space-y-2">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="secondary"
                  className="w-full min-h-11"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                >
                  Continue with {p.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Sign-in is disabled.</p>
          )}
          <Link
            to="/"
            className="inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Back to wallet
          </Link>
        </div>
      </div>
    </main>
  );
}
