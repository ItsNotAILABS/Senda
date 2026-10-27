import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FilmBand } from "@/components/film-band";
import { TabLead } from "@/components/tab-lead";
import { JumpStrip } from "@/components/jump-strip";
import { formatMoney } from "@/lib/wallet";
import { shortPk } from "@/lib/senda-keys";
import { readChain, type ChainWallet } from "@/lib/phantom";
import { WalletPicker } from "@/components/wallet-picker";
import { RevolutAccount } from "@/components/revolut-account";
import { BrowserBook } from "@/components/browser-book";
import { CardFund } from "@/components/card-fund";
import { CompanyAccount } from "@/components/company-account";
import { MaskCard } from "@/components/mask-card";
import { LanguageSwitch } from "@/components/language-switch";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const START: { to: string; search?: { act: string }; line: string }[] = [
  { to: "/invest", line: "Buy a name. You sign. It lands in your wallet." },
  { to: "/payments", search: { act: "link" }, line: "Make a payment link. Someone pays your address in USDC." },
  { to: "/social", line: "Above or below the print." },
];

const CASH: { to: string; search?: Record<string, string>; label: string; hint: string }[] = [
  { to: "/wallet", label: "Swap", hint: "USDC, pesos, or another token. Phantom signs." },
  { to: "/payments", label: "Send", hint: "USDC to a person, a shop, or a batch." },
  { to: "/invest", label: "Trade", hint: "A name, a stake, or a Jupiter perpetual." },
  { to: "/vault", label: "Portfolio", hint: "What this address holds, and the signatures." },
];

const ALSO: { to: string; label: string; hint: string }[] = [
  { to: "/books", label: "Books", hint: "Internal tokens and the digest" },
  { to: "/social", label: "Play", hint: "Race, board, and a slip on the print" },
  { to: "/cards", label: "Cards", hint: "A number for a store" },
  { to: "/cover", label: "Cover", hint: "Phone, travel, rent, a haul, life" },
  { to: "/global", label: "Global", hint: "Bank payout, cards, eSIM, and Circle fees. A missing key stays dark." },
  { to: "/pre", label: "PreStocks", hint: "Buy, cover, spend, or see where a name stands" },
];

