import { Link } from "@tanstack/react-router";
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
  { to: "/social", label: "Play", hint: "Routed into the live PreStocks print" },
  { to: "/cards", label: "Cards", hint: "Virtual debit you issue" },
  { to: "/cover", label: "Cover", hint: "Phone, travel, rent, life. Puts on Trade." },
  { to: "/accounts", label: "Link Phantom", hint: "Wallet you already have" },
];

export function MoreDesk() {
  const { w, usd } = useWallet();
  const ach = sendaDeposit(w.tag);

  return (
    <main className="flex flex-1 flex-col px-5 pt-6 pb-8">
      <h1 className="font-display text-4xl tracking-tight">Account</h1>
      <p className="mt-1 text-sm text-muted">
        One cash account. ISO 20022 on send (pain.001 / UETR). ISO 8583 on card auth. PreStocks fills on Jupiter — we
        don’t take the other side.
      </p>

      <dl className="mt-6 divide-y divide-border rounded-2xl bg-elevated">
        <Row k="Tag" v={w.tag} />
        <Row k="Total" v={formatMoney(usd)} />
        <Row k="USD" v={formatMoney(w.balances.USD)} />
        <Row k="USDC" v={formatMoney(w.balances.USDC ?? 0, "USDC")} />
        <Row k="SOL" v={formatMoney(w.balances.SOL, "SOL")} />
        <Row k="Cards" v={String(w.cards.length)} />
        <Row k="Cover" v={String(w.policies.length)} />
        <Row k="Vaults" v={String(w.vaults.length)} />
      </dl>

      {w.senda ? (
        <p className="mt-4 break-all font-mono text-xs text-subtle">Senda wallet · {shortPk(w.senda.pubkey)}</p>
      ) : null}
      <p className="mt-2 font-mono text-xs text-subtle">
        BIC {BIC} · ACH {ach.routing} {ach.account}
      </p>
      <p className="mt-1 break-all font-mono text-xs text-subtle">EUR acct {sendaIban(w.tag, "EUR")}</p>
      <p className="mt-1 break-all font-mono text-xs text-subtle">Program {PROGRAM_ID}</p>

      <h2 className="mt-8 text-sm font-medium text-muted">Wallets</h2>
      <div className="mt-2 rounded-2xl bg-elevated px-4 py-4">
        {w.links.length > 0 ? (
          <ul className="mb-4 divide-y divide-border">
            {w.links.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between py-2 text-sm">
                <span>{l.label}</span>
                <span className="font-mono text-xs text-subtle">{shortPk(l.address)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <WalletPicker />
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">Everything in this app</h2>
      <ul className="mt-2 overflow-hidden rounded-2xl bg-elevated">
        {LINKS.map((l) => (
          <li key={l.label} className="border-b border-border last:border-0">
            <Link
              to={l.to}
              search={l.search as never}
              className="flex min-h-16 flex-col justify-center px-4 py-3"
            >
              <span className="text-sm font-semibold">{l.label}</span>
              <span className="text-xs text-muted">{l.hint}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        to="/login"
        className="mt-6 min-h-12 rounded-full text-center text-sm font-medium leading-[3rem] text-muted"
      >
        Sign in to keep this wallet
      </Link>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between px-4 py-3">
      <dt className="text-sm text-muted">{k}</dt>
      <dd className="font-mono text-sm tabular-nums">{v}</dd>
    </div>
  );
}
