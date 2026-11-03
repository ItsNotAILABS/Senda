import { useEffect, useState } from "react";
import { deskNews, type DeskHeadline } from "@/lib/desk-news";

function ago(at: string) {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

const BRIEF: DeskHeadline[] = [
  {
    id: "kraken-xstocks-vaults",
    title: "Kraken pays yield on SPYx, QQQx, and NVDAx in the same token",
    body: "The vaults lend those xStocks through Kamino on Solana. Yield is variable, a withdrawal can take three days, and the US, UK, Canada, Australia, and the UAE are excluded. Senda does not hold the vault.",
    source: "Kraken · Oct 9",
    url: "https://xstocks.fi/news/xstocks-vaults-go-live-on-kraken-bringing-defi-yield-to-tokenized-equities-on-an-exchange",
    at: "2026-10-09T16:31:00Z",
  },
  {
    id: "visa-agent-pay",
    title: "Visa, BILL, and Billtrust are piloting agent invoice payments",
    body: "An agent registered on Visa's Trusted Agent Protocol can pay an invoice it was already cleared for. On this desk the clearance is the contract: one address and one cap. Phantom still signs every send.",
    source: "Visa · Oct 20",
    url: "https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.22856.html",
    at: "2026-10-20T12:00:00Z",
  },
];

export function DeskNews({ limit = 18, flush = false }: { limit?: number; flush?: boolean }) {
  const [rows, setRows] = useState<DeskHeadline[] | null>(null);

  useEffect(() => {
    let live = true;
    deskNews()
      .then((list) => live && setRows(list))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, []);

  const shown = [...BRIEF, ...(rows ?? [])].slice(0, limit);

  return (
    <section className={flush ? "py-3" : "px-3 py-3 lg:px-4"}>
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">News</p>
      <h2 className="mt-1 text-2xl tracking-tight">What moved</h2>
      <p className="mt-1 text-sm text-white/50">CoinDesk, The Block, and Cointelegraph. The headline is theirs. A trade still signs here.</p>
      {rows == null ? <p className="mt-4 text-sm text-white/45">Pulling the wires.</p> : null}
      {rows && shown.length === 0 ? <p className="mt-4 text-sm text-white/45">The wires did not answer.</p> : null}
      <ul className="mt-2">
        {shown.map((row) => (
          <li key={row.id} className="border-b border-white/10 py-4">
            <a href={row.url} target="_blank" rel="noreferrer" className="flex gap-3">
              {row.image ? (
                <img src={row.image} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-xs font-semibold">{row.source.slice(0, 2)}</span>
              )}
              <span className="min-w-0">
                <span className="block text-base font-semibold leading-snug">{row.title}</span>
                {row.body ? <span className="mt-1 block text-sm leading-relaxed text-white/70">{row.body}</span> : null}
                <span className="mt-2 block text-xs text-[#7eb6ff]">
                  {row.source}
                  {ago(row.at) ? ` · ${ago(row.at)}` : ""}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
