import { useEffect, useState } from "react";
import { toast } from "sonner";
import { USDC } from "@/lib/jup-exec";
import { quoteRoute, signRoute, SOL } from "@/lib/jup-sign";
import { connectPhantom, splHolding } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { rememberTrade } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { WuDesk } from "@/components/wu-desk";
import { cn } from "@/lib/utils";

const KEY = "senda.cardfund.v2";
const USDPT = "HVWf8JmLoHs99Lw8Psf3fyqAtA4crWxCPkrmSdNjhNH3";

const PROGRAMS = [
  {
    id: "jupiter",
    name: "Jupiter",
    state: "Sends now",
    line: "Address from the Jupiter deposit screen, remembered after the first paste. Phantom sends the USDC. The Visa is Rain’s, in the Jupiter app.",
  },
  {
    id: "rain",
    name: "Rain",
    state: "Program slot",
    line: "Same box the program will fill in. Until Rain sends an address, a paste still works and stays saved.",
  },
  {
    id: "bridge",
    name: "Bridge",
    state: "Not signed",
    line: "Solana USDC only. Paste the address Bridge shows. A Base address is rejected by the signature.",
  },
  {
    id: "stable",
    name: "Stablecard",
    state: "Swap",
    line: "Senda quotes USDC to USDPT and Phantom signs. The Western Union Visa spends that token in their app, not from this screen.",
  },
] as const;

type Id = (typeof PROGRAMS)[number]["id"];
type Way = "usdc-pt" | "pt-usdc" | "pt-sol";

const WAYS: { id: Way; label: string; input: string; output: string; dec: number; noun: string }[] = [
  { id: "usdc-pt", label: "Get USDPT", input: USDC, output: USDPT, dec: 6, noun: "USDPT" },
  { id: "pt-usdc", label: "Get USDC", input: USDPT, output: USDC, dec: 6, noun: "USDC" },
  { id: "pt-sol", label: "Get SOL", input: USDPT, output: SOL, dec: 9, noun: "SOL" },
];

