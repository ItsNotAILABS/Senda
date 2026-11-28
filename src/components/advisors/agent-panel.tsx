import { useEffect, useState } from "react";
import { toast } from "sonner";
import { devnetAirdrop, devnetLamports, devnetMemo, dropAgent, listAgents, sealAgent, solOf, type SealedAgent } from "@/lib/devnet-agent";

export function AgentPanel() {
  const [rows, setRows] = useState<SealedAgent[]>(() => listAgents());
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState("");
  const [balances, setBalances] = useState<Record<string, number | "err">>({});
  const [phrase, setPhrase] = useState<Record<string, string>>({});
  const [memo, setMemo] = useState<Record<string, string>>({});
  const [sig, setSig] = useState<Record<string, string>>({});
  const [fault, setFault] = useState<Record<string, string>>({});

  function reload() {
    setRows(listAgents());
  }

  useEffect(() => {
    let live = true;
    for (const row of rows) {
      devnetLamports(row.pubkey)
        .then((lamports) => {
          if (live) setBalances((cur) => ({ ...cur, [row.pubkey]: lamports }));
        })
        .catch(() => {
          if (live) setBalances((cur) => ({ ...cur, [row.pubkey]: "err" }));
        });
    }
    return () => {
      live = false;
    };
  }, [rows]);

  async function create() {
    if (pass !== again) {
      toast.error("The two passphrases do not match.");
      return;
    }
    setBusy("new");
    try {
      const row = await sealAgent(name, pass);
      setName("");
      setPass("");
      setAgain("");
      reload();
      toast.success(`${row.name} is sealed. The secret is not on the server.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The agent was not sealed.");
    } finally {
      setBusy("");
    }
  }

  async function airdrop(row: SealedAgent) {
    setBusy(row.id + ":air");
    try {
      const signature = await devnetAirdrop(row.pubkey);
      setSig((cur) => ({ ...cur, [row.id]: signature }));
      setFault((cur) => ({ ...cur, [row.id]: "" }));
      toast.success("Devnet faucet accepted. The balance updates when the slot confirms.");
      window.setTimeout(() => {
        devnetLamports(row.pubkey)
          .then((lamports) => setBalances((cur) => ({ ...cur, [row.pubkey]: lamports })))
          .catch(() => undefined);
      }, 4000);
    } catch (e) {
      const message = e instanceof Error ? e.message : "The faucet refused.";
      setFault((cur) => ({ ...cur, [row.id]: message }));
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function attest(row: SealedAgent) {
    setBusy(row.id + ":memo");
    try {
      const signature = await devnetMemo(row, phrase[row.id] || "", memo[row.id] || `${row.name} online`);
      setSig((cur) => ({ ...cur, [row.id]: signature }));
      setFault((cur) => ({ ...cur, [row.id]: "" }));
      setPhrase((cur) => ({ ...cur, [row.id]: "" }));
      toast.success("Signed on devnet. This did not move USDC.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "The memo did not land.";
      setFault((cur) => ({ ...cur, [row.id]: message }));
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-2xl border border-white/10 bg-[#101114] p-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-[#d6ff4a] uppercase">Devnet agent</p>
        <h2 className="mt-1 text-lg font-semibold">A key that stays sealed</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          The secret is encrypted in this browser with PBKDF2-SHA256, 250,000 rounds, then AES-GCM. Senda does not keep the passphrase or the key. This address is Solana devnet. It cannot spend mainnet USDC. A strategy Sign still asks Phantom.
        </p>
        <label className="mt-3 block text-xs text-white/45">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white" />
        </label>
        <label className="mt-3 block text-xs text-white/45">
          Passphrase
          <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" autoComplete="new-password" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white" />
        </label>
        <label className="mt-3 block text-xs text-white/45">
          Repeat it
          <input value={again} onChange={(e) => setAgain(e.target.value)} type="password" autoComplete="new-password" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white" />
        </label>
        <button type="button" disabled={busy === "new"} onClick={() => void create()} className="mt-4 min-h-11 w-full rounded-full bg-[#d6ff4a] text-sm font-semibold text-black disabled:opacity-40">
          {busy === "new" ? "Sealing…" : "Seal a devnet agent"}
        </button>
      </section>
      <section className="rounded-2xl border border-white/10 bg-black p-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">On this browser</p>
        <ul className="mt-3 space-y-4">
          {rows.map((row) => {
            const bal = balances[row.pubkey];
            const shown = bal == null ? "Reading devnet…" : bal === "err" ? "Devnet did not answer" : `${solOf(bal)} SOL`;
            return (
              <li key={row.id} className="border-b border-white/10 pb-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold">{row.name}</p>
                  <p className="font-mono text-xs tabular-nums text-white/70">{shown}</p>
                </div>
                <a className="mt-1 block break-all font-mono text-[11px] text-white/40" href={`https://explorer.solana.com/address/${row.pubkey}?cluster=devnet`} target="_blank" rel="noreferrer">{row.pubkey}</a>
                <p className="mt-1 text-[11px] text-white/35">Devnet · {row.cipher} · {row.box.length} chars of ciphertext · passphrase not stored</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={busy === row.id + ":air"} onClick={() => void airdrop(row)} className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">
                    {busy === row.id + ":air" ? "Asking the faucet…" : "Airdrop 1 SOL"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dropAgent(row.id);
                      reload();
                    }}
                    className="min-h-9 rounded-full px-3 text-xs text-[#ff5d73]"
                  >
                    Drop the seal
                  </button>
                </div>
                <label className="mt-3 block text-[11px] text-white/45">
                  Passphrase, only to sign
                  <input value={phrase[row.id] || ""} onChange={(e) => setPhrase((cur) => ({ ...cur, [row.id]: e.target.value }))} type="password" autoComplete="current-password" className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-[#101114] px-3 text-sm text-white" />
                </label>
                <div className="mt-2 flex gap-2">
                  <input value={memo[row.id] || ""} onChange={(e) => setMemo((cur) => ({ ...cur, [row.id]: e.target.value }))} placeholder="Memo" className="min-h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#101114] px-3 text-sm text-white" />
                  <button type="button" disabled={busy === row.id + ":memo"} onClick={() => void attest(row)} className="min-h-10 shrink-0 rounded-full bg-[#d6ff4a] px-3 text-xs font-semibold text-black disabled:opacity-40">
                    {busy === row.id + ":memo" ? "Signing…" : "Sign memo"}
                  </button>
                </div>
                {fault[row.id] ? <p className="mt-2 text-[11px] leading-relaxed text-[#ff5d73]">{fault[row.id]}</p> : null}
                {sig[row.id] ? (
                  <a className="mt-2 block truncate font-mono text-[11px] text-[#d6ff4a]" href={`https://explorer.solana.com/tx/${sig[row.id]}?cluster=devnet`} target="_blank" rel="noreferrer">
                    {sig[row.id]}
                  </a>
                ) : null}
              </li>
            );
          })}
          {rows.length === 0 ? <li className="text-sm text-white/45">No sealed agent yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
