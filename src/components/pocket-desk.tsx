import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import {
  createPocket,
  listPockets,
  movePocket,
  pocketOpen,
  releasePocket,
  returnPocket,
  type MoneyPocket,
  type PocketKind,
} from "@/lib/pocket-contract";
import { usdcPayLink } from "@/lib/solana-pay";
import { cn } from "@/lib/utils";

const KINDS: Array<{ id: PocketKind; label: string }> = [
  { id: "time", label: "Time" },
  { id: "constraint", label: "Constraint" },
  { id: "decision", label: "Decision" },
  { id: "send", label: "Send" },
];

const NAMES = ["Premium", "Cover", "Rent", "Payroll"];

export function PocketDesk({
  names,
  signer,
}: {
  names: HouseListing[];
  signer: () => Promise<string>;
}) {
  const [kind, setKind] = useState<PocketKind>("decision");
  const [title, setTitle] = useState("Premium");
  const [usd, setUsd] = useState(1);
  const [hours, setHours] = useState(24);
  const [symbol, setSymbol] = useState(names[0]?.symbol || "");
  const [side, setSide] = useState<"above" | "below">("above");
  const [strike, setStrike] = useState(names[0]?.last || 0);
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<MoneyPocket[]>([]);
  const [busy, setBusy] = useState(false);
  const book = names.filter((n) => n.last > 0).slice(0, 40);
  const picked = book.find((n) => n.symbol === symbol) || book[0];

  useEffect(() => {
    setRows(listPockets());
  }, []);

  useEffect(() => {
    if (!picked) return;
    setSymbol(picked.symbol);
    setStrike(picked.last);
  }, [picked?.symbol]);

  async function create() {
    setBusy(true);
    try {
      const who = await signer();
      const row = await createPocket({
        owner: who,
        usd,
        kind,
        title,
        to,
        until: kind === "time" ? Date.now() + hours * 3_600_000 : undefined,
        symbol: kind === "constraint" ? picked?.symbol : undefined,
        side: kind === "constraint" ? side : undefined,
        strike: kind === "constraint" ? strike : undefined,
      });
      setRows(listPockets());
      toast.success(`Pocket holds $${row.usd.toFixed(2)}. ${row.sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The pocket did not open.");
    } finally {
      setBusy(false);
    }
  }

  async function act(run: (who: string) => Promise<string>, ok: string) {
    setBusy(true);
    try {
      const who = await signer();
      await run(who);
      setRows(listPockets());
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The pocket did not move.");
    } finally {
      setBusy(false);
    }
  }

  const held = rows.filter((r) => r.status === "held");

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-sm font-semibold">New pocket</p>
      <p className="mt-1 text-xs text-muted">
        A named contract with money in it. Time pays after the clock. A constraint pays when last crosses the line. A decision pays when you say so. Send pays the address now, the same USDC path as a pay link. You can move cash from one contract to another. This browser holds the key, so you can also take it back.
      </p>
      <div className="mt-3 flex gap-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold", kind === k.id ? "bg-accent text-accent-fg" : "border border-white/10 text-muted")}
          >
            {k.label}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs text-muted">
        Name
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Premium, rent, payroll"
          className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-1">
        {NAMES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setTitle(n)}
            className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", title === n ? "bg-white/15 text-fg" : "border border-white/10 text-muted")}
          >
            {n}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs text-muted">
        USDC
        <input
          inputMode="decimal"
          value={usd}
          onChange={(e) => setUsd(Number(e.target.value) || 0)}
          className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm"
        />
      </label>
      {kind === "time" ? (
        <div className="mt-2 flex gap-1">
          {[1, 24, 168].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              className={cn("min-h-11 flex-1 rounded-full text-sm", hours === h ? "bg-white/15 text-fg" : "border border-white/10 text-muted")}
            >
              {h === 1 ? "1 hour" : h === 24 ? "1 day" : "7 days"}
            </button>
          ))}
        </div>
      ) : null}
      {kind === "constraint" && picked ? (
        <div className="mt-2 space-y-2">
          <select
            value={picked.symbol}
            onChange={(e) => {
              const next = book.find((n) => n.symbol === e.target.value);
              if (!next) return;
              setSymbol(next.symbol);
              setStrike(next.last);
            }}
            className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm"
          >
            {book.map((n) => (
              <option key={n.symbol} value={n.symbol}>
                {n.symbol} · {formatUsd(n.last)}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {(["above", "below"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={cn("min-h-11 flex-1 rounded-full text-sm", side === s ? "bg-white/15 text-fg" : "border border-white/10 text-muted")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <label className="mt-2 block text-xs text-muted">
        Pays to
        <input
          value={to}
          placeholder="Solana address. Empty sends it back to you."
          onChange={(e) => setTo(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs"
        />
      </label>
      <button
        type="button"
        disabled={busy || !(usd >= 0.01)}
        onClick={() => void create()}
        className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
      >
        Create · ${usd.toFixed(2)}
      </button>
      <ul className="mt-4 space-y-2">
        {held.map((row) => {
          const last = names.find((n) => n.symbol === row.symbol)?.last ?? 0;
          const open = pocketOpen(row, last);
          const others = held.filter((p) => p.id !== row.id);
          return (
            <li key={row.id} className="rounded-2xl border border-white/10 px-3 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">
                  ${row.usd.toFixed(2)} · {row.title || row.kind}
                </p>
                <p className="font-mono text-[11px] text-subtle">{row.pocket.slice(0, 4)}…{row.pocket.slice(-4)}</p>
              </div>
              <p className="mt-1 text-xs text-muted">{ruleLine(row, last, open)}</p>
              <div className="mt-3 flex gap-1">
                <button
                  type="button"
                  disabled={busy || !open}
                  onClick={() => void act((who) => releasePocket(row, who, last), `Sent $${row.usd.toFixed(2)}`)}
                  className="min-h-11 flex-1 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
                >
                  {open ? (row.kind === "send" ? "Send" : "Release") : "Not open"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = usdcPayLink(row.pocket, row.usd, row.title || row.kind);
                    void navigator.clipboard?.writeText(url).then(
                      () => toast.success("Pay link copied. They fund this contract."),
                      () => toast.error("Could not copy the link."),
                    );
                  }}
                  className="min-h-11 rounded-full border border-white/15 px-3 text-sm font-semibold"
                >
                  Link
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act((who) => returnPocket(row, who), `$${row.usd.toFixed(2)} is back`)}
                  className="min-h-11 flex-1 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-50"
                >
                  Take back
                </button>
              </div>
              {others.length ? (
                <label className="mt-2 block text-xs text-muted">
                  Move into
                  <select
                    defaultValue=""
                    disabled={busy}
                    onChange={(e) => {
                      const into = others.find((p) => p.id === e.target.value);
                      e.target.value = "";
                      if (!into) return;
                      void act((who) => movePocket(row, into, who), `Moved $${row.usd.toFixed(2)}`);
                    }}
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm"
                  >
                    <option value="">Another pocket</option>
                    {others.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.kind} · ${p.usd.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ruleLine(row: MoneyPocket, last: number, open: boolean): string {
  if (row.kind === "time") {
    const when = new Date(row.until || 0);
    return open
      ? `Open. Release pays ${short(row.to)}.`
      : `Pays ${short(row.to)} after ${when.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`;
  }
  if (row.kind === "constraint") {
    return `${row.symbol || "Name"} ${row.side || "above"} ${formatUsd(row.strike || 0)}${last > 0 ? `, last ${formatUsd(last)}` : ""}. ${open ? "Open." : "Not through yet."} Release pays ${short(row.to)}.`;
  }
  if (row.kind === "send") return `Send. Pays ${short(row.to)} now. Link lets someone else fund this contract.`;
  return `A decision. Release pays ${short(row.to)}. Take back returns it to this Phantom.`;
}

function short(address: string): string {
  if (address.length < 8) return address || "you";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
