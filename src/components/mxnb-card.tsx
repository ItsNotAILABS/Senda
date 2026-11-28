import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { MXNB_MINT, readMxnb, type MxnbFacts } from "@/lib/mxnb";

function pesos(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** The Solana peso mint, read live. No swap: Jupiter does not trade it while supply is zero. */
export function MxnbCard() {
  const [row, setRow] = useState<MxnbFacts | { ok: false } | null>(null);

  useEffect(() => {
    let live = true;
    readMxnb()
      .then((next) => live && setRow(next))
      .catch(() => live && setRow({ ok: false }));
    return () => {
      live = false;
    };
  }, []);

  const supply = row?.ok ? row.supply : null;
  const line =
    row == null
      ? "Reading the mint."
      : !row.ok
        ? "The mint did not answer. The address below is still the one Juno lists."
        : !row.token2022
          ? "That account is not a Token-2022 mint. This card will not treat it as MXNB."
          : row.paused
            ? "The issuer has paused this mint. Nothing moves until they unpause it."
            : supply === 0
              ? "Solana supply is 0. The pesos sit on Juno’s other chains. Jupiter has no market, so there is no buy."
              : `${pesos(supply || 0)} MXNB on this mint. This card still does not swap it.`;

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-white/40 uppercase">Peso</p>
      <h2 className="mt-1 text-lg font-semibold">MXNB</h2>
      <p className="mt-1 text-sm leading-snug text-white/60">
        One peso, issued by Juno. Senda does not mint it, and it does not send a SPEI.
      </p>
      <p className="mt-2 text-sm leading-snug text-white/80">{line}</p>
      <p className="mt-2 text-xs leading-snug text-white/45">
        Juno can freeze an account and can pause the mint. On 10 Nov their other chains showed 77.7 million in circulation. That number is not this Solana supply.
      </p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(MXNB_MINT).then(
            () => toast.success("Mint copied."),
            () => toast.error("Could not copy."),
          );
        }}
        className="mt-3 block w-full break-all rounded-2xl bg-white/[0.06] px-3 py-2 text-left font-mono text-[11px] text-white/70"
      >
        {MXNB_MINT}
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/invest" search={{ desk: "hl" }} className="inline-flex min-h-10 items-center rounded-full bg-white px-3 text-sm font-semibold text-black">
          Long or short
        </Link>
        <a href={`https://explorer.solana.com/address/${MXNB_MINT}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-full bg-white/10 px-3 text-sm font-semibold">
          Explorer
        </a>
      </div>
    </section>
  );
}
