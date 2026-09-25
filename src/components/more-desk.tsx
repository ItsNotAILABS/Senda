import { Link } from "@tanstack/react-router";
import { FilmBand } from "@/components/film-band";
import { BIC, sendaIban } from "@/lib/iso20022";
import { PROGRAM_ID } from "@/lib/senda-program";
import { formatMoney, sendaDeposit } from "@/lib/wallet";
import { shortPk } from "@/lib/senda-keys";
import { WalletPicker } from "@/components/wallet-picker";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const LINKS: { to: string; search?: { act: string; from?: string }; label: string; hint: string }[] = [
  { to: "/payments", search: { act: "add" }, label: "Add money", hint: "Card, bank, Apple Pay, USDC, SOL" },
  { to: "/payments", search: { act: "send" }, label: "Send", hint: "@tag, same cash" },
  { to: "/payments", search: { act: "nearby" }, label: "Nearby", hint: "Bluetooth, NFC, or a note" },
  { to: "/payments", search: { act: "exchange" }, label: "Exchange", hint: "Hold EUR, MXN, USDC, SOL" },
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
      <header className="rounded-[28px] border border-white/10 bg-[#101018] p-6">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Account</p>
        <h1 className="mt-2 text-4xl">{w.tag}</h1>
        <p className="mt-2 font-mono text-4xl tabular-nums">{formatMoney(usd)}</p>
        <p className="mt-2 max-w-xl text-sm text-muted">One account. Cash, cards, cover, and the wallet that signs a PreStock.</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/legal" className="text-accent">Privacy</Link>
          <Link to="/login" className="text-muted">Sign in to keep this wallet</Link>
        </div>
      </header>
      <FilmBand poster="/images/hero.jpg" label="One account." />

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Pocket k="USD" v={formatMoney(w.balances.USD)} />
        <Pocket k="USDC" v={formatMoney(w.balances.USDC ?? 0, "USDC")} />
        <Pocket k="SOL" v={formatMoney(w.balances.SOL, "SOL")} />
        <Pocket k="Cards" v={String(w.cards.length)} />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <h2 className="text-lg">Wallets</h2>
          <p className="mt-1 text-sm text-muted">The key stays in the wallet. Senda only keeps the address.</p>
          {w.links.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {w.links.map((l) => (
                <li key={l.id} className="flex items-center justify-between rounded-2xl bg-black/40 px-3 py-2 text-sm">
                  <span>{l.label}</span>
                  <span className="font-mono text-xs text-subtle">{shortPk(l.address)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-subtle">None connected.</p>
          )}
          <div className="mt-4"><WalletPicker /></div>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
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
      </section>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {LINKS.map((l) => (
          <Link key={l.label} to={l.to} search={l.search as never} className="rounded-[24px] border border-white/10 bg-[#101018] px-4 py-4">
            <span className="block text-sm font-semibold">{l.label}</span>
            <span className="mt-1 block text-xs text-muted">{l.hint}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}

function Pocket({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#101018] px-4 py-4">
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