function saved(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, string>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

/** Fund a card program with USDC. Jupiter sends today. Rain and Bridge wait on a real address. Stablecard swaps to USDPT. */
export function CardFund({ owner }: { owner: string }) {
  const [id, setId] = useState<Id>("jupiter");
  const [usd, setUsd] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");
  const [out, setOut] = useState("");
  const [way, setWay] = useState<Way>("usdc-pt");
  const [held, setHeld] = useState<number | null>(null);
  const [cash, setCash] = useState<number | null>(null);
  const wallet = useWallet();
  const route = WAYS.find((row) => row.id === way) ?? WAYS[0];
  const program = PROGRAMS.find((row) => row.id === id) ?? PROGRAMS[0];

  useEffect(() => {
    setTo(saved()[id] || "");
    setSig("");
  }, [id]);

  useEffect(() => {
    const amount = Number(usd);
    if (id !== "stable" || !(amount > 0)) {
      setOut("");
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      void quoteRoute({
        inputMint: route.input,
        outputMint: route.output,
        amountRaw: Math.round(amount * 10 ** (way === "usdc-pt" ? 6 : 6)),
        outDecimals: route.dec,
      })
        .then((q) => live && setOut(`${q.outUi.toFixed(way === "pt-sol" ? 4 : 2)} ${route.noun}`))
        .catch(() => live && setOut(""));
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [id, usd, way, route.input, route.output, route.dec, route.noun]);

  useEffect(() => {
    if (!owner || id !== "stable") return;
    let live = true;
    void splHolding(owner, USDPT)
      .then((row) => live && setHeld(row.ui))
      .catch(() => live && setHeld(null));
    return () => {
      live = false;
    };
  }, [owner, id, sig]);

  useEffect(() => {
    if (!owner || id !== "jupiter") return;
    let live = true;
    void splHolding(owner, USDC)
      .then((row) => live && setCash(row.ui))
      .catch(() => live && setCash(null));
    return () => {
      live = false;
    };
  }, [owner, id, sig]);

  async function fund() {
    const amount = Number(usd);
    if (!(amount > 0)) {
      toast.error("Enter the dollars.");
      return;
    }
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (id === "stable") {
        const done = await signRoute({
          owner: who,
          inputMint: route.input,
          outputMint: route.output,
          amountRaw: Math.round(amount * 1_000_000),
          outDecimals: route.dec,
          usd: amount,
        });
        rememberTrade({
          symbol: route.noun,
          side: way === "usdc-pt" ? "buy" : "sell",
          usd: amount,
          mint: route.output,
          signature: done.signature,
        });
        setSig(done.signature);
        toast.success(`${done.outUi.toFixed(way === "pt-sol" ? 4 : 2)} ${route.noun} is in this Phantom.`);
        return;
      }
      const dest = to.trim();
      if (!dest) throw new Error("Paste the Solana address that screen is showing.");
      const paid = await payUsdc({ owner: who, to: dest, usd: amount, memo: program.name });
      const prior = saved();
      prior[id] = dest;
      localStorage.setItem(KEY, JSON.stringify(prior));
      rememberTrade({ symbol: "USDC", side: "send", usd: amount, mint: USDC, signature: paid.signature });
      setSig(paid.signature);
      toast.success(`${program.name} funded. ${paid.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nothing was sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setId("jupiter")} className={cn("relative h-48 overflow-hidden rounded-[24px] border p-5 text-left", id === "jupiter" ? "border-white/40" : "border-white/10")} style={{ background: "linear-gradient(135deg,#1a2744 0%,#0c1018 55%,#142033 100%)" }}>
          <span className="text-[11px] tracking-[0.18em] text-white/50 uppercase">Jupiter · Rain</span>
          <span className="mt-6 block font-mono text-lg tracking-[0.2em]">{saved()["jupiter"] ? `${saved()["jupiter"].slice(0, 4)} ···· ${saved()["jupiter"].slice(-4)}` : "Not issued"}</span>
          <span className="mt-2 block text-sm text-white/70">{cash == null ? "Reading USDC" : `${cash.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC ready`}</span>
          <span className="absolute right-5 bottom-4 text-xs font-semibold text-white/80">{saved()["jupiter"] ? "Deposit saved" : "Needs Global ID"}</span>
        </button>
        <button type="button" onClick={() => setId("stable")} className={cn("relative h-48 overflow-hidden rounded-[24px] border p-5 text-left", id === "stable" ? "border-white/40" : "border-white/10")} style={{ background: "linear-gradient(135deg,#10241c 0%,#0c1018 50%,#1a2a18 100%)" }}>
          <span className="text-[11px] tracking-[0.18em] text-white/50 uppercase">Stable · Western Union</span>
          <span className="mt-6 block font-mono text-3xl tabular-nums">{held == null ? "—" : held.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          <span className="mt-1 block text-sm text-white/70">USDPT in this Phantom</span>
          <span className="absolute right-5 bottom-4 text-xs font-semibold text-white/80">Visa lives in their app</span>
        </button>
      </div>
      <div className="rounded-[24px] border border-white/10 bg-[#0c0e14] p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {PROGRAMS.map((row) => (
          <button key={row.id} type="button" onClick={() => setId(row.id)} className={cn("min-h-12 rounded-2xl px-2 text-left", id === row.id ? "bg-white text-black" : "bg-white/5")}>
            <span className="block text-sm font-semibold">{row.name}</span>
            <span className={cn("block text-[10px] uppercase tracking-wide", id === row.id ? "text-black/60" : "text-muted")}>{row.state}</span>
          </button>
        ))}
      </div>
      {id === "jupiter" ? (
        <ol className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["1", "Open Spend", "Jupiter app, card icon. Sign in with email, Google, or Apple."],
            ["2", "Global ID", "Document, phone, liveness. Jupiter decides the country. This desk does not get a Visa issued in the United States, Mexico, or the rest of Latin America."],
            ["3", "Fund it here", "Copy the Solana USDC address they show. Paste it once. Phantom sends. The 16 digits stay in Jupiter."],
          ].map(([n, title, line]) => (
            <li key={n} className="rounded-2xl bg-black/30 px-3 py-3">
              <p className="font-mono text-[11px] text-accent">{n}</p>
              <p className="mt-1 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs text-muted">{line}</p>
            </li>
          ))}
        </ol>
      ) : null}
      {id === "jupiter" ? <a href="https://jup.ag" target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-black">Open Jupiter</a> : null}
      {id === "stable" ? (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-3 gap-1">
            {WAYS.map((row) => (
              <button key={row.id} type="button" onClick={() => setWay(row.id)} className={cn("min-h-11 rounded-full text-xs font-semibold", way === row.id ? "bg-white text-black" : "bg-white/5 text-muted")}>{row.label}</button>
            ))}
          </div>
          <p className="text-xs text-muted">Western Union issues the Visa in their app. This swap loads USDPT into Phantom. A store pays from their drawer, not from this screen.</p>
          <WuDesk />
        </div>
      ) : id === "jupiter" ? null : (
        <p className="mt-3 text-xs text-muted">{program.line}</p>
      )}
      <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0" aria-label="Dollars" className="mt-3 w-full bg-transparent font-mono text-5xl tabular-nums outline-none" />
      <div className="mt-2 flex gap-2">
        {["10", "25", "50"].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-9 flex-1 rounded-full text-xs font-semibold", usd === n ? "bg-white text-black" : "border border-white/10 text-muted")}>${n}</button>
        ))}
        {(wallet.w.balances.USD || 0) > 0 ? (
          <button type="button" onClick={() => setUsd(String(Math.round((wallet.w.balances.USD || 0) * 100) / 100))} className="min-h-9 flex-1 rounded-full border border-white/10 text-xs font-semibold text-muted">Book</button>
        ) : null}
      </div>
      {id === "stable" && out ? <p className="mt-2 font-mono text-sm text-muted">About {out}</p> : null}
      {id === "stable" ? null : (
        <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder={to ? "Saved Solana address" : "Paste once. Senda keeps it."} spellCheck={false} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
      )}
      <button type="button" disabled={busy} onClick={() => void fund()} className="mt-4 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        {busy ? "Waiting on Phantom" : id === "stable" ? route.label : `Send to ${program.name}`}
      </button>
      {sig ? (
        <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="mt-3 block font-mono text-xs break-all text-accent">{sig}</a>
      ) : null}
      </div>
    </section>
  );
}
