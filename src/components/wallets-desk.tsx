import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { JumpStrip } from "@/components/jump-strip";
import { DeskAudit } from "@/components/money-flow";
import { ClearStrip } from "@/components/clear-strip";
import { connectPhantom, readChain } from "@/lib/phantom";
import { humanWalletError, insideWalletApp, isPhoneBrowser } from "@/lib/mobile-wallet";
import { feeOf } from "@/lib/money-move";
import { connectWallet, detectWallets, rememberWallet, type WalletChoice, type WalletId } from "@/lib/wallets";
import { shortPk } from "@/lib/senda-keys";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const ORDER = [
  { n: "1", title: "Phantom", line: "On a phone this page opens inside Phantom. You sign there." },
  { n: "2", title: "USDC", line: "That is the buying power. If the wallet only has SOL, convert it first." },
  { n: "3", title: "MetaMask", line: "An account wallet, same as Phantom. It stays signed in. It signs Base: gold, oil, FX, a short." },
] as const;

/** The schedule, from feeOf. Not a second leg. */
function clearSchedule(): string {
  const above = feeOf(100);
  const cap = feeOf(10_000);
  const under = feeOf(0.5);
  const pct = above.bps / 100;
  const capUsd = Number.isInteger(cap.usd) ? cap.usd.toFixed(0) : cap.usd.toFixed(2);
  const small = under.usd === 0 ? "Under $1 there is no fee." : `Under $1 the fee is $${under.usd.toFixed(2)}.`;
  return `A clear above $1 keeps ${pct}% for the desk, capped at $${capUsd}. ${small}`;
}

