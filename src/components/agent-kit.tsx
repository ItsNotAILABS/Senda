import { useState } from "react";
import { toast } from "sonner";

const TOKEN = "senda.harness.token";

const BRIEF = `Do not generate a Solana wallet. Do not ask for a seed phrase. Do not save a key to a file.
I use Senda. My Phantom wallet is the only signer.
Call POST /api/agent with header Authorization: Bearer <the token I paste>.
Body: {"method":"check_coin","params":{"query":"SYMBOL"}}
If the result has refused set, stop. Do not queue that coin.
If thin is true, the pool is under $25,000. Do not queue a size over 5% of liquidity.
A trade is queue_trade after I have opened a mission. You do not sign it. I do.
Senda does not issue a coin. You trade other assets through my wallet.`;

type Coin = {
  symbol: string;
  name: string;
  mint: string;
  holders: number;
  liquidity: number;
  price: number;
  mintOff: boolean;
  freezeOff: boolean;
  devMints: number | null;
  launchpad: string;
};

/** The open kit. An outside agent can look, quote, and queue. It cannot hold a key. */
export function AgentKit() {
  const [query, setQuery] = useState("");
  const [coin, setCoin] = useState<Coin | null>(null);
  const [refused, setRefused] = useState("");
  const [thin, setThin] = useState(false);
  const [busy, setBusy] = useState(false);
  const token = typeof window === "undefined" ? "" : window.localStorage.getItem(TOKEN) || "";

  async function look() {
    if (!token) {
      toast.error("Open the harness once. That token is what an outside agent uses. It is not a wallet key.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ method: "check_coin", params: { query } }),
      });
      const body = (await res.json()) as { result?: { coin?: Coin; refused?: string; thin?: boolean }; error?: string };
      if (!res.ok || !body.result?.coin) throw new Error(body.error || "Jupiter did not list that coin.");
      setCoin(body.result.coin);
      setRefused(body.result.refused || "");
      setThin(body.result.thin === true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The check did not finish.");
    } finally {
      setBusy(false);
    }
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(BRIEF);
      toast.success("Copied. Paste it to the agent. Then paste the harness token. Never a seed.");
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <div className="space-y-3 overflow-y-auto px-3 py-3">
      <section className="rounded-3xl border border-white/10 bg-[#0c0e13] p-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-white/40 uppercase">Open kit</p>
        <h2 className="mt-1 text-lg font-semibold">Look, quote, queue. No key, and no Senda coin.</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          Grok, Claude, or another agent calls <span className="font-mono text-white/80">/api/agent</span> or MCP at <span className="font-mono text-white/80">/api/mcp</span> with the harness token. The tools include quote, queue_trade, and queue_pay. A trade or a USDC payment still waits for your signature. Nothing leaves the wallet until you sign it in Senda.
        </p>
        <button type="button" onClick={() => void copyBrief()} className="mt-3 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black">
          Copy the brief for your agent
        </button>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-white/70">{BRIEF}</pre>
      </section>
      <section className="rounded-3xl border border-white/10 p-4">
        <h2 className="text-base font-semibold">Look before a buy</h2>
        <p className="mt-1 text-xs text-white/45">Holders, liquidity, mint authority, freeze authority. A refusal means do not queue.</p>
        <div className="mt-3 flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value.toUpperCase())} placeholder="BONK or a mint" className="min-h-11 flex-1 rounded-full bg-white/10 px-3 font-mono text-sm" />
          <button type="button" disabled={busy || query.trim().length < 2} onClick={() => void look()} className="min-h-11 rounded-full bg-[#3dd68c] px-4 text-sm font-semibold text-[#062117] disabled:opacity-40">
            {busy ? "Looking" : "Check"}
          </button>
        </div>
        {!token ? <p className="mt-2 text-xs text-white/40">No harness token on this phone yet. Open Harness and start one. The token is not a seed.</p> : null}
        {coin ? (
          <div className="mt-3 space-y-1 text-sm">
            <p className="font-semibold">{coin.symbol} · {coin.name}</p>
            <p className="font-mono text-[11px] text-white/45">{coin.mint}</p>
            <p>{coin.holders.toLocaleString("en-US")} holders · pool {coin.liquidity > 0 ? `$${Math.round(coin.liquidity).toLocaleString("en-US")}` : "not reported"} · {coin.launchpad}</p>
            <p>Mint {coin.mintOff ? "off" : "still on"} · freeze {coin.freezeOff ? "off" : "still on"}{coin.devMints != null ? ` · dev mints ${coin.devMints}` : ""}</p>
            {thin ? <p className="text-[#ffb020]">Under $25,000 in the pool. A large queue will be refused.</p> : null}
            <p className={refused ? "text-[#ff8d9a]" : "text-[#3dd68c]"}>{refused || "No hard refusal. Still not a buy until you sign."}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
