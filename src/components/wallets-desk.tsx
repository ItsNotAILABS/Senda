import { useState } from "react";
import { toast } from "sonner";
import { TabLead } from "@/components/tab-lead";
import { MoneyBar } from "@/components/money-bar";
import { robinhoodBuyingPowerUrl } from "@/lib/robinhood";
import { connectWallet, detectWallets, type WalletChoice, type WalletId } from "@/lib/wallets";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const JOB: { id: WalletId; does: string }[] = [
  { id: "phantom", does: "PreStocks, USDC, cover, and work pay. This is the wallet that signs a buy." },
  { id: "solflare", does: "Same Solana book as Phantom, if this is the wallet you already use." },
  { id: "backpack", does: "Same Solana book. Swaps still sign here. Senda does not take the key." },
  { id: "metamask", does: "Ethereum. Use it when a desk asks for a Base wallet. It does not buy a PreStock." },
  { id: "rabby", does: "Ethereum, same job as MetaMask." },
  { id: "coinbase", does: "Ethereum. Not the Solana buy path." },
];

export function WalletsDesk() {
  const w = useWallet();
  const [choices, setChoices] = useState<WalletChoice[]>(() => detectWallets());
  const [busy, setBusy] = useState<string | null>(null);
  const [usd, setUsd] = useState(50);
  const sol = w.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");

  async function go(c: WalletChoice) {
    setBusy(c.id);
    try {
      const got = await connectWallet(c.id);
      const kind = got.chain === "evm" ? "evm" : c.id === "phantom" ? "phantom" : "solana";
      const r = w.linkChain(got.address, got.label, kind);
      if (!r.ok) toast.error(r.error);
      else {
        if (got.chain === "solana") w.openCurrency("SOL");
        toast.success(`${got.label} is on the desk.`);
        setChoices(detectWallets());
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect.");
    } finally {
      setBusy(null);
    }
  }

  function robinhood() {
    if (!sol) {
      toast.error("Connect Phantom or another Solana wallet first. That address receives the USDC.");
      return;
    }
    const url = robinhoodBuyingPowerUrl({ wallet: sol.address, usd, origin: window.location.origin });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Wallets"
        title="Each wallet"
        accent="has a job."
        line="Connect what you already have. Buys and USDC sign on Solana. Ethereum is a different signature."
        live={["Phantom, Solflare, Backpack", "MetaMask and other Ethereum wallets", "Robinhood buying power into USDC"]}
        coming={["A wallet Senda custodies"]}
      />
      <MoneyBar />
      <section className="grid gap-3 lg:grid-cols-3">
        {[
          ["1", "Connect Phantom", "That address is the account for PreStocks."],
          ["2", "If you only hold SOL", "Convert it to USDC, then come back and buy."],
          ["3", "Pay, cover, or send", "Each one asks that same wallet to sign."],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
            <p className="font-mono text-[11px] text-accent">{n}</p>
            <p className="mt-2 text-lg font-semibold">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <h2 className="text-sm font-semibold">On this desk</h2>
        {w.w.links.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing connected yet.</p> : null}
        <ul className="mt-2 divide-y divide-white/10">
          {w.w.links.map((l) => (
            <li key={l.address} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold">{l.label}</p>
                <p className="font-mono text-[11px] text-subtle">{l.address}</p>
              </div>
              <button type="button" onClick={() => w.unlink(l.address)} className="text-xs text-muted">
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-2 md:grid-cols-2">
        {choices.map((c) => {
          const job = JOB.find((j) => j.id === c.id);
          return (
            <button
              key={c.id}
              type="button"
              disabled={busy !== null}
              onClick={() => void go(c)}
              className={cn(
                "rounded-[22px] border border-white/10 bg-[#10131c] p-4 text-left",
                !c.installed && "opacity-60",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-base font-semibold">{c.name}</p>
                <p className="font-mono text-[11px] text-subtle">{c.installed ? "In this browser" : "Not installed"}</p>
              </div>
              <p className="mt-1 text-xs text-accent">{c.chain === "solana" ? "Solana" : "Ethereum"}</p>
              <p className="mt-2 text-sm text-muted">{job?.does ?? "Connect it if this is the wallet you use."}</p>
            </button>
          );
        })}
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Robinhood</p>
        <h2 className="mt-2 text-3xl tracking-tight">Buying power into USDC.</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Robinhood opens. You confirm there. USDC is aimed at {sol ? `${sol.address.slice(0, 4)}…${sol.address.slice(-4)}` : "the Solana wallet you connect"}. It does not sit in a Senda balance.
        </p>
        <label className="mt-4 block text-xs text-subtle">
          Dollars
          <input value={usd} onChange={(e) => setUsd(Math.max(1, Number(e.target.value) || 0))} inputMode="decimal" className="mt-1 min-h-12 w-40 rounded-2xl border border-white/10 bg-black/40 px-4 font-mono text-sm outline-none" />
        </label>
        <button type="button" onClick={robinhood} className="mt-4 min-h-12 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
          Open Robinhood
        </button>
      </section>
    </div>
  );
}
