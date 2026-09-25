import { useState } from "react";
import { outUi, quoteJup } from "@/lib/jup-exec";
import { recentMemories } from "@/lib/agent-memory";
import { writeLog } from "@/lib/agent-envelope";
import { spendCap } from "@/lib/spend-cap";
import { wrappedUsdc } from "@/lib/vault-wrap";
import { formatPremium, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

type Line = { who: "you" | "box"; text: string };

/** A closed computer. Every command calls something the app already does. */
export function AgentComputer({ names, envelopeId }: { names: HouseListing[]; envelopeId: string | null }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [lines, setLines] = useState<Line[]>([
    { who: "box", text: "book · quote SYMBOL · memory · vault · note …" },
  ]);
  const [cmd, setCmd] = useState("");
  const [busy, setBusy] = useState(false);

  async function answer(raw: string): Promise<string> {
    const parts = raw.trim().split(/\s+/);
    const op = (parts[0] || "").toLowerCase();
    const rest = parts.slice(1).join(" ");
    if (!op || op === "help") return "book · quote SYMBOL · memory · vault · note your text";
    if (op === "book") {
      return names
        .slice(0, 8)
        .map((n) => `${n.symbol} ${formatPremium(n.premium)}`)
        .join("\n");
    }
    if (op === "quote") {
      const name = names.find((n) => n.symbol.toLowerCase() === rest.toLowerCase());
      if (!name) return "Name that symbol. It has to be on the PreStocks book.";
      const q = await quoteJup({ data: { mint: name.mint, usd: 10, side: "buy" } });
      if ("error" in q) return q.error;
      return `$10 of ${name.symbol} → ${outUi(q, 6).toFixed(4)} · ${q.route[0] || "Jupiter"}`;
    }
    if (op === "memory") {
      const rows = recentMemories();
      if (rows.length === 0) return "No past send in this browser.";
      return rows.map((m) => `${m.side} ${m.symbol} $${m.usd}`).join("\n");
    }
    if (op === "vault") {
      if (!owner) return "No wallet connected. The vault wraps a wallet, it does not replace one.";
      return `Wrapped $${wrappedUsdc(owner).toFixed(2)} of ${owner.slice(0, 4)}… · send cap $${spendCap()}. The USDC is still in the wallet.`;
    }
    if (op === "note") {
      if (!rest) return "Write the note after the word note.";
      if (envelopeId) writeLog(envelopeId, rest);
      return envelopeId ? "Written to this agent's log." : "No agent selected, so it was not filed.";
    }
    return "Unknown. book · quote SYMBOL · memory · vault · note …";
  }

  async function go(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setCmd("");
    setBusy(true);
    setLines((ls) => [...ls, { who: "you", text }]);
    try {
      const textOut = await answer(text);
      setLines((ls) => [...ls, { who: "box", text: textOut }]);
    } catch (e) {
      setLines((ls) => [...ls, { who: "box", text: e instanceof Error ? e.message : "That command failed." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-[#07070f]">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">Computer</p>
        <p className="text-[11px] text-subtle">{envelopeId ? "This agent" : "Desk"}</p>
      </div>
      <div className="max-h-52 space-y-1 overflow-y-auto px-3 py-2 font-mono text-xs">
        {lines.map((l, i) => (
          <p key={i} className={l.who === "you" ? "text-fg" : "whitespace-pre-wrap text-muted"}>
            {l.who === "you" ? "› " : ""}
            {l.text}
          </p>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void go(cmd);
        }}
        className="border-t border-border"
      >
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder="quote OPENAI"
          className="min-h-10 w-full bg-transparent px-3 font-mono text-xs outline-none"
        />
      </form>
    </div>
  );
}
