import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUpRight, Bluetooth, Plus, RefreshCw } from "lucide-react";
import { AddAccountScreen } from "@/components/add-account";
import { AddMoneyScreen } from "@/components/add-money";
import { TokenMark } from "@/components/token-mark";
import { VaultRow } from "@/components/vault-row";
import { loadHouseBook, markHouse } from "@/lib/house-paper";
import { shortPk } from "@/lib/senda-keys";
import { getHouse, formatChg, formatUsd, type HouseListing } from "@/lib/sol-house";
import { CCY_META, formatMoney, sendaDeposit, type Ccy } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { act: "add", label: "Add", icon: Plus },
  { act: "send", label: "Send", icon: ArrowUpRight },
  { act: "nearby", label: "Nearby", icon: Bluetooth },
  { act: "exchange", label: "Exchange", icon: RefreshCw },
] as const;

const PRODUCTS = [
  { to: "/lab", label: "Lab", hint: "12 desks" },
  { to: "/market", label: "Market", hint: "Stream" },
  { to: "/invest", label: "Trade", hint: "Jupiter" },
  { to: "/social", label: "Play", hint: "Fill" },
] as const;

export function WalletHome() {
  const { w, usd, ready, setTag, add } = useWallet();
  const [addOpen, setAddOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [movers, setMovers] = useState<HouseListing[]>([]);
  const [house, setHouse] = useState<HouseListing[]>([]);

  useEffect(() => {
    getHouse()
      .then((rows) => {
        const pre = rows.filter((r) => r.venue === "prestocks");
        setHouse(pre);
        setMovers(pre.slice(0, 8));
      })
      .catch(() => {
        /* keep */
      });
  }, []);

  const book = typeof window === "undefined" ? {} : loadHouseBook();
  const held = house.filter((h) => (book[h.id]?.shares ?? 0) !== 0);

  return (
    <main className="flex flex-1 flex-col">
      {addOpen ? <AddMoneyScreen onClose={() => setAddOpen(false)} /> : null}
      {acctOpen ? <AddAccountScreen onClose={() => setAcctOpen(false)} /> : null}
      <section className="relative overflow-hidden">
        <img src="/images/markets-desk.jpg" alt="" className="h-52 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/15" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-4">
          <p className="text-sm text-muted">Total · USD</p>
          <p className="mt-1 font-display text-5xl leading-none tracking-tight tabular-nums" suppressHydrationWarning>
            {ready ? formatMoney(usd, "USD") : "—"}
          </p>
          {ready && w.tag !== "@you" ? <p className="mt-1 text-sm text-subtle">{w.tag}</p> : null}
        </div>
      </section>
      <section className="px-5 pt-4 pb-3">
        {ready && w.tag === "@you" ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const r = setTag(tagDraft);
              if (!r.ok) toast.error(r.error);
            }}
          >
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              placeholder="Your @tag"
              className="min-h-12 flex-1 rounded-2xl bg-elevated px-4 text-sm outline-none placeholder:text-subtle"
            />
            <button type="submit" className="min-h-12 rounded-full bg-fg px-5 text-sm font-semibold text-bg">
              Set
            </button>
          </form>
        ) : null}
        {usd < 1 ? (
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                const r = add(250, "USD", "cash");
                if (!r.ok) toast.error(r.error);
                else toast.success("$250 paper cash in.");
              }}
              className="min-h-12 w-full rounded-full bg-accent text-base font-semibold text-accent-fg"
            >
              Paper $250
            </button>
            <button type="button" onClick={() => setAddOpen(true)} className="min-h-11 text-sm text-muted">
              Card, bank, or crypto
            </button>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-4 gap-2 px-5 pb-4">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          if (a.act === "add") {
            return (
              <button
                key={a.label}
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-elevated"
              >
                <span className="grid size-10 place-items-center rounded-full bg-bg">
                  <Icon className="size-4" strokeWidth={1.9} />
                </span>
                <span className="text-xs font-medium">{a.label}</span>
              </button>
            );
          }
          return (
            <Link
              key={a.label}
              to="/payments"
              search={{ act: a.act, from: undefined }}
              className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-elevated"
            >
              <span className="grid size-10 place-items-center rounded-full bg-bg">
                <Icon className="size-4" strokeWidth={1.9} />
              </span>
              <span className="text-xs font-medium">{a.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2 px-5 pb-6">
        {PRODUCTS.map((p) => (
          <Link
            key={p.to}
            to={p.to}
            className="flex min-h-[4.75rem] flex-col justify-center rounded-2xl bg-paper px-3 text-ink"
          >
            <span className="text-sm font-semibold">{p.label}</span>
            <span className="text-[11px] text-ink/50">{p.hint}</span>
          </Link>
        ))}
      </div>

      {movers.length > 0 ? (
        <section className="pb-5">
          <div className="flex items-baseline justify-between px-5 pb-2">
            <h2 className="text-sm font-medium text-muted">PreStocks</h2>
            <Link to="/market" className="text-sm text-muted">
              Market
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 px-3">
            {movers.slice(0, 6).map((r) => (
              <Link
                key={r.id}
                to="/house/$id"
                params={{ id: r.id }}
                className="flex items-center gap-2 rounded-2xl bg-paper p-3 text-ink"
              >
                <TokenMark stock={r} size={36} />
                <div className="min-w-0">
                  <p className="font-display text-base leading-none">{r.symbol}</p>
                  <p className="mt-1 font-mono text-xs tabular-nums">{formatUsd(r.last)}</p>
                  <p className={cn("text-[11px] font-medium", (r.change24h ?? 0) < 0 ? "text-down" : "text-up")}>
                    {formatChg(r.change24h)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {held.length > 0 ? (
        <section className="pb-5">
          <h2 className="px-5 pb-2 text-sm font-medium text-muted">Holdings</h2>
          <ul className="divide-y divide-border">
            {held.map((h) => {
              const pos = book[h.id];
              const mtm = markHouse(pos, h.last);
              return (
                <li key={h.id}>
                  <Link to="/house/$id" params={{ id: h.id }} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{h.symbol}</p>
                      <p className="font-mono text-xs text-subtle">
                        {pos.shares > 0 ? "Long" : "Short"} {Math.abs(pos.shares).toFixed(4)}
                      </p>
                    </div>
                    <p className="font-mono text-sm">{formatUsd(mtm)}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {w.policies.length > 0 ? (
        <section className="pb-5">
          <div className="flex items-baseline justify-between px-5 pb-2">
            <h2 className="text-sm font-medium text-muted">Cover</h2>
            <Link to="/cover" className="text-sm text-muted">
              All
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {w.policies.slice(0, 3).map((p) => (
              <li key={p.id} className="flex items-baseline justify-between px-5 py-3">
                <p className="text-sm">{p.title}</p>
                <p className="font-mono text-xs text-subtle">{formatMoney(p.cover)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {w.cards.length > 0 ? (
        <section className="pb-5">
          <div className="flex items-baseline justify-between px-5 pb-2">
            <h2 className="text-sm font-medium text-muted">Cards</h2>
            <Link to="/cards" search={{ spend: 0 }} className="text-sm text-muted">
              All
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {w.cards.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-5 py-3">
                <p className="text-sm">{c.label}</p>
                <p className="font-mono text-xs text-subtle">··{c.last4}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="flex items-baseline justify-between px-5 pb-2">
          <h2 className="text-sm font-medium text-muted">Accounts</h2>
          <button type="button" onClick={() => setAcctOpen(true)} className="text-sm text-muted">
            Add
          </button>
        </div>
        <div className="divide-y divide-border">
          {(w.opened ?? ["USD"])
            .filter((c) => CCY_META[c]?.kind === "fiat")
            .map((c) => (
              <AccountRow key={c} ccy={c} bal={w.balances[c] ?? 0} />
            ))}
        </div>
        {(w.opened ?? []).some((c) => CCY_META[c]?.kind === "crypto") ? (
          <>
            <h2 className="mt-6 px-5 pb-2 text-sm font-medium text-muted">Crypto</h2>
            <div className="divide-y divide-border">
              {(w.opened ?? [])
                .filter((c) => CCY_META[c]?.kind === "crypto")
                .map((c) => (
                  <AccountRow key={c} ccy={c} bal={w.balances[c] ?? 0} />
                ))}
            </div>
          </>
        ) : null}
        {w.senda ? (
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div className="grid size-10 place-items-center rounded-full bg-elevated text-xs font-semibold">SOL</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Senda wallet</p>
              <p className="truncate font-mono text-xs text-subtle">{shortPk(w.senda.pubkey)}</p>
            </div>
            <p className="text-sm font-semibold tabular-nums">{formatMoney(w.balances.SOL, "SOL")}</p>
          </div>
        ) : null}
        {w.links.map((l) => (
          <div key={l.id} className="flex items-center gap-3 px-5 py-3.5">
            <div className="grid size-10 place-items-center rounded-full bg-elevated text-xs font-semibold">
              {l.kind === "evm" ? "ETH" : l.kind === "phantom" ? "Ph" : "SOL"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{l.label}</p>
              <p className="truncate font-mono text-xs text-subtle">{shortPk(l.address)}</p>
            </div>
          </div>
        ))}
        {w.methods
          .filter((m) => m.kind === "bank" || m.kind === "card")
          .map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="grid size-10 place-items-center rounded-full bg-elevated text-xs font-semibold">
                {m.kind === "bank" ? "ACH" : "••"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-subtle">{m.kind === "bank" ? "Linked bank" : "Debit"}</p>
              </div>
            </div>
          ))}
        {w.vaults.map((v) => (
          <VaultRow key={v.id} vault={v} />
        ))}
        <p className="px-5 pt-3 text-xs text-subtle">
          ACH in · {sendaDeposit(w.tag).routing} · {sendaDeposit(w.tag).account}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="px-5 pb-2 text-sm font-medium text-muted">Activity</h2>
        {w.txs.length === 0 ? (
          <p className="px-5 py-10 text-sm text-subtle">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {w.txs.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.counterparty}</p>
                  <p className="text-xs text-subtle">{t.note}</p>
                </div>
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    t.kind === "receive" || t.kind === "add" ? "text-up" : "text-fg",
                  )}
                >
                  {t.kind === "receive" || t.kind === "add" ? "+" : "−"}
                  {formatMoney(t.amount, t.ccy)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function AccountRow({ ccy, bal }: { ccy: Ccy; bal: number }) {
  const { usdPer } = useWallet();
  return (
    <Link
      to="/payments"
      search={{ act: "exchange", from: ccy }}
      className="flex items-center gap-3 px-5 py-3.5 active:bg-elevated"
    >
      <div className="grid size-10 place-items-center rounded-full bg-elevated text-xs font-semibold">{ccy}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{CCY_META[ccy].name}</p>
        <p className="text-xs text-subtle tabular-nums">{formatMoney(bal * (usdPer[ccy] || 0), "USD")}</p>
      </div>
      <p className="text-sm font-semibold tabular-nums">{formatMoney(bal, ccy)}</p>
    </Link>
  );
}
