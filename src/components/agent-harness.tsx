import { useEffect, useState } from "react";
import { toast } from "sonner";
import { USDC } from "@/lib/jup-exec";
import { agentNames } from "@/lib/agent-catalog";
import { matrixClears } from "@/lib/matrix-engine";
import { refuseLaunch, type Launch } from "@/lib/launch-gate";
import { raceRoute, signRoute } from "@/lib/jup-sign";
import { routePro } from "@/lib/route-pro";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { ProPanel } from "@/components/pro-panel";
import { ProSnipe } from "@/components/pro-snipe";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

type Strategy = { id: string; name: string; category: string; thesis: string; executable: boolean };
type Mission = { id: string; strategyId: string; bankrollUsd: number; aimUsd: number; spentUsd: number; leftToday: number; status: string };
type Found = { symbol: string; price: number; change: number | null; short: string | null; lane: string };
type Tracked = { symbol: string; thesis: string; price: number; change: number | null; short: string | null };
type Intent = { id: string; symbol: string; mint: string; side: string; usd: number; why: string; status: string; signature: string };

const TOKEN = "senda.harness.token";

async function call(token: string, method: string, params: Record<string, unknown> = {}) {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ method, params }),
  });
  const body = (await res.json()) as { result?: Record<string, unknown>; error?: string };
  if (!res.ok || !body.result) throw new Error(body.error || "The harness did not answer.");
  return body.result;
}

