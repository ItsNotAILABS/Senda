import { CARD_TERMS, phantomBrowse, phantomToken } from "@/lib/card-rails";

const DESK = "https://senda.pocketnova.app";
const CASH = "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH";

export function CardTerms({ id }: { id: string }) {
  const row = CARD_TERMS[id];
  if (!row) return null;
  return (
    <div className="mt-3 space-y-2 text-[13px] leading-snug text-white/55">
      <p>
        <span className="text-white">{row.stack}</span>
        {" · "}
        {row.door}
        {". "}
        {row.holds}
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={row.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-3 text-xs font-semibold text-white">
          {row.name}
        </a>
        {id === "phantom" ? (
          <>
            <a href={phantomBrowse(DESK)} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-3 text-xs font-semibold text-white">
              Open this desk in Phantom
            </a>
            <a href={phantomToken(CASH)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-3 text-xs font-semibold text-white">
              CASH page
            </a>
          </>
        ) : null}
        {id === "xplace" ? (
          <a href="https://docs.x.place/card/about-xplace-sard" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-3 text-xs font-semibold text-white">
            Collateral docs
          </a>
        ) : null}
      </div>
    </div>
  );
}