export function WalletsDesk({ embedded = false }: { embedded?: boolean }) {
  const wallet = useWallet();
  const [choices, setChoices] = useState<WalletChoice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [held, setHeld] = useState<{ sol: number; usdc: number } | null>(null);
  const [chain, setChain] = useState<"all" | "solana" | "evm">("all");
  const [readyOnly, setReadyOnly] = useState(false);
  const [scanned, setScanned] = useState<Date | null>(null);
  useEffect(() => {
    setPhone(isPhoneBrowser());
    setInApp(insideWalletApp());
    const read = () => {
      setChoices(detectWallets());
      setScanned(new Date());
    };
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
  const sol = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const evm = wallet.w.links.find((l) => l.kind === "evm");

  useEffect(() => {
    if (!sol) {
      setHeld(null);
      return;
    }
    let live = true;
    readChain(sol.address)
      .then((chain) => {
        if (!live) return;
        const usdc = chain.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;
        setHeld({ sol: chain.sol, usdc });
      })
      .catch(() => live && setHeld(null));
    return () => {
      live = false;
    };
  }, [sol?.address]);

  async function phantom() {
    setBusy("phantom");
    try {
      const addr = await connectPhantom();
      rememberWallet("phantom");
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
      toast.success(`Phantom · ${shortPk(addr)}`);
      setChoices(detectWallets());
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "Phantom did not connect."));
    } finally {
      setBusy(null);
    }
  }

  async function other(id: WalletId, name: string) {
    setBusy(id);
    try {
      const got = await connectWallet(id);
      const kind = got.chain === "evm" ? "evm" : id === "phantom" ? "phantom" : "solana";
      const linked = wallet.linkChain(got.address, got.label, kind);
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
      toast.success(`${name} · ${shortPk(got.address)}`);
      setChoices(detectWallets());
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "That wallet did not connect."));
    } finally {
      setBusy(null);
    }
  }

  const ready = choices.filter((c) => c.installed).length;
  const scanRows = choices
    .filter((c) => (chain === "all" ? true : c.chain === chain))
    .filter((c) => (readyOnly ? c.installed : true))
    .slice()
    .sort((a, b) => Number(b.installed) - Number(a.installed));

  return (
      <div className="space-y-4">
      {embedded ? null : <JumpStrip />}
      {embedded ? (
        <div>
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Scan</p>
          <h2 className="mt-1 text-2xl tracking-tight">Wallets in this browser.</h2>
        </div>
      ) : (
      <header>
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Wallets</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Connect the wallet that matches the trade.</h1>
      </header>
      )}
      <DeskAudit live="Phantom, Solflare, and Backpack sign here. On a phone the page opens inside the wallet." hold="MetaMask is Base only. It does not sign a Solana USDC transfer." />
      <ol className="grid gap-2 lg:grid-cols-3">
        {ORDER.map((step) => (
          <li key={step.n} className="rounded-2xl border border-white/10 bg-[#10131c] px-4 py-3">
            <p className="font-mono text-[11px] text-accent">{step.n}</p>
            <p className="mt-1 text-sm font-semibold">{step.title}</p>
            <p className="mt-1 text-sm text-muted">{step.line}</p>
          </li>
        ))}
      </ol>
      <ClearStrip />
      <p className="text-sm text-muted">{clearSchedule()}</p>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">Solana · Phantom</p>
          <h2 className="mt-1 text-xl">This wallet buys and clears.</h2>
          <p className="mt-2 text-sm text-muted">A name, a prediction, and a payment are USDC from this address. You sign. Senda does not hold it.</p>
          <p className="mt-2 font-mono text-xs text-white/70">{sol ? `${sol.label} · ${shortPk(sol.address)}` : "Not connected."}</p>
          {held ? <p className="mt-1 font-mono text-sm tabular-nums">{held.sol.toFixed(4)} SOL · {held.usdc.toFixed(2)} USDC</p> : null}
          <button type="button" disabled={busy !== null} onClick={() => void phantom()} className="mt-3 min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50">
            {busy === "phantom" ? "Opening…" : sol ? "Phantom again" : phone && !inApp ? "Open Phantom" : "Connect Phantom"}
          </button>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/invest" className="min-h-9 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold">Buy a name</Link>
            <Link to="/social" className="min-h-9 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold">Above or below</Link>
            <Link to="/invest" search={{ lane: "solana" }} className="min-h-9 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold">Buy on Solana</Link>
            <Link to="/payments" search={{ act: "link" }} className="min-h-9 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold">Send USDC</Link>
            <Link to="/wallet" className="min-h-9 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold">Convert SOL</Link>
          </div>
        </article>

        <article className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="font-mono text-[11px] tracking-[0.14em] text-[#c4b5fd] uppercase">Base · MetaMask</p>
          <h2 className="mt-1 text-xl">This wallet is only the other market.</h2>
          <p className="mt-2 text-sm text-muted">Gold, oil, and FX ask MetaMask on Base. It does not buy a PreStock.</p>
          <p className="mt-2 font-mono text-xs text-white/70">{evm ? `${evm.label} · ${shortPk(evm.address)}` : "Not connected."}</p>
          <button type="button" disabled={busy !== null} onClick={() => void other("metamask", "MetaMask")} className="mt-3 min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-50">
            {busy === "metamask" ? "Waiting…" : evm?.label === "MetaMask" ? "MetaMask again" : "Connect MetaMask"}
          </button>
          <div className="mt-3">
            <Link to="/invest" search={{ desk: "world" }} className="inline-flex min-h-9 items-center rounded-full bg-white/10 px-3 text-xs font-semibold">Open gold, oil, FX</Link>
          </div>
        </article>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Already linked</h2>
        {wallet.w.links.length === 0 ? <p className="mt-1 text-sm text-muted">None yet. Connecting one below keeps the address on this desk.</p> : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {wallet.w.links.map((l) => (
              <li key={l.address} className="rounded-2xl border border-white/10 bg-[#10131c] px-4 py-3">
                <p className="text-sm font-semibold">{l.label}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-subtle">{l.address}</p>
                <p className="mt-1 text-xs text-muted">{l.kind === "evm" ? "Base" : "Solana"} · linked</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0c0e14]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-accent uppercase">Scan</p>
            <h2 className="mt-1 text-2xl tracking-tight">Wallets this browser can sign with</h2>
            <p className="mt-1 text-sm text-muted">{scanned ? `Scanned ${scanned.toLocaleTimeString()}` : "Scanning"} · {ready} ready · {choices.length - ready} not installed</p>
          </div>
          <button type="button" onClick={() => { setChoices(detectWallets()); setScanned(new Date()); }} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black">
            Scan again
          </button>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10">
          {[
            ["Ready", String(ready)],
            ["Linked", String(wallet.w.links.length)],
            ["Not here", String(choices.length - ready)],
          ].map(([label, value]) => (
            <div key={label} className="px-4 py-3">
              <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">{label}</p>
              <p className="mt-1 font-mono text-2xl tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 py-3">
          {([
            ["all", "All"],
            ["solana", "Solana"],
            ["evm", "Base"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setChain(id)} className={cn("min-h-8 rounded-full px-3 text-xs font-semibold", chain === id ? "bg-white text-black" : "border border-white/10 text-muted")}>{label}</button>
          ))}
          <button type="button" onClick={() => setReadyOnly((v) => !v)} className={cn("min-h-8 rounded-full px-3 text-xs font-semibold", readyOnly ? "bg-accent text-accent-fg" : "border border-white/10 text-muted")}>Ready only</button>
        </div>
        <ul className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {scanRows.map((c) => {
            const linked = wallet.w.links.some((l) => l.label === c.name || (c.id === "phantom" && l.kind === "phantom") || (c.id === "metamask" && l.kind === "evm" && l.label === "MetaMask"));
            const opens = phone && !inApp && !c.installed && (c.id === "solflare" || c.id === "backpack" || c.id === "phantom");
            const status = busy === c.id ? "Opening" : linked ? "Linked" : opens ? "Open app" : c.installed ? "Ready" : "Not here";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={busy !== null || (!c.installed && !opens)}
                  onClick={() => void (c.id === "phantom" ? phantom() : other(c.id, c.name))}
                  className={cn("flex min-h-[72px] w-full items-center justify-between rounded-2xl border px-3 text-left transition", c.installed ? "border-white/15 bg-black/20 hover:border-white/40" : "border-white/10 opacity-60", linked && "border-accent/50")}
                >
                  <span>
                    <span className="block text-sm font-semibold">{c.name}</span>
                    <span className="block text-xs text-muted">{c.chain === "solana" ? "Solana" : "Base"}</span>
                  </span>
                  <span className={cn("rounded-full px-2 py-1 text-[11px] font-semibold", c.installed ? "bg-accent text-accent-fg" : "bg-white/10 text-subtle")}>{status}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
