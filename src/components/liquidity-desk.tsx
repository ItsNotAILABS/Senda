import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ISSUER_ASKS } from "@/lib/access-rails";
import { previewFill } from "@/lib/fill-quote";
import { getVerifiedAssets, type VerifiedAsset } from "@/lib/quote-gate";
import { openLend, type LendRow } from "@/lib/stock-lend";

const SIZES = [25, 100, 500] as const;

export function LiquidityDesk() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<VerifiedAsset[]>([]);
  const [note, setNote] = useState("Asking Jupiter which names still fill inside 1%.");
  const [pick, setPick] = useState<string>("");
  const [usd, setUsd] = useState<number>(100);
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState(false);
  const [usdc, setUsdc] = useState<LendRow | null>(null);
  const [lendNote, setLendNote] = useState("Asking Kamino where dollars already sit.");

  useEffect(() => {
    let live = true;
    getVerifiedAssets()
      .then((book) => {
        if (!live) return;
        setAssets(book.assets);
        setNote(book.assets.length ? book.note : "Jupiter did not clear a name inside 1%.");
        setPick(book.assets[0]?.mint ?? "");
      })
      .catch(() => live && setNote("Jupiter did not answer."));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    openLend()
      .then((book) => {
        if (!live) return;
        setUsdc(book.usdc);
        setLendNote(book.usdc ? "" : book.answered ? "USDC was not on the main book." : "Kamino did not answer.");
      })
      .catch(() => live && setLendNote("Kamino did not answer."));
    return () => {
      live = false;
    };
  }, []);

  const asset = assets.find((row) => row.mint === pick) ?? null;

  async function quote() {
    if (!asset) return;
    setBusy(true);
    setLine("");
    try {
      const fill = await previewFill({ mint: asset.mint, side: "buy", usd, symbol: asset.symbol });
      setLine(fill.line);
    } catch (e) {
      setLine(e instanceof Error ? e.message : "The quote did not return.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const text = [
      "Senda liquidity note",
      asset ? `${asset.symbol} · ${asset.name}` : "No name selected",
      asset ? `$25 impact ${asset.impactPct.toFixed(2)}% · ${asset.route}` : "",
      line || "No extra size quoted.",
      "Jupiter Liquidity Services (design, seed, makers) is not filed from this desk.",
      "This note does not sign.",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Note copied. Jupiter does not have it.");
    } catch {
      toast.error("Could not copy the note.");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 pb-16">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Liquidity</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">What a pool will take.</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        Jupiter’s Liquidity Services is an issuer desk: design, seed, and market-maker introductions. This page does not file that. It quotes a listed name on Jupiter, and it stops before a signature.
      </p>
      <button type="button" onClick={() => void navigate({ href: "/passport" })} className="mt-3 min-h-11 w-full rounded-[22px] border border-white/10 px-4 text-left text-sm">
        <span className="block font-semibold">An issuer file would need their identity</span>
        <span className="mt-0.5 block text-xs text-white/50">The passport on this phone is a key. It is not Jupiter’s verified identity.</span>
      </button>

      <ul className="mt-4 space-y-2">
        {ISSUER_ASKS.map((row) => (
          <li key={row.id} className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-3">
            <p className="text-sm font-semibold">{row.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-white/55">{row.line}</p>
          </li>
        ))}
      </ul>

      <section className="mt-4 rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-sm text-white/55">{note}</p>
        {assets.length ? (
          <>
            <p className="mt-3 text-xs text-white/40">Impact on a $25 buy. A name is listed only inside 1%.</p>
            <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
              {assets.map((row) => (
                <button
                  key={row.mint}
                  type="button"
                  onClick={() => {
                    setPick(row.mint);
                    setLine("");
                  }}
                  className={`min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold ${pick === row.mint ? "bg-white text-black" : "bg-white/10"}`}
                >
                  {row.symbol}
                  <span className="ml-1 font-mono text-[11px] opacity-70">{row.impactPct.toFixed(2)}%</span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setUsd(size)}
                  className={`min-h-11 rounded-full text-sm font-semibold ${usd === size ? "bg-white text-black" : "bg-white/10"}`}
                >
                  ${size}
                </button>
              ))}
            </div>
            <button type="button" disabled={busy || !asset} onClick={() => void quote()} className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
              {busy ? "Asking Jupiter…" : "Quote this size"}
            </button>
          </>
        ) : null}
        {line ? <p className="mt-3 text-sm leading-relaxed text-white/80">{line}</p> : null}
        <button type="button" onClick={() => void copy()} className="mt-3 min-h-11 w-full rounded-full border border-white/10 text-sm font-semibold">
          Copy the note
        </button>
        <p className="mt-2 text-xs text-white/40">Impact over 1% means that size moves the pool. The quote is not an order.</p>
      </section>

      <section className="mt-3 rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-sm font-semibold">Where dollars can sit today</p>
        <p className="mt-1 text-sm leading-relaxed text-white/55">
          {usdc
            ? `USDC on Kamino’s main market supplies ${(usdc.supplyApy * 100).toFixed(2)}% and borrows at ${(usdc.borrowApy * 100).toFixed(2)}%. That is not seed capital, and it is not filed with Jupiter.`
            : lendNote}
        </p>
        <button type="button" onClick={() => void navigate({ href: "/vault/loans" })} className="mt-3 min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
          Open loans
        </button>
      </section>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => void navigate({ href: "/equities" })} className="min-h-11 flex-1 rounded-full border border-white/10 text-sm font-semibold">
          Stocks
        </button>
        <button type="button" onClick={() => void navigate({ href: "/equities/bullish" })} className="min-h-11 flex-1 rounded-full border border-white/10 text-sm font-semibold">
          Bullish
        </button>
      </div>
    </div>
  );
}
