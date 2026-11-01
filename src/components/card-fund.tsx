import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CASH, USDC } from "@/lib/jup-exec";
import { quoteRoute, signRoute, SOL } from "@/lib/jup-sign";
import { connectPhantom, splHolding } from "@/lib/phantom";
import { paySol, payToken, payUsdc } from "@/lib/solana-pay";
import { bindCardSend, CARD_BOOK } from "@/lib/card-rails";
import { rememberTrade } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { WuDesk } from "@/components/wu-desk";
import { cn } from "@/lib/utils";

const KEY = "senda.cardfund.v2";
const USDPT = "HVWf8JmLoHs99Lw8Psf3fyqAtA4crWxCPkrmSdNjhNH3";

const PROGRAMS = [
  { id: "jupiter", name: "Jupiter", state: "USDC", line: "Paste the Spend address from Jupiter. Only USDC. Their Visa stays in their app." },
  { id: "avici", name: "Avici", state: "USDC", line: "Paste the escrow address Avici shows. The card balance sits in their contract, not in this wallet." },
  { id: "kast", name: "KAST", state: "USDC", line: "Paste the Solana deposit KAST shows. They hold it. USDC, USDT, or PYUSD. This send is USDC." },
  { id: "xplace", name: "XPlace", state: "No USDC", line: "USDT, SOL, wETH, cbBTC, or jitoSOL. USDC is refused. A new address stops at the first-send cap. The last four characters have to match." },
  { id: "phantom", name: "Phantom", state: "CASH", line: "Swaps USDC into Phantom’s CASH token and leaves it in this wallet. Their Visa stays in Phantom." },
  { id: "fuse", name: "Fuse", state: "USDC", line: "Paste the address Fuse shows for the card account. Their Visa. United States, except New York and Alaska." },
  { id: "rain", name: "Rain", state: "Address", line: "Same box. Until Rain sends an address, a paste still works and stays saved." },
  { id: "bridge", name: "Bridge", state: "USDC", line: "Solana USDC only. Paste the address Bridge shows." },
  { id: "stable", name: "Stablecard", state: "Swap", line: "Senda quotes USDC to USDPT and the wallet signs. The Western Union Visa spends that token in their app." },
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
  const [asset, setAsset] = useState("USDC");
  const [tail, setTail] = useState("");
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
    setTail("");
    setSig("");
    const book = CARD_BOOK[id];
    if (book) setAsset(book.assets[0].symbol);
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
      if (id === "phantom") {
        const done = await signRoute({
          owner: who,
          inputMint: USDC,
          outputMint: CASH,
          amountRaw: Math.round(amount * 1_000_000),
          outDecimals: 6,
          usd: amount,
        });
        setSig(done.signature);
        toast.success(`CASH is in this wallet. Phantom’s card spends it.`);
        return;
      }
      if (id === "jupiter" || id === "avici" || id === "kast" || id === "xplace" || id === "fuse" || id === "rain" || id === "bridge") {
        const bound = bindCardSend({ program: id, symbol: asset, dest: to, amount, tail, remembered: saved()[id] || "" });
        const whoPay = who;
        const sigOut = bound.asset.native
          ? await paySol({ owner: whoPay, to: bound.dest, sol: amount })
          : bound.asset.symbol === "USDC"
            ? (await payUsdc({ owner: whoPay, to: bound.dest, usd: amount, memo: id, deskFee: false })).signature
            : (await payToken({ owner: whoPay, to: bound.dest, mint: bound.asset.mint, symbol: bound.asset.symbol, amount, decimals: bound.asset.decimals })).signature;
        const prior = saved();
        prior[id] = bound.dest;
        localStorage.setItem(KEY, JSON.stringify(prior));
        rememberTrade({ symbol: bound.asset.symbol, side: "send", usd: amount, mint: bound.asset.mint || USDC, signature: sigOut });
        setSig(sigOut);
        toast.success(`${amount} ${bound.asset.symbol} sent for ${bound.name}. ${sigOut.slice(0, 8)}…`);
        return;
      }
      throw new Error("That card is not on this desk.");
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
      <div className="grid grid-cols-3 gap-2">
        {PROGRAMS.filter((row) => ["jupiter", "avici", "kast", "xplace", "phantom", "fuse"].includes(row.id)).map((row) => (
          <button key={row.id} type="button" onClick={() => setId(row.id)} className={cn("min-h-16 rounded-2xl px-2 py-2 text-center", id === row.id ? "bg-white text-black" : "bg-white/5")}>
            <span className="block text-sm font-semibold">{row.name}</span>
            <span className={cn("block text-[10px] uppercase tracking-wide", id === row.id ? "text-black/55" : "text-muted")}>{row.state}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {PROGRAMS.filter((row) => ["rain", "bridge", "stable"].includes(row.id)).map((row) => (
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
      {id === "stable" ? null : id === "phantom" ? null : (
        <>
          {CARD_BOOK[id] && CARD_BOOK[id].assets.length > 1 ? (
            <label className="mt-3 block text-xs text-muted">
              Asset
              <select value={asset} onChange={(e) => setAsset(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-black px-3 text-[15px] text-white">
                {CARD_BOOK[id].assets.map((row) => (
                  <option key={row.symbol} value={row.symbol}>{row.symbol}</option>
                ))}
              </select>
            </label>
          ) : null}
          <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder={to ? "Saved Solana address" : "Paste once. Senda keeps it."} spellCheck={false} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
          <input value={tail} onChange={(e) => setTail(e.target.value.trim())} placeholder="Last 4 of that address" maxLength={4} spellCheck={false} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
          <p className="mt-2 text-xs text-muted">A new address stops at the first-send cap. This matches the last four characters. It does not prove the address belongs to {program.name}.</p>
        </>
      )}
      <button type="button" disabled={busy} onClick={() => void fund()} className="mt-4 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        {busy ? "Waiting on Phantom" : id === "stable" ? route.label : id === "phantom" ? "Swap into CASH" : `Send to ${program.name}`}
      </button>
      {sig ? (
        <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="mt-3 block font-mono text-xs break-all text-accent">{sig}</a>
      ) : null}
      </div>
    </section>
  );
}
