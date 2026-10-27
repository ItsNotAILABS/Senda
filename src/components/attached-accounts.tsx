import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ATTACHED, accountOpen, attachedAddress, openOne, readAttached, returnRent, type AttachedHold } from "@/lib/attached";
import { USDC } from "@/lib/jup-exec";
import { signRoute } from "@/lib/jup-sign";
import { connectPhantom, mintDecimals } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const WAYS = [
  { n: "1", title: "His bank", line: "In Bitso: Enviar, transferencia bancaria, his 18-digit CLABE. Bitso says this is free and can take up to one business day. His CURP has to be validated." },
  { n: "2", title: "His debit card", line: "Same Bitso send screen. SPEI or debit card. He enters the card, the bank, and his name." },
  { n: "3", title: "His phone", line: "Bitso’s bank form also takes a phone number instead of a CLABE. The pesos land on the account tied to that number." },
  { n: "4", title: "Another Bitso user", line: "Bitso Transfer to a Bitso account he chooses. That person can then SPEI it out. Still inside Bitso, not this app." },
  { n: "5", title: "Pesos in his Phantom", line: "You send MXNe to his Solana address. He holds pesos. To reach a bank he sells them for USDC here and uses Withdraw to Bitso, then 1 or 2." },
] as const;

/** One signature opens the USDC, peso, and euro accounts on this Phantom. */
export function AttachedAccounts({ owner }: { owner: string }) {
  const wallet = useWallet();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [hold, setHold] = useState<AttachedHold | null>(null);
  const [opening, setOpening] = useState("");
  const [closing, setClosing] = useState("");
  const [fundAmt, setFundAmt] = useState("1");
  const [funding, setFunding] = useState("");

  function refresh(who: string) {
    void Promise.all(
      ATTACHED.filter((row) => row.mint).map(async (row) => {
        const addr = attachedAddress(who, row);
        return [row.id, await accountOpen(addr).catch(() => false)] as const;
      }),
    ).then((rows) => {
      setOpen(Object.fromEntries(rows));
    });
    void readAttached(who).then(setHold).catch(() => setHold(null));
  }

  useEffect(() => {
    if (!owner) {
      setOpen({});
      return;
    }
    refresh(owner);
  }, [owner]);

  async function copy(text: string, symbol: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${symbol} copied.`);
    } catch {
      toast.error("Could not copy.");
    }
  }

  async function takeRent(id: string, mint: string) {
    setClosing(id);
    try {
      const who = owner || (await connectPhantom());
      const sig = await returnRent(who, mint);
      toast.success(`Rent is back on the Phantom. ${sig.slice(0, 8)}…`);
      refresh(who);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The rent did not come back.");
    } finally {
      setClosing("");
    }
  }

  async function fund(id: string, mint: string, symbol: string) {
    const n = Number(fundAmt);
    if (!(n > 0)) return toast.error("Enter the dollars.");
    setFunding(symbol);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
      }
      if (!open[id]) await openOne(who, mint).catch(() => null);
      const decimals = await mintDecimals(mint);
      const done = await signRoute({
        owner: who,
        inputMint: USDC,
        outputMint: mint,
        amountRaw: Math.round(n * 1e6),
        outDecimals: decimals,
        usd: n,
      });
      toast.success(`${symbol} funded. ${done.signature.slice(0, 8)}…`);
      refresh(who);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The fund did not sign.");
    } finally {
      setFunding("");
    }
  }

  async function openRow(mint: string, symbol: string) {
    setOpening(symbol);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
      }
      const sig = await openOne(who, mint);
      toast.success(sig ? `${symbol} is open. ${sig.slice(0, 8)}…` : `${symbol} was already open.`);
      refresh(who);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Phantom did not open it.");
    } finally {
      setOpening("");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Wallets</p>
      <h2 className="mt-1 font-display text-2xl tracking-tight">One button each.</h2>
      <p className="mt-1 max-w-lg text-sm text-muted">SOL is the Phantom. Each other line opens on its own. Fund swaps USDC into that token, in this same wallet. Phantom signs. It can fail.</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-subtle">Fund with</span>
        <input value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} inputMode="decimal" aria-label="Dollars to fund" className="min-h-9 w-24 rounded-full border border-white/10 bg-black/30 px-3 font-mono text-sm" />
        <span className="text-xs text-subtle">USDC</span>
      </div>
      {hold ? <p className="mt-3 font-mono text-3xl tabular-nums">{hold.sol.toLocaleString("en-US", { maximumFractionDigits: 4 })} <span className="text-base text-muted">SOL in this Phantom</span></p> : null}
      {owner ? (
        <ul className="mt-4 divide-y divide-white/10">
          {ATTACHED.map((row) => {
            const addr = attachedAddress(owner, row);
            return (
              <li key={row.id} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {row.symbol}{" "}
                      <span className="font-mono font-normal text-muted">
                        {row.id === "sol"
                          ? hold ? hold.sol.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"
                          : hold ? (hold.token[row.id] ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}
                      </span>
                    </p>
                    <p className="truncate font-mono text-[11px] text-subtle">{addr}</p>
                    <p className="text-[11px] text-muted">{row.id === "sol" ? "This is the wallet. SOL you sent here is already in Phantom." : row.line}</p>
                    {row.mint && (hold?.rent[row.id] ?? 0) > 0 && (hold?.token[row.id] ?? 0) === 0 ? (
                      <p className="text-[11px] text-subtle">{hold?.rent[row.id].toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL is rent keeping this line open, not a balance.</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => void copy(addr, row.symbol)} className="min-h-9 rounded-full border border-white/10 px-3 text-xs font-semibold">
                      Copy
                    </button>
                    {row.mint && !open[row.id] ? (
                      <button type="button" disabled={opening === row.symbol} onClick={() => void openRow(row.mint, row.symbol)} className="min-h-9 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40">
                        {opening === row.symbol ? "…" : "Open"}
                      </button>
                    ) : row.mint ? (
                      <span className="min-h-9 rounded-full px-3 py-2 text-xs font-semibold text-subtle">Open</span>
                    ) : null}
                    {row.mint && row.symbol !== "USDC" ? (
                      <button type="button" disabled={funding === row.symbol} onClick={() => void fund(row.id, row.mint, row.symbol)} className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">
                        {funding === row.symbol ? "…" : "Fund"}
                      </button>
                    ) : null}
                    {row.mint && (hold?.token[row.id] ?? 0) === 0 && (hold?.rent[row.id] ?? 0) > 0 ? (
                      <button type="button" disabled={closing === row.id} onClick={() => void takeRent(row.id, row.mint)} className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">
                        {closing === row.id ? "…" : "Return rent"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/** How dollars become pesos a cousin in Mexico can take out. The bank step is his, inside Bitso. */
export function CousinPesos() {
  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">To Mexico</p>
      <h2 className="mt-1 font-display text-2xl tracking-tight">Dollars to your cousin.</h2>
      <ol className="mt-3 space-y-2 text-sm text-muted">
        <li><span className="text-foreground">1.</span> He opens Bitso and copies the Solana USDC address it shows today. Or he sends you his Phantom address if he wants the peso token instead.</li>
        <li><span className="text-foreground">2.</span> You paste that address in Bitso below and send USDC, SOL, or the pesos you hold. Phantom signs. Senda does not take a cut.</li>
        <li><span className="text-foreground">3.</span> Bitso credits USDC or SOL. He sells for MXN. The peso token never arrives at Bitso. It only arrives in a Phantom.</li>
      </ol>
      <div className="mt-4 grid gap-2">
        {WAYS.map((way) => (
          <div key={way.n} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
            <p className="text-sm font-semibold">{way.n}. {way.title}</p>
            <p className="mt-0.5 text-xs text-muted">{way.line}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
