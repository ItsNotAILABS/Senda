import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Bluetooth, Plus, RefreshCw } from "lucide-react";
import { AddMoneyScreen } from "@/components/add-money";
import { SpaceDesk } from "@/components/space-desk";
import { NearbyDesk } from "@/components/nearby-desk";
import { TabLead } from "@/components/tab-lead";
import { MoneyBar } from "@/components/money-bar";
import { MexicoSend } from "@/components/mexico-send";
import { ClearingCard } from "@/components/clearing-card";
import { CCYS, CCY_META, formatMoney, revolutFee, type Ccy, type Contact, type Tx } from "@/lib/wallet";
import { rate } from "@/lib/wallet-fx";
import { FillCard } from "@/components/fill-card";
import { PayQr } from "@/components/pay-qr";
import { connectPhantom, readChain } from "@/lib/phantom";
import { SEND_ASSETS, paySol, payUsdc, splPayLink } from "@/lib/solana-pay";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export type PayAct = "send" | "request" | "exchange" | "add" | "withdraw" | "nearby" | "link";

const ACTS: { id: PayAct; label: string; icon: typeof ArrowUpRight }[] = [
  { id: "send", label: "Send", icon: ArrowUpRight },
  { id: "request", label: "Request", icon: ArrowDownLeft },
  { id: "nearby", label: "Nearby", icon: Bluetooth },
  { id: "exchange", label: "Exchange", icon: RefreshCw },
  { id: "add", label: "Add", icon: Plus },
  { id: "link", label: "QR", icon: ArrowDownLeft },
  { id: "withdraw", label: "Revolut", icon: ArrowUpRight },
];

const field =
  "min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none placeholder:text-subtle";

const SEND_PRESETS = [1, 5, 20, 100] as const;

const PERSON_TX = new Set<Tx["kind"]>(["send", "receive", "request", "nearby", "split"]);

/** Latest person per counterparty. Only rows that already exist on the wallet. */
function payAgainRows(txs: Tx[], contacts: Contact[]) {
  const seen = new Set<string>();
  const rows: { id: string; label: string; tag: string; name: string; amount: number; ccy: Ccy; note: string }[] = [];
  for (const t of txs) {
    if (!PERSON_TX.has(t.kind)) continue;
    const who = t.counterparty.trim();
    if (!who) continue;
    if (t.kind === "nearby" && !who.startsWith("@")) continue;
    const key = who.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const contact = contacts.find((c) => {
      const raw = who.toLowerCase();
      const handle = c.tag.trim().toLowerCase();
      return c.name.trim().toLowerCase() === raw || handle === raw || handle === `@${raw.replace(/^@/, "")}`;
    });
    const tag = contact?.tag || who;
    const name = contact?.name || (who.startsWith("@") ? "" : who);
    const note = t.note.trim();
    const userNote = /^pain\.001|^nearby |^iso /i.test(note) ? "" : note;
    rows.push({ id: t.id, label: who, tag, name, amount: t.amount, ccy: t.ccy, note: userNote });
  }
  return rows;
}

