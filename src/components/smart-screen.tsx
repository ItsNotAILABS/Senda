import { useEffect, useState } from "react";
import { toast } from "sonner";
import { USDC } from "@/lib/jup-exec";
import { decideRoute, quoteRoute, signRoute } from "@/lib/jup-sign";
import { refuseLaunch, type Launch } from "@/lib/launch-gate";
import { feeDrag, quoteEdge, sliceUsd } from "@/lib/route-cost";
import { BOOK } from "@/lib/sol-books";
import { connectPhantom } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

type Name = { symbol: string; mint: string; decimals: number };
type LaneQuote = { out: number; impact: number; route: string; ms: number };
type Compared = { direct: LaneQuote; hop: LaneQuote; edge: NonNullable<ReturnType<typeof quoteEdge>> };
type Stonk = Launch & { mcap: number };

const MAJORS = BOOK.filter((row) => row.lane === "majors" && row.mint && row.symbol !== "ICP").slice(0, 8);
const SIZES = [10, 50, 100] as const;

function px(n: number) {
  if (!(n > 0)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

async function lane(name: Name, usd: number, direct: boolean): Promise<LaneQuote> {
  const started = performance.now();
  const quote = await quoteRoute({
    inputMint: USDC,
    outputMint: name.mint,
    amountRaw: Math.round(usd * 1_000_000),
    outDecimals: name.decimals,
    slippageBps: 50,
    onlyDirect: direct,
    maxImpact: 5,
  });
  return { out: quote.outUi, impact: Math.abs(quote.impact), route: quote.route, ms: Math.max(1, Math.round(performance.now() - started)) };
}

/** Two Jupiter lanes, the measured gap, and StonkFun coins each on their own row. */
export function SmartScreen() {
  const wallet = useWallet();
  const [usd, setUsd] = useState<number>(50);
  const [algo, setAlgo] = useState<"price" | "fast" | "slice">("price");
  const [name, setName] = useState<Name>(MAJORS.find((row) => row.symbol === "SOL") || MAJORS[0]);
  const [compared, setCompared] = useState<Compared | null>(null);
  const [busy, setBusy] = useState("");
  const [stonks, setStonks] = useState<Stonk[]>([]);
  const [own, setOwn] = useState<Record<string, string>>({});

  const parts = algo === "slice" ? sliceUsd(usd, 4) : [usd];
  const ticket = parts[0] || usd;

  async function compare(target = name, size = ticket) {
    setBusy(target.symbol);
    try {
      const [direct, hop] = await Promise.all([lane(target, size, true), lane(target, size, false)]);
      const edge = quoteEdge(direct.out, hop.out);
      if (!edge) throw new Error("One lane did not quote.");
      if (target.mint === name.mint) setCompared({ direct, hop, edge });
      return { direct, hop, edge };
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Jupiter did not quote both lanes.");
      return null;
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    let live = true;
    void fetch("https://lite-api.jup.ag/tokens/v2/search?query=stonkfun", { headers: { accept: "application/json" } })
      .then((res) => res.json())
      .then((body: Array<Record<string, unknown>>) => {
        if (!live || !Array.isArray(body)) return;
        const rows: Stonk[] = [];
        for (const raw of body) {
          if (raw.launchpad !== "stonkfun" || typeof raw.id !== "string" || typeof raw.symbol !== "string") continue;
          const row: Launch = {
            mint: raw.id,
            symbol: String(raw.symbol).toUpperCase().slice(0, 16),
            name: String(raw.name || raw.symbol).slice(0, 48),
            decimals: Number(raw.decimals) || 6,
            launchpad: "stonkfun",
            holders: Number(raw.holderCount) || 0,
            createdAt: String(raw.createdAt || new Date().toISOString()),
            organic: Number(raw.organicScore) || 0,
            liquidity: Number(raw.liquidity) || 0,
            price: Number(raw.usdPrice) || 0,
            mintOff: (raw.audit as { mintAuthorityDisabled?: boolean } | undefined)?.mintAuthorityDisabled === true,
            freezeOff: (raw.audit as { freezeAuthorityDisabled?: boolean } | undefined)?.freezeAuthorityDisabled === true,
            devMints: Number.isFinite(Number((raw.audit as { devMints?: number } | undefined)?.devMints)) ? Number((raw.audit as { devMints?: number }).devMints) : null,
          };
          if (rows.some((have) => have.mint === row.mint)) continue;
          rows.push({ ...row, mcap: Number(raw.mcap) || Number(raw.fdv) || 0 });
        }
        setStonks(rows.slice(0, 8));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  async function sign() {
    setBusy("sign");
    try {
      const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address || (await connectPhantom());
      const decided = await decideRoute({
        inputMint: USDC,
        outputMint: name.mint,
        amountRaw: Math.round(ticket * 1_000_000),
        outDecimals: name.decimals,
      });
      if (decided.impact > 1) {
        toast.error(`Price impact is ${decided.impact.toFixed(2)}%. The wallet was not asked.`);
        return;
      }
      const done = await signRoute({
        owner,
        inputMint: USDC,
        outputMint: name.mint,
        amountRaw: Math.round(ticket * 1_000_000),
        outDecimals: name.decimals,
        usd: ticket,
        symbol: name.symbol,
        onlyDirect: decided.onlyDirect,
        slippageBps: 50,
        maxImpact: 1,
      });
      toast.success(`${name.symbol} · ${decided.why} · ${done.signature.slice(0, 8)}…`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The wallet did not sign.");
    } finally {
      setBusy("");
    }
  }

  const drag = feeDrag(ticket, 10);
  const chosen = compared ? (compared.edge.lane === "direct" ? compared.direct : compared.hop) : null;

  return (
    <div className="space-y-4 px-3 py-3">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Smart</p>
        <h2 className="mt-1 text-lg font-semibold">Two routes. The cheaper one is the one that pays more token.</h2>
        <p className="mt-2 text-sm text-muted">
          Direct and routed are both quoted. The gap is this size, this moment. Senda adds 0 bps. A 10 bps platform fee on this ticket would take ${drag.toFixed(2)}. It is not charged. PrimeRevenue announced time drafts on Solana. Jupiter lists no mint, so there is nothing here to buy.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MAJORS.map((row) => (
            <button key={row.mint} type="button" onClick={() => { setName(row); setCompared(null); }} className={`min-h-10 rounded-full px-3 text-xs font-semibold ${name.mint === row.mint ? "bg-white text-black" : "bg-white/10"}`}>{row.symbol}</button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {SIZES.map((n) => (
            <button key={n} type="button" onClick={() => { setUsd(n); setCompared(null); }} className={`min-h-10 rounded-full px-3 text-xs font-semibold ${usd === n ? "bg-white text-black" : "bg-white/10"}`}>${n}</button>
          ))}
          <button type="button" onClick={() => setAlgo("price")} className={`min-h-10 rounded-full px-3 text-xs font-semibold ${algo === "price" ? "bg-white text-black" : "bg-white/10"}`}>Best price</button>
          <button type="button" onClick={() => setAlgo("fast")} className={`min-h-10 rounded-full px-3 text-xs font-semibold ${algo === "fast" ? "bg-white text-black" : "bg-white/10"}`}>Fast if within 8 bps</button>
          <button type="button" onClick={() => setAlgo("slice")} className={`min-h-10 rounded-full px-3 text-xs font-semibold ${algo === "slice" ? "bg-white text-black" : "bg-white/10"}`}>4 slices</button>
        </div>
        {algo === "slice" ? <p className="mt-2 text-xs text-muted">Slices {parts.map((n) => `$${n}`).join(" · ")}. Only the first is quoted. Each later slice is its own signature.</p> : null}
        <button type="button" disabled={busy !== ""} onClick={() => void compare()} className="mt-3 min-h-11 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">{busy === name.symbol ? "Quoting both lanes" : `Compare $${ticket}`}</button>
        {compared && chosen ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>Direct · {px(compared.direct.out)} {name.symbol} · impact {compared.direct.impact.toFixed(2)}% · {compared.direct.ms}ms</p>
            <p>Routed · {px(compared.hop.out)} {name.symbol} · {compared.hop.route} · impact {compared.hop.impact.toFixed(2)}% · {compared.hop.ms}ms</p>
            <p className="font-semibold">
              {compared.edge.lane === "same"
                ? "Same output. No saving on this size."
                : algo === "fast" && compared.edge.bps <= 8
                  ? `Fast lane is close enough. Gap is ${compared.edge.bps.toFixed(1)} bps.`
                  : `${compared.edge.lane === "routed" ? "Routed" : "Direct"} pays ${compared.edge.bps.toFixed(1)} bps more token.`}
            </p>
            <p className="text-xs text-muted">Senda fee $0. The sign builds a fresh quote. The gap can move. Impact over 1% does not open the wallet.</p>
            <button type="button" disabled={busy !== ""} onClick={() => void sign()} className="min-h-11 w-full rounded-full border border-white/20 text-sm font-semibold disabled:opacity-40">Sign the cheaper lane</button>
          </div>
        ) : null}
      </section>
      <section className="rounded-3xl border border-white/10 p-4">
        <h2 className="text-base font-semibold">StonkFun, each coin alone</h2>
        <p className="mt-1 text-xs text-muted">Jupiter marks the launchpad. A coin is not rolled into the one above it. Mint or freeze authority still on, or a serial deployer, and it cannot be signed.</p>
        <ul className="mt-3 space-y-2">
          {stonks.map((row) => {
            const blocked = refuseLaunch(row);
            return (
              <li key={row.mint} className="rounded-2xl bg-white/5 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{row.symbol}</p>
                    <p className="text-[11px] text-white/45">{row.holders} holders · mcap {row.mcap ? `$${Math.round(row.mcap).toLocaleString("en-US")}` : "—"}</p>
                    <p className="text-[11px] text-white/40">{blocked || own[row.mint] || "Not quoted yet."}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy !== "" || !!blocked}
                    onClick={() => void compare({ symbol: row.symbol, mint: row.mint, decimals: row.decimals }, 5).then((result) => {
                      if (!result) return;
                      const line = result.edge.lane === "same"
                        ? "$5 is the same on both lanes."
                        : `$5 ${result.edge.lane} pays ${result.edge.bps.toFixed(1)} bps more.`;
                      setOwn((cur) => ({ ...cur, [row.mint]: line }));
                    })}
                    className="min-h-10 shrink-0 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-30"
                  >
                    {blocked ? "Refused" : "$5"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {!stonks.length ? <p className="mt-3 text-xs text-muted">No StonkFun mints in this Jupiter search.</p> : null}
      </section>
    </div>
  );
}
