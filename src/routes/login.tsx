import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-fg">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Sovereign Summit
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Sign in
          </h1>
          <p className="text-sm text-muted">
            Use the same account you want on the guest list. We prefill your RSVP.
          </p>
        </div>
        {authEnabled ? (
          <div className="space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="secondary"
                className="w-full"
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
          className="inline-block text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Back to the event
        </Link>
      </div>
    </main>
  );
}
