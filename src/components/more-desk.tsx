import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FilmBand } from "@/components/film-band";
import { TabLead } from "@/components/tab-lead";
import { BIC, sendaIban } from "@/lib/iso20022";
import { PROGRAM_ID } from "@/lib/senda-program";
import { formatMoney, sendaDeposit } from "@/lib/wallet";
import { shortPk } from "@/lib/senda-keys";
import { readChain, readUsdcMoves, type ChainWallet, type UsdcMove } from "@/lib/phantom";
import { readActs, type Act } from "@/lib/book";
import { dollarsOf, movedThrough, recordMove } from "@/lib/moves";
import { WalletPicker } from "@/components/wallet-picker";
import { readTapePrefs, writeTapePrefs, type TapeFilter, type TapeSpeed } from "@/lib/tape-prefs";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { LendDesk } from "@/components/lend-desk";
import { OfferingBook } from "@/components/offering-book";
import { OwnedCards } from "@/components/owned-cards";
import { SavingsLane } from "@/components/savings-lane";
import { getHouse, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const CASH: { to: string; search?: { act: string }; label: string; hint: string }[] = [
  { to: "/payments", search: { act: "revolut" }, label: "Revolut", hint: "Their app. Withdraw SOL or USDC here." },
  { to: "/payments", search: { act: "add" }, label: "Add", hint: "USDC already in the wallet, or buy it in Phantom." },
  { to: "/payments", search: { act: "send" }, label: "Send", hint: "USDC to a Solana address." },
  { to: "/payments", search: { act: "nearby" }, label: "Nearby", hint: "Bluetooth, NFC, or a note." },
  { to: "/payments", search: { act: "exchange" }, label: "Exchange", hint: "A quote. Not a conversion." },
];

const ALSO: { to: string; label: string; hint: string }[] = [
  { to: "/tv", label: "Crypto TV", hint: "Live desks and a video you can look up" },
  { to: "/books", label: "Books", hint: "Internal tokens and the digest" },
  { to: "/social", label: "Play", hint: "Race, board, and a slip on the print" },
  { to: "/cards", label: "Cards", hint: "A number for a store" },
  { to: "/cover", label: "Cover", hint: "Phone, travel, rent, a haul, life" },
  { to: "/pre", label: "PreStocks", hint: "Buy, cover, spend, or see where a name stands" },
  { to: "/contracts", label: "Contracts", hint: "Buy a call or a put, or open a pocket" },
];

export function MoreDesk() {
  const { w, usd } = useWallet();
  const ach = sendaDeposit(w.tag);
  const owner = w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [chain, setChain] = useState<ChainWallet | null>(null);
  const [chainMiss, setChainMiss] = useState(false);
  const [moves, setMoves] = useState<UsdcMove[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [book, setBook] = useState<"all" | "chain" | "fill">("all");
  const [face, setFace] = useState<"account" | "settings">("account");
  const [tape, setTape] = useState(readTapePrefs);
  const [cap, setCap] = useState(100);
  const [pocket, setPocket] = useState<"holdings" | "loans" | "savings">("holdings");
  const [house, setHouse] = useState<HouseListing[]>([]);
  useEffect(() => setCap(spendCap()), []);
  useEffect(() => {
    getHouse().then(setHouse).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!owner) {
      setChain(null);
      setChainMiss(false);
      return;
    }
    let live = true;
    setChain(null);
    setChainMiss(false);
    readChain(owner)
      .then((snap) => {
        if (!live) return;
        setChain(snap);
      })
      .catch(() => {
        if (!live) return;
        setChain(null);
        setChainMiss(true);
      });
    readUsdcMoves(owner)
      .then((rows) => live && setMoves(rows))
      .catch(() => live && setMoves([]));
    setActs(readActs());
    return () => {
      live = false;
    };
  }, [owner]);

  const chainUsdc = chain?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;
  const otherTokens = chain ? chain.tokens.filter((t) => t.symbol !== "USDC").length : 0;
  const chainText = (v: string) => (chainMiss ? "—" : chain ? v : "…");

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Account"
        title="Your account"
        accent="is the wallet."
        line="USDC on the address you connect. Add it, send it, request it, or spend it with the card."
        live={["Live USDC on the address.", "A pay link anyone can settle.", "A card that spends that USDC.", "The signatures that landed."]}
        coming={["A card a store terminal will clear."]}
      />
      <div className="flex gap-2">
        {(["account", "settings"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFace(id)}
            className={cn("min-h-10 rounded-full px-4 text-sm font-semibold capitalize", face === id ? "bg-white text-black" : "bg-[#1c1c1e] text-white/60")}
          >
            {id}
          </button>
        ))}
      </div>
      {face === "settings" ? (
        <section className="space-y-3">
          <article className="rounded-[22px] border border-[#c6f56a]/20 bg-[#070b08] p-4">
            <p className="text-sm font-semibold">Tape</p>
            <p className="mt-1 text-xs text-white/45">How fast the prices move, and which way they have to be going.</p>
            <div className="mt-3 flex gap-2">
              {(["slow", "desk", "fast"] as TapeSpeed[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    const next = { ...tape, speed: id };
                    setTape(next);
                    writeTapePrefs(next);
                  }}
                  className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold capitalize", tape.speed === id ? "bg-[#c6f56a] text-black" : "bg-black/40 text-white/70")}
                >
                  {id === "slow" ? "Slow" : id === "desk" ? "Desk" : "Fast"}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {(
                [
                  ["all", "All"],
                  ["up", "Winners"],
                  ["down", "Down"],
                ] as [TapeFilter, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    const next = { ...tape, filter: id };
                    setTape(next);
                    writeTapePrefs(next);
                  }}
                  className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", tape.filter === id ? "bg-white text-black" : "bg-black/40 text-white/70")}
                >
                  {label}
                </button>
              ))}
            </div>
          </article>
          <article className="rounded-[22px] border border-white/10 bg-[#101114] p-4">
            <p className="text-sm font-semibold">Send cap</p>
            <p className="mt-1 text-xs text-white/45">The most an agent can ask you to sign in one send. You still sign.</p>
            <div className="mt-3 flex gap-2">
              {[25, 100, 500].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCap(setSpendCap(n))}
                  className={cn("min-h-10 flex-1 rounded-full font-mono text-sm", cap === n ? "bg-[#c6f56a] text-black" : "bg-black/40 text-white/70")}
                >
                  ${n}
                </button>
              ))}
            </div>
          </article>
          <article className="rounded-[22px] border border-white/10 bg-[#101114] p-4">
            <p className="text-sm font-semibold">Also on this account</p>
            <div className="mt-3 grid gap-2">
              <Link to="/vault" className="rounded-2xl bg-black/40 px-4 py-3 text-sm font-semibold">Portfolio</Link>
              <Link to="/wallets" className="rounded-2xl bg-black/40 px-4 py-3 text-sm font-semibold">Wallets</Link>
              <Link to="/accounts" className="rounded-2xl bg-black/40 px-4 py-3 text-sm font-semibold">Venue links</Link>
              <Link to="/cards" search={{ spend: 0 }} className="rounded-2xl bg-black/40 px-4 py-3 text-sm font-semibold">Card</Link>
            </div>
          </article>
        </section>
      ) : null}
      {face === "account" ? (
      <>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Your money</p>
        <h2 className="mt-2 font-mono text-5xl tabular-nums tracking-tight">
          {!owner ? "$0" : chainMiss ? "—" : !chain ? "…" : formatMoney(chainUsdc, "USDC")}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          {owner ? "USDC on the address you connected." : "Connect a wallet. That address is the account."}
        </p>
        <p className="mt-3 max-w-xl text-sm text-muted">
          The balance is read from Solana. Send, request, and the card move that USDC when you sign. Browser cash is not this balance. A store will not charge the card number.
        </p>
        <p className="mt-3 font-mono text-sm text-subtle">Browser cash, separate: {formatMoney(usd)}. It is not the wallet.</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Link to="/invest" className="flex min-h-14 items-center rounded-2xl border border-white/10 px-4 text-sm font-semibold">
            Buy a name. You sign. It lands in your wallet.
          </Link>
          <Link to="/payments" search={{ act: "link" } as never} className="flex min-h-14 items-center rounded-2xl border border-white/10 px-4 text-sm font-semibold">
            Make a payment link. Someone pays your address in USDC.
          </Link>
          <Link to="/social" className="flex min-h-14 items-center rounded-2xl border border-white/10 px-4 text-sm font-semibold">
            Above or below the print.
          </Link>
        </div>
      </section>
      <div className="mt-1">
        <OwnedCards
          sol={chain?.sol ?? 0}
          solPx={0}
          tokens={chain?.tokens ?? []}
          marks={house.filter((n) => n.last > 0).map((n) => ({ mint: n.mint, last: n.last, name: n.name }))}
        />
      </div>
      <div className="flex gap-2">
        {(
          [
            ["holdings", "Holdings"],
            ["loans", "Loans"],
            ["savings", "Savings"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPocket(id)}
            className={cn("min-h-10 rounded-full px-4 text-sm font-semibold", pocket === id ? "bg-white text-black" : "border border-white/15 text-white/70")}
          >
            {label}
          </button>
        ))}
      </div>
      {pocket === "loans" ? <LendDesk house={house} /> : null}
      {pocket === "savings" ? (
        <SavingsLane
          owner={owner}
          sol={chain?.sol ?? 0}
          jito={chain?.tokens.find((t) => t.symbol === "JitoSOL")?.ui ?? 0}
          solPx={0}
        />
      ) : null}
      <OfferingBook />
      <section className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Wallets</p>
          <h2 className="mt-2 text-3xl tracking-tight">The address that signs</h2>
          <p className="mt-2 text-sm text-muted">Senda only keeps the address. {w.links.length} connected.</p>
          <button
            type="button"
            disabled={!owner}
            onClick={() => {
              if (!owner) return;
              setChain(null);
              setChainMiss(false);
              readChain(owner)
                .then(setChain)
                .catch(() => setChainMiss(true));
            }}
            className="mt-3 min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40"
          >
            Refresh
          </button>
          {w.links.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {w.links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-4 text-sm">
                  <span className="font-semibold">{l.label}</span>
                  <span className="font-mono text-sm text-subtle">{shortPk(l.address)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-subtle">None connected.</p>
          )}
          <div className="mt-4"><WalletPicker /></div>
          <Link to="/wallet" className="mt-4 inline-flex min-h-14 items-center rounded-full bg-accent px-6 text-base font-semibold text-accent-fg">
            Open wallet
          </Link>
        </article>

        <article className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Browser cash</p>
          <h2 className="mt-2 text-3xl tracking-tight">Move the browser cash</h2>
          <p className="mt-2 text-sm text-muted">This is the cash on this computer. It is not the SOL or USDC in Phantom.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Pocket k="USD" v={formatMoney(w.balances.USD)} />
            <Pocket k="USDC" v={formatMoney(w.balances.USDC ?? 0, "USDC")} />
            <Pocket k="SOL" v={formatMoney(w.balances.SOL, "SOL")} />
            <Pocket k="Cards" v={String(w.cards.length)} />
          </div>
          {owner ? (
            <>
              <p className="mt-4 font-mono text-[11px] tracking-[0.16em] text-subtle">
                <span className="uppercase">Wallet</span> · {shortPk(owner)}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Pocket k="SOL" v={chainText(formatMoney(chain?.sol ?? 0, "SOL"))} />
                <Pocket k="USDC" v={chainText(formatMoney(chainUsdc, "USDC"))} />
                <Pocket k="Other tokens" v={chainText(String(otherTokens))} />
              </div>
            </>
          ) : null}
          <ul className="mt-4 space-y-2">
            {CASH.map((l) => (
              <li key={l.label}>
                <Link to={l.to} search={l.search as never} className="flex min-h-14 items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-3">
                  <span>
                    <span className="block text-sm font-semibold">{l.label}</span>
                    <span className="block text-xs text-muted">{l.hint}</span>
                  </span>
                  <span className="text-accent">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Privacy</p>
          <h2 className="mt-2 text-3xl tracking-tight">What this account keeps</h2>
          <p className="mt-2 text-sm text-muted">The key stays in the wallet. Cash, the wrap, and notes stay in this browser.</p>
          <div className="mt-5 flex flex-col gap-2">
            <Link to="/legal" className="inline-flex min-h-14 items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-accent-fg">
              Privacy
            </Link>
            <Link to="/login" className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/15 px-6 text-base font-semibold">
              Sign in to keep this wallet
            </Link>
          </div>
        </article>
      </section>
      <section className="rounded-[28px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-[#d7e36a]">IN THE WALLET</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Connect Phantom"}</h2>
        <p className="mt-1 text-sm text-white/55">Read from Solana. Not the cash stored in this browser.</p>
        <button
          type="button"
          disabled={!owner}
          onClick={() => {
            if (!owner) return;
            setChain(null);
            setChainMiss(false);
            readChain(owner).then(setChain).catch(() => setChainMiss(true));
            readUsdcMoves(owner).then(setMoves).catch(() => setMoves([]));
          }}
          className="mt-4 min-h-11 rounded-full border border-white/20 px-5 text-sm font-semibold disabled:opacity-40"
        >
          Refresh
        </button>
        {!owner ? (
          <p className="mt-4 text-sm text-white/45">Nothing to show until a wallet is connected.</p>
        ) : chainMiss ? (
          <p className="mt-4 text-sm text-down">The chain did not answer.</p>
        ) : !chain ? (
          <p className="mt-4 text-sm text-white/45">Reading the address…</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[22px] bg-black/50 px-4 py-3">
                <p className="text-xs text-white/45">SOL</p>
                <p className="font-mono text-2xl tabular-nums">{chain.sol.toFixed(4)}</p>
              </div>
              <div className="rounded-[22px] bg-black/50 px-4 py-3">
                <p className="text-xs text-white/45">USDC</p>
                <p className="font-mono text-2xl tabular-nums">{chainUsdc.toFixed(2)}</p>
              </div>
              <div className="rounded-[22px] bg-black/50 px-4 py-3">
                <p className="text-xs text-white/45">Tokens</p>
                <p className="font-mono text-2xl tabular-nums">{chain.tokens.length}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {chain.tokens.map((t) => (
                <li key={t.mint} className="flex items-center justify-between gap-3 rounded-[22px] bg-black/50 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">{t.symbol}</span>
                    <span className="block truncate font-mono text-[11px] text-white/35">{t.mint}</span>
                  </span>
                  <span className="font-mono tabular-nums">{t.ui >= 1 ? t.ui.toFixed(4) : t.ui.toFixed(4)}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-4 space-y-1">
              {chain.txs.map((tx) => (
                <li key={tx.signature} className="flex items-center justify-between font-mono text-xs text-white/55">
                  <span>{tx.signature.slice(0, 8)}…{tx.signature.slice(-6)}</span>
                  <span>{tx.err ? "failed" : "landed"}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-white/45">Browser cash, separate: {formatMoney(usd)}. It is not the wallet.</p>
          </>
        )}
      </section>

      {owner && chain ? (
        <section className="rounded-[28px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] tracking-[0.16em] text-[#d7e36a]">THIS PHANTOM</p>
          <h2 className="mt-1 text-2xl font-semibold">What the chain wrote</h2>
          <p className="mt-1 text-sm text-white/55">
            {owner.slice(0, 4)}…{owner.slice(-4)} · {chain.sol.toFixed(4)} SOL · ${chainUsdc.toFixed(2)} USDC · $0.00 CASH
          </p>
          <h3 className="mt-4 text-sm font-semibold">Dollar moves</h3>
          <ul className="mt-2">
            {moves.length === 0 ? <li className="text-sm text-white/45">No USDC move in the last signatures.</li> : null}
            {moves.map((m) => (
              <li key={m.signature} className="flex items-center justify-between border-t border-white/10 py-2 font-mono text-sm">
                <span className="text-[#d7e36a]">{m.signature.slice(0, 8)}…</span>
                <span className={m.delta < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]"}>
                  {m.delta === 0 ? "—" : `${m.delta > 0 ? "+" : "−"}$${Math.abs(m.delta).toFixed(2)}`}
                </span>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-sm font-semibold">Signatures</h3>
          <ul>
            {chain.txs.map((tx) => (
              <li key={tx.signature} className="flex items-center justify-between border-t border-white/10 py-2 text-sm">
                <span className="font-mono text-[#d7e36a]">{tx.signature.slice(0, 12)}…</span>
                <span className="text-xs text-white/45">
                  {tx.time ? new Date(tx.time * 1000).toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AppVolume />
      <section className="rounded-[28px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-[#d7e36a]">LEDGER</p>
        <h2 className="mt-1 text-3xl font-semibold">{(chain?.txs.length ?? 0) + acts.length} lines</h2>
        <p className="mt-2 text-sm text-white/55">Chain lines are public. Fills are what this desk recorded when Phantom signed.</p>
        <button
          type="button"
          onClick={() => {
            const lines = [
              ...acts.map((a) => `${new Date(a.ts).toISOString()} fill ${a.title} ${a.signature}`),
              ...(chain?.txs ?? []).map((tx) => `${tx.time ?? ""} chain ${tx.signature}`),
            ].join("\n");
            void navigator.clipboard?.writeText(lines);
          }}
          className="mt-3 min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-black"
        >
          Export
        </button>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-[22px] bg-black/50 px-4 py-3"><p className="text-[11px] tracking-wide text-white/40">CHAIN</p><p className="font-mono text-2xl">{chain?.txs.length ?? 0}</p></div>
          <div className="rounded-[22px] bg-black/50 px-4 py-3"><p className="text-[11px] tracking-wide text-white/40">FILL</p><p className="font-mono text-2xl">{acts.length}</p></div>
        </div>
        <div className="mt-3 flex gap-2">
          {(["all", "chain", "fill"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setBook(id)} className={`min-h-10 rounded-full px-4 text-sm font-semibold capitalize ${book === id ? "bg-[#d7e36a] text-black" : "bg-[#2a2a2e]"}`}>{id}</button>
          ))}
        </div>
        <div className="mt-3 flex justify-between text-[11px] tracking-[0.14em] text-white/40">
          <span>WHEN</span>
          <span>BOOK ENTRY</span>
        </div>
        <ul>
          {book !== "chain"
            ? acts.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 border-t border-white/10 py-3 text-sm">
                  <span className="text-xs text-white/45">{new Date(a.ts).toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="text-right">
                    <span className="block text-[11px] text-white/40">Fill</span>
                    <span className="block font-semibold text-[#d7e36a]">{a.title}</span>
                  </span>
                </li>
              ))
            : null}
          {book !== "fill"
            ? (chain?.txs ?? []).map((tx) => (
                <li key={tx.signature} className="flex items-start justify-between gap-3 border-t border-white/10 py-3 text-sm">
                  <span className="text-xs text-white/45">{tx.time ? new Date(tx.time * 1000).toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</span>
                  <span className="text-right">
                    <span className="block text-[11px] text-white/40">Chain</span>
                    <span className="block font-semibold text-[#d7e36a]">{tx.err ? "Failed" : "Signature"}</span>
                    <span className="block font-mono text-[11px] text-white/40">{tx.signature.slice(0, 4)}…{tx.signature.slice(-4)}</span>
                  </span>
                </li>
              ))
            : null}
        </ul>
      </section>
      <header className="rounded-[22px] border border-white/10 bg-[#10131c] p-6 lg:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Account</p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] tracking-tight lg:text-5xl">
          {w.tag}. <span className="text-accent">One account.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted">Cards, cover, and a PreStock all settle from the USDC on the connected wallet.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/legal" className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">Privacy</Link>
          <Link to="/login" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold">Sign in to keep this wallet</Link>
        </div>
      </header>
      <FilmBand poster="/images/hero.jpg" label="One account." />

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-lg">How cash is addressed</h2>
          <p className="mt-1 text-sm text-muted">Labels on this account. Not an account at a bank.</p>
          <dl className="mt-3 space-y-2 text-sm">
            <Rail k="ACH" v={`${ach.routing} ${ach.account}`} />
            <Rail k="BIC" v={BIC} />
            <Rail k="EUR" v={sendaIban(w.tag, "EUR")} />
            {w.senda ? <Rail k="Senda" v={shortPk(w.senda.pubkey)} /> : null}
            <Rail k="Program" v={PROGRAM_ID} />
          </dl>
          <p className="mt-3 text-xs text-subtle">{w.policies.length} covers · {w.vaults.length} vaults</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-lg">Also on this account</h2>
          <ul className="mt-3 space-y-2">
            {ALSO.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className="flex items-center justify-between gap-3 rounded-2xl bg-black/40 px-3 py-3">
                  <span>
                    <span className="block text-sm font-semibold">{l.label}</span>
                    <span className="block text-xs text-muted">{l.hint}</span>
                  </span>
                  <span className="font-mono text-xs text-subtle">
                    {l.to === "/cards" ? w.cards.length : l.to === "/cover" ? w.policies.length : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      </>
      ) : null}
    </div>
  );
}

function Pocket({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-black/40 px-3 py-3">
      <p className="text-xs text-subtle">{k}</p>
      <p className="mt-1 font-mono text-xl">{v}</p>
    </div>
  );
}

function Rail({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{k}</dt>
      <dd className="break-all font-mono text-xs">{v}</dd>
    </div>
  );
}

function AppVolume() {
  const [tot, setTot] = useState<{ usd: number; count: number; swaps: number; sends: number } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      for (const act of readActs()) {
        const usd = dollarsOf(act.title, act.detail);
        if (!(usd > 0)) continue;
        await recordMove({ data: { signature: act.signature, kind: act.kind, title: act.title, usd } }).catch(() => undefined);
      }
      const next = await movedThrough().catch(() => null);
      if (live) setTot(next);
    })();
    return () => {
      live = false;
    };
  }, []);
  const usd = tot?.usd ?? 0;
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-[#d7e36a]">THROUGH THE APP</p>
      <h2 className="mt-1 font-mono text-3xl font-semibold tabular-nums">${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
      <p className="mt-2 text-sm text-white/55">
        {tot ? `${tot.count} signatures. $${tot.swaps.toFixed(2)} traded. $${tot.sends.toFixed(2)} sent.` : "Reading the book."}
      </p>
      <p className="mt-2 text-xs text-white/40">A signature is written when the app broadcasts it. You do not mark it by hand. Dollars are filled in when that signature was a swap or a send. The same signature is counted once.</p>
    </section>
  );
}
