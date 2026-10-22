import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Unplug, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WalletPicker } from "@/components/wallet-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { checkKalshiLink } from "@/lib/kalshi-link";
import { formatVolume } from "@/lib/markets";
import {
  clearKalshiLink,
  clearPolyLink,
  clearSolLink,
  loadVenueSession,
  requestPolyWallet,
  requestSolanaWallet,
  saveKalshiLink,
  savePolyLink,
  saveSolLink,
  shortAddress,
  type KalshiLink,
  type PolyLink,
  type SolLink,
} from "@/lib/venue-session";

export function AccountsDesk() {
  const [sol, setSol] = useState<SolLink | null>(() =>
    typeof window === "undefined" ? null : loadVenueSession().sol,
  );
  const [poly, setPoly] = useState<PolyLink | null>(() =>
    typeof window === "undefined" ? null : loadVenueSession().poly,
  );
  const [kalshi, setKalshi] = useState<KalshiLink | null>(() =>
    typeof window === "undefined" ? null : loadVenueSession().kalshi,
  );
  const [keyId, setKeyId] = useState("");
  const [pem, setPem] = useState("");
  const [busy, setBusy] = useState<"sol" | "poly" | "kalshi" | null>(null);

  async function connectSol() {
    setBusy("sol");
    try {
      const addr = await requestSolanaWallet();
      setSol(saveSolLink(addr));
      toast.success(`Phantom ${shortAddress(addr)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Phantom connect failed.");
    } finally {
      setBusy(null);
    }
  }

  async function connectPoly() {
    setBusy("poly");
    try {
      const addr = await requestPolyWallet();
      setPoly(savePolyLink(addr));
      toast.success(`Polymarket wallet ${shortAddress(addr)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wallet connect failed.");
    } finally {
      setBusy(null);
    }
  }

  async function linkKalshi(e: FormEvent) {
    e.preventDefault();
    setBusy("kalshi");
    try {
      const res = await checkKalshiLink({ data: { keyId: keyId.trim(), pem: pem.trim() } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setKalshi(saveKalshiLink(keyId.trim(), res.balance, pem.trim()));
      setPem("");
      toast.success(
        res.balance != null
          ? `Kalshi linked · cash ${formatVolume(res.balance, "kalshi")}`
          : "Kalshi linked. Key is valid.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reach Kalshi.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-5 pb-16 sm:px-6 sm:py-8">
      <div className="flex items-start gap-3">
        <Link
          to="/"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg"
          aria-label="Back to pit floor"
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.22em] text-accent uppercase">Accounts</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Phantom signs Solana. Not us.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
            Paper chips on this pit stay paper. Tessera T-Tokens and PreStocks
            trade permissionlessly — no KYC, no minimums. Live size is a
            Jupiter swap from the Phantom you link. We do not hold SOL or
            tokens, and live routing is not armed yet.
          </p>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl bg-elevated p-4 shadow-panel sm:grid-cols-3">
        <Stat label="Cash" value="Senda wallet" />
        <Stat label="Phantom" value={sol ? shortAddress(sol.address) : "Not linked"} />
        <Stat label="Live path" value="Jupiter · not armed" />
      </div>

      <article className="flex flex-col rounded-2xl bg-elevated p-5 shadow-panel sm:p-6">
        <p className="font-mono text-[0.65rem] tracking-[0.18em] text-subtle uppercase">
          Solana · Tessera + PreStocks
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">Phantom</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          T-Kalshi, T-OpenAI, T-SpaceX and the PreStocks book live on Solana
          as Token-2022 mints. You sign in Phantom. Jupiter routes the swap.
          The Senda wallet is paper until routing is armed.
        </p>
        <ol className="mt-4 space-y-2 text-sm text-muted">
          <li>01 · Connect Phantom (or any injected Solana wallet).</li>
          <li>02 · Buys in Invest debit Senda USD. Paper until routing is armed.</li>
          <li>03 · “Swap on Jupiter” opens USDC → mint in your wallet. We never see the key.</li>
        </ol>
        <div className="mt-5">
          {sol ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-sm tabular-nums text-fg">{shortAddress(sol.address)}</p>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => {
                  clearSolLink();
                  setSol(null);
                }}
              >
                <Unplug className="size-4" strokeWidth={1.75} />
                Unlink
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={busy !== null}
              onClick={() => void connectSol()}
            >
              <Wallet className="size-4" strokeWidth={1.75} />
              {busy === "sol" ? "Waiting on Phantom…" : "Connect Phantom"}
            </Button>
          )}
          <p className="mt-2 text-xs text-subtle">
            Preview windows often block injected wallets. Open Senda in a browser where the extension is installed.
          </p>
          <div className="mt-5 rounded-xl bg-bg p-4">
            <WalletPicker />
          </div>
        </div>
      </article>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="flex flex-col rounded-2xl bg-elevated p-5 shadow-panel sm:p-6">
          <p className="font-mono text-[0.65rem] tracking-[0.18em] text-subtle uppercase">
            Polymarket · secondary
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">Wallet</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Street books stay on the floor as a second tape. They are not the PreStocks path.
          </p>
          <div className="mt-auto pt-5">
            {poly ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-mono text-sm tabular-nums text-fg">{shortAddress(poly.address)}</p>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => {
                    clearPolyLink();
                    setPoly(null);
                  }}
                >
                  <Unplug className="size-4" strokeWidth={1.75} />
                  Unlink
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 w-full"
                disabled={busy !== null}
                onClick={() => void connectPoly()}
              >
                <Wallet className="size-4" strokeWidth={1.75} />
                {busy === "poly" ? "Waiting on wallet…" : "Connect EVM wallet"}
              </Button>
            )}
          </div>
        </article>

        <article className="flex flex-col rounded-2xl bg-elevated p-5 shadow-panel sm:p-6">
          <p className="font-mono text-[0.65rem] tracking-[0.18em] text-subtle uppercase">
            Kalshi · CFTC · secondary
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">API key</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            T-Kalshi does not need this. Keep it only if you still want the
            CFTC book.
          </p>
          <div className="mt-5">
            {kalshi ? (
              <div className="flex flex-col gap-3">
                <p className="font-mono text-sm text-fg">
                  {kalshi.keyId.slice(0, 8)}…{kalshi.keyId.slice(-4)}
                  {kalshi.balance != null ? ` · ${formatVolume(kalshi.balance, "kalshi")}` : ""}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-full"
                  onClick={() => {
                    clearKalshiLink();
                    setKalshi(null);
                    setKeyId("");
                    setPem("");
                  }}
                >
                  <Unplug className="size-4" strokeWidth={1.75} />
                  Unlink
                </Button>
              </div>
            ) : (
              <form className="flex flex-col gap-3" onSubmit={(e) => void linkKalshi(e)}>
                <div className="space-y-1.5">
                  <Label htmlFor="kalshi-id">Key ID</Label>
                  <Input
                    id="kalshi-id"
                    value={keyId}
                    onChange={(e) => setKeyId(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="uuid from Kalshi"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kalshi-pem">Private key (PEM)</Label>
                  <Textarea
                    id="kalshi-pem"
                    value={pem}
                    onChange={(e) => setPem(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    className="min-h-28 font-mono text-xs"
                    required
                  />
                </div>
                <Button type="submit" variant="secondary" className="min-h-11" disabled={busy !== null}>
                  <KeyRound className="size-4" strokeWidth={1.75} />
                  {busy === "kalshi" ? "Checking Kalshi…" : "Check key"}
                </Button>
              </form>
            )}
          </div>
        </article>
      </div>

      <p className="max-w-2xl text-sm text-muted">
        Next arm is a confirm ticket then a Jupiter swap signed in Phantom —
        USDC for T-Kalshi, T-OpenAI, T-SpaceX or a PreStock. Until that
        switch is on, LONG/FADE on the floor is still paper.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-1 py-1">
      <p className="font-mono text-[0.6rem] tracking-wider text-subtle uppercase">{label}</p>
      <p className="truncate font-mono text-sm text-fg">{value}</p>
    </div>
  );
}
