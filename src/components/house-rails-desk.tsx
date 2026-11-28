import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Field = { id: string; label: string; hint: string };
type Corridor = {
  id: string;
  country: string;
  rail: string;
  ccy: string;
  desk: "rosis" | "house";
  minUsd: number;
  maxUsd: number;
  feeBps: number;
  feeUsd: number;
  fields: Field[];
};
type Quote = {
  rules: string;
  corridor: string;
  country: string;
  rail: string;
  desk: "rosis" | "house";
  ccy: string;
  usd: number;
  rate: number;
  feeUsd: number;
  netUsd: number;
  local: number;
  expires: number;
  receive: string;
  collect: Record<string, string> | null;
  spei?: {
    protocol: "clabe" | "card" | "phone";
    account: string;
    bankCode: string;
    plaza: string;
    bankName: string;
    concept: string;
    reference: string;
  } | null;
  pix?: {
    protocol: "cpf" | "cnpj" | "email" | "phone" | "evp";
    key: string;
    shown: string;
    concept: string;
  } | null;
  note: string;
  direction: "out" | "in";
};
type Order = {
  id: string;
  rules: string;
  direction: "out" | "in";
  corridor: string;
  country: string;
  rail: string;
  desk: "rosis" | "house";
  ccy: string;
  usd: number;
  rate: number;
  feeUsd: number;
  netUsd: number;
  local: number;
  account: Record<string, string>;
  status: "open" | "signed" | "credited";
  signature: string;
  tracking: string;
  note: string;
  createdAt: string;
};

