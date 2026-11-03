import { useEffect, useState } from "react";
import { EquitiesDesk } from "@/components/equities-desk";
import { ChainTapeView } from "@/components/chain-tape";
import { getEquityBook, type EquityBook } from "@/lib/equities";
import { getChainTape, type ChainTape } from "@/lib/chain-tape";

export function EquityMount() {
  const [book, setBook] = useState<EquityBook | null>(null);
  useEffect(() => {
    let live = true;
    getEquityBook()
      .then((next) => {
        if (live) setBook(next);
      })
      .catch(() => {
        if (live) setBook({ stocks: [], reserves: [] });
      });
    return () => {
      live = false;
    };
  }, []);
  if (!book) return <p className="px-4 py-6 text-sm text-white/50">Reading listed stocks and ETFs.</p>;
  if (book.stocks.length === 0) return <p className="px-4 py-6 text-sm text-white/50">The listed book did not come back.</p>;
  return <EquitiesDesk book={book} />;
}

export function ChainMount() {
  const [tape, setTape] = useState<ChainTape | null>(null);
  useEffect(() => {
    let live = true;
    getChainTape()
      .then((next) => live && setTape(next))
      .catch(() => live && setTape({ ok: false, rows: [], note: "", jupiter: false, defillama: false }));
    return () => {
      live = false;
    };
  }, []);
  if (!tape) return <p className="px-4 py-6 text-sm text-white/50">Reading Solana and the other chains.</p>;
  return <ChainTapeView tape={tape} />;
}
