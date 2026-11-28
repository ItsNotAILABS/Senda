import { Link } from "@tanstack/react-router";
import { EsimDesk } from "@/components/esim-desk";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { pickOwner } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

function short(s: string): string {
  if (s.length < 12) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function ProfileDesk() {
  const user = useCurrentUser();
  const wallet = useWallet();
  const owner = pickOwner(wallet.w.links);
  const fallback = user?.isDevFallback === true;
  const name = fallback ? "No account" : user?.displayName || "Signed out";
  const mail = fallback ? "" : user?.primaryEmail || "";
  return (
    <main className="space-y-3 px-3 py-3 lg:px-4">
      <header className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-black">{fallback ? "—" : name.charAt(0).toUpperCase()}</span>
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Profile</p>
          <h1 className="text-3xl tracking-tight">{name}</h1>
          {mail ? <p className="text-sm text-muted">{mail}</p> : null}
        </div>
      </header>
      <section className="rounded-2xl border border-white/10 p-4">
        {fallback ? (
          <p className="text-sm text-muted">
            This is not you. Sign-in is off, so the app was printing Dev User and dev@example.com. That address was never onboarded. There is no Senda account, no KYC, and no profile that follows you to another computer. The wallet is what signs.
          </p>
        ) : user ? (
          <p className="text-sm text-muted">
            This is only the sign-in email. There is still no onboarding and no KYC. A trade is signed by the wallet, not by this name.
          </p>
        ) : (
          <p className="text-sm text-muted">No session. There is still no onboarding. Connect a wallet to sign.</p>
        )}
        <p className="mt-3 font-mono text-xs text-subtle">{owner ? `Signer ${short(owner)}` : "No wallet connected."}</p>
        <Link to="/vault/lens" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent">
          Position is the wallet, not this chip
        </Link>
      </section>
      <EsimDesk />
    </main>
  );
}
