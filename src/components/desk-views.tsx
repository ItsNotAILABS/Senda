import { useEffect, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { AgentWorkspace } from "@/components/agent-workspace";
import { BooksDesk } from "@/components/books-desk";
import { CardsDesk } from "@/components/cards-desk";
import { CoverDesk } from "@/components/cover-desk";
import { DocsDesk } from "@/components/docs-desk";
import { EquitiesDesk } from "@/components/equities-desk";
import { MakeDesk } from "@/components/make-desk";
import { PaymentsDesk, type SendPage } from "@/components/payments-desk";
import { GAMES, PlayFloor, type GameId } from "@/components/play-ten";
import { PreDesk } from "@/components/pre-desk";
import { SolanaFloor } from "@/components/solana-floor";
import { VaultDesk } from "@/components/vault-desk";
import { WalletDesk } from "@/components/wallet-desk";
import { WalletsDesk } from "@/components/wallets-desk";
import { WorkDesk } from "@/components/work-desk";
import { getEquityBook, type EquityBook, type ListedStock } from "@/lib/equities";
import { getVerifiedAssets, type VerifiedAsset } from "@/lib/quote-gate";
import { getPreRoutes, type PreRoute } from "@/lib/prestock";
import { useHouse } from "@/lib/use-house";
import { useNavigate } from "@tanstack/react-router";

const preRoute = getRouteApi("/pre");
const walletRoute = getRouteApi("/wallet");
const cardsRoute = getRouteApi("/cards");

export function PreView({ view }: { view: "book" | "ticket" | "cover" | "spend" | "stand" | "basket" | "hold" }) {
  const { q } = preRoute.useSearch();
  const names = useHouse();
  const [routes, setRoutes] = useState<PreRoute[]>([]);
  useEffect(() => {
    getPreRoutes()
      .then(setRoutes)
      .catch(() => undefined);
  }, []);
  return <PreDesk names={names} routes={routes} query={view === "book" ? (q ?? "") : ""} view={view} />;
}

export function PlayLobby() {
  const navigate = useNavigate();
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {GAMES.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => void navigate({ href: `/social/${g.id}` })}
          className="rounded-2xl border border-white/10 bg-[#10131c] p-5 text-left"
        >
          <p className="text-xl tracking-tight">{g.name}</p>
          <p className="mt-1 font-mono text-sm text-accent">{g.pay}</p>
          <p className="mt-2 text-sm text-muted">{g.line}</p>
        </button>
      ))}
    </div>
  );
}

export function PlayGame({ game }: { game: string }) {
  const names = useHouse().filter((h) => h.venue === "prestocks");
  const id = (GAMES.some((g) => g.id === game) ? game : "wheel") as GameId;
  return <PlayFloor names={names} game={id} />;
}

export function SendView({ page }: { page: SendPage }) {
  return <PaymentsDesk page={page} />;
}

export function ShopView({ view }: { view: "account" | "pay" | "chain" | "number" | "expenses" | "rails" }) {
  const { spend } = cardsRoute.useSearch();
  return <CardsDesk initialSpend={view === "pay" ? (spend ?? 0) : 0} view={view} />;
}

export function CoverView({ view }: { view: "drop" | "life" | "open" }) {
  const names = useHouse();
  return <CoverDesk names={names} view={view} />;
}

export function WorkView({ view }: { view: "jobs" | "sheet" | "page" }) {
  const names = useHouse();
  return <WorkDesk names={names} view={view} />;
}

export function ListedView({ view }: { view: "market" | "borrow" }) {
  const [book, setBook] = useState<EquityBook | null>(null);
  const [verified, setVerified] = useState<VerifiedAsset[] | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("Asking Jupiter which names fill at $25…");
  useEffect(() => {
    getEquityBook()
      .then(setBook)
      .catch(() => undefined);
    getVerifiedAssets()
      .then((gate) => {
        setVerified(gate.assets);
        setNote(gate.note);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Jupiter did not answer."));
  }, []);
  if (!verified && !error) return <p className="px-6 py-10 text-sm text-muted">{note}</p>;
  if (error && !verified) return <p className="px-6 py-10 text-sm text-down">{error}</p>;
  const rows = verified ?? [];
  const stocks: ListedStock[] = rows.map((asset) => {
    const known = book?.stocks.find((s) => s.mint === asset.mint);
    return {
      symbol: asset.symbol,
      name: asset.kind === "prestock" ? `${asset.name} · pre-IPO` : known?.name || asset.name,
      mint: asset.mint,
      open: known?.open ?? asset.kind === "prestock",
      halted: known?.halted ?? false,
      hours: asset.kind === "prestock" ? "Pre-IPO" : known?.hours || "24/5",
      period: known?.period || "",
      impactPct: asset.impactPct,
      route: asset.route,
    };
  });
  const mints = new Set(rows.map((a) => a.mint));
  const gated: EquityBook = {
    stocks,
    reserves: (book?.reserves ?? []).filter((r) => mints.has(r.mint)),
  };
  return <EquitiesDesk book={gated} view={view} note={note} />;
}

export function PortfolioView({ view }: { view: "holdings" | "sleeve" | "all" }) {
  const names = useHouse();
  return <VaultDesk names={names} />;
}

export function ConvertView({ view }: { view: "swap" | "sell" }) {
  const { buy } = walletRoute.useSearch();
  return <WalletDesk buy={view === "swap" ? buy : undefined} view={view} />;
}

export function WalletsView({ view }: { view: "connect" | "power" }) {
  return <WalletsDesk view={view} />;
}

export function SolanaView({ view }: { view: "mints" | "index" | "signer" }) {
  const house = useHouse().filter((h) => h.venue === "prestocks");
  return <SolanaFloor house={house} view={view} />;
}

export function MakeView({ view }: { view: "board" | "post" }) {
  return <MakeDesk view={view} />;
}

export function BooksView({ view }: { view: "journal" | "tokens" }) {
  return <BooksDesk view={view} />;
}

export function DocsView({ book }: { book?: string }) {
  return <DocsDesk bookId={book} />;
}

export function AgentsView({ pane }: { pane: "studio" | "build" }) {
  const names = useHouse();
  return <AgentWorkspace names={names} pane={pane} />;
}
