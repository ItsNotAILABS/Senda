import { useState } from "react";
import { toast } from "sonner";
import { KINDS, listListings, saveListing, type Listing, type MakeKind } from "@/lib/make-board";
import { payUsdc } from "@/lib/solana-pay";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function MakeDesk() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [rows, setRows] = useState<Listing[]>(() => (typeof window === "undefined" ? [] : listListings()));
  const [kind, setKind] = useState<MakeKind>("service");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [usd, setUsd] = useState("200");
  const [payTo, setPayTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<MakeKind | "all">("all");
  const shown = filter === "all" ? rows : rows.filter((r) => r.kind === filter);

  function post() {
    const n = Math.round(Number(usd) * 100) / 100;
    if (!title.trim()) return toast.error("Name what you are offering, or what you need.");
    if (!(n > 0)) return toast.error("Set a price in USDC.");
    if (payTo.trim().length < 32) return toast.error("Paste the Solana address that should receive the USDC.");
    const row = saveListing({ kind, title: title.trim(), detail: detail.trim(), usd: n, payTo: payTo.trim() });
    setRows((r) => [row, ...r]);
    setTitle("");
    setDetail("");
    toast.success("It’s on the board. Payment goes to that address.");
  }

  return (
    <main className="space-y-4 px-5 py-4 lg:px-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div>
          <h1 className="max-w-3xl font-display text-4xl leading-[1.02] font-medium tracking-[-0.03em] xl:text-6xl">
            Make something a person will pay for.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/55">
            A job. Software. A service. Hardware. A robot. Or what a teacher’s class is missing. The price is USDC. The wallet signs. The whole amount goes to the address on the listing.
          </p>
        </div>
        <form
          className="rounded-[28px] bg-[#14141c] p-5"
          onSubmit={(e) => {
            e.preventDefault();
            post();
          }}
        >
          <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Post</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={cn("rounded-2xl px-3 py-2 text-left text-sm", kind === k.id ? "bg-accent text-accent-fg" : "bg-black/30")}
              >
                {k.label}
              </button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What it is" className="mt-3 min-h-12 w-full rounded-2xl bg-black/30 px-4 text-sm outline-none" />
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Who it helps, and what they get" rows={3} className="mt-2 w-full rounded-2xl bg-black/30 px-4 py-3 text-sm outline-none" />
          <div className="mt-2 grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
            <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" aria-label="USDC" className="min-h-12 rounded-2xl bg-black/30 px-4 font-mono text-sm outline-none" />
            <input value={payTo} onChange={(e) => setPayTo(e.target.value)} placeholder="Solana address to pay" spellCheck={false} className="min-h-12 rounded-2xl bg-black/30 px-4 font-mono text-xs outline-none" />
          </div>
          <button type="submit" className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg">
            Put it on the board
          </button>
        </form>
      </section>

      <div className="flex flex-wrap gap-2">
        <Filter on={filter === "all"} label="All" set={() => setFilter("all")} />
        {KINDS.map((k) => (
          <Filter key={k.id} on={filter === k.id} label={k.label} set={() => setFilter(k.id)} />
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[28px] bg-[#14141c] px-5 py-10 text-sm text-white/50">Nothing in this lane yet. The first listing is the one you post.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((row) => {
            const meta = KINDS.find((k) => k.id === row.kind);
            return (
              <li key={row.id} className="flex flex-col rounded-[28px] bg-[#14141c] p-5">
                <p className="text-[11px] tracking-[0.16em] text-accent uppercase">{meta?.label}</p>
                <h2 className="mt-2 font-display text-2xl tracking-tight">{row.title}</h2>
                <p className="mt-2 flex-1 text-sm text-white/55">{row.detail || meta?.line}</p>
                <p className="mt-4 font-mono text-3xl tabular-nums">${row.usd}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-white/35">{row.payTo}</p>
                <button
                  type="button"
                  disabled={busy === row.id}
                  onClick={() => {
                    if (!owner) return toast.error("Connect a Solana wallet. It has to sign.");
                    setBusy(row.id);
                    void payUsdc({ owner, to: row.payTo, usd: row.usd })
                      .then((r) => toast.success(`Signed. ${r.signature.slice(0, 8)}…`))
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "The transfer did not send."))
                      .finally(() => setBusy(null));
                  }}
                  className="mt-4 min-h-11 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-50"
                >
                  {busy === row.id ? "Waiting on the wallet" : row.kind === "teaching" ? "Fund this" : "Pay in USDC"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function Filter({ on, label, set }: { on: boolean; label: string; set: () => void }) {
  return (
    <button type="button" onClick={set} className={cn("min-h-10 rounded-full px-4 text-sm", on ? "bg-white text-black" : "bg-[#14141c] text-white/70")}>
      {label}
    </button>
  );
}