export function PaymentsDesk({ initialAct, initialFrom }: { initialAct?: string; initialFrom?: string }) {
  const start: PayAct = initialAct === "revolut" ? "withdraw" : ACTS.some((a) => a.id === initialAct) ? (initialAct as PayAct) : "send";
  const [act, setAct] = useState<PayAct>(start);
  useEffect(() => {
    setAct(start);
  }, [start]);
  const [pocket, setPocket] = useState<Ccy | null>(null);
  const w = useWallet();
  const fromInit = CCYS.includes(initialFrom as Ccy) ? (initialFrom as Ccy) : "USD";

  const total = CCYS.reduce((s, c) => s + (w.w.balances[c] || 0) * (w.usdPer[c] || (c === "USD" || c === "USDC" ? 1 : 0)), 0);
  const open = CCYS.filter((c) => w.w.opened.includes(c) || (w.w.balances[c] || 0) > 0);
  const pockets = (open.length ? open : (["USD"] as Ccy[])).map((c) => ({
    c,
    v: w.w.balances[c] || 0,
  }));

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Send"
        title="Send USDC."
        accent="They get the token."
        line="A peso figure is a quote. The transfer is USDC. You sign it. Senda does not hold it."
        live={["Send", "Request", "Nearby", "Exchange", "Add"]}
        coming={["Bank wires", "A handle that exists outside this browser"]}
      />

      <MoneyBar />

      <section className={cn("rounded-[22px] border border-white/10 bg-[#10131c]", act === "nearby" ? "py-4" : "p-5")}>
        {act === "send" ? <SendForm w={w} /> : null}
        {act === "nearby" ? <NearbyDesk /> : null}
        {act === "request" ? <RequestForm w={w} /> : null}
        {act === "exchange" ? <ExchangeForm key={pocket ?? fromInit} w={w} fromInit={pocket ?? fromInit} /> : null}
        {act === "add" ? <AddForm w={w} /> : null}
        {act === "link" ? <PayLinkForm w={w} /> : null}
        {act === "withdraw" ? <RevolutSend w={w} /> : null}
        <div className={cn("flex flex-wrap gap-2", act === "nearby" ? "px-4 pt-2" : "mt-4 border-t border-white/10 pt-3")}>
          {ACTS.map((a) => {
            const Icon = a.icon;
            const on = act === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAct(a.id)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold",
                  on ? "bg-accent text-accent-fg" : "border border-white/10 text-muted",
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.9} />
                {a.label}
              </button>
            );
          })}
        </div>
      </section>

      <MexicoSend
        owner={w.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? ""}
        onLinked={(addr) => {
          w.linkChain(addr, "Phantom", "phantom");
        }}
      />
      <ClearingCard />

      <SpaceDesk />

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c]">
          <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold">Pockets</h2>
            <p className="font-mono text-[11px] text-subtle">
              {formatMoney(total, "USD")} · {w.w.tag}
            </p>
          </div>
          <ul>
            {pockets.map((p) => {
              const meta = CCY_META[p.c];
              const px = w.usdPer[p.c] || (p.c === "USD" || p.c === "USDC" ? 1 : 0);
              return (
                <li key={p.c} className="border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setPocket(p.c);
                      setAct("exchange");
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-[11px]">
                      {meta.flag}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{meta.name}</span>
                      <span className="block font-mono text-[11px] text-subtle">{p.c}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-sm tabular-nums">{formatMoney(p.v, p.c)}</span>
                      {p.c !== "USD" && px > 0 ? (
                        <span className="block font-mono text-[11px] text-subtle tabular-nums">{formatMoney(p.v * px, "USD")}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <aside className="h-fit rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <h2 className="text-sm font-semibold">Activity</h2>
          {w.w.txs.length === 0 ? <p className="py-4 text-sm text-subtle">Nothing sent yet.</p> : null}
          <ul>
            {w.w.txs.slice(0, 8).map((t) => (
              <li key={t.id} className="border-t border-white/10 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">{t.counterparty}</p>
                  <p className="font-mono text-xs tabular-nums">{formatMoney(t.amount, t.ccy)}</p>
                </div>
                <p className="text-xs text-subtle">
                  {t.kind}
                  {t.note ? ` · ${t.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </div>
  );
}

function PayLinkForm({ w }: { w: ReturnType<typeof useWallet> }) {
  const [raw, setRaw] = useState("1");
  const [mint, setMint] = useState(SEND_ASSETS[1].mint);
  const [held, setHeld] = useState<{ symbol: string; mint: string }[]>([]);
  const [link, setLink] = useState("");
  const amount = Number(raw) || 0;
  const owner = w.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const choices = [
    ...SEND_ASSETS.map((a) => ({ symbol: a.label, mint: a.mint })),
    ...held.filter((h) => !SEND_ASSETS.some((a) => a.mint === h.mint || (a.id === "SOL" && h.symbol === "SOL"))),
  ];

  useEffect(() => {
    if (!owner) {
      setHeld([]);
      return;
    }
    let live = true;
    readChain(owner)
      .then((s) => {
        if (!live) return;
        const rows = s.sol > 0 ? [{ symbol: "SOL", mint: "" }] : [];
        for (const token of s.tokens) {
          if (token.ui > 0) rows.push({ symbol: token.symbol, mint: token.mint });
        }
        setHeld(rows);
      })
      .catch(() => live && setHeld([]));
    return () => {
      live = false;
    };
  }, [owner]);

  async function make() {
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = w.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
      }
      const url = splPayLink(who, mint, amount, "Senda");
      setLink(url);
      await navigator.clipboard?.writeText(url);
      toast.success("QR is ready. They scan it in Phantom. Nothing moves until they sign.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The link was not made.");
    }
  }

  return (
    <div>
      <h2 className="text-xl tracking-tight">Pay QR</h2>
      <p className="mt-2 text-sm text-muted">
        A code can request SOL, USDC, CASH, USDT, PYUSD, or any other token this address already holds. That is the whole Send tab a camera can move. A bank payout, an eSIM, and a Circle burn are not in the code. Nothing leaves until the other wallet signs. A send you sign still stops at your spend cap.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {choices.map((row) => (
          <button key={`${row.symbol}-${row.mint}`} type="button" onClick={() => { setMint(row.mint); setLink(""); }} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", mint === row.mint ? "bg-white text-black" : "bg-white/10")}>
            {row.symbol}
          </button>
        ))}
      </div>
      <input inputMode="decimal" value={raw} onChange={(e) => { setRaw(e.target.value); setLink(""); }} aria-label="Amount" className={cn(field, "mt-3 font-mono")} />
      <button type="button" disabled={!(amount > 0)} onClick={() => void make()} className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50">
        Make the QR
      </button>
      {link ? (
        <div className="mt-4">
          <PayQr value={link} />
          <p className="mt-3 break-all font-mono text-xs text-subtle">{link}</p>
        </div>
      ) : null}
    </div>
  );
}

function RevolutSend({ w }: { w: ReturnType<typeof useWallet> }) {
  const [to, setTo] = useState("");
  const [raw, setRaw] = useState("1");
  const [asset, setAsset] = useState<"USDC" | "SOL">("USDC");
  const [busy, setBusy] = useState(false);
  const [fill, setFill] = useState<{ amount: string; asset: string; sig: string } | null>(null);
  const amount = Number(raw) || 0;
  const owner = w.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";

  async function send() {
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = w.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
      }
      const done =
        asset === "USDC"
          ? await payUsdc({ owner: who, to, usd: amount, memo: "Senda Revolut USDC" })
          : await paySol({ owner: who, to, sol: amount, memo: "Senda Revolut SOL" });
      toast.success(`Signed. ${done.signature.slice(0, 8)}…`);
      setFill({ amount: String(amount), asset, sig: done.signature });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The withdraw did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {fill ? (
        <FillCard title={`To Revolut · ${fill.asset}`} symbol={fill.asset} amount={fill.amount} paid={`${fill.amount} ${fill.asset}`} received="Their Revolut Solana address" where="Solana" when="Just now" sig={fill.sig} onDone={() => setFill(null)} />
      ) : null}
      <h2 className="text-xl tracking-tight">Revolut</h2>
      <p className="mt-2 text-sm text-muted">
        Their app gives you a Solana address. Paste it. Phantom signs the USDC or SOL to that address. This is not browser cash.
      </p>
      <div className="mt-4 flex gap-2">
        {(["USDC", "SOL"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setAsset(id)}
            className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold", asset === id ? "bg-accent text-accent-fg" : "border border-white/10 text-muted")}
          >
            {id}
          </button>
        ))}
      </div>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana address from Revolut" className={cn(field, "mt-3")} />
      <input inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} className={cn(field, "mt-2")} />
      <button type="button" disabled={busy || !(amount > 0) || to.trim().length < 32} onClick={() => void send()} className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50">
        {busy ? "Waiting for the wallet…" : `Withdraw ${amount || 0} ${asset}`}
      </button>
    </div>
  );
}

function SendForm({ w }: { w: ReturnType<typeof useWallet> }) {
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [ccy, setCcy] = useState<Ccy>("USD");
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [fill, setFill] = useState<{ amount: string; to: string; sig: string } | null>(null);
  const amount = Number(raw) || 0;
  const again = payAgainRows(w.w.txs, w.w.contacts);

  function go() {
    if (busy) return;
    const t = tag.trim();
    if (!t) {
      toast.error("Who is it for?");
      return;
    }
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t)) {
      toast.error("Paste their Solana address. USDC was not sent.");
      return;
    }
    if (!(amount > 0)) {
      toast.error("Enter an amount.");
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        const existing = w.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
        const owner = existing || (await connectPhantom());
        if (!existing) {
          const linked = w.linkChain(owner, "Phantom", "phantom");
          if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
        }
        const paid = await payUsdc({ owner, to: t, usd: amount, memo: note || "Senda send" });
        setFill({ amount: String(amount), to: t, sig: paid.signature });
        toast.success(`USDC signed. ${paid.signature.slice(0, 8)}…`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "The payment did not send.");
      } finally {
        setBusy(false);
      }
    })();
  }

  return (
    <div className="flex flex-col gap-3">
      {fill ? (
        <FillCard title="USDC sent" symbol="USDC" amount={`$${fill.amount}`} paid={`$${fill.amount} USDC`} received={fill.to} where="Solana" when="Just now" sig={fill.sig} onDone={() => setFill(null)} />
      ) : null}
      <p className="text-sm text-white/55">USDC leaves your Phantom and lands in their wallet. That is the spendable dollar. Phantom signs it. Nothing moves before that.</p>
      <label className="block">
        <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">Person</span>
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Solana address"
          aria-label="Person"
          className={cn(field, "mt-1 text-lg")}
        />
      </label>
      {w.w.contacts.length > 0 ? (
        <div className="flex gap-1 overflow-x-auto">
          {w.w.contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setTag(c.tag);
                setName(c.name);
              }}
              className="min-h-10 shrink-0 rounded-full border border-white/10 px-4 text-sm font-medium"
            >
              {c.tag}
            </button>
          ))}
        </div>
      ) : null}

      <label className="block">
        <span className="text-[11px] tracking-[0.14em] text-subtle uppercase">Amount</span>
        <div className="mt-1 flex items-end gap-3">
          <input
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="0"
            aria-label="Amount"
            className="min-h-14 w-full bg-transparent font-mono text-5xl tabular-nums tracking-tight outline-none placeholder:text-white/20"
          />
          <select
            value={ccy}
            onChange={(e) => setCcy(e.target.value as Ccy)}
            aria-label="Currency"
            className="mb-1 min-h-11 rounded-full border border-white/10 bg-black/30 px-3 font-mono text-sm"
          >
            {CCYS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <p className="font-mono text-xs tabular-nums text-subtle">Available {formatMoney(w.w.balances[ccy], ccy)}</p>
      </label>

      <div className="flex gap-2">
        {SEND_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setRaw(String(n));
              setCcy("USD");
            }}
            className={cn(
              "min-h-11 flex-1 rounded-full font-mono text-sm font-semibold",
              ccy === "USD" && Number(raw) === n ? "bg-accent text-accent-fg" : "border border-white/10",
            )}
          >
            ${n}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={busy || !(amount > 0)}
        onClick={go}
        className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40"
      >
        Send USDC
      </button>

      {again.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-subtle">Pay again</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {again.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setTag(row.tag);
                  setName(row.name);
                  setCcy(row.ccy);
                  setRaw(String(row.amount));
                  setNote(row.note);
                }}
                className="min-w-[8.5rem] shrink-0 rounded-[22px] border border-white/10 bg-black/30 px-3 py-3 text-left"
              >
                <span className="block truncate text-sm font-semibold">{row.label}</span>
                <span className="mt-1 block font-mono text-sm tabular-nums">{formatMoney(row.amount, row.ccy)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RequestForm({ w }: { w: ReturnType<typeof useWallet> }) {
  const opened = w.w.opened?.length ? w.w.opened : ["USD"];
  const [tag, setTag] = useState("");
  const [ccy, setCcy] = useState<Ccy>("USD");
  const [raw, setRaw] = useState("");
  const amount = Number(raw) || 0;

  function go() {
    const t = tag.trim();
    if (!t) {
      toast.error("Who from?");
      return;
    }
    const who = w.remember(t, t);
    const r = w.receive(amount, ccy, who.tag, `Paid your request · ${ccy}`);
    if (r.ok) toast.success(`${who.tag} paid ${formatMoney(amount, ccy)}.`);
  }

  return (
    <div className="flex flex-col gap-3">
      <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="@someone" aria-label="Person" className={field} />
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="0"
          aria-label="Amount"
          className={cn(field, "flex-1 font-mono text-lg tabular-nums")}
        />
        <select value={ccy} onChange={(e) => setCcy(e.target.value as Ccy)} aria-label="Currency" className={cn(field, "w-28 font-mono")}>
          {opened.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={!(amount > 0)}
        onClick={go}
        className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40"
      >
        Request {amount > 0 ? formatMoney(amount, ccy) : ""}
      </button>
    </div>
  );
}

function ExchangeForm({ w, fromInit }: { w: ReturnType<typeof useWallet>; fromInit: Ccy }) {
  const opened: Ccy[] = w.w.opened?.length ? w.w.opened : ["USD"];
  const [from, setFrom] = useState<Ccy>(opened.includes(fromInit) ? fromInit : "USD");
  const [to, setTo] = useState<Ccy>("EUR");
  const [raw, setRaw] = useState("");
  const amount = Number(raw) || 0;
  const r = rate(from, to, w.usdPer);
  const got = amount * r;
  const amountUsd = amount * (w.usdPer[from] || 0);
  const rev = revolutFee("fx", amountUsd, w.weekend);
  const oneToOne = (from === "USD" && to === "USDC") || (from === "USDC" && to === "USD");

  const preview = useMemo(() => got, [got]);

  function go() {
    const res = w.convert(from, to, amount);
    if (!res.ok) toast.error(res.error);
    else toast.success(`Now holding ${formatMoney(preview, to)}.`);
  }

  const choices = Array.from(new Set([...opened, from, to]));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <select value={from} onChange={(e) => setFrom(e.target.value as Ccy)} aria-label="From" className={cn(field, "font-mono")}>
          {choices.map((c) => (
            <option key={c} value={c}>
              From {c}
            </option>
          ))}
        </select>
        <select value={to} onChange={(e) => setTo(e.target.value as Ccy)} aria-label="Hold" className={cn(field, "font-mono")}>
          {CCYS.map((c) => (
            <option key={c} value={c}>
              Hold {c}
            </option>
          ))}
        </select>
      </div>
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="0"
        aria-label="Amount"
        className="min-h-14 w-full bg-transparent font-mono text-4xl tabular-nums outline-none placeholder:text-white/20"
      />
      <p className="font-mono text-xs tabular-nums text-subtle">Available {formatMoney(w.w.balances[from] ?? 0, from)}</p>
      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
        <p className="font-mono font-medium tabular-nums">You hold {formatMoney(got, to)}</p>
        <p className="mt-1 text-muted">
          {oneToOne ? "USDC ↔ USD is 1:1. No spread." : `1 ${from} = ${r.toFixed(4)} ${to} · mid-market · $0`}
        </p>
        {rev > 0 ? <p className="mt-1 text-muted">Revolut weekend/over-cap would take {formatMoney(rev)}.</p> : null}
      </div>
      <button
        type="button"
        disabled={!(amount > 0) || from === to}
        onClick={go}
        className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40"
      >
        Exchange
      </button>
    </div>
  );
}

function AddForm({ w }: { w: ReturnType<typeof useWallet> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {open ? <AddMoneyScreen onClose={() => setOpen(false)} /> : null}
      <button type="button" onClick={() => setOpen(true)} className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg">
        Add money
      </button>
      <button
        type="button"
        className="min-h-12 rounded-full border border-white/15 text-sm font-semibold"
        onClick={() => {
          const r = w.withdraw(Math.min(w.w.balances.USD, 2500), "USD");
          if (!r.ok) toast.error(r.error);
          else toast.success("On the way to checking.");
        }}
      >
        Withdraw to bank
      </button>
    </div>
  );
}