/** Budgets a third-party agent can queue against. The wallet on this phone still signs. */
export function AgentHarness() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [token, setToken] = useState("");
  const [shown, setShown] = useState("");
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [found, setFound] = useState<Found[]>([]);
  const [tracked, setTracked] = useState<Tracked[]>([]);
  const [kind, setKind] = useState<"clip" | "dip" | "momentum" | "note">("dip");
  const [strategyId, setStrategyId] = useState("clip");
  const [bankroll, setBankroll] = useState(20);
  const [aim, setAim] = useState(0.5);
  const [thesis, setThesis] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [busy, setBusy] = useState("");

  async function refresh(next = token) {
    if (!next) return;
    const [s, m, i, t] = await Promise.all([
      call(next, "list_strategies"),
      call(next, "list_missions"),
      call(next, "list_intents"),
      call(next, "list_trackers"),
    ]);
    setStrategies((s.strategies as Strategy[]) || []);
    setMissions((m.missions as Mission[]) || []);
    setIntents((i.intents as Intent[]) || []);
    setTracked((t.trackers as Tracked[]) || []);
  }

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN) || "";
    setToken(saved);
    if (saved) refresh(saved).catch((e: unknown) => toast.error(e instanceof Error ? e.message : "The harness did not load."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function open() {
    setBusy("open");
    try {
      const row = await call("", "open_harness", { owner });
      const next = String(row.token || "");
      window.localStorage.setItem(TOKEN, next);
      setToken(next);
      setShown(next);
      await refresh(next);
      toast.success("Harness open. Copy the token if another agent should use it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The harness did not open.");
    } finally {
      setBusy("");
    }
  }

  async function mission() {
    setBusy("mission");
    try {
      await call(token, "open_mission", { strategyId, bankrollUsd: bankroll, aimUsd: aim });
      await refresh();
      toast.success(`Mission open. Up to $${aim} can be queued today. That is not a promised profit.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The mission did not open.");
    } finally {
      setBusy("");
    }
  }

  async function addRule() {
    setBusy("rule");
    try {
      await call(token, "add_strategy", {
        name: ruleName,
        category: "custom",
        thesis,
        rule: { kind, side: "buy", symbols: [] },
      });
      setRuleName("");
      setThesis("");
      await refresh();
      toast.success("Strategy added. It can be used on a mission. It still cannot sign.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The strategy was not saved.");
    } finally {
      setBusy("");
    }
  }

  async function sign(row: Intent, opts?: { maxImpact?: number }) {
    setBusy(row.id);
    try {
      const addr = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(addr, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
      }
      const known = agentNames().find((n) => n.mint === row.mint);
      let name = known ? { ...known, lane: known.lane } : null;
      if (!name) {
        const found = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${row.mint}`, { headers: { accept: "application/json" } });
        const body = (await found.json()) as Array<{ id?: string; symbol?: string; decimals?: number; holderCount?: number; createdAt?: string; organicScore?: number; liquidity?: number; usdPrice?: number; launchpad?: string; audit?: { mintAuthorityDisabled?: boolean; freezeAuthorityDisabled?: boolean; devMints?: number } }>;
        const raw = body.find((item) => item.id === row.mint);
        if (!raw?.id) throw new Error("Jupiter does not list that mint. Nothing was signed.");
        const launch: Launch = {
          mint: raw.id,
          symbol: row.symbol,
          name: row.symbol,
          decimals: Number(raw.decimals) || 6,
          launchpad: raw.launchpad || "unknown",
          holders: Number(raw.holderCount) || 0,
          createdAt: raw.createdAt || new Date().toISOString(),
          organic: Number(raw.organicScore) || 0,
          liquidity: Number(raw.liquidity) || 0,
          price: Number(raw.usdPrice) || 0,
          mintOff: raw.audit?.mintAuthorityDisabled === true,
          freezeOff: raw.audit?.freezeAuthorityDisabled === true,
          devMints: Number.isFinite(Number(raw.audit?.devMints)) ? Number(raw.audit?.devMints) : null,
        };
        const blocked = refuseLaunch(launch);
        if (blocked) throw new Error(blocked);
        name = { symbol: launch.symbol, name: launch.name, mint: launch.mint, decimals: launch.decimals, lane: "launch", trade: true };
      }
      if (!name.trade) throw new Error("That name cannot be signed from this harness.");
      if (String(row.why || "").startsWith("matrix|")) {
        const gate = await call(token, "market_matrix", { symbol: row.symbol });
        const matrix = gate.matrix as { volumeReliable?: boolean; market?: string; atrPct?: number | null };
        if (!matrixClears(matrix)) throw new Error("The matrix no longer clears. The wallet was not asked.");
      }
      const priced = await fetch(`https://lite-api.jup.ag/price/v3?ids=${name.mint}`, { headers: { accept: "application/json" } });
      const book = (await priced.json()) as Record<string, { usdPrice?: number }>;
      const px = Number(book[name.mint]?.usdPrice) || 0;
      if (row.side === "sell" && !(px > 0)) throw new Error("No live price. Nothing was signed.");
      const cap = opts?.maxImpact ?? 5;
      const companies = name.lane === "companies";
      if (companies && row.side === "buy") {
        await raceRoute({
          inputMint: USDC,
          outputMint: name.mint,
          amountRaw: Math.round(row.usd * 1_000_000),
          outDecimals: name.decimals,
          pro: routePro(),
        });
      }
      const done = companies
        ? await runPrestock({ owner: addr, mint: row.mint, side: row.side === "sell" ? "sell" : "buy", usd: row.usd, price: px, symbol: row.symbol })
        : await (async () => {
            const amountRaw = row.side === "sell" ? Math.max(1, Math.round((row.usd / px) * 10 ** name.decimals)) : Math.round(row.usd * 1_000_000);
            const raced = await raceRoute({
              inputMint: row.side === "sell" ? name.mint : USDC,
              outputMint: row.side === "sell" ? USDC : name.mint,
              amountRaw,
              outDecimals: row.side === "sell" ? 6 : name.decimals,
              pro: routePro(),
            });
            return signRoute({
              owner: addr,
              inputMint: row.side === "sell" ? name.mint : USDC,
              outputMint: row.side === "sell" ? USDC : name.mint,
              amountRaw,
              outDecimals: row.side === "sell" ? 6 : name.decimals,
              usd: row.usd,
              symbol: row.symbol,
              onlyDirect: raced.direct,
              slippageBps: 50,
              maxImpact: cap,
              refPrice: px,
            });
          })();
      await call(token, "mark_signed", { id: row.id, signature: done.signature });
      await refresh();
      return;
    } finally {
      setBusy("");
    }
  }

  async function look() {
    setBusy("look");
    try {
      const row = await call(token, "discover", { limit: 8 });
      setFound((row.rows as Found[]) || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discovery did not answer.");
    } finally {
      setBusy("");
    }
  }

  async function watch(symbol: string) {
    setBusy(symbol);
    try {
      await call(token, "track", { symbol, thesis: "Found on the live Jupiter board." });
      await refresh();
      toast.success(`${symbol} is on the tracker.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "It did not track.");
    } finally {
      setBusy("");
    }
  }

  async function release(row: Intent) {
    setBusy(row.id);
    try {
      await call(token, "release", { id: row.id });
      await refresh();
      toast.success("Released. The aim is free again.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "It did not release.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Harness</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Give an agent a budget. You still sign.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
        A mission such as $20 with a $0.50 daily aim lets Claude, GPT, Muse, or another Grok discover names, track them, write a strategy, and queue one attempt a day through MCP. The aim is the most that can be reserved. It is not a promise that the day makes $0.50. Dip waits for a name down 2% or more. Momentum waits for +2% to +12%. You still sign.
      </p>
      {!token ? (
        <button type="button" disabled={busy !== ""} onClick={() => void open()} className="mt-4 min-h-12 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">
          {busy === "open" ? "Opening…" : "Open a harness"}
        </button>
      ) : (
        <div className="mt-4 space-y-4">
          <ProPanel token={token} call={call} sign={sign} />
          <ProSnipe token={token} call={call} />
          {shown ? <p className="break-all rounded-2xl bg-white/5 p-3 font-mono text-[11px] text-white/70">Token, shown once: {shown}</p> : <p className="text-xs text-white/40">A token is on this phone. Another agent sends it as Authorization: Bearer to /api/mcp.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setBankroll(20); setAim(0.5); }} className="min-h-10 rounded-full bg-white/10 px-3 text-xs">$20 · aim $0.50</button>
            <button type="button" onClick={() => { setBankroll(100); setAim(1); }} className="min-h-10 rounded-full bg-white/10 px-3 text-xs">$100 · aim $1</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)} className="min-h-11 rounded-2xl bg-white/5 px-3 text-sm">
              {strategies.filter((row) => row.executable).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            <input value={bankroll} onChange={(e) => setBankroll(Number(e.target.value))} inputMode="decimal" className="min-h-11 rounded-2xl bg-white/5 px-3 font-mono text-sm" aria-label="Bankroll" />
            <input value={aim} onChange={(e) => setAim(Number(e.target.value))} inputMode="decimal" className="min-h-11 rounded-2xl bg-white/5 px-3 font-mono text-sm" aria-label="Daily aim" />
            <button type="button" disabled={busy !== ""} onClick={() => void mission()} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">Open mission</button>
          </div>
          <ul className="space-y-2">
            {missions.map((row) => (
              <li key={row.id} className="rounded-2xl border border-white/10 px-3 py-2 text-sm">
                <span className="font-semibold">{row.strategyId}</span>
                <span className="mt-1 block text-white/50">Bankroll ${row.bankrollUsd} · aim ${row.aimUsd} · left today ${row.leftToday} · spent ${row.spentUsd}</span>
              </li>
            ))}
          </ul>
          <ul className="space-y-2">
            {intents.filter((row) => row.status === "queued").map((row) => (
              <li key={row.id} className="rounded-2xl bg-white/5 px-3 py-3 text-sm">
                <p>{row.side} {row.symbol} · ${row.usd}</p>
                <p className="mt-1 text-xs text-white/45">{row.why}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={busy !== ""} onClick={() => void sign(row).then(() => toast.success(`${row.symbol} signed.`)).catch((e: unknown) => toast.error(e instanceof Error ? e.message : "The wallet did not sign."))} className="min-h-10 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">{busy === row.id ? "Waiting on the wallet" : "Sign"}</button>
                  <button type="button" disabled={busy !== ""} onClick={() => void release(row)} className="min-h-10 rounded-full border border-white/15 px-3 text-xs disabled:opacity-40">Release</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Tracker</p>
            <button type="button" disabled={busy !== ""} onClick={() => void look()} className="min-h-10 rounded-full bg-white/10 px-3 text-xs disabled:opacity-40">{busy === "look" ? "Reading Jupiter…" : "Discover"}</button>
          </div>
          <ul className="space-y-2">
            {tracked.map((row) => (
              <li key={row.symbol} className="rounded-2xl border border-white/10 px-3 py-2 text-sm">
                <span className="font-semibold">{row.symbol}</span>
                <span className="ml-2 font-mono text-xs text-white/50">{row.price ? `$${row.price < 1 ? row.price.toPrecision(3) : row.price.toFixed(2)}` : ""} {row.change == null ? "" : `${row.change >= 0 ? "+" : ""}${row.change.toFixed(1)}%`}</span>
                <span className="mt-1 block text-xs text-white/40">{row.short ? `Short: ${row.short}` : "No short market"}{row.thesis ? ` · ${row.thesis}` : ""}</span>
              </li>
            ))}
          </ul>
          {found.length ? (
            <ul className="space-y-2">
              {found.map((row) => (
                <li key={row.symbol} className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold">{row.symbol}</span>
                    <span className="ml-2 font-mono text-xs text-white/50">{row.change == null ? "" : `${row.change >= 0 ? "+" : ""}${row.change.toFixed(1)}%`}</span>
                    <span className="mt-0.5 block text-[11px] text-white/35">{row.short || row.lane}</span>
                  </span>
                  <button type="button" disabled={busy !== ""} onClick={() => void watch(row.symbol)} className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">Track</button>
                </li>
              ))}
            </ul>
          ) : null}
          <form onSubmit={(e) => { e.preventDefault(); void addRule(); }} className="space-y-2 rounded-2xl border border-white/10 p-3">
            <p className="text-sm font-semibold">Add a strategy</p>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="min-h-11 w-full rounded-2xl bg-white/5 px-3 text-sm">
              <option value="dip">Dip, buy only after -2%</option>
              <option value="momentum">Momentum, buy only +2% to +12%</option>
              <option value="clip">Daily clip, no day filter</option>
              <option value="note">Research note, does not trade</option>
            </select>
            <input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Name" className="min-h-11 w-full rounded-2xl bg-white/5 px-3 text-sm" />
            <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="The research, in your words" className="min-h-24 w-full rounded-2xl bg-white/5 px-3 py-2 text-sm" />
            <button type="submit" disabled={busy !== ""} className="min-h-10 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">Save strategy</button>
          </form>
        </div>
      )}
    </div>
  );
}
