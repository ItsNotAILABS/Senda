import { Link } from "@tanstack/react-router";
import { FilmBand } from "@/components/film-band";
import { TabLead } from "@/components/tab-lead";
import { BIC, sendaIban } from "@/lib/iso20022";
import { PROGRAM_ID } from "@/lib/senda-program";
import { formatMoney, sendaDeposit } from "@/lib/wallet";
import { shortPk } from "@/lib/senda-keys";
import { WalletPicker } from "@/components/wallet-picker";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const CASH: { to: string; search?: { act: string }; label: string; hint: string }[] = [
  { to: "/payments", search: { act: "add" }, label: "Add money", hint: "Card, bank, Apple Pay, USDC, SOL" },
  { to: "/payments", search: { act: "send" }, label: "Send", hint: "@tag, same cash" },
  { to: "/payments", search: { act: "nearby" }, label: "Nearby", hint: "Bluetooth, NFC, or a note" },
  { to: "/payments", search: { act: "exchange" }, label: "Exchange", hint: "Hold EUR, MXN, USDC, SOL" },
];

const ALSO: { to: string; label: string; hint: string }[] = [
  { to: "/books", label: "Books", hint: "Internal tokens and the digest" },
  { to: "/social", label: "Play", hint: "Race, board, and a slip on the print" },
  { to: "/cards", label: "Cards", hint: "A number for a store" },
  { to: "/cover", label: "Cover", hint: "Phone, travel, rent, a haul, life" },
  { to: "/pre", label: "PreStocks", hint: "Buy, cover, spend, or see where a name stands" },
];

export function MoreDesk() {
  const { w, usd } = useWallet();
  const ach = sendaDeposit(w.tag);

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Account"
        title="The account"
        accent="on this browser."
        line="Wallets you linked. The privacy note. Cash that stays on this browser."
        live={["Wallets you linked.", "The privacy note.", "Cash on this browser."]}
        coming={["A login that follows you to another computer."]}
      />
      <section className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Wallets</p>
          <h2 className="mt-2 text-3xl tracking-tight">The address that signs</h2>
          <p className="mt-2 text-sm text-muted">Senda only keeps the address. {w.links.length} connected.</p>
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
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Cash</p>
          <h2 className="mt-2 font-mono text-5xl tabular-nums">{formatMoney(usd)}</h2>
          <p className="mt-2 text-sm text-muted">Same cash. Add it, send it, or hold another currency.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Pocket k="USD" v={formatMoney(w.balances.USD)} />
            <Pocket k="USDC" v={formatMoney(w.balances.USDC ?? 0, "USDC")} />
            <Pocket k="SOL" v={formatMoney(w.balances.SOL, "SOL")} />
            <Pocket k="Cards" v={String(w.cards.length)} />
          </div>
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
      <header className="rounded-[22px] border border-white/10 bg-[#10131c] p-6 lg:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Account</p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] tracking-tight lg:text-5xl">
          {w.tag}. <span className="text-accent">One account.</span>
        </h1>
        <p className="mt-4 font-mono text-4xl tabular-nums lg:text-5xl">{formatMoney(usd)}</p>
        <p className="mt-3 max-w-xl text-sm text-muted">One account. Cash, cards, cover, and the wallet that signs a PreStock.</p>
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
