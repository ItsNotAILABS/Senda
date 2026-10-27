import { useEffect, useState } from "react";
import { EquitiesDesk } from "@/components/equities-desk";
import { HedgeBook } from "@/components/hedge-book";
import { PreDesk } from "@/components/pre-desk";
import { derivBook, type DerivRow } from "@/lib/deriv-book";
import { getEquityBook, type EquityBook } from "@/lib/equities";
import { getPreRoutes, type PreRoute } from "@/lib/prestock";
import { getHouse, HOUSE_FALLBACK, type HouseListing } from "@/lib/sol-house";

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
  if (!book) return <p className="px-4 py-6 text-sm text-white/50">Reading the listed book.</p>;
  if (book.stocks.length === 0) return <p className="px-4 py-6 text-sm text-white/50">The listed book did not come back.</p>;
  return <EquitiesDesk book={book} />;
}

export function HedgeMount() {
  const [rows, setRows] = useState<DerivRow[]>([]);
  useEffect(() => {
    let live = true;
    derivBook()
      .then((next) => {
        if (live) setRows(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  if (rows.length === 0) return <p className="px-4 py-6 text-sm text-white/50">Reading the hedge pairs.</p>;
  return <HedgeBook rows={rows} />;
}

export function PreMount() {
  const [names, setNames] = useState<HouseListing[] | null>(null);
  const [routes, setRoutes] = useState<PreRoute[]>([]);
  useEffect(() => {
    let live = true;
    Promise.all([getHouse().catch(() => HOUSE_FALLBACK), getPreRoutes().catch(() => [])]).then(([house, legs]) => {
      if (!live) return;
      setNames(house);
      setRoutes(legs);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!names) return <p className="px-4 py-6 text-sm text-white/50">Reading PreStocks.</p>;
  return <PreDesk names={names} routes={routes} />;
}
