import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FilmBand } from "@/components/film-band";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
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
};

type Game = "wheel" | "slots" | "table";

function pocket(book: HouseListing[]): number {
  const n = book.reduce((s, x) => s + Math.round(x.last * 100), 0);
  return n % book.length;
}

export function PlayFloor({ names }: { names: HouseListing[] }) {
  const book = names.filter((n) => n.venue === "prestocks" && n.last > 0 && !/xai/i.test(n.symbol));
  const wallet = useWallet();
  const cash = wallet.w.balances.USD || 0;
  const [game, setGame] = useState<Game>("wheel");
  const [stake, setStake] = useState(10);
  const [pick, setPick] = useState(book[0]?.symbol ?? "");
  const [lit, setLit] = useState(0);
  const [busy, setBusy] = useState(false);
  const [landed, setLanded] = useState("");
  const [reels, setReels] = useState<string[]>(["", "", ""]);
  const [dir, setDir] = useState<"up" | "down">("up");
  const [locked, setLocked] = useState<{ symbol: string; start: number } | null>(null);
  const timer = useRef<number | null>(null);
  const face = book.find((n) => n.symbol === pick) ?? book[0];
  const pays = Math.max(2, book.length - 1);

  useEffect(() => {
    if (!pick && book[0]) setPick(book[0].symbol);
  }, [book, pick]);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  function take(payout: number, note: string) {
    const r = wallet.playRound(stake, payout, note);
    if (!r.ok) {
      toast.error(r.error || "Not enough cash.");
      return false;
    }
    return true;
  }

  function spinWheel() {
    if (!book.length || busy) return;
    if (!(cash >= stake)) {
      toast.error("Not enough cash. Add it on Send.");
      return;
    }
    setBusy(true);
    setLanded("");
    const idx = pocket(book);
    let step = 0;
    const total = book.length * 3 + idx;
    const id = window.setInterval(() => {
      setLit(step % book.length);
      step += 1;
      if (step > total) {
        window.clearInterval(id);
        timer.current = null;
        const hit = book[idx];
        setLanded(hit.symbol);
        setLit(idx);
        setBusy(false);
        const won = hit.symbol === pick;
        if (take(won ? stake * pays : 0, `Wheel ${hit.symbol}`)) {
          toast.success(won ? `${hit.symbol} hit. Paid ${pays}×.` : `Landed on ${hit.symbol}.`);
        }
      }
    }, 70);
    timer.current = id;
  }

  function spinSlots() {
    if (book.length < 3 || busy) return;
    if (!(cash >= stake)) {
      toast.error("Not enough cash. Add it on Send.");
      return;
    }
    setBusy(true);
    const base = pocket(book);
    const stops = [base % book.length, Math.floor((base * 7) % book.length), Math.floor((base * 13) % book.length)];
    let step = 0;
    const id = window.setInterval(() => {
      setReels([
        book[(step + stops[0]) % book.length].symbol,
        book[(step + stops[1]) % book.length].symbol,
        book[(step * 2 + stops[2]) % book.length].symbol,
      ]);
      step += 1;
      if (step > 18) {
        window.clearInterval(id);
        timer.current = null;
        const faces = stops.map((i) => book[i].symbol);
        setReels(faces);
        setBusy(false);
        const same = faces[0] === faces[1] && faces[1] === faces[2];
        const pair = faces[0] === faces[1] || faces[1] === faces[2] || faces[0] === faces[2];
        const payout = same ? stake * 12 : pair ? stake * 2 : 0;
        if (take(payout, `Slots ${faces.join(" ")}`)) {
          toast.success(same ? "Three of a kind. 12×." : pair ? "A pair. 2×." : "No line.");
        }
      }
    }, 80);
    timer.current = id;
  }

  function deal() {
    if (!face) return;
    setLocked({ symbol: face.symbol, start: face.last });
    toast.success(`${face.symbol} locked at ${formatUsd(face.last)}.`);
  }

  function stand() {
    if (!locked) return;
    const now = book.find((n) => n.symbol === locked.symbol);
    if (!now) return;
    const won = dir === "up" ? now.last > locked.start : now.last < locked.start;
    if (take(won ? stake * 2 : 0, `Table ${locked.symbol} ${dir}`)) {
      toast.success(won ? `${locked.symbol} went ${dir}. Paid 2×.` : `${locked.symbol} did not. Stake stays with the house.`);
    }
    setLocked(null);
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-[28px] border border-white/10 bg-[#0c0c14] p-6">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Play</p>
          <h1 className="mt-2 text-4xl tracking-tight">The floor</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            The faces are the PreStocks. The stake is the same cash you send. A hit pays back into that cash. Nothing else is minted.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["wheel", "Wheel"],
                ["slots", "Slots"],
                ["table", "Table"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setGame(id)} className={cn("min-h-10 rounded-full px-4 text-sm font-semibold", game === id ? "bg-accent text-accent-fg" : "bg-white/10")}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <p className="text-xs text-subtle">Cash on the account</p>
          <p className="mt-1 font-mono text-4xl">${cash.toFixed(0)}</p>
          <div className="mt-4 flex gap-1">
            {[5, 10, 25, 100].map((n) => (
              <button key={n} type="button" onClick={() => setStake(n)} className={cn("min-h-9 flex-1 rounded-full font-mono text-xs", stake === n ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}>
                ${n}
              </button>
            ))}
          </div>
        </div>
      </section>
      <FilmBand src="/video/desk.mp4" poster="/images/venue.jpg" label="The faces are the book." />

      {game === "wheel" ? (
        <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl">Wheel</h2>
              <p className="mt-1 text-sm text-muted">Pick a face. The pocket is the live print. A hit pays {pays}×.</p>
            </div>
            <button type="button" disabled={busy || !face} onClick={spinWheel} className="min-h-12 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg disabled:opacity-40">
              {busy ? "Spinning…" : `Spin $${stake}`}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {book.map((n, i) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setPick(n.symbol)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 text-left",
                  landed === n.symbol ? "bg-accent text-accent-fg" : pick === n.symbol ? "bg-white/15" : "bg-black/40",
                  lit === i && busy ? "ring-2 ring-accent" : "",
                )}
              >
                <Face symbol={n.symbol} />
                <span>
                  <span className="block text-sm font-semibold">{n.symbol}</span>
                  <span className="block font-mono text-[11px] opacity-70">{formatUsd(n.last)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {game === "slots" ? (
        <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl">Slots</h2>
              <p className="mt-1 text-sm text-muted">Three faces. A pair pays 2×. Three of a kind pays 12×. The stops come off the print.</p>
            </div>
            <button type="button" disabled={busy} onClick={spinSlots} className="min-h-12 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg disabled:opacity-40">
              {busy ? "Spinning…" : `Pull $${stake}`}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {reels.map((sym, i) => (
              <div key={i} className="grid min-h-36 place-items-center rounded-[24px] bg-black/50">
                {sym ? (
                  <div className="text-center">
                    <Face symbol={sym} />
                    <p className="mt-2 text-sm font-semibold">{sym}</p>
                  </div>
                ) : (
                  <p className="text-sm text-subtle">—</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {game === "table" ? (
        <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <h2 className="text-2xl">Table</h2>
          <p className="mt-1 text-sm text-muted">Pick a face and a side. Deal locks this print. Stand pays 2× if it moved that way. The stake leaves when you stand.</p>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {book.map((n) => (
              <button key={n.id} type="button" onClick={() => setPick(n.symbol)} className={cn("min-w-28 shrink-0 rounded-2xl px-3 py-3 text-left", pick === n.symbol ? "bg-accent text-accent-fg" : "bg-black/40")}>
                <Face symbol={n.symbol} />
                <p className="mt-2 text-sm font-semibold">{n.symbol}</p>
                <p className="font-mono text-[11px] opacity-70">{formatUsd(n.last)}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["up", "down"] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDir(d)} className={cn("min-h-10 rounded-full px-4 text-sm font-semibold", dir === d ? "bg-white text-black" : "bg-black/40")}>
                {d === "up" ? "Up" : "Down"}
              </button>
            ))}
            <button type="button" onClick={deal} className="min-h-10 rounded-full bg-white/10 px-4 text-sm font-semibold">Deal</button>
            <button type="button" disabled={!locked} onClick={stand} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
              Stand · ${stake}
            </button>
          </div>
          {locked ? <p className="mt-3 font-mono text-sm">{locked.symbol} from {formatUsd(locked.start)}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function Face({ symbol }: { symbol: string }) {
  const src = LOGO[symbol];
  if (!src) return <span className="grid size-10 place-items-center rounded-full bg-black/40 text-[10px] font-semibold">{symbol.slice(0, 2)}</span>;
  return <img src={src} alt="" className="size-10 rounded-full bg-white object-contain p-1" />;
}
