import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { TabLead } from "@/components/tab-lead";
import { MoneyBar } from "@/components/money-bar";
import { humanWalletError, insideWalletApp, isPhoneBrowser, openInWallet } from "@/lib/mobile-wallet";
import { robinhoodBuyingPowerUrl } from "@/lib/robinhood";
import { connectWallet, detectWallets, rememberWallet, type WalletChoice, type WalletId } from "@/lib/wallets";
import { readChain } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const JOB: { id: WalletId; does: string }[] = [
  { id: "phantom", does: "PreStocks, USDC, cover, and work pay. This is the wallet that signs a buy." },
  { id: "solflare", does: "Same Solana book as Phantom, if this is the wallet you already use." },
  { id: "backpack", does: "Same Solana book. Swaps still sign here. Senda does not take the key." },
  { id: "coinbase-sol", does: "Coinbase Wallet on Solana. USDC, names, and sends sign here." },
  { id: "metamask", does: "Ethereum. Use it when a desk asks for a Base wallet. It does not buy a PreStock." },
  { id: "rabby", does: "Ethereum, same job as MetaMask." },
  { id: "coinbase", does: "Coinbase Wallet on Base. Gold, oil, and FX. It does not buy a PreStock." },
];

export function WalletsDesk() {
  const w = useWallet();
  const [choices, setChoices] = useState<WalletChoice[]>(() => detectWallets());
  const [busy, setBusy] = useState<string | null>(null);
  const [usd, setUsd] = useState(50);
  const [phone, setPhone] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [usdc, setUsdc] = useState<number | null>(null);
  const [solBal, setSolBal] = useState<number | null>(null);
  const [held, setHeld] = useState<{ symbol: string; ui: number }[]>([]);
  const sol = w.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");

  useEffect(() => {
    setPhone(isPhoneBrowser());
    setInApp(insideWalletApp());
  }, []);

  useEffect(() => {
    if (!sol?.address) {
      setUsdc(null);
      setSolBal(null);
      setHeld([]);
      return;
    }
    let live = true;
    readChain(sol.address)
      .then((snap) => {
        if (!live) return;
        setUsdc(snap.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
        setSolBal(snap.sol);
        setHeld(
          snap.tokens
            .filter((t) => t.ui > 0 && t.symbol !== "USDC")
            .sort((a, b) => b.ui - a.ui)
            .slice(0, 8)
            .map((t) => ({ symbol: t.symbol, ui: t.ui })),
        );
      })
      .catch(() => {
        if (!live) return;
        setUsdc(null);
        setSolBal(null);
      });
    return () => {
      live = false;
    };
  }, [sol?.address]);

  async function go(c: WalletChoice) {
    if (!c.installed && (c.id === "phantom" || c.id === "solflare" || c.id === "backpack" || c.id === "coinbase-sol") && isPhoneBrowser() && !insideWalletApp()) {
      openInWallet(c.id === "coinbase-sol" ? "coinbase" : c.id);
      toast.success("Opening the wallet. The same page loads inside it. Tap the wallet again there.");
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
        window.dispatchEvent(new Event("senda-chain"));
        toast.success(`${got.label} is on the desk.`);
        setChoices(detectWallets());
      }
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "Could not connect."));
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
        line="Phantom, Backpack, Solflare, and Coinbase Wallet sign a Solana buy. On a phone the page opens inside the wallet. MetaMask and Coinbase on Base do not sign a Solana transfer."
        live={["Phantom, Solflare, Backpack, Coinbase", "MetaMask and Coinbase on Base", "Revolut and Robinhood into this address"]}
        coming={["A wallet Senda custodies"]}
      />
      <MoneyBar />
      <section className="grid gap-3 lg:grid-cols-3">
        {[
          ["1", "Phantom", "On a phone this page opens inside Phantom. You sign there."],
          ["2", "This address", sol ? (usdc == null ? "Reading the wallet…" : `${solBal == null ? "" : `${solBal.toFixed(4)} SOL · `}$${usdc.toFixed(2)} USDC`) : "Connect first. If the wallet only has SOL, convert it."],
          ["3", "Backpack", "Same Solana book as Phantom. The next buy signs there if you choose it."],
          ["4", "MetaMask", "Base and the other EVM desks. It does not buy a PreStock."],
          ["5", "Revolut", sol ? "Copy this address into Revolut → Crypto → Send. USDC or SOL lands here." : "Connect a Solana wallet first. Revolut sends to that address."],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
            <p className="font-mono text-[11px] text-accent">{n}</p>
            <p className="mt-2 text-lg font-semibold">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/pre" className="flex min-h-12 items-center rounded-2xl border border-white/10 bg-[#10131c] px-4 text-sm font-semibold">Buy a name</Link>
        <Link to="/social" className="flex min-h-12 items-center rounded-2xl border border-white/10 bg-[#10131c] px-4 text-sm font-semibold">Above or below</Link>
        <Link to="/solana" className="flex min-h-12 items-center rounded-2xl border border-white/10 bg-[#10131c] px-4 text-sm font-semibold">Buy on Solana</Link>
        <Link to="/payments" className="flex min-h-12 items-center rounded-2xl border border-white/10 bg-[#10131c] px-4 text-sm font-semibold">Send USDC</Link>
        <Link to="/wallet" className="flex min-h-12 items-center rounded-2xl border border-white/10 bg-[#10131c] px-4 text-sm font-semibold">Convert SOL</Link>
        <Link to="/invest" className="flex min-h-12 items-center rounded-2xl border border-white/10 bg-[#10131c] px-4 text-sm font-semibold">Open gold, oil, FX</Link>
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
              <span className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const id = l.kind === "evm"
                      ? l.label.toLowerCase().includes("coinbase")
                        ? "coinbase"
                        : "metamask"
                      : l.label.toLowerCase().includes("backpack")
                        ? "backpack"
                        : l.label.toLowerCase().includes("solflare")
                          ? "solflare"
                          : l.label.toLowerCase().includes("coinbase")
                            ? "coinbase-sol"
                            : "phantom";
                    if (l.kind !== "evm") rememberWallet(id);
                    toast.success(l.kind === "evm" ? "MetaMask stays on for Base. A Solana buy still uses Phantom, Backpack, or Solflare." : `${l.label} signs the next Solana buy.`);
                  }}
                  className="text-xs font-semibold text-accent"
                >
                  {l.kind === "evm" ? "EVM" : "Signs next"}
                </button>
                <button type="button" onClick={() => w.unlink(l.address)} className="text-xs text-muted">
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
        {held.length > 0 ? (
          <ul className="mt-2 flex gap-2 overflow-x-auto">
            {held.map((row) => (
              <li key={row.symbol} className="shrink-0 rounded-full border border-white/10 px-3 py-1 font-mono text-xs">
                {row.symbol} {row.ui >= 1 ? row.ui.toFixed(2) : row.ui.toPrecision(3)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="grid gap-2 md:grid-cols-2">
        {choices.map((c) => {
          const job = JOB.find((j) => j.id === c.id);
          const opens = phone && !inApp && !c.installed && (c.id === "phantom" || c.id === "solflare" || c.id === "backpack" || c.id === "coinbase-sol");
          return (
            <button
              key={c.id}
              type="button"
              disabled={busy !== null}
              onClick={() => void go(c)}
              className={cn(
                "rounded-[22px] border border-white/10 bg-[#10131c] p-4 text-left",
                !c.installed && !opens && "opacity-60",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-base font-semibold">{c.name}</p>
                <p className="font-mono text-[11px] text-subtle">{c.installed ? "In this browser" : opens ? "Open app" : inApp && !c.installed ? "Tap again" : "Not installed"}</p>
              </div>
              <p className="mt-1 text-xs text-accent">{c.chain === "solana" ? "Solana" : "Ethereum"}</p>
              <p className="mt-2 text-sm text-muted">{job?.does ?? "Connect it if this is the wallet you use."}</p>
            </button>
          );
        })}
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Revolut</p>
        <h2 className="mt-2 text-xl font-semibold">Send crypto to this address.</h2>
        <p className="mt-2 text-sm text-muted">In Revolut: Crypto, Send, Solana, paste the address. USDC or SOL arrives in the wallet below. This desk does not see the Revolut balance.</p>
        <p className="mt-3 break-all font-mono text-xs text-white/70">{sol?.address ?? "Connect Phantom, Backpack, or Solflare first."}</p>
        <button
          type="button"
          disabled={!sol}
          onClick={() => {
            if (!sol) return;
            void navigator.clipboard.writeText(sol.address).then(
              () => toast.success("Copied. Paste it in Revolut."),
              () => toast.error("Could not copy. Select the address."),
            );
          }}
          className="mt-4 min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-black disabled:opacity-40"
        >
          Copy address
        </button>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Robinhood</p>
        <h2 className="mt-2 text-xl font-semibold">Buying power into USDC.</h2>
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
