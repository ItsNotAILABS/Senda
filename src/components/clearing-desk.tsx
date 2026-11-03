import { Link } from "@tanstack/react-router";
import type { fetchClearing } from "@/lib/clearing-status";

export function ClearingDesk({ book }: { book: Awaited<ReturnType<typeof fetchClearing>> }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="text-xs tracking-[0.16em] text-subtle uppercase">Clearing</p>
        <h1 className="mt-2 text-3xl tracking-tight">Receipts, not custody</h1>
        <p className="mt-3 text-sm text-muted">
          Senda does not hold the card number or the assets. A virtual Mastercard is a Commercial Connect wrap of a registered real card. PARALLAX can anchor a receipt hash. Stocklana can reserve a one-time policy. None of those invent a number.
        </p>
      </header>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <h2 className="text-lg">Mastercard</h2>
        <p className="mt-2 text-sm text-muted">{book.mastercard.note}</p>
        <p className="mt-3 font-mono text-xs text-subtle">
          {book.mastercardReady ? "Commercial Connect is connected." : `Not connected. Missing ${book.mastercardMissing.join(", ")}.`}
        </p>
        <Link to="/cards" search={{ spend: 0 }} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-accent">
          Open the card desk
        </Link>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <h2 className="text-lg">PARALLAX</h2>
        <p className="mt-2 text-sm text-muted">{book.parallax.note}</p>
        <a href={book.parallax.repo} className="mt-3 inline-flex text-sm text-accent">
          {book.parallax.contract}
        </a>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <h2 className="text-lg">Stocklana</h2>
        <p className="mt-2 text-sm text-muted">{book.stocklana.note}</p>
        <a href={book.stocklana.repo} className="mt-3 inline-flex text-sm text-accent">
          Stocklana
        </a>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <h2 className="text-lg">Monad</h2>
        <p className="mt-2 text-sm text-muted">{book.monad.note}</p>
      </section>
    </div>
  );
}
