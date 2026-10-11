import { useEffect, useState } from "react";
import { toast } from "sonner";
import { humanWalletError, isPhoneBrowser, type MobileWallet } from "@/lib/mobile-wallet";
import { connectWallet, detectWallets, type WalletChoice } from "@/lib/wallets";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { shortPk } from "@/lib/senda-keys";
import { cn } from "@/lib/utils";

const OPENS: MobileWallet[] = ["phantom", "solflare", "backpack"];

export function WalletPicker() {
  const w = useWallet();
  const [choices, setChoices] = useState<WalletChoice[]>(() => detectWallets());
  const [busy, setBusy] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    setPhone(isPhoneBrowser());
    const read = () => setChoices(detectWallets());
    read();
    const id = window.setInterval(read, 400);
    const stop = window.setTimeout(() => window.clearInterval(id), 4000);
    const onReady = () => read();
    window.addEventListener("phantom#initialized", onReady);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
      window.removeEventListener("phantom#initialized", onReady);
    };
  }, []);
  const installed = choices.filter((c) => c.installed);
  const missing = choices.filter((c) => !c.installed);
  const shown = phone ? choices.filter((c) => c.chain === "solana" || c.installed) : installed.length ? installed : choices;

  async function go(c: WalletChoice) {
    const opens = phone && !c.installed && OPENS.includes(c.id as MobileWallet);
    if (!c.installed && !opens) {
      toast.error(`Open this page in a browser that has ${c.name}.`);
      return;
    }
    setBusy(c.id);
    try {
      const got = await connectWallet(c.id);
      const kind = got.chain === "evm" ? "evm" : c.id === "phantom" ? "phantom" : "solana";
      const r = w.linkChain(got.address, got.label, kind);
      if (!r.ok && r.error !== "Already linked.") toast.error(r.error);
      else {
        if (got.chain === "solana") w.openCurrency("SOL");
        toast.success(r.ok ? `${got.label} · ${shortPk(got.address)}` : `${got.label} is already this account.`);
        setChoices(detectWallets());
      }
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "Could not connect."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold">Wallets you already have</p>
      <p className="mt-1 text-xs text-muted">
        {phone
          ? "This phone browser has no extension. Phantom, Solflare, or Backpack opens this page. You sign there. Senda never takes the key."
          : "The vault wraps the wallet. Swaps sign in that wallet. We never take the key."}
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {shown.map((c) => {
          const linked = w.w.links.some((l) => l.label === c.name);
          const opens = phone && !c.installed && OPENS.includes(c.id as MobileWallet);
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void go(c)}
                className={cn("flex min-h-14 w-full items-center justify-between rounded-xl bg-bg px-3 text-left", !c.installed && !opens && "opacity-60")}
              >
                <span>
                  <span className="block text-sm font-semibold">{c.name}</span>
                  <span className="block text-xs text-muted">{c.chain === "solana" ? "Solana" : "Ethereum"}</span>
                </span>
                <span className="text-xs text-subtle">{busy === c.id ? "Opening…" : linked ? "Linked" : opens ? "Open app" : c.installed ? "Connect" : "Not here"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {phone ? (
        <p className="mt-2 text-xs text-subtle">
          No app yet?{" "}
          <a className="text-accent" href="https://apps.apple.com/app/phantom-crypto-wallet/id1598432977">
            Get Phantom
          </a>
          {" · "}
          <a className="text-accent" href="https://apps.apple.com/app/solflare/id1580902717">
            Get Solflare
          </a>
        </p>
      ) : installed.length > 0 && missing.length > 0 ? (
        <p className="mt-2 text-xs text-subtle">Also works with {missing.map((m) => m.name).join(", ")} when that extension is installed.</p>
      ) : null}
    </div>
  );
}