function money(n: number, ccy: string) {
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`;
}

export function HouseRailsDesk() {
  const w = useWallet();
  const owner = w.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [rows, setRows] = useState<Corridor[]>([]);
  const [rules, setRules] = useState("");
  const [id, setId] = useState("mx-spei");
  const [usd, setUsd] = useState("100");
  const [account, setAccount] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [book, setBook] = useState<Order[]>([]);
  const [actorLine, setActorLine] = useState("");
  const [actorNote, setActorNote] = useState("");
  const [actorQuote, setActorQuote] = useState<Quote | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const corridor = rows.find((row) => row.id === id) ?? rows[0];

  async function pullBook() {
    const res = await fetch("/api/rails?book=1");
    const body = (await res.json()) as { orders?: Order[]; error?: string };
    if (!res.ok || body.error) throw new Error(body.error || "The book did not open.");
    setBook(body.orders || []);
  }

  useEffect(() => {
    void fetch("/api/rails")
      .then((res) => res.json())
      .then((body: { rules?: string; corridors?: Corridor[] }) => {
        setRules(body.rules || "");
        setRows(body.corridors || []);
      })
      .catch(() => toast.error("The house book did not load."));
    void pullBook().catch((err) => toast.error(err instanceof Error ? err.message : "The book did not open."));
  }, []);

  async function ask() {
    if (!corridor) return;
    setBusy(true);
    setQuote(null);
    try {
      const res = await fetch("/api/rails", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ corridor: corridor.id, usd: Number(usd), account, direction }),
      });
      const body = (await res.json()) as Quote & { error?: string };
      if (!res.ok || body.error) throw new Error(body.error || "No quote.");
      setQuote(body);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No quote.");
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    if (!quote || !corridor) return;
    if (Date.now() > quote.expires) {
      toast.error("That quote expired. Ask again.");
      return;
    }
    setBusy(true);
    try {
      const opened = await fetch("/api/rails", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "open", corridor: corridor.id, usd: Number(usd), account, direction }),
      });
      const body = (await opened.json()) as { order?: Order; error?: string };
      if (!opened.ok || body.error || !body.order) throw new Error(body.error || "The instruction was not kept.");
      if (direction === "out" && quote.receive) {
        const addr = owner || (await connectPhantom());
        const paid = await payUsdc({ owner: addr, to: quote.receive, usd: quote.usd, memo: `house ${quote.corridor}` });
        const signed = await fetch("/api/rails", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ op: "sign", id: body.order.id, signature: paid.signature }),
        });
        const signedBody = (await signed.json()) as { error?: string };
        if (!signed.ok || signedBody.error) throw new Error(signedBody.error || "The signature did not stick.");
        toast.success("USDC signed. The local credit is still open.");
      } else {
        toast(direction === "in" ? "Collect instruction is on the house book." : "Instruction kept. No house receive address is set, so USDC did not move.");
      }
      await pullBook();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function credit(orderId: string) {
    const res = await fetch("/api/rails", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "credit", id: orderId, tracking: tracking[orderId] || "" }),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok || body.error) {
      toast.error(body.error || "That row did not update.");
      return;
    }
    await pullBook();
  }

  const rosis = book.filter((row) => row.desk === "rosis");

  return (
    <div className="space-y-3">
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">House rails {rules}</p>
        <h2 className="mt-1 text-xl font-semibold">One API. The house sets the number.</h2>
        <p className="mt-1 text-sm text-muted">Mexico, Guatemala, and El Salvador sit with Rosis. The United States sits with the house. Brazil, Colombia, Argentina, and Peru use the same book. The fee and the fields are not someone else’s.</p>
        <p className="mt-2 text-xs text-white/45"><Link to="/solana/edges" className="underline">Solana holds the hash of an instruction</Link>. It is not the bank receipt, and it does not move the peso.</p>
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Actors</p>
          <input value={actorLine} onChange={(e) => { setActorLine(e.target.value); setActorQuote(null); }} placeholder="100 name Ana Ruiz concept Rent then the CLABE or the Pix key" className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm" />
          <div className="flex gap-2">
            {(["mexico", "brazil"] as const).map((actor) => (
              <button
                key={actor}
                type="button"
                onClick={() => {
                  void fetch("/api/rails", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ op: "actor", actor, text: actorLine }),
                  })
                    .then((res) => res.json())
                    .then((body: { error?: string; from?: string; quote?: Quote }) => {
                      if (body.error || !body.quote) throw new Error(body.error || "The actor did not read that.");
                      setActorQuote(body.quote);
                      const detail = body.quote.spei
                        ? `${body.quote.spei.protocol} · ${body.quote.spei.bankName || body.quote.spei.bankCode || "bank not named"} · ${body.quote.spei.concept}`
                        : body.quote.pix
                          ? `${body.quote.pix.protocol} · ${body.quote.pix.shown} · ${body.quote.pix.concept}`
                          : body.quote.rail;
                      setActorNote(`${actor === "mexico" ? "Mexico" : "Brazil"} actor. ${body.from === "grok" ? "Grok read the sentence." : "The actor read the sentence."} ${detail}. Nothing was signed.`);
                    })
                    .catch((err) => toast.error(err instanceof Error ? err.message : "The actor did not read that."));
                }}
                className="min-h-11 flex-1 rounded-full bg-white/10 text-sm"
              >
                {actor === "mexico" ? "Mexico actor" : "Brazil actor"}
              </button>
            ))}
          </div>
          {actorNote ? <p className="text-xs text-white/55">{actorNote}</p> : null}
          {actorQuote ? (
            <button
              type="button"
              onClick={() => {
                const actor = actorQuote.corridor === "br-pix" ? "brazil" : "mexico";
                void fetch("/api/rails", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ op: "actor_open", actor, text: actorLine }),
                })
                  .then((res) => res.json())
                  .then((body: { error?: string; order?: { local: number; ccy: string } }) => {
                    if (body.error || !body.order) throw new Error(body.error || "The actor did not keep a row.");
                    setActorNote(`Kept ${body.order.local} ${body.order.ccy} on the house book. Not signed.`);
                    setActorQuote(null);
                    return pullBook();
                  })
                  .catch((err) => toast.error(err instanceof Error ? err.message : "The actor did not keep a row."));
              }}
              className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black"
            >
              Keep this row
            </button>
          ) : null}
        </form>
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setId(row.id);
                setAccount({});
                setQuote(null);
              }}
              className={cn("min-h-10 shrink-0 rounded-full px-3 text-sm", corridor?.id === row.id ? "bg-white text-black" : "bg-white/10")}
            >
              {row.country}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => { setDirection("out"); setQuote(null); }} className={cn("min-h-10 flex-1 rounded-full text-sm", direction === "out" ? "bg-white text-black" : "bg-white/10")}>Pay out</button>
          <button type="button" onClick={() => { setDirection("in"); setQuote(null); }} className={cn("min-h-10 flex-1 rounded-full text-sm", direction === "in" ? "bg-white text-black" : "bg-white/10")}>Collect</button>
        </div>
        {corridor ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-white/45">
              {corridor.rail} · {corridor.ccy} · {corridor.desk === "rosis" ? "Rosis posts the local credit" : "House posts the US credit"} · {corridor.feeBps} bps + ${corridor.feeUsd} · {corridor.minUsd}–{corridor.maxUsd} USD
            </p>
            <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm" />
            {direction === "out" ? corridor.fields.map((field) => (
              <label key={field.id} className="block">
                <span className="text-[11px] text-white/45">{field.label}</span>
                <input
                  value={account[field.id] || ""}
                  placeholder={field.hint}
                  onChange={(e) => setAccount((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  className="mt-1 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm"
                />
              </label>
            )) : <p className="text-xs text-white/45">Collect does not ask for their account. The house account, if one is issued, comes back on the quote.</p>}
            <button type="button" disabled={busy} onClick={() => void ask()} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
              {busy ? "Asking" : "Quote"}
            </button>
          </div>
        ) : null}
        {quote ? (
          <div className="mt-4 rounded-2xl bg-white/[0.04] p-3 text-sm">
            <p>{money(quote.local, quote.ccy)} arrives after a {money(quote.feeUsd, "USD")} fee.</p>
            {quote.spei ? (
              <p className="mt-1 text-xs text-white/55">
                {quote.spei.protocol} · bank {quote.spei.bankCode}{quote.spei.bankName ? ` ${quote.spei.bankName}` : " not named on this book"}{quote.spei.plaza ? ` · plaza ${quote.spei.plaza}` : ""} · {quote.spei.concept} · ref {quote.spei.reference || "assigned when kept"}
              </p>
            ) : null}
            {quote.pix ? (
              <p className="mt-1 text-xs text-white/55">
                {quote.pix.protocol} · {quote.pix.shown} · {quote.pix.concept}
              </p>
            ) : null}
            {quote.spei ? <p className="mt-1 text-xs text-white/45">A checked CLABE does not prove the account exists. The CEP is Banxico’s receipt, and this row is not one.</p> : null}
            {quote.pix ? <p className="mt-1 text-xs text-white/45">A Pix key that checks is not the account. An end-to-end id comes from the SPI, and this row does not mint one.</p> : null}
            <p className="mt-1 text-xs text-white/45">Rate {quote.rate} · net {money(quote.netUsd, "USD")} · {quote.note}</p>
            <p className="mt-1 text-xs text-white/45">{quote.receive && direction === "out" ? `USDC signs to ${quote.receive.slice(0, 4)}…${quote.receive.slice(-4)}` : direction === "in" && quote.collect ? `Collect into ${Object.values(quote.collect).filter(Boolean).join(" · ")}` : direction === "in" ? "No collect account is issued on this corridor yet. The row can still be kept." : "No house receive address. The instruction can be kept. USDC does not move."}</p>
            <button type="button" disabled={busy} onClick={() => void sign()} className="mt-3 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black">
              {direction === "out" && quote.receive ? "Sign USDC" : "Keep on the house book"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Rosis</p>
        <h2 className="mt-1 text-lg font-semibold">Southern credits on the house book</h2>
        <p className="mt-1 text-sm text-muted">Marking a row says Rosis posted the local credit. It is not a SPEI receipt or a Pix end-to-end id, and it does not move a bank.</p>
        <ul className="mt-3 space-y-2">
          {rosis.length === 0 ? <li className="text-sm text-white/40">No southern instruction yet.</li> : null}
          {rosis.map((row) => (
            <li key={row.id} className="rounded-2xl bg-white/[0.04] px-3 py-2 text-sm">
              <p>{row.country} · {row.direction === "in" ? "collect" : "pay"} · {money(row.local, row.ccy)} · {row.status}</p>
              <p className="text-[11px] text-white/40">{row.account.pix ? `${row.account.protocol || "pix"} ${row.account.pix}` : row.account.clabe || row.account.card || row.account.phone || "no account"}{row.account.bankName ? ` · ${row.account.bankName}` : ""}{row.account.concept ? ` · ${row.account.concept}` : ""}{row.account.reference ? ` · ref ${row.account.reference}` : ""}{row.tracking ? ` · ${row.tracking}` : ""}</p>
              {row.status !== "credited" && (row.corridor === "mx-spei" || row.corridor === "br-pix") ? (
                <input value={tracking[row.id] || ""} onChange={(e) => setTracking((prev) => ({ ...prev, [row.id]: e.target.value }))} placeholder={row.corridor === "br-pix" ? "Pix end-to-end id, if Rosis has it" : "Clave de rastreo, if you have it"} className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-xs" />
              ) : null}
              {row.status !== "credited" ? (
                <button type="button" onClick={() => credit(row.id)} className="mt-2 min-h-9 rounded-full border border-white/15 px-3 text-xs">
                  Rosis posted it
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
