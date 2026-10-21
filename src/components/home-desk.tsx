import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bot, Gamepad2, RefreshCw, Send, ShoppingBag, Sparkles } from "lucide-react";
import { BookView } from "@/components/book-view";
import { ActivityTape } from "@/components/activity-tape";
import { DeskStake } from "@/components/desk-stake";
import { AccountChart } from "@/components/desk-card";
import { OwnedCards } from "@/components/owned-cards";
import { InstrumentCard } from "@/components/desk-card";
import { WalletPicker } from "@/components/wallet-picker";
import { recordFill, setIntent, type Bucket } from "@/lib/book";
import { localLine, usdRates } from "@/lib/fx";
import { connectPhantom, readChain, readUsdcMoves, type UsdcMove } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { acceptQuote, acceptSize } from "@/lib/engine";
import { USDC, dollarOf } from "@/lib/wallet-engine";
import { quoteRoute, type RouteQuote } from "@/lib/jup-sign";
import { setSpendCap, spendCap } from "@/lib/spend-cap";
import { writeUsing } from "@/lib/using";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { getEquityBook, type ListedStock } from "@/lib/equities";
import { noteMark, marksIn, WINDOWS, type WindowId } from "@/lib/account-series";
import { pullPrints, type DeskPrint } from "@/lib/desk-api";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const LOGO: Record<string, string> = {
  SPACEX: "/logos/spacex.png",
  OPENAI: "/logos/openai.png",
  ANTHROPIC: "/logos/anthropic.png",
  ANDURIL: "/logos/anduril.png",
  NEURALINK: "/logos/neuralink.png",
  FIGUREAI: "/logos/figureai.png",
  KALSHI: "/logos/kalshi.png",
  POLYMARKET: "/logos/polymarket.png",
  XAI: "/logos/xai.png",
};