export function MoreDesk() {
  const { w, usd } = useWallet();
  const link = w.links.find((l) => l.kind === "phantom" || l.kind === "solana");
  const [chain, setChain] = useState<ChainWallet | null>(null);
  const [chainErr, setChainErr] = useState("");
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!link) {
      setChain(null);
      setChainErr("");
      return;
    }
    let live = true;
    const pull = () => {
      setReading(true);
      readChain(link.address)
        .then((s) => {
          if (!live) return;
          setChain(s);
          setChainErr("");
        })
        .catch((e: unknown) => {
          if (!live) return;
          setChainErr(e instanceof Error ? e.message : "Could not read that wallet.");
        })
        .finally(() => live && setReading(false));
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [link?.address]);

  const usdc = chain?.tokens.find((t) => t.symbol === "USDC");
  const held = chain?.tokens.filter((t) => t.symbol !== "USDC") ?? [];

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <JumpStrip />
      <TabLead
        kicker="Senda"
        title="Your account"
        accent="is the wallet."
        line="USDC on the address you connect. Add it, send it, request it, or spend it with the card."
        live={["USDC on the address", "A pay link anyone can settle", "A card that spends that USDC", "The signatures that landed"]}
        coming={["A card a store terminal will clear"]}
        audit={{
          live: "The balance is read from Solana. Send, request, and the card move that USDC when you sign.",
          hold: "Browser cash is not this balance. A store will not charge the card number.",
        }}
      />
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-subtle">Language</p>
        <LanguageSwitch />
      </div>
      <AccountCard
        tag={w.tag}
        last4={w.cards[0]?.last4 || ""}
        nameOn={w.cards[0]?.nameOn || w.tag}
        expiry={w.cards[0]?.expiry || ""}
        frozen={Boolean(w.cards[0]?.frozen)}
        usdc={chain ? (usdc?.ui ?? 0) : null}
      />
      <CompanyAccount />
      <MaskCard />
      <CardFund owner={link?.address ?? ""} />
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <h2 className="text-lg">Start</h2>
        <ul className="mt-3 grid gap-2 lg:grid-cols-3">
          {START.map((l) => (
            <li key={l.line}>
              <Link to={l.to} search={l.search as never} className="flex h-full items-center justify-between gap-3 rounded-2xl bg-black/40 px-3 py-3">
                <span className="text-sm font-semibold">{l.line}</span>
                <span className="text-accent">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Wallets</p>
          <h2 className="mt-2 text-3xl tracking-tight">Phantom and MetaMask</h2>
          <p className="mt-2 text-sm text-muted">Both can be signed in. A Solana leg uses Phantom. A Base leg uses MetaMask. Senda only keeps the addresses. {w.links.length} connected.</p>
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

        <article className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8 lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">In the wallet</p>
              <h2 className="mt-2 text-3xl tracking-tight">{link ? shortPk(link.address) : "Connect Phantom"}</h2>
              <p className="mt-2 text-sm text-muted">
                {link ? "Read from Solana. Not the cash stored in this browser." : "Nothing to show until a wallet is connected."}
              </p>
            </div>
            <button
              type="button"
              disabled={!link || reading}
              onClick={() => {
                if (!link) return;
                setReading(true);
                readChain(link.address)
                  .then((s) => {
                    setChain(s);
                    setChainErr("");
                  })
                  .catch((e: unknown) => setChainErr(e instanceof Error ? e.message : "Could not read that wallet."))
                  .finally(() => setReading(false));
              }}
              className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40"
            >
              {reading ? "Reading…" : "Refresh"}
            </button>
          </div>
          {!link ? (
            <div className="mt-4"><WalletPicker /></div>
          ) : chainErr ? (
            <p className="mt-4 text-sm text-down">{chainErr}</p>
          ) : !chain ? (
            <p className="mt-4 text-sm text-muted">Reading the address…</p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Pocket k="SOL" v={chain.sol.toLocaleString("en-US", { maximumFractionDigits: 4 })} />
                <Pocket k="USDC" v={(usdc?.ui ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} />
                <Pocket k="Tokens" v={String(held.length)} />
              </div>
              {held.length === 0 ? (
                <p className="mt-4 text-sm text-muted">No other tokens on this address. A buy lands here after you sign.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {held.map((t) => (
                    <li key={t.mint} className="flex items-center justify-between gap-3 rounded-2xl bg-black/40 px-4 py-3">
                      <span>
                        <span className="block text-sm font-semibold">{t.symbol}</span>
                        <span className="block font-mono text-[10px] text-subtle">{t.mint}</span>
                      </span>
                      <span className="font-mono text-lg tabular-nums">{t.ui.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>
                    </li>
                  ))}
                </ul>
              )}
              {chain.txs.length > 0 ? (
                <ul className="mt-4 space-y-1">
                  {chain.txs.slice(0, 5).map((tx) => (
                    <li key={tx.signature} className="flex items-center justify-between gap-3 font-mono text-xs text-subtle">
                      <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noreferrer" className="truncate text-white/70">
                        {tx.signature.slice(0, 8)}…{tx.signature.slice(-6)}
                      </a>
                      <span>{tx.err ? "failed" : "landed"}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
          <p className="mt-4 text-xs text-subtle">Browser cash, separate: {formatMoney(usd)}. It is not the wallet.</p>
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
      <header className="rounded-[22px] border border-white/10 bg-[#10131c] p-6 lg:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Account</p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] tracking-tight lg:text-5xl">
          {w.tag}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted">Cards, cover, and a PreStock all settle from the USDC on the connected wallet.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/legal" className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">Privacy</Link>
          <Link to="/login" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold">Sign in to keep this wallet</Link>
        </div>
      </header>
      <FilmBand poster="/images/hero.jpg" label={chain ? `${(usdc?.ui ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC on this address` : "Connect Phantom"} />

      <BrowserBook />

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <h2 className="text-lg">Where the chain USDC goes</h2>
          <p className="mt-1 text-sm text-muted">These leave Phantom. The browser book above does not.</p>
          <ul className="mt-3 space-y-2">
            {CASH.map((l) => (
              <li key={l.label}>
                <Link to={l.to} search={l.search as never} className="flex items-center justify-between gap-3 rounded-2xl bg-black/40 px-3 py-3">
                  <span>
                    <span className="block text-sm font-semibold">{l.label}</span>
                    <span className="block text-xs text-muted">{l.hint}</span>
                  </span>
                  <span className="text-accent">→</span>
                </Link>
              </li>
            ))}
          </ul>
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
    </div>
  );
}

function AccountCard({
  tag,
  last4,
  nameOn,
  expiry,
  frozen,
  usdc,
}: {
  tag: string;
  last4: string;
  nameOn: string;
  expiry: string;
  frozen: boolean;
  usdc: number | null;
}) {
  return (
    <section className="grid items-center gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <div className="relative aspect-[1.7/1] overflow-hidden rounded-[22px] bg-gradient-to-br from-[#243044] via-[#141820] to-[#0d2420] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgb(255_255_255/0.08)_48%,transparent_66%)]" />
        <div className="relative flex items-start justify-between">
          <p className="text-[11px] tracking-[0.18em] text-white/60 uppercase">Senda</p>
          <p className="text-[11px] font-semibold text-accent">{frozen ? "Frozen" : last4 ? "Live" : "No number"}</p>
        </div>
        <div className="relative mt-6 h-7 w-9 rounded-md bg-gradient-to-br from-[#d6c08a] to-[#8a7340]" />
        <p className="relative mt-5 font-mono text-lg tracking-[0.18em]">
          {last4 ? `••••  ••••  ••••  ${last4}` : "••••  ••••  ••••  ••••"}
        </p>
        <div className="relative mt-4 flex items-end justify-between text-sm">
          <div>
            <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">Name</p>
            <p className="font-medium">{nameOn || tag}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">Exp</p>
            <p className="font-mono">{expiry || "—"}</p>
          </div>
        </div>
      </div>
      <div>
        <p className="font-mono text-3xl tabular-nums">{usdc == null ? "…" : `${usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`}</p>
        <p className="mt-2 max-w-md text-sm text-muted">
          This face spends the USDC on the connected address. It is not a store card. A parked xStock contract holds the share itself. That share tracks the listed company. This balance does not.
        </p>
        <Link to="/cards" search={{ spend: 0 }} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
          {last4 ? "Open the card" : "Make the number"}
        </Link>
      </div>
    </section>
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
