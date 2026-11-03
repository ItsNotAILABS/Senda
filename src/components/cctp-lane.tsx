import { useState } from "react";
import { toast } from "sonner";
import { CCTP_DOMAINS, burnUsdc, closeMint, type CctpId, type CctpResult } from "@/lib/cctp";

const SOURCES = ["ethereum", "base", "arbitrum"] as const;

function line(result: CctpResult): string {
  if (result.kind === "sent") return result.hash;
  return JSON.stringify({ why: result.why, chainId: result.chainId, calls: result.calls }, null, 2);
}

export function CctpLane() {
  const [source, setSource] = useState<(typeof SOURCES)[number]>("ethereum");
  const [destination, setDestination] = useState<CctpId>("base");
  const [usd, setUsd] = useState("5");
  const [recipient, setRecipient] = useState("");
  const [tx, setTx] = useState("");
  const [mintTo, setMintTo] = useState<CctpId>("ethereum");
  const [sourceDomain, setSourceDomain] = useState(0);
  const [busy, setBusy] = useState<"burn" | "mint" | "">("");
  const [out, setOut] = useState("");
  const dest = CCTP_DOMAINS.find((d) => d.id === mintTo);

  async function burn() {
    setBusy("burn");
    try {
      const result = await burnUsdc({
        source,
        destination,
        recipient: recipient.trim(),
        usd: Number(usd),
      });
      setOut(line(result));
      if (result.kind === "sent") {
        setTx(result.hash);
        toast.success("Burn signed. Circle attests it, then the mint can close.");
      } else {
        toast.message("Arbitrum payload exported. Phantom is not asked to mint it.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The burn did not send.");
    } finally {
      setBusy("");
    }
  }

  async function mint() {
    if (!dest?.mintInApp) {
      setBusy("mint");
      try {
        const result = await closeMint({ sourceDomain, txHash: tx, destination: mintTo });
        setOut(line(result));
        toast.message(dest?.why || "Exported. There is no mint button for this chain.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Circle did not return the message.");
      } finally {
        setBusy("");
      }
      return;
    }
    setBusy("mint");
    try {
      const result = await closeMint({ sourceDomain, txHash: tx, destination: mintTo });
      setOut(line(result));
      if (result.kind === "sent") toast.success("Mint signed in Phantom.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The mint did not send.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="mt-5 rounded-[22px] bg-[#101114] p-3">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">CCTP</p>
      <h3 className="mt-1 text-lg font-semibold">Move USDC. The wallet signs the mint.</h3>
      <p className="mt-1 text-xs text-white/55">
        Ethereum and Base close inside Phantom. Arbitrum is not on Phantom's network list, so that transfer exports the payload. There is no mint button for it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SOURCES.map((id) => (
          <button key={id} type="button" onClick={() => setSource(id)} className={source === id ? "min-h-9 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-9 rounded-full bg-white/10 px-3 text-sm text-white/70"}>
            From {id}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {CCTP_DOMAINS.filter((d) => d.id !== "solana" && d.id !== source).map((d) => (
          <button key={d.id} type="button" onClick={() => setDestination(d.id)} className={destination === d.id ? "min-h-9 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-9 rounded-full bg-white/10 px-3 text-sm text-white/70"}>
            To {d.name}
          </button>
        ))}
      </div>
      <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" aria-label="USDC amount" className="mt-3 min-h-11 w-full rounded-full bg-black/40 px-4 font-mono text-sm outline-none" />
      <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Mint recipient, 0x" className="mt-2 min-h-11 w-full rounded-full bg-black/40 px-4 text-sm outline-none" />
      <button type="button" disabled={busy !== ""} onClick={() => void burn()} className="mt-3 min-h-11 rounded-full bg-[#d7e36a] px-4 text-sm font-semibold text-black">
        {busy === "burn" ? "Waiting for the wallet…" : source === "arbitrum" ? "Export the Arbitrum burn" : `Burn on ${source}`}
      </button>

      <h3 className="mt-5 text-sm font-semibold">Close the mint</h3>
      <p className="mt-1 text-xs text-white/45">Paste the burn hash. Circle attests it. Phantom mints on Ethereum or Base only.</p>
      <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="Burn transaction 0x" className="mt-2 min-h-11 w-full rounded-full bg-black/40 px-4 font-mono text-xs outline-none" />
      <div className="mt-2 flex flex-wrap gap-2">
        {CCTP_DOMAINS.filter((d) => d.id !== "solana").map((d) => (
          <button key={d.id} type="button" onClick={() => setSourceDomain(d.domain)} className={sourceDomain === d.domain ? "min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black" : "min-h-9 rounded-full bg-white/10 px-3 text-xs text-white/70"}>
            Burned on {d.name}
          </button>
        ))}
        <button type="button" onClick={() => setSourceDomain(5)} className={sourceDomain === 5 ? "min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black" : "min-h-9 rounded-full bg-white/10 px-3 text-xs text-white/70"}>
          Burned on Solana
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {CCTP_DOMAINS.map((d) => (
          <button key={d.id} type="button" onClick={() => setMintTo(d.id)} className={mintTo === d.id ? "min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black" : "min-h-9 rounded-full bg-white/10 px-3 text-xs text-white/70"}>
            {d.mintInApp ? `Mint on ${d.name}` : `${d.name} export`}
          </button>
        ))}
      </div>
      {dest && !dest.mintInApp ? <p className="mt-2 text-xs text-white/55">{dest.why}</p> : null}
      <button type="button" disabled={busy !== ""} onClick={() => void mint()} className="mt-3 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black">
        {busy === "mint" ? "Waiting…" : dest?.mintInApp ? `Mint on ${dest.name}` : "Export the payload"}
      </button>
      {out ? <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[11px] text-white/55">{out}</pre> : null}
    </section>
  );
}