export function HomeDesk({ names }: { names: HouseListing[] }) {
  const pre = names.filter((n) => n.venue === "prestocks" && n.last > 0);
  const featured = [...pre].sort((a, b) => Math.abs(b.premium ?? 0) - Math.abs(a.premium ?? 0));
  const lead = featured[0];
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [sol, setSol] = useState(0);
  const [usdc, setUsdc] = useState(0);
  const [purseLine, setPurseLine] = useState("");
  const [held, setHeld] = useState(0);
  const [holds, setHolds] = useState<{ symbol: string; ui: number; value: number }[]>([]);
  const [tokens, setTokens] = useState<{ mint: string; symbol: string; ui: number }[]>([]);
  const [moves, setMoves] = useState<UsdcMove[]>([]);
  const [bucket, setBucket] = useState<Bucket>("hold");
  const [fx, setFx] = useState("");
  const [cap, setCap] = useState(100);
  const [pick, setPick] = useState("");
  const [buyUsd, setBuyUsd] = useState(1);
  const [buying, setBuying] = useState(false);
  const [quote, setQuote] = useState<RouteQuote | null>(null);
  const [quoteWhy, setQuoteWhy] = useState("");
  const [openWork, setOpenWork] = useState<{ id: string; title: string; usd: number }[] | null>(null);
  const [win, setWin] = useState<WindowId>("4H");
  const [solPx, setSolPx] = useState(0);
  const [stars, setStars] = useState<string[]>([]);
  const [prints, setPrints] = useState<DeskPrint[]>([]);
  const [lens, setLens] = useState<"all" | "up" | "down">("all");
  const [stocks, setStocks] = useState<ListedStock[]>([]);
  const navigate = useNavigate();
  const chosen = pre.find((n) => n.symbol === pick) ?? featured[0];

  useEffect(() => {
    setCap(spendCap());
    let live = true;
    getEquityBook()
      .then((book) => {
        if (!live) return;
        setStocks((book?.stocks ?? []).filter((s) => s.open && !s.halted).slice(0, 8));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    try {
      const rows = JSON.parse(window.localStorage.getItem("senda.stars.v1") || "[]") as string[];
      if (Array.isArray(rows)) setStars(rows);
    } catch {
      setStars([]);
    }
  }, []);
  useEffect(() => {
    let live = true;
    const pull = () => {
      pullPrints()
        .then((rows) => live && setPrints(rows))
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 30_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);
  useEffect(() => {
    let live = true;
    usdRates().then((rates) => live && setFx(localLine(buyUsd, rates)));
    return () => {
      live = false;
    };
  }, [buyUsd]);
  useEffect(() => {
    if (!owner) return;
    let live = true;
    readChain(owner)
      .then((s) => {
        if (!live) return;
        const dollars = dollarOf(s.tokens);
        const rows = s.tokens.flatMap((t) => {
          const name = pre.find((n) => n.mint === t.mint);
          if (!name || !(t.ui > 0)) return [];
          return [{ symbol: name.symbol, ui: t.ui, value: t.ui * name.last }];
        });
        setSol(s.sol);
        setUsdc(dollars.total);
        setPurseLine(dollars.lines.map((l) => `${l.ui.toFixed(2)} ${l.symbol}`).join(" · "));
        setHolds(rows);
        setTokens(s.tokens.filter((t) => t.ui > 0).map((t) => ({ mint: t.mint, symbol: t.symbol, ui: t.ui })));
        setHeld(rows.reduce((sum, row) => sum + row.value, 0));
        readUsdcMoves(owner).then((rows) => live && setMoves(rows.filter((m) => m.signature).slice(0, 6))).catch(() => undefined);
      })
      .catch(() => live && setUsdc(0));
    const again = () => {
      readChain(owner)
        .then((s) => {
          if (!live) return;
          const dollars = dollarOf(s.tokens);
          const rows = s.tokens.flatMap((t) => {
            const name = pre.find((n) => n.mint === t.mint);
            if (!name || !(t.ui > 0)) return [];
            return [{ symbol: name.symbol, ui: t.ui, value: t.ui * name.last }];
          });
          setSol(s.sol);
          setUsdc(dollars.total);
          setPurseLine(dollars.lines.map((l) => `${l.ui.toFixed(2)} ${l.symbol}`).join(" · "));
          setHolds(rows);
          setTokens(s.tokens.filter((t) => t.ui > 0).map((t) => ({ mint: t.mint, symbol: t.symbol, ui: t.ui })));
          setHeld(rows.reduce((sum, row) => sum + row.value, 0));
        })
        .catch(() => {});
    };
    window.addEventListener("senda-chain", again);
    return () => {
      live = false;
      window.removeEventListener("senda-chain", again);
    };
  }, [owner, names]);

  useEffect(() => {
    if (!chosen) return;
    let live = true;
    const t = window.setTimeout(() => {
      quoteRoute({
        inputMint: USDC,
        outputMint: chosen.mint,
        amountRaw: Math.max(1, Math.round(buyUsd * 1e6)),
        outDecimals: 9,
      })
        .then((q) => {
          if (!live) return;
          const size = acceptSize(buyUsd, spendCap());
          const gate = acceptQuote(q);
          setQuote(q);
          setQuoteWhy(!size.ok ? size.reason : !gate.ok ? gate.reason : "");
        })
        .catch((e) => {
          if (!live) return;
          setQuote(null);
          setQuoteWhy(e instanceof Error ? e.message : "No quote.");
        });
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [chosen?.mint, buyUsd]);

  useEffect(() => {
    let live = true;
    import("@/lib/work-hub")
      .then((mod) => mod.listWork())
      .then((rows) => {
        if (!live) return;
        setOpenWork(
          rows
            .filter((g) => g.status !== "paid")
            .slice(0, 3)
            .map((g) => ({ id: g.id, title: g.title, usd: g.usd })),
        );
      })
      .catch(() => {
        if (live) setOpenWork(null);
      });
    return () => {
      live = false;
    };
  }, []);

  function choose(n: HouseListing) {
    setPick(n.symbol);
    writeUsing({ symbol: n.symbol, name: n.name, last: n.last, premium: n.premium, mint: n.mint });
  }

  async function buyChosen() {
    if (!chosen) return;
    setBuying(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      choose(chosen);
      const done = await runPrestock({ owner: who, mint: chosen.mint, side: "buy", usd: buyUsd, price: chosen.last });
      const next = await readChain(who);
      const dollars = dollarOf(next.tokens);
      const rows = next.tokens.flatMap((t) => {
        const name = pre.find((n) => n.mint === t.mint);
        if (!name || !(t.ui > 0)) return [];
        return [{ symbol: name.symbol, ui: t.ui, value: t.ui * name.last }];
      });
      setSol(next.sol);
      setUsdc(dollars.total);
      setPurseLine(dollars.lines.map((l) => `${l.ui.toFixed(2)} ${l.symbol}`).join(" · "));
      setHolds(rows);
      setTokens(next.tokens.filter((t) => t.ui > 0).map((t) => ({ mint: t.mint, symbol: t.symbol, ui: t.ui })));
      setHeld(rows.reduce((sum, row) => sum + row.value, 0));
      const qty = done.outUi > 0 ? done.outUi : chosen.last > 0 ? buyUsd / chosen.last : 0;
      recordFill({ symbol: chosen.symbol, mint: chosen.mint, side: "buy", bucket, usd: buyUsd, qty, signature: done.signature });
      toast.success(`${chosen.symbol} is in the wallet. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The buy did not send.");
    } finally {
      setBuying(false);
    }
  }

  const total = usdc + held + sol * solPx;
  const windowMs = WINDOWS.find((row) => row[0] === win)?.[1] ?? WINDOWS[2][1];
  const accountKey = owner ? `acct:${owner}` : "";
  const stored = accountKey ? marksIn(accountKey, windowMs).map((p) => p.v) : [];
  const accountPts = !accountKey ? [] : stored[stored.length - 1] === total ? stored : [...stored, total];
  const accountMove = accountPts.length > 1 ? accountPts[accountPts.length - 1] - accountPts[0] : null;
  useEffect(() => {
    if (!accountKey) return;
    noteMark(accountKey, total);
  }, [accountKey, total]);
  useEffect(() => {
    for (const n of pre) {
      const hit = prints.find((p) => p.symbol === n.symbol && p.last > 0);
      const last = hit?.last || n.last;
      if (last > 0) noteMark(`px:${n.symbol}`, last);
    }
  }, [names, prints]);
  useEffect(() => {
    if (!owner) return;
    let live = true;
    fetch("https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112", { headers: { accept: "application/json" } })
      .then((r) => r.json())
      .then((body: Record<string, { usdPrice?: number }>) => {
        const px = Number(body.So11111111111111111111111111111111111111112?.usdPrice);
        if (live && px > 0) setSolPx(px);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [owner]);
  const day = holds.reduce((sum, row) => {
    const name = pre.find((n) => n.symbol === row.symbol);
    return name?.change24h == null ? sum : sum + row.value * name.change24h;
  }, 0);
  const activity = wallet.w.txs.slice(0, 4);
  const card = wallet.w.cards[0];
  const desks = [
    ["PreStocks", "/invest", "pre"],
    ["xStocks", "/invest", "xstock"],
    ["Quotes", "/invest", "spot"],
    ["Perps", "/invest", "perps"],
    ["Metals", "/invest", "world"],
    ["Commodities", "/invest", "comms"],
    ["Indexes", "/invest", "index"],
    ["Shares", "/invest", "shares"],
    ["Options", "/invest", "options"],
    ["Cover", "/invest", "cover"],
    ["Loans", "/invest", "loans"],
    ["Predict", "/invest", "pred"],
    ["Futures", "/invest", "futures"],
    ["Coins", "/invest", "tape"],
    ["Chains", "/invest", "chains"],
    ["Solana", "/invest", "vault"],
    ["Borrow", "/invest", "lend"],
    ["Protect", "/invest", "book"],
    ["Hedge", "/invest", "hedge"],
    ["Bridge", "/invest", "bridge"],
    ["Programs", "/invest", "prog"],
    ["Index", "/invest", "basket"],
    ["Launch", "/invest", "minty"],
    ["Curve", "/invest", "curve"],
    ["Radar", "/invest", "wrap"],
    ["Rails", "/invest", "eco"],
  ] as const;
  const PRODUCT_LINE: Record<string, string> = {
    Quotes: "Last price, then you sign",
    PreStocks: "Pre-IPO names, 24/7",
    xStocks: "Listed shares in the wallet",
    Metals: "Gold, silver, copper",
    Commodities: "Oil, energy, softs",
    Options: "A call or a put. The premium is what you sign",
    Perps: "Margin and leverage on the ticket",
    Predict: "Above or below a name. You sign the stake",
    Indexes: "US500, US100, and the other indexes",
    Shares: "NVDA, AAPL, and the other listed names",
    Chains: "Solana markets and the EVM books that sign",
    Coins: "Jupiter coins, including sub-penny",
    Solana: "What this address holds",
    Programs: "The program book",
    Protect: "A book around the print",
    Index: "A basket of names",
    Borrow: "Sell up to half. Repay buys it back",
    Launch: "A new name on the desk",
    Curve: "The curve book",
    Radar: "The widest gap to the mark",
    Rails: "Move value off the trade",
    Futures: "A name, settled later",
    Loans: "Against a name or a share you hold",
    Bridge: "USDC to another chain. You sign",
    Hedge: "The other side of a name",
    Cover: "A premium if the print drops",
  };
  const shownTokens = tokens.filter((t) => t.symbol !== "USDC").slice(0, 8);
  const barMax = Math.max(0.01, ...shownTokens.map((t) => t.ui));
  function star(id: string) {
    setStars((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
      window.localStorage.setItem("senda.stars.v1", JSON.stringify(next));
      return next;
    });
  }
  const book = featured
    .map((n) => {
      const hit = prints.find((p) => p.symbol === n.symbol && p.last > 0);
      return hit ? { ...n, last: hit.last, mark: hit.mark || n.mark, premium: hit.premium } : n;
    })
    .filter((n) => {
      const ch = n.change24h == null ? null : Math.abs(n.change24h) <= 2 ? n.change24h * 100 : n.change24h;
      if (lens === "up") return ch != null && ch > 0;
      if (lens === "down") return ch != null && ch < 0;
      return true;
    })
    .sort((a, b) => Number(stars.includes(b.symbol)) - Number(stars.includes(a.symbol)));
  const products = [...desks].sort((a, b) => Number(stars.includes(b[0])) - Number(stars.includes(a[0])));

  return (
    <main className="space-y-3 px-4 py-3 lg:px-5">
      <section className="overflow-hidden rounded-[28px] border border-[#c6f56a]/25 bg-[#070b08] px-4 py-5">
        <div className="flex items-center justify-between">
          <p className="text-[28px] font-semibold tracking-tight">Account</p>
          <p className="font-mono text-[11px] text-[#c6f56a]">{owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "Not connected"}</p>
        </div>
        <p className="mt-5 text-sm text-white/55">Total Balance</p>
        <p className="mt-1 font-mono text-[42px] leading-none tracking-tight tabular-nums">${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        {accountMove != null ? (
          <p className={cn("mt-2 font-mono text-sm", accountMove < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
            {accountMove >= 0 ? "+" : ""}${Math.abs(accountMove).toLocaleString("en-US", { maximumFractionDigits: 2 })} this window
            {holds.length > 0 ? ` · ${day >= 0 ? "+" : ""}$${Math.abs(day).toLocaleString("en-US", { maximumFractionDigits: 2 })} on names held` : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-white/40">
            {owner
              ? `Buying power $${usdc.toFixed(2)} · ${sol.toFixed(4)} SOL${solPx > 0 ? ` · $${(sol * solPx).toFixed(2)}` : ""}${held > 0 ? ` · $${held.toFixed(2)} in names` : ""}`
              : "Connect Phantom. This number is that wallet."}
          </p>
        )}
        <div className="mt-4">
          <OwnedCards
            sol={sol}
            solPx={solPx}
            tokens={tokens}
            marks={pre.map((n) => ({ mint: n.mint, last: n.last, name: n.name }))}
          />
        </div>
        <AccountChart
          label="WALLET"
          windowId={win}
          onWindow={setWin}
          points={accountPts}
          note={accountPts.length > 1 ? (accountMove != null && accountMove < 0 ? "down" : "up") : "this wallet"}
        />
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {(
            [
              ["Deposit", "/payments", "add"],
              ["Trade", "/invest", "spot"],
              ["Send", "/payments", undefined],
              ["Card", "/cards", undefined],
            ] as const
          ).map(([label, to, extra]) =>
            to === "/cards" ? (
              <Link key={label} to="/cards" search={{ spend: 0 }} className="rounded-2xl bg-[#141a14] px-1 py-3 active:scale-95">
                <span className="mx-auto grid size-9 place-items-center rounded-full border border-[#c6f56a]/40 text-[#c6f56a]">▣</span>
                <span className="mt-2 block text-xs">{label}</span>
              </Link>
            ) : to === "/invest" ? (
              <Link key={label} to="/invest" search={{ desk: extra }} className="rounded-2xl bg-[#141a14] px-1 py-3 active:scale-95">
                <span className="mx-auto grid size-9 place-items-center rounded-full border border-[#c6f56a]/40 text-[#c6f56a]">⇄</span>
                <span className="mt-2 block text-xs">{label}</span>
              </Link>
            ) : (
              <Link key={label} to="/payments" search={extra ? { act: extra } : {}} className="rounded-2xl bg-[#141a14] px-1 py-3 active:scale-95">
                <span className="mx-auto grid size-9 place-items-center rounded-full border border-[#c6f56a]/40 text-[#c6f56a]">{label === "Deposit" ? "↓" : "↗"}</span>
                <span className="mt-2 block text-xs">{label}</span>
              </Link>
            ),
          )}
        </div>
      </section>

      <Movers />
      <ActivityTape />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-lg font-semibold">Equity</h2>
          <div className="flex gap-1">
            {(
              [
                ["all", "All"],
                ["up", "Winners"],
                ["down", "Down"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setLens(id)} className={cn("min-h-8 rounded-full px-3 text-xs font-semibold", lens === id ? "bg-white text-black" : "text-white/50")}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {book.map((n) => (
          <InstrumentCard
            key={n.id}
            title={n.name}
            sub={n.symbol}
            value={formatUsd(n.last)}
            change={n.change24h}
            logo={LOGO[n.symbol] || n.image}
            starred={stars.includes(n.symbol)}
            onStar={() => star(n.symbol)}
            onOpen={() => {
              choose(n);
              void navigate({ to: "/house/$id", params: { id: n.id } });
            }}
            points={marksIn(`px:${n.symbol}`, windowMs).map((p) => p.v)}
          />
        ))}
        {book.length === 0 ? <p className="px-4 py-6 text-sm text-white/45">{lens === "all" ? "Waiting on the book." : "Nothing in this filter."}</p> : null}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-lg font-semibold">Stocks</h2>
          <Link to="/equities" className="text-sm text-[#c6f56a]">Listed</Link>
        </div>
        {stocks.length === 0 ? (
          <p className="px-1 text-sm text-white/45">The listed book has not come back yet.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto">
            {stocks.map((s) => (
              <Link key={s.mint} to="/invest" search={{ desk: "xstock" }} className="min-w-[148px] rounded-[22px] border border-white/10 bg-[#101114] p-3">
                <p className="text-base font-semibold">{s.symbol.replace(/x$/i, "")}</p>
                <p className="truncate text-xs text-white/45">{s.name}</p>
                <p className="mt-2 font-mono text-[11px] text-[#c6f56a]">{s.exchange || "Listed"} · open</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-lg font-semibold">Products</h2>
          <Link to="/invest" className="text-sm text-[#c6f56a]">Trade</Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {products.map(([label, path, desk]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (path === "/invest") void navigate({ to: "/invest", search: { desk } });
              }}
              className="min-h-[88px] rounded-[22px] border border-white/10 bg-[#101114] px-3 py-3 text-left active:scale-[0.98]"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold">{label}</span>
                <span
                  role="button"
                  aria-label={stars.includes(label) ? "Unstar" : "Star"}
                  onClick={(e) => {
                    e.stopPropagation();
                    star(label);
                  }}
                  className={stars.includes(label) ? "text-[#c6f56a]" : "text-white/25"}
                >
                  ★
                </span>
              </span>
              <span className="mt-1 block text-xs leading-snug text-white/45">{PRODUCT_LINE[label] ?? "Opens in Trade"}</span>
            </button>
          ))}
        </div>
      </section>

      {!owner ? <WalletPicker /> : null}
      {owner ? (
        <section className="rounded-[28px] border border-white/10 bg-[#101114] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-[#c6f56a]">SENDA</p>
              <p className="font-mono text-4xl tabular-nums">{total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="mt-1 text-xs text-white/55">USDC {usdc.toFixed(2)} · CASH 0.00 · {sol.toFixed(4)} SOL</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs text-white/70">{sol.toFixed(4)} SOL</p>
              <p className="font-mono text-xs text-white/45">{owner.slice(0, 4)}…{owner.slice(-4)}</p>
              <button type="button" onClick={() => window.dispatchEvent(new Event("senda-chain"))} className="mt-2 block text-sm font-semibold text-[#d7e36a]">Refresh</button>
              <button
                type="button"
                onClick={() => {
                  void connectPhantom().then((addr) => wallet.linkChain(addr, "Phantom", "phantom")).catch((e) => toast.error(e instanceof Error ? e.message : "Phantom did not open."));
                }}
                className="text-sm text-white/80"
              >
                Use this Phantom
              </button>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {shownTokens.map((t) => {
              const name = pre.find((n) => n.mint === t.mint);
              const value = name ? t.ui * name.last : 0;
              return (
                <li key={t.mint} className="flex items-center gap-3 text-sm">
                  <span className="w-24 truncate font-semibold">{t.symbol.length > 10 ? `${t.symbol.slice(0, 4)}…${t.symbol.slice(-4)}` : t.symbol}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full bg-[#c6f56a]" style={{ width: `${Math.max(8, (t.ui / barMax) * 100)}%` }} />
                  </span>
                  <span className="w-14 text-right font-mono text-xs">{value > 0 ? value.toFixed(2) : t.ui >= 1 ? t.ui.toFixed(2) : t.ui.toFixed(4)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {shownTokens.slice(0, 4).map((t) => (
              <div key={t.mint} className="min-w-[108px] rounded-full bg-black px-4 py-2">
                <p className="truncate text-sm font-semibold">{t.symbol.length > 12 ? `${t.symbol.slice(0, 4)}…${t.symbol.slice(-4)}` : t.symbol}</p>
                <p className="font-mono text-xs text-white/55">{t.ui < 1 ? t.ui.toFixed(4) : t.ui.toFixed(2)}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] tracking-[0.14em] text-white/40">IN THE WALLET · ${usdc.toFixed(2)}</p>
          <div className="mt-2 grid grid-cols-3 text-[11px] tracking-[0.12em] text-white/40">
            <span>YOU TAPPED</span>
            <span>PHANTOM HOLDS</span>
            <span>DOLLARS PAID</span>
          </div>
          <div className="mt-2 grid grid-cols-3 text-sm">
            <span>SOL</span>
            <span className="font-mono">{sol.toFixed(5)} SOL</span>
            <span className="font-mono">${usdc.toFixed(2)}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Link to="/payments" search={{ act: "add" }} className="flex min-h-14 items-center justify-center rounded-full bg-[#2a2a2e] text-sm font-semibold">Add</Link>
            <Link to="/payments" className="flex min-h-14 items-center justify-center rounded-full bg-[#2a2a2e] text-sm font-semibold">Send</Link>
            <Link to="/invest" className="flex min-h-14 items-center justify-center rounded-full bg-[#2a2a2e] text-sm font-semibold">Trade</Link>
            <Link to="/social" className="flex min-h-14 items-center justify-center rounded-full bg-[#2a2a2e] text-sm font-semibold">Predict</Link>
            <Link to="/cover" className="flex min-h-14 items-center justify-center rounded-full bg-[#2a2a2e] text-sm font-semibold">Cover</Link>
            <Link to="/cards" search={{ spend: 0 }} className="flex min-h-14 items-center justify-center rounded-full bg-[#2a2a2e] text-sm font-semibold">Card</Link>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] tracking-[0.14em] text-white/40">CARD</p>
              <p className="text-sm">{card ? `···· ${card.last4}` : "None yet"}</p>
            </div>
            <Link to="/cards" search={{ spend: 0 }} className="inline-flex min-h-12 items-center rounded-full bg-[#d7e36a] px-5 text-sm font-semibold text-black">Get a card</Link>
          </div>
          <ul className="mt-4">
            {moves.map((m) => (
              <li key={m.signature} className="flex items-start justify-between gap-3 border-t border-white/10 py-3">
                <span>
                  <span className="block font-mono text-sm">{m.delta >= 0 ? "+" : ""}{m.delta.toFixed(2)} USDC</span>
                  <span className="font-mono text-[11px] text-white/40">{m.signature.slice(0, 4)}…{m.signature.slice(-4)}</span>
                </span>
                <span className="text-xs text-white/45">{m.at ? new Date(m.at * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex gap-2 overflow-x-auto">
        {desks.map(([label, , desk]) => (
          <Link key={label} to="/invest" search={{ desk }} className="shrink-0 rounded-full bg-[#2a2a2e] px-4 py-2 text-sm font-semibold">{label}</Link>
        ))}
      </div>

      {lead ? (
        <Link to="/pre" search={{ q: lead.symbol.toLowerCase() }} className="block px-1 text-sm">
          Radar · <span className="font-semibold">{lead.symbol}</span> is the widest gap to its mark, {formatPremium(lead.premium)}.
        </Link>
      ) : null}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-lg font-semibold">Positions</p>
          <p className="font-mono text-xs text-white/45">{sol.toFixed(4)} SOL</p>
        </div>
        {!owner ? (
          <button
            type="button"
            onClick={() => {
              void connectPhantom()
                .then((addr) => wallet.linkChain(addr, "Phantom", "phantom"))
                .catch((e) => toast.error(e instanceof Error ? e.message : "Phantom did not open."));
            }}
            className="text-sm font-semibold text-[#d7e36a]"
          >
            Connect Phantom.
          </button>
        ) : shownTokens.length === 0 ? (
          <p className="text-sm text-subtle">Nothing in this wallet yet.</p>
        ) : (
          <ul>
            {shownTokens.map((t) => {
              const name = pre.find((n) => n.mint === t.mint);
              const value = name ? t.ui * name.last : 0;
              return (
                <li key={t.mint} className="flex items-center justify-between border-t border-white/10 py-3">
                  <span>
                    <span className="block font-semibold">{t.symbol.length > 12 ? `${t.symbol.slice(0, 4)}…${t.symbol.slice(-4)}` : t.symbol}</span>
                    <span className="font-mono text-xs text-white/40">{t.ui < 1 ? t.ui.toFixed(6) : t.ui.toFixed(4)}</span>
                  </span>
                  <span className="font-mono text-sm">{value > 0 ? `$${value.toFixed(2)}` : "Live"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <DeskStake names={names} mode="perp" />

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Buy a name</p>
        {chosen ? (
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="font-display text-3xl tracking-tight">{chosen.symbol}</p>
            <p className="font-mono text-2xl tabular-nums">{formatUsd(chosen.last)}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-white/60">No live price yet.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {[0.01, 0.1, 1, 25, 100].map((n) => (
            <button key={n} type="button" onClick={() => setBuyUsd(n)} className={cn("min-h-10 rounded-full px-3 font-mono text-sm", buyUsd === n ? "bg-white text-black" : "border border-white/15 text-white/70")}>${n}</button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => { setBucket("hold"); setIntent("hold"); }} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", bucket === "hold" ? "bg-white text-black" : "bg-black/40")}>Hold</button>
          <button type="button" onClick={() => { setBucket("trade"); setIntent("trade"); }} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", bucket === "trade" ? "bg-white text-black" : "bg-black/40")}>Trade</button>
        </div>
        <button type="button" disabled={buying || !chosen || !quote || Boolean(quoteWhy)} onClick={() => void buyChosen()} className="mt-3 min-h-12 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50">
          {buying ? "Waiting for the wallet…" : `Buy $${buyUsd}`}
        </button>
        {quote && chosen ? <p className="mt-2 font-mono text-xs text-muted">Get {quote.outUi.toFixed(4)} {chosen.symbol} · {quote.route}</p> : null}
        {quoteWhy ? <p className="mt-1 text-xs text-down">{quoteWhy}</p> : null}
        {fx ? <p className="mt-1 text-[11px] text-subtle">{fx}</p> : null}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-sm font-semibold">Companies</p>
          <Link to="/pre" className="text-xs text-accent">All names</Link>
        </div>
        {featured.length === 0 ? (
          <p className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-6 text-sm text-subtle">Prices have not come back yet.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto">
            {featured.map((n) => (
              <button key={n.id} type="button" onClick={() => choose(n)} className={cn("flex min-w-[132px] flex-1 flex-col rounded-[22px] border border-white/10 bg-[#10131c] p-3 text-left", chosen?.symbol === n.symbol && "border-accent")}>
                <span className="flex items-center gap-2"><Mark symbol={n.symbol} /><span className="truncate text-sm font-semibold">{n.symbol}</span></span>
                <span className="mt-3 font-mono text-lg tabular-nums">{formatUsd(n.last)}</span>
                <span className={cn("font-mono text-xs tabular-nums", (n.premium ?? 0) < 0 ? "text-down" : "text-up")}>{formatPremium(n.premium)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {holds.length > 0 ? (
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">This address</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-right text-[11px] text-subtle">USDC ${usdc.toFixed(2)} · {sol.toFixed(4)} SOL</p>
          <ul className="mt-3 flex gap-2 overflow-x-auto">
            {holds.map((h) => (
              <li key={h.symbol} className="min-w-[120px] rounded-2xl bg-black/30 px-3 py-2">
                <p className="text-sm font-semibold">{h.symbol}</p>
                <p className="font-mono text-xs text-subtle">{h.ui < 1 ? h.ui.toFixed(4) : h.ui.toFixed(2)}</p>
                <p className="font-mono text-xs">${h.value.toFixed(2)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : owner ? (
        <p className="text-sm text-subtle">No names in the wallet yet. Buying one puts the token here.</p>
      ) : null}

      <DeskStake names={names} mode="pred" />

      <section className="px-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Open games</p>
          <Link to="/social" className="text-xs text-accent">The full ladder</Link>
        </div>
        <p className="mt-2 text-sm text-subtle">No one is in a pot yet. Stake the card above and you are the first side.</p>
      </section>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Tile to="/pre" icon={Sparkles} tint="bg-[#14f195]/15 text-[#7dffa8]" title="Companies" hint="Buy a pre-IPO name" />
        <Tile to="/wallet" icon={RefreshCw} tint="bg-[#9945ff]/20 text-[#d8b4fe]" title="Convert" hint="Swap what you already hold" />
        <Tile to="/social" icon={Gamepad2} tint="bg-[#3b82f6]/15 text-[#93c5fd]" title="Predict" hint="Above or below the print" />
        <Tile to="/cards" search={{ spend: 0 }} icon={ShoppingBag} tint="bg-[#eab308]/15 text-[#fde047]" title="Pay" hint="The card on this computer, then USDC" />
        <Tile to="/payments" icon={Send} tint="bg-[#22d3ee]/15 text-[#67e8f9]" title="Send" hint="Send USDC to someone" />
        <Tile to="/agents" icon={Bot} tint="bg-[#a855f7]/20 text-[#e9d5ff]" title="Agents" hint="Make one, or hire a trader" />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_280px]">
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c]">
          <video src="/video/card.mp4" poster="/images/metal-card.jpg" autoPlay muted loop playsInline className="h-52 w-full object-cover" />
          <div className="p-4">
            <p className="text-sm font-semibold">Shop with the cash</p>
            <p className="mt-1 text-xs text-muted">The number is a cap on the USDC in the wallet. It is not a charge a store can run.</p>
            {card ? <p className="mt-3 font-mono text-xs text-accent">···· {card.last4}</p> : null}
            <Link to="/cards" search={{ spend: 0 }} className="mt-4 inline-flex min-h-12 items-center rounded-full bg-[#d7e36a] px-6 text-sm font-semibold text-black">Mint the number</Link>
          </div>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">AI agent budget</p>
            <Link to="/agents" className="text-xs text-accent">Open</Link>
          </div>
          <p className="mt-1 text-xs text-muted">A send bigger than this is refused. You still sign.</p>
          <p className="mt-3 font-mono text-3xl">${cap}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#d7e36a]" style={{ width: `${Math.min(100, (cap / 500) * 100)}%` }} />
          </div>
          <div className="mt-3 flex gap-2">
            {[25, 100, 500].map((n) => (
              <button key={n} type="button" onClick={() => { setSpendCap(n); setCap(n); }} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", cap === n ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}>${n}</button>
            ))}
          </div>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-sm font-semibold">Recent</p>
          {activity.length === 0 ? <p className="mt-3 text-xs text-subtle">Nothing from this account yet.</p> : (
            <ul>
              {activity.map((tx) => (
                <li key={tx.id} className="border-t border-white/10 py-2 text-xs">
                  <span className="block">{tx.note || tx.kind}</span>
                  <span className="font-mono text-subtle">{tx.amount} {tx.ccy}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function Movers() {
  const [up, setUp] = useState<Array<{ id: string; symbol: string; price: number; change: number }>>([]);
  const [down, setDown] = useState<Array<{ id: string; symbol: string; price: number; change: number }>>([]);
  useEffect(() => {
    let live = true;
    const map = (body: Array<{ id?: string; symbol?: string; usdPrice?: number; stats24h?: { priceChange?: number } }>) =>
      body
        .filter((row) => row.id && row.symbol)
        .map((row) => ({
          id: row.id || "",
          symbol: row.symbol || "",
          price: Number(row.usdPrice) || 0,
          change: Number(row.stats24h?.priceChange) || 0,
        }));
    const pull = () => {
      Promise.all([
        fetch("https://lite-api.jup.ag/tokens/v2/toptrending/24h?limit=16", { headers: { accept: "application/json" } }).then((r) => r.json()),
        fetch("https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=40", { headers: { accept: "application/json" } }).then((r) => r.json()),
      ])
        .then(([trend, traded]) => {
          if (!live) return;
          const trending = Array.isArray(trend) ? map(trend).slice(0, 12) : [];
          const losers = Array.isArray(traded)
            ? map(traded)
                .filter((row) => row.change < 0)
                .sort((a, b) => a.change - b.change)
                .slice(0, 12)
            : [];
          setUp(trending);
          setDown(losers);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 60_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);
  if (!up.length && !down.length) return null;
  return (
    <section className="space-y-3">
      <Strip title="Movers" rows={up} />
      <Strip title="Shakers" rows={down} />
    </section>
  );
}

function Strip({ title, rows }: { title: string; rows: Array<{ id: string; symbol: string; price: number; change: number }> }) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link to="/invest" search={{ desk: "tape" }} className="text-sm text-[#c6f56a]">
          Trade
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {rows.map((row) => {
          const chg = row.change;
          const price = row.price >= 1 ? `$${row.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : row.price > 0 ? `$${row.price.toPrecision(3)}` : "—";
          return (
            <Link key={row.id} to="/invest" search={{ desk: "spot" }} className="min-w-[132px] shrink-0 rounded-2xl border border-white/10 bg-[#101114] p-3">
              <p className="truncate text-sm font-semibold">{row.symbol}</p>
              <p className="mt-2 font-mono text-sm tabular-nums">{price}</p>
              <p className={cn("font-mono text-xs", chg < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                {chg >= 0 ? "+" : ""}
                {chg.toFixed(1)}%
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Tile({
  to,
  search,
  icon: Icon,
  tint,
  title,
  hint,
}: {
  to: "/" | "/pre" | "/wallet" | "/social" | "/cards" | "/payments" | "/agents";
  search?: { spend: number };
  icon: typeof Sparkles;
  tint: string;
  title: string;
  hint: string;
}) {
  return (
    <Link to={to} search={search} className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-[#10131c] px-3 py-3">
      <span className={cn("grid size-10 place-items-center rounded-xl", tint)}>
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[11px] text-muted">{hint}</span>
      </span>
    </Link>
  );
}

function Mark({ symbol }: { symbol: string }) {
  const src = LOGO[symbol];
  if (!src) return <span className="grid size-8 place-items-center rounded-full bg-elevated text-[10px]">{symbol.slice(0, 2)}</span>;
  return <img src={src} alt="" className="size-8 rounded-full bg-white object-contain p-1" />;
}

function Bal({ k, v, sub, tint }: { k: string; v: string; sub: string; tint: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-black/30 px-3 py-2">
      <span className={cn("size-8 rounded-full", tint)} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{k}</span>
        <span className="block text-[11px] text-subtle">{sub}</span>
      </span>
      <span className="font-mono text-sm">{v}</span>
    </li>
  );
}
