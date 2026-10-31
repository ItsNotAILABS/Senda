import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PortfolioNav } from "@/components/portfolio-nav";
import { TabLead } from "@/components/tab-lead";
import { AAVE, aaveAccount, aaveBorrow, aaveRepay, aaveSupply, type AaveAccount, type AaveNet } from "@/lib/aave-lend";
import { kaminoLoans, kaminoMarkets, signKamino, type KaminoLoan, type KaminoReserve } from "@/lib/kamino-lend";
import { MarginfiBook } from "@/components/extra-rails";
import { connectPhantom, mintDecimals, phantomProvider } from "@/lib/phantom";
import { liquidateLock, lockPubkey, lockShares, readLock, unlockShares, type ShareLock } from "@/lib/share-lock";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function LoansDesk() {
  const wallet = useWallet();
  const sol = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const evm = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
  const [reserves, setReserves] = useState<KaminoReserve[]>([]);
  const [loans, setLoans] = useState<KaminoLoan[]>([]);
  const [market, setMarket] = useState("Main");
  const [reserve, setReserve] = useState("");
  const [usd, setUsd] = useState(5);
  const [net, setNet] = useState<AaveNet>(AAVE[0]);
  const [account, setAccount] = useState<AaveAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState<ShareLock | null>(null);
  const [lockMint, setLockMint] = useState("");
  const [lockSymbol, setLockSymbol] = useState("PRE");
  const [lockUi, setLockUi] = useState("1");
  const [lender, setLender] = useState("");
  const [floor, setFloor] = useState("");
  const book = reserves.filter((row) => row.marketName === market).sort((a, b) => b.totalSupplyUsd - a.totalSupplyUsd);
  const picked = book.find((row) => row.reserve === reserve) ?? book.find((row) => row.symbol !== "USDC") ?? null;
  const usdc = book.find((row) => row.symbol === "USDC") ?? null;
  const deep = (row: KaminoReserve | null) => !row || !(row.totalSupplyUsd > 0) || usd <= row.totalSupplyUsd * 0.05;

  useEffect(() => {
    setLock(readLock());
  }, []);

  useEffect(() => {
    kaminoMarkets()
      .then((rows) => {
        setReserves(rows);
        const first = rows.find((row) => row.marketName === "Main" && row.symbol === "USDC")
          ?? rows.find((row) => row.marketName === "Main");
        setReserve(first?.reserve ?? "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!sol) {
      setLoans([]);
      return;
    }
    kaminoLoans(sol).then(setLoans).catch(() => setLoans([]));
  }, [sol, busy]);

  useEffect(() => {
    if (!evm) {
      setAccount(null);
      return;
    }
    aaveAccount(net, evm).then(setAccount).catch(() => setAccount(null));
  }, [evm, net, busy]);

  async function signer() {
    const live = phantomProvider()?.publicKey?.toString();
    const who = live || sol || (await connectPhantom());
    if (who !== sol) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
    }
    return who;
  }

  async function kamino(action: "deposit" | "borrow" | "repay" | "withdraw", row: KaminoReserve | null) {
    if (!row) return;
    setBusy(true);
    try {
      const who = await signer();
      const sig = await signKamino({
        action,
        wallet: who,
        market: row.market,
        reserve: row.reserve,
        amount: String(usd),
      });
      toast.success(`${action} ${row.symbol}. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kamino did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function aave(kind: "supply" | "borrow" | "repay") {
    if (!evm) return toast.error("Connect an Ethereum wallet on Wallets.");
    setBusy(true);
    try {
      const hash =
        kind === "supply" ? await aaveSupply(net, evm, usd) : kind === "borrow" ? await aaveBorrow(net, evm, usd) : await aaveRepay(net, evm, usd);
      toast.success(`${kind} on ${net.name}. ${hash.slice(0, 10)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aave did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function lockNow() {
    setBusy(true);
    try {
      const who = sol || (await connectPhantom());
      const decimals = await mintDecimals(lockMint.trim());
      const sig = await lockShares({
        owner: who,
        mint: lockMint.trim(),
        symbol: lockSymbol.trim() || "PRE",
        ui: Number(lockUi),
        decimals,
        lender: lender.trim(),
        floor: Number(floor),
      });
      setLock(readLock());
      toast.success(`Locked. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The lock did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function watchLock() {
    const row = readLock();
    if (!row) return;
    setBusy(true);
    try {
      const res = await fetch(`https://lite-api.jup.ag/price/v2?ids=${row.mint}`, { headers: { accept: "application/json" } });
      const body = (await res.json()) as { data?: Record<string, { price?: string }> };
      const px = Number(body?.data?.[row.mint]?.price) || 0;
      if (!(px > 0)) throw new Error("Jupiter has no price for that mint.");
      const sig = await liquidateLock(px);
      setLock(readLock());
      toast.success(sig ? `Paid the lender. ${sig.slice(0, 8)}…` : "The print is still above the floor.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The lock did not sell.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-4 px-3 py-3 lg:px-4">
      <PortfolioNav current="loans" />
      <TabLead
        kicker="Portfolio"
        title="Loans"
        accent="you sign."
        line="Kamino holds Solana collateral. Aave holds Ethereum and Base collateral. Senda only asks the wallet to sign the transaction that market built."
        live={["Kamino deposit, borrow, repay, and withdraw.", "Aave supply, borrow, and repay on Ethereum and Base.", "Your open Kamino loans, read from the market."]}
        coming={["A loan on a chain that has no transaction builder yet."]}
      />
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Solana · Kamino</p>
        <div className="mt-3 flex gap-1">
          {["Main", "xStocks"].map((name) => (
            <button key={name} type="button" onClick={() => setMarket(name)} className={cn("min-h-10 rounded-full px-3 text-sm font-semibold", market === name ? "bg-white text-black" : "border border-white/15 text-muted")}>
              {name}
            </button>
          ))}
        </div>
        <ul className="mt-3 space-y-2">
          {loans.length === 0 ? <li className="text-sm text-muted">No Kamino loan on this Solana address.</li> : null}
          {loans.map((loan) => (
            <li key={loan.id} className="rounded-2xl border border-white/10 px-3 py-3 text-sm">
              <p>Collateral {loan.collateral}</p>
              <p className="mt-1 text-muted">Debt {loan.debt}</p>
              <p className="mt-1 font-mono text-xs text-subtle">LTV {(loan.ltv * 100).toFixed(1)}%</p>
            </li>
          ))}
        </ul>
        <label className="mt-4 block text-xs text-muted">
          Collateral
          <select value={picked?.reserve ?? ""} onChange={(e) => setReserve(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm">
            {book.map((row) => (
              <option key={row.reserve} value={row.reserve}>
                {row.symbol} · supply {(row.supplyApy * 100).toFixed(2)}% · borrow {(row.borrowApy * 100).toFixed(2)}% · ${Math.round(row.totalSupplyUsd).toLocaleString("en-US")}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 flex gap-1">
          {[1, 5, 25].map((n) => (
            <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/15 text-muted")}>
              {n}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy || !picked || !deep(picked)} onClick={() => void kamino("deposit", picked)} className="min-h-11 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            Deposit {usd} {picked?.symbol ?? ""}
          </button>
          <button type="button" disabled={busy || !picked} onClick={() => void kamino("withdraw", picked)} className="min-h-11 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">
            Withdraw {usd}
          </button>
          <button type="button" disabled={busy || !usdc || !deep(usdc)} onClick={() => void kamino("borrow", usdc)} className="min-h-11 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
            Borrow {usd} USDC
          </button>
          <button type="button" disabled={busy || !usdc} onClick={() => void kamino("repay", usdc)} className="min-h-11 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">
            Repay {usd} USDC
          </button>
        </div>
        <p className="mt-2 text-[11px] text-subtle">
          {picked ? `${picked.symbol} has $${Math.round(picked.totalSupplyUsd).toLocaleString("en-US")} supplied on Kamino. ` : ""}
          {usdc ? `USDC has $${Math.round(usdc.totalSupplyUsd).toLocaleString("en-US")}. ` : ""}
          A size over 5% of that reserve is blocked. Deposit locks the token in Kamino. The token does not come to Senda.
        </p>
      </section>
      <MarginfiBook />
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Ethereum and Base · Aave</p>
        <div className="mt-3 flex gap-1">
          {AAVE.map((row) => (
            <button key={row.id} type="button" onClick={() => setNet(row)} className={cn("min-h-10 rounded-full px-3 text-sm font-semibold", net.id === row.id ? "bg-white text-black" : "border border-white/15 text-muted")}>
              {row.name}
            </button>
          ))}
        </div>
        {account ? (
          <p className="mt-3 text-sm">
            Collateral ${account.collateral.toFixed(2)} · debt ${account.debt.toFixed(2)} · you can borrow ${account.available.toFixed(2)}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">{evm ? "No Aave position read on this address." : "Connect an Ethereum wallet on Wallets. Phantom’s Ethereum account works."}</p>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button type="button" disabled={busy || !evm} onClick={() => void aave("supply")} className="min-h-11 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            Supply {usd} USDC
          </button>
          <button type="button" disabled={busy || !evm} onClick={() => void aave("borrow")} className="min-h-11 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
            Borrow {usd} USDC
          </button>
          <button type="button" disabled={busy || !evm} onClick={() => void aave("repay")} className="min-h-11 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">
            Repay {usd} USDC
          </button>
        </div>
        <p className="mt-2 text-[11px] text-subtle">Supply asks for an approval, then the deposit. Borrow fails on the chain if this address has no collateral. Variable rate. You need a little ETH on that network for the fee.</p>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">PreStock lock</p>
        <h2 className="mt-1 text-xl tracking-tight">Lock a share. Pay the lender if the print breaks the floor.</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Kamino lends listed xStocks. A new lock is not given a key in this browser. If this phone already holds one, the address is below and you can still send the share back.
        </p>
        <p className="mt-2 break-all font-mono text-[11px] text-subtle">{lockPubkey()}</p>
        {lock ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <p className="w-full text-sm">{lock.symbol} locked. Floor ${lock.floor}. Lender {lock.lender.slice(0, 4)}…</p>
            <button type="button" disabled={busy} onClick={() => void watchLock()} className="h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">Check the floor</button>
            <button type="button" disabled={busy || !sol} onClick={() => void unlockShares(sol).then((sig) => { setLock(readLock()); toast.success(`Unlocked. ${sig.slice(0, 8)}`); }).catch((e) => toast.error(e instanceof Error ? e.message : "Unlock failed."))} className="h-10 rounded-full border border-white/15 px-4 text-sm font-semibold">Send it back</button>
          </div>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input value={lockMint} onChange={(e) => setLockMint(e.target.value.trim())} placeholder="Token mint" spellCheck={false} className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
            <input value={lockSymbol} onChange={(e) => setLockSymbol(e.target.value)} placeholder="Symbol" className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
            <input value={lockUi} onChange={(e) => setLockUi(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Tokens" className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
            <input value={floor} onChange={(e) => setFloor(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Floor price" className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
            <input value={lender} onChange={(e) => setLender(e.target.value.trim())} placeholder="Lender address" spellCheck={false} className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs sm:col-span-2" />
            <button type="button" disabled={busy} onClick={() => void lockNow()} className="h-11 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40 sm:col-span-2">Lock into this browser</button>
          </div>
        )}
      </section>
    </main>
  );
}
