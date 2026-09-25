import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
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

const PANEL = "rounded-[22px] border border-white/[0.08] bg-[#10131c]";
const STAKES = [5, 10, 25, 100] as const;

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
  const [turn, setTurn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [landed, setLanded] = useState("");
  const [reels, setReels] = useState<string[]>(["", "", ""]);
  const [dir, setDir] = useState<"up" | "down">("up");
  const [locked, setLocked] = useState<{ symbol: string; start: number } | null>(null);
  const timer = useRef<number | null>(null);
  const face = book.find((n) => n.symbol === pick) ?? book[0];
  const pays = Math.max(2, book.length - 1);
  const under = book[lit] ?? book[0];
  const lockedNow = locked ? book.find((n) => n.symbol === locked.symbol) : undefined;
  const tableFace = (locked ? lockedNow : face) ?? face;

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
    const n = book.length;
    const idx = pocket(book);
    let step = 0;
    const total = n * 3 + idx;
    const id = window.setInterval(() => {
      if (step > total) {
        window.clearInterval(id);
        timer.current = null;
        const hit = book[idx];
        setLanded(hit.symbol);
        setLit(idx);
        setTurn(-(total * 360) / n);
        setBusy(false);
        const won = hit.symbol === pick;
        if (take(won ? stake * pays : 0, `Wheel ${hit.symbol}`)) {
          toast.success(won ? `${hit.symbol} hit. Paid ${pays}×.` : `Landed on ${hit.symbol}.`);
        }
        return;
      }
      setLit(step % n);
      setTurn(-(step * 360) / n);
      step += 1;
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

  const rule =
    game === "wheel"
      ? `${face ? face.symbol : "A face"}. Hit pays ${pays}×.`
      : game === "slots"
        ? "Pair pays 2×. Three of a kind pays 12×."
        : locked
          ? `${locked.symbol} locked at ${formatUsd(locked.start)}.`
          : "Up or down. Stand pays 2×.";

  const actLabel =
    game === "wheel" ? (busy ? "Spinning" : `Spin $${stake}`) : game === "slots" ? (busy ? "Spinning" : `Pull $${stake}`) : locked ? `Stand $${stake}` : "Deal";

  function act() {
    if (game === "wheel") spinWheel();
    else if (game === "slots") spinSlots();
    else if (locked) stand();
    else deal();
  }

  return (
    <div className="senda-rise space-y-3 px-3 py-3 lg:px-4">
      <header className={cn(PANEL, "px-6 py-6 lg:px-8")}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">Play</p>
            <h1 className="mt-2 text-5xl tracking-tight lg:text-6xl">The floor</h1>
          </div>
          <div className="text-right">
            <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Cash</p>
            <p className="font-mono text-4xl">${cash.toFixed(0)}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(
            [
              ["wheel", "Wheel"],
              ["slots", "Slots"],
              ["table", "Table"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setGame(id)}
              className={cn("min-h-11 rounded-full px-4 text-sm font-semibold", game === id ? "bg-accent text-accent-fg" : "bg-white/[0.06] text-muted")}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {game === "wheel" ? (
        <Felt>
          {book.length ? (
            <Wheel book={book} lit={lit} turn={turn} pick={pick} landed={landed} pays={pays} under={under} busy={busy} onPick={setPick} />
          ) : (
            <p className="grid min-h-80 place-items-center text-sm text-muted">No faces on the book.</p>
          )}
        </Felt>
      ) : null}

      {game === "slots" ? (
        <Felt className="px-4 py-6 sm:px-8">
          <div className="relative mx-auto grid max-w-3xl grid-cols-3 gap-3">
            <div className="pointer-events-none absolute inset-x-3 top-1/2 z-10 h-px -translate-y-1/2 bg-accent" />
            {[0, 1, 2].map((i) => {
              const sym = reels[i] || book[i]?.symbol || "";
              return (
                <div key={i} className="relative grid min-h-56 place-items-center overflow-hidden rounded-[18px] border border-white/10 bg-black/45 sm:min-h-72">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/80 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent" />
                  {sym ? (
                    <div className="text-center">
                      <Face symbol={sym} className="mx-auto size-16 sm:size-28" />
                      <p className="mt-3 text-xs font-semibold tracking-wide sm:text-sm">{sym}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-subtle">—</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center font-mono text-[11px] tracking-[0.16em] text-accent uppercase">2× pair · 12× three</p>
        </Felt>
      ) : null}

      {game === "table" ? (
        <Felt className="px-4 py-6 sm:px-8">
          <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto pb-5">
            {book.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setPick(n.symbol)}
                aria-pressed={pick === n.symbol}
                className={cn(
                  "grid w-24 shrink-0 place-items-center rounded-[18px] border px-2 py-3",
                  pick === n.symbol ? "border-accent bg-accent/10" : "border-white/10 bg-black/30",
                )}
              >
                <Face symbol={n.symbol} className="size-14" />
                <span className="mt-2 text-xs font-semibold">{n.symbol}</span>
              </button>
            ))}
          </div>
          <div className="mx-auto grid w-full max-w-xl place-items-center rounded-[36px] border border-white/10 bg-black/30 px-6 py-10 text-center shadow-[inset_0_0_80px_rgb(0_0_0/0.45)] sm:rounded-[999px] sm:px-16">
            {tableFace ? (
              <>
                <Face symbol={tableFace.symbol} className="size-28 sm:size-36" />
                <p className="mt-4 text-3xl">{tableFace.symbol}</p>
                <p className="mt-1 font-mono text-lg text-accent">{formatUsd(lockedNow?.last ?? tableFace.last)}</p>
                {locked ? <p className="mt-2 font-mono text-xs text-muted">From {formatUsd(locked.start)}</p> : null}
              </>
            ) : (
              <p className="text-sm text-muted">No face on the book.</p>
            )}
            <div className="mt-6 flex gap-2">
              {(["up", "down"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDir(d)}
                  className={cn("min-h-11 min-w-24 rounded-full px-5 text-sm font-semibold", dir === d ? "bg-accent text-accent-fg" : "bg-black/50 text-muted")}
                >
                  {d === "up" ? "Up" : "Down"}
                </button>
              ))}
            </div>
          </div>
        </Felt>
      ) : null}

      <section className={cn(PANEL, "flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5")}>
        <div>
          <p className="text-sm text-muted">{rule}</p>
          <div className="mt-3 flex gap-2">
            {STAKES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStake(n)}
                aria-pressed={stake === n}
                className={cn(
                  "grid size-14 place-items-center rounded-full font-mono text-sm font-semibold",
                  "shadow-[inset_0_0_0_3px_rgb(255_255_255/0.28),inset_0_0_0_7px_rgb(7_8_13/0.55)]",
                  stake === n ? "bg-accent text-accent-fg" : "bg-[#171c12] text-accent",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={act}
          disabled={game === "table" ? !locked && !face : busy || !face || (game === "slots" && book.length < 3)}
          className="min-h-14 rounded-full bg-accent px-8 text-base font-semibold text-accent-fg disabled:opacity-40 sm:min-w-52"
        >
          {actLabel}
        </button>
      </section>
    </div>
  );
}

function Felt({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn("overflow-hidden rounded-[22px] border border-white/[0.08]", className)}
      style={{
        backgroundColor: "#07110e",
        backgroundImage: "linear-gradient(180deg, rgb(8 16 13 / 0.72), rgb(5 9 8 / 0.88)), url(/felt.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {children}
    </section>
  );
}

function Wheel({
  book,
  lit,
  turn,
  pick,
  landed,
  pays,
  under,
  busy,
  onPick,
}: {
  book: HouseListing[];
  lit: number;
  turn: number;
  pick: string;
  landed: string;
  pays: number;
  under?: HouseListing;
  busy: boolean;
  onPick: (symbol: string) => void;
}) {
  const n = book.length;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]">
      <div className="absolute top-3 left-1/2 z-20 -translate-x-1/2">
        <div className="h-0 w-0 border-x-[11px] border-x-transparent border-t-[18px] border-t-accent" />
      </div>
      <div
        className="absolute inset-[7%] rounded-full border border-white/10 shadow-[inset_0_0_70px_rgb(0_0_0/0.55)]"
        style={{ transform: `rotate(${turn}deg)`, transition: "transform 60ms linear" }}
      >
        {book.map((item, i) => {
          const ang = ((i / n) * Math.PI * 2) - Math.PI / 2;
          const x = 50 + Math.cos(ang) * 38;
          const y = 50 + Math.sin(ang) * 38;
          const chosen = pick === item.symbol;
          const hit = landed === item.symbol;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.symbol}
              aria-pressed={chosen}
              onClick={() => onPick(item.symbol)}
              className="absolute"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) rotate(${-turn}deg)`,
                transition: "transform 60ms linear",
              }}
            >
              <span
                className={cn(
                  "grid size-14 place-items-center rounded-full sm:size-[4.5rem]",
                  chosen && "ring-2 ring-accent ring-offset-2 ring-offset-[#07110e]",
                  (hit || (busy && lit === i)) && "ring-4 ring-accent",
                )}
              >
                <Face symbol={item.symbol} className="size-14 sm:size-[4.5rem]" />
              </span>
            </button>
          );
        })}
      </div>
      <div
        className={cn(
          "pointer-events-none absolute top-1/2 left-1/2 z-10 flex size-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border bg-[#10131c]/92 text-center sm:size-32",
          landed && landed === pick ? "border-accent" : "border-white/10",
        )}
      >
        {under ? <Face symbol={under.symbol} className="size-10 sm:size-12" /> : null}
        <p className="mt-1 text-[11px] font-semibold leading-none">{under?.symbol}</p>
        <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-accent uppercase">{pays}×</p>
      </div>
    </div>
  );
}

function Face({ symbol, className }: { symbol: string; className?: string }) {
  const src = LOGO[symbol] ?? LOGO[symbol.toUpperCase()];
  if (!src) {
    return (
      <span className={cn("grid place-items-center rounded-full bg-white text-[10px] font-semibold text-black", className)}>
        {symbol.slice(0, 2)}
      </span>
    );
  }
  return <img src={src} alt="" className={cn("rounded-full bg-white object-contain p-1.5", className)} />;
}
