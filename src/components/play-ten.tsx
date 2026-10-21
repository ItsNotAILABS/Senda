import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { TabLead } from "@/components/tab-lead";
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

const PRACTICE = "senda.practice.usd";

function readPractice() {
  try {
    return Number(localStorage.getItem(PRACTICE) || "0") || 0;
  } catch {
    return 0;
  }
}
const STAKES = [5, 10, 25, 100] as const;

type GameId = "wheel" | "slots" | "updown" | "race" | "closest" | "crash" | "hilo" | "parlay" | "dice" | "mines";

const GAMES: { id: GameId; name: string; pay: string; line: string }[] = [
  { id: "wheel", name: "Wheel", pay: "Field ×", line: "Pick a name. The print stops the wheel." },
  { id: "slots", name: "Slots", pay: "2× / 12×", line: "Three faces from the book. A pair pays." },
  { id: "updown", name: "Up / Down", pay: "2×", line: "Lock a print. Call the next move." },
  { id: "race", name: "Furthest", pay: "5×", line: "Which name sits furthest from its mark." },
  { id: "closest", name: "Closest", pay: "5×", line: "Which name sits tightest to its mark." },
  { id: "crash", name: "Ride", pay: "You cash", line: "The print sets the bust. You choose when to get off." },
  { id: "hilo", name: "Higher", pay: "1.9×", line: "The next name on the book. Higher or lower." },
  { id: "parlay", name: "Parlay", pay: "3.4×", line: "Two names. Call each cheap or rich." },
  { id: "dice", name: "Dice", pay: "2× / 5×", line: "Two faces from the cents. Over, under, or seven." },
  { id: "mines", name: "Mines", pay: "4×", line: "Three safe tiles. The print hid three mines." },
];

type RoundBanner = { what: string; paid: number; practice: boolean };

function pocket(book: HouseListing[]): number {
  const n = book.reduce((s, x) => s + Math.round(x.last * 100), 0);
  return book.length ? n % book.length : 0;
}

function byGap(book: HouseListing[], far: boolean): HouseListing | undefined {
  return [...book].sort((a, b) => {
    const d = Math.abs(a.premium ?? 0) - Math.abs(b.premium ?? 0);
    return far ? -d : d;
  })[0];
}

export function PlayFloor({ names }: { names: HouseListing[] }) {
  const book = names.filter((n) => n.venue === "prestocks" && n.last > 0 && !/xai/i.test(n.symbol));
  const wallet = useWallet();
  const cash = wallet.w.balances.USD || 0;
  const [mode, setMode] = useState<"practice" | "real">("practice");
  const [practice, setPractice] = useState(0);
  const [game, setGame] = useState<GameId>("wheel");
  const [stake, setStake] = useState(10);
  const [banner, setBanner] = useState<RoundBanner | null>(null);
  const pot = mode === "practice" ? practice : cash;

  useEffect(() => setPractice(readPractice()), []);

  function loadPractice() {
    try {
      localStorage.setItem(PRACTICE, "500");
    } catch {
      /* private */
    }
    setPractice(500);
    setMode("practice");
  }

  function take(payout: number, label: string) {
    if (mode === "practice") {
      if (practice + 0.001 < stake) {
        toast.error("Practice is empty. Load $500.");
        return false;
      }
      const next = Math.round((practice - stake + Math.max(0, payout)) * 100) / 100;
      try {
        localStorage.setItem(PRACTICE, String(next));
      } catch {
        /* private */
      }
      setPractice(next);
      setBanner({ what: label, paid: payout, practice: true });
      return true;
    }
    const r = wallet.playRound(stake, payout, label);
    if (!r.ok) {
      toast.error(r.error || "Not enough cash. Switch to practice.");
      return false;
    }
    setBanner({ what: label, paid: payout, practice: false });
    return true;
  }

  const meta = GAMES.find((g) => g.id === game)!;

  return (
    <div className="px-3 py-3 lg:px-4">
      <TabLead
        kicker="Play"
        title="Ten games on the live book."
        accent="Practice first."
        line="Every result comes from a PreStock print, not a hidden roll. Practice cash lets you learn the felt. Real cash is the balance you already hold. The two never mix."
        live={["Wheel, slots, up/down, furthest, closest, ride, higher, parlay, dice, and mines.", "Practice bankroll on this browser.", "Real stakes leave Senda cash and wins come back."]}
        coming={["A shared table with another wallet.", "A prize that leaves this browser."]}
      />

      <Felt className="mt-3">
        <div className="flex gap-2 overflow-x-auto px-3 pt-3 lg:grid lg:grid-cols-10 lg:overflow-visible">
          {GAMES.map((g) => {
            const on = game === g.id;
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                aria-label={`${g.name}, ${g.pay}. ${g.line}`}
                onClick={() => {
                  setGame(g.id);
                  setBanner(null);
                }}
                className={cn(
                  "flex min-h-14 w-[5.6rem] shrink-0 flex-col items-start justify-center rounded-2xl px-3 lg:w-auto",
                  on ? "bg-paper text-ink" : "bg-black/40 text-fg",
                )}
              >
                <span className="text-sm leading-none font-semibold">{g.name}</span>
                <span className={cn("mt-1 font-mono text-[10px] leading-none", on ? "opacity-70" : "text-accent")}>{g.pay}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-5xl leading-none tracking-tight">${pot.toFixed(2)}</p>
            <div className="flex rounded-full bg-black/40 p-1">
              <button
                type="button"
                aria-pressed={mode === "practice"}
                onClick={() => setMode("practice")}
                className={cn("min-h-11 rounded-full px-4 text-sm font-semibold", mode === "practice" ? "bg-accent text-accent-fg" : "text-fg")}
              >
                Practice
              </button>
              <button
                type="button"
                aria-pressed={mode === "real"}
                onClick={() => setMode("real")}
                className={cn("min-h-11 rounded-full px-4 text-sm font-semibold", mode === "real" ? "bg-accent text-accent-fg" : "text-fg")}
              >
                Real
              </button>
            </div>
            <button type="button" onClick={loadPractice} className="min-h-11 rounded-full border border-white/20 px-4 text-sm font-semibold">
              Load $500
            </button>
          </div>
          <div className="flex items-center gap-2">
            {STAKES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={stake === n}
                onClick={() => setStake(n)}
                className={cn(
                  "grid size-14 place-items-center rounded-full bg-chip font-mono text-sm font-semibold text-chip-ink",
                  "shadow-[inset_0_0_0_3px_rgb(242_239_232_/_0.22),0_6px_0_rgb(90_18_18)]",
                  stake === n ? "-translate-y-0.5 ring-2 ring-fg" : "opacity-80",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <Board game={game} book={book} stake={stake} cash={pot} pay={meta.pay} banner={banner} take={take} clear={() => setBanner(null)} />
      </Felt>
    </div>
  );
}

function Board({
  game,
  book,
  stake,
  cash,
  pay,
  banner,
  take,
  clear,
}: {
  game: GameId;
  book: HouseListing[];
  stake: number;
  cash: number;
  pay: string;
  banner: RoundBanner | null;
  take: (payout: number, label: string) => boolean;
  clear: () => void;
}) {
  if (!book.length) {
    return (
      <div className="grid min-h-64 place-items-center">
        <p className="text-sm text-muted">The book has no prints yet.</p>
      </div>
    );
  }
  const props = { book, stake, cash, pay, banner, take, clear };
  if (game === "wheel") return <WheelGame {...props} />;
  if (game === "slots") return <SlotsGame {...props} />;
  if (game === "updown") return <UpGame {...props} />;
  if (game === "race") return <GapGame {...props} far />;
  if (game === "closest") return <GapGame {...props} far={false} />;
  if (game === "crash") return <CrashGame {...props} />;
  if (game === "hilo") return <HiLo {...props} />;
  if (game === "parlay") return <Parlay {...props} />;
  if (game === "dice") return <Dice {...props} />;
  return <Mines {...props} />;
}

function need(cash: number, stake: number) {
  if (cash + 0.001 < stake) {
    toast.error("Not enough cash. Add it on Send.");
    return false;
  }
  return true;
}

type Common = {
  book: HouseListing[];
  stake: number;
  cash: number;
  pay: string;
  banner: RoundBanner | null;
  take: (payout: number, label: string) => boolean;
  clear: () => void;
};

function WheelGame({ book, stake, cash, pay, banner, take, clear }: Common) {
  const [pick, setPick] = useState(book[0].symbol);
  const [lit, setLit] = useState(0);
  const [turn, setTurn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [landed, setLanded] = useState("");
  const timer = useRef<number | null>(null);
  const pays = Math.max(2, book.length - 1);
  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  function spin() {
    if (busy || !need(cash, stake)) return;
    clear();
    setBusy(true);
    setLanded("");
    const idx = pocket(book);
    const n = book.length;
    let step = 0;
    const total = n * 3 + idx;
    const id = window.setInterval(() => {
      if (step > total) {
        window.clearInterval(id);
        const hit = book[idx];
        setLanded(hit.symbol);
        setLit(idx);
        setBusy(false);
        const won = hit.symbol === pick;
        take(won ? stake * pays : 0, `Wheel ${hit.symbol}`);
        return;
      }
      setLit(step % n);
      setTurn(-(step * 360) / n);
      step += 1;
    }, 60);
    timer.current = id;
  }

  return (
    <Stage pay={pay} banner={banner} label={busy ? "Spinning" : `Spin $${stake}`} disabled={busy} onClick={spin}>
      <Wheel book={book} lit={lit} turn={turn} pick={pick} landed={landed} pays={pays} under={book[lit]} busy={busy} onPick={setPick} />
      <NameRail book={book} pick={pick} disabled={busy} onPick={setPick} />
    </Stage>
  );
}

function SlotsGame({ book, stake, cash, pay, banner, take, clear }: Common) {
  const [reels, setReels] = useState<string[]>([book[0].symbol, book[1 % book.length].symbol, book[2 % book.length].symbol]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  function pull() {
    if (book.length < 2 || busy || !need(cash, stake)) return;
    clear();
    setBusy(true);
    const base = pocket(book);
    const stops = [base % book.length, (base * 7) % book.length, (base * 13) % book.length];
    let step = 0;
    const id = window.setInterval(() => {
      setReels([
        book[(step + stops[0]) % book.length].symbol,
        book[(step + stops[1]) % book.length].symbol,
        book[(step * 2 + stops[2]) % book.length].symbol,
      ]);
      step += 1;
      if (step > 16) {
        window.clearInterval(id);
        setBusy(false);
        const faces = stops.map((i) => book[i].symbol);
        setReels(faces);
        const same = faces[0] === faces[1] && faces[1] === faces[2];
        const pair = faces[0] === faces[1] || faces[1] === faces[2] || faces[0] === faces[2];
        take(same ? stake * 12 : pair ? stake * 2 : 0, `Slots ${faces.join(" ")}`);
      }
    }, 70);
    timer.current = id;
  }

  return (
    <Stage pay={pay} banner={banner} label={busy ? "Spinning" : `Pull $${stake}`} disabled={busy} onClick={pull}>
      <div className="grid w-full max-w-4xl grid-cols-3 gap-3">
        {reels.map((sym, i) => (
          <div key={i} className="flex min-h-44 flex-col items-center justify-center rounded-[28px] bg-black/50 px-1 sm:min-h-72">
            <Face symbol={sym} className="size-16 sm:size-32" />
            <p className="mt-3 w-full truncate text-center text-xs font-semibold sm:text-base">{sym}</p>
          </div>
        ))}
      </div>
    </Stage>
  );
}

function UpGame({ book, stake, cash, pay, banner, take, clear }: Common) {
  const [pick, setPick] = useState(book[0].symbol);
  const [dir, setDir] = useState<"up" | "down">("up");
  const [locked, setLocked] = useState<{ symbol: string; start: number } | null>(null);
  const face = book.find((n) => n.symbol === (locked?.symbol || pick)) ?? book[0];

  function go() {
    if (!locked) {
      clear();
      setLocked({ symbol: face.symbol, start: face.last });
      toast.success(`${face.symbol} locked at ${formatUsd(face.last)}.`);
      return;
    }
    if (!need(cash, stake)) return;
    clear();
    const now = book.find((n) => n.symbol === locked.symbol);
    if (!now) return;
    const won = dir === "up" ? now.last > locked.start : now.last < locked.start;
    const push = now.last === locked.start;
    take(push ? stake : won ? stake * 2 : 0, `UpDown ${locked.symbol} ${dir}`);
    setLocked(null);
  }

  return (
    <Stage pay={pay} banner={banner} label={locked ? `Stand $${stake}` : "Lock the print"} onClick={go}>
      <NameRail book={book} pick={face.symbol} disabled={!!locked} onPick={(symbol) => !locked && setPick(symbol)} />
      <div className="text-center">
        <Face symbol={face.symbol} className="mx-auto size-28 sm:size-36" />
        <p className="mt-3 font-display text-4xl">{face.symbol}</p>
        <p className="font-mono text-3xl text-accent">{formatUsd(face.last)}</p>
        {locked ? <p className="mt-1 font-mono text-sm text-muted">Locked {formatUsd(locked.start)}</p> : null}
      </div>
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <Pick title="Up" on={dir === "up"} onClick={() => setDir("up")} />
        <Pick title="Down" on={dir === "down"} onClick={() => setDir("down")} />
      </div>
    </Stage>
  );
}

function GapGame({ book, stake, cash, pay, banner, take, clear, far }: Common & { far: boolean }) {
  const [pick, setPick] = useState(book[0].symbol);
  const [shown, setShown] = useState(false);
  const winner = byGap(book, far);
  const mine = book.find((n) => n.symbol === pick) ?? book[0];

  function run() {
    if (!need(cash, stake) || !winner) return;
    clear();
    setShown(true);
    const held = book.find((n) => n.symbol === pick);
    const hit = held && Math.abs(held.premium ?? 0) === Math.abs(winner.premium ?? 0);
    take(hit ? stake * 5 : 0, `${far ? "Furthest" : "Closest"} ${winner.symbol}`);
  }

  return (
    <Stage pay={pay} banner={banner} label={`${far ? "Who is furthest" : "Who is closest"} · $${stake}`} onClick={run}>
      <div className="text-center">
        <Face symbol={mine.symbol} className="mx-auto size-24 sm:size-28" />
        <p className="mt-2 font-display text-4xl">{mine.symbol}</p>
        {shown ? <p className="font-mono text-sm text-muted">{((mine.premium ?? 0) * 100).toFixed(1)}% vs mark</p> : null}
      </div>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-2 md:grid-cols-4">
        {book.map((n) => {
          const on = pick === n.symbol;
          return (
            <button
              key={n.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setPick(n.symbol);
                setShown(false);
                clear();
              }}
              className={cn("flex min-h-28 flex-col items-center justify-center rounded-2xl px-2 py-3", on ? "bg-paper text-ink" : "bg-black/40 text-fg")}
            >
              <Face symbol={n.symbol} className="size-12" />
              <span className="mt-2 max-w-full truncate text-sm font-semibold">{n.symbol}</span>
              {shown ? <span className="font-mono text-[11px]">{((n.premium ?? 0) * 100).toFixed(1)}%</span> : null}
            </button>
          );
        })}
      </div>
    </Stage>
  );
}

function CrashGame({ book, stake, cash, pay, banner, take, clear }: Common) {
  const [mult, setMult] = useState(1);
  const [live, setLive] = useState(false);
  const ref = useRef({ mult: 1 });
  const liveRef = useRef(false);
  const bustRef = useRef(1.15);
  const takeRef = useRef(take);
  takeRef.current = take;

  useEffect(() => {
    if (!live) return;
    const limit = bustRef.current;
    const id = window.setInterval(() => {
      if (!liveRef.current) {
        window.clearInterval(id);
        return;
      }
      ref.current.mult = Math.round((ref.current.mult + 0.08) * 100) / 100;
      setMult(ref.current.mult);
      if (ref.current.mult >= limit) {
        window.clearInterval(id);
        if (!liveRef.current) return;
        liveRef.current = false;
        setLive(false);
        takeRef.current(0, `Ride bust ${limit.toFixed(2)}`);
      }
    }, 90);
    return () => window.clearInterval(id);
  }, [live]);

  function start() {
    if (liveRef.current || !need(cash, stake)) return;
    bustRef.current = 1.15 + ((Math.round(book[0].last * 100) % 8) + 1) * 0.28;
    ref.current.mult = 1;
    setMult(1);
    clear();
    liveRef.current = true;
    setLive(true);
  }

  function cashOut() {
    if (!liveRef.current) return;
    liveRef.current = false;
    setLive(false);
    const m = ref.current.mult;
    take(stake * m, `Ride ${m.toFixed(2)}`);
  }

  return (
    <Stage
      pay={pay}
      banner={banner}
      label={live ? `Cash out ${mult.toFixed(2)}×` : `Ride $${stake}`}
      onClick={live ? cashOut : start}
    >
      <div className="text-center">
        <p className="font-mono text-7xl leading-none text-accent sm:text-8xl">{mult.toFixed(2)}×</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5">
          <Face symbol={book[0].symbol} className="size-7" />
          <span className="text-sm font-semibold">{book[0].symbol}</span>
        </div>
      </div>
    </Stage>
  );
}

function HiLo({ book, stake, cash, pay, banner, take, clear }: Common) {
  const seed = pocket(book);
  const cur = book[seed % book.length];
  const nxt = book[(seed * 3 + 1) % book.length];
  const [higher, setHigher] = useState(true);
  const [open, setOpen] = useState(false);

  function go() {
    if (open) {
      setOpen(false);
      clear();
      return;
    }
    if (!need(cash, stake)) return;
    clear();
    setOpen(true);
    if (nxt.last === cur.last) {
      take(stake, `Higher ${nxt.symbol} push`);
      return;
    }
    const won = higher ? nxt.last > cur.last : nxt.last < cur.last;
    take(won ? stake * 1.9 : 0, `Higher ${nxt.symbol}`);
  }

  return (
    <Stage pay={pay} banner={banner} label={open ? "Next hand" : `Call $${stake}`} onClick={go}>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-3">
        <CardFace n={cur} />
        {open ? (
          <CardFace n={nxt} />
        ) : (
          <div className="grid h-64 place-items-center rounded-[22px] border border-dashed border-white/25 bg-black/30 text-sm text-muted sm:h-72">
            Next name
          </div>
        )}
      </div>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-3">
        <Pick title="Higher" on={higher} disabled={open} onClick={() => setHigher(true)} />
        <Pick title="Lower" on={!higher} disabled={open} onClick={() => setHigher(false)} />
      </div>
    </Stage>
  );
}

function Parlay({ book, stake, cash, pay, banner, take, clear }: Common) {
  const a = book[0];
  const b = book[Math.min(1, book.length - 1)];
  const [side, setSide] = useState<Record<string, "cheap" | "rich">>({ [a.symbol]: "cheap", [b.symbol]: "rich" });
  const names = a.symbol === b.symbol ? [a] : [a, b];

  function run() {
    if (!need(cash, stake)) return;
    clear();
    const ok = names.every((n) => ((n.premium ?? 0) < 0 ? "cheap" : "rich") === side[n.symbol]);
    take(ok && names.length === 2 ? stake * 3.4 : 0, `Parlay ${names.map((n) => n.symbol).join(" ")}`);
  }

  return (
    <Stage pay={pay} banner={banner} label={`Run the parlay $${stake}`} disabled={names.length < 2} onClick={run}>
      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        {names.map((n) => (
          <div key={n.id} className="rounded-[22px] bg-black/35 px-4 py-5 text-center">
            <Face symbol={n.symbol} className="mx-auto size-20" />
            <p className="mt-3 font-display text-3xl">{n.symbol}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["cheap", "rich"] as const).map((s) => (
                <Pick key={s} title={s} on={side[n.symbol] === s} onClick={() => setSide({ ...side, [n.symbol]: s })} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Stage>
  );
}

function Dice({ book, stake, cash, pay, banner, take, clear }: Common) {
  const [call, setCall] = useState<"over" | "under" | "seven">("over");
  const [faces, setFaces] = useState<[number, number] | null>(null);
  const a = (Math.round(book[0].last * 100) % 6) + 1;
  const b = (Math.round(book[Math.min(1, book.length - 1)].last * 100) % 6) + 1;

  function roll() {
    if (!need(cash, stake)) return;
    clear();
    setFaces([a, b]);
    const sum = a + b;
    const won = call === "seven" ? sum === 7 : call === "over" ? sum > 7 : sum < 7;
    const mult = call === "seven" ? 5 : 2;
    take(won ? stake * mult : 0, `Dice ${sum}`);
  }

  const calls = [
    ["under", "Under", "2×"],
    ["seven", "Seven", "5×"],
    ["over", "Over", "2×"],
  ] as const;

  return (
    <Stage pay={pay} banner={banner} label={`Roll $${stake}`} onClick={roll}>
      <div className="flex gap-4">
        {[faces?.[0] ?? "·", faces?.[1] ?? "·"].map((d, i) => (
          <div key={i} className="grid size-28 place-items-center rounded-[22px] bg-paper font-mono text-6xl font-semibold text-ink sm:size-36">
            {d}
          </div>
        ))}
      </div>
      <div className="grid w-full max-w-lg grid-cols-3 gap-2">
        {calls.map(([id, title, sub]) => (
          <Pick key={id} title={title} sub={sub} on={call === id} onClick={() => setCall(id)} />
        ))}
      </div>
    </Stage>
  );
}

function Mines({ book, stake, cash, pay, banner, take, clear }: Common) {
  const mines = new Set<number>();
  const start = pocket(book) % 9;
  for (let i = 0; mines.size < 3; i += 1) mines.add((start + i * 4) % 9);
  const [picked, setPicked] = useState<number[]>([]);
  const [open, setOpen] = useState(false);

  function lift() {
    if (open) {
      setOpen(false);
      setPicked([]);
      clear();
      return;
    }
    if (picked.length !== 3 || !need(cash, stake)) return;
    clear();
    setOpen(true);
    const hit = picked.some((i) => mines.has(i));
    take(hit ? 0 : stake * 4, "Mines");
  }

  return (
    <Stage pay={pay} banner={banner} label={open ? "New board" : `Lift 3 · $${stake}`} disabled={!open && picked.length !== 3} onClick={lift}>
      <p className="font-mono text-sm text-accent">{picked.length} / 3</p>
      <div className="grid w-full max-w-md grid-cols-3 gap-2 sm:max-w-lg sm:gap-3">
        {Array.from({ length: 9 }, (_, i) => {
          const on = picked.includes(i);
          const mine = mines.has(i);
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (open) return;
                setPicked(on ? picked.filter((n) => n !== i) : picked.length < 3 ? [...picked, i] : picked);
              }}
              className={cn(
                "grid aspect-square place-items-center rounded-2xl text-sm font-semibold sm:text-base",
                open && mine ? "bg-down text-down-fg" : on ? "bg-paper text-ink" : "bg-black/45 text-fg",
              )}
            >
              {open ? (mine ? "Mine" : book[i % book.length].symbol.slice(0, 4)) : on ? String(picked.indexOf(i) + 1) : ""}
            </button>
          );
        })}
      </div>
    </Stage>
  );
}

function Stage({
  pay,
  banner,
  children,
  label,
  disabled,
  onClick,
}: {
  pay: string;
  banner: RoundBanner | null;
  children: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex min-h-[540px] flex-col sm:min-h-[640px]">
      <div className="flex items-start gap-3 px-4 pt-1">
        <div className="min-w-0 flex-1">{banner ? <RoundNote banner={banner} /> : null}</div>
        <PayMark pay={pay} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-3 py-5">{children}</div>
      <div className="flex justify-center px-3 pb-5">
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className="min-h-14 w-full max-w-md rounded-full bg-accent px-8 text-base font-semibold text-accent-fg shadow-[0_6px_0_rgb(90_18_18)] disabled:opacity-40"
        >
          {label}
        </button>
      </div>
    </div>
  );
}

function PayMark({ pay }: { pay: string }) {
  return (
    <div className="shrink-0 text-right">
      <p className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">Pays</p>
      <p className="font-mono text-4xl leading-none text-accent sm:text-5xl">{pay}</p>
    </div>
  );
}

function RoundNote({ banner }: { banner: RoundBanner }) {
  const won = banner.paid > 0;
  const money = won
    ? `Paid $${(Math.round(banner.paid * 100) / 100).toFixed(2)}${banner.practice ? " practice" : ""}.`
    : "Nothing paid. Stake stayed.";
  return (
    <div role="status" className={cn("rounded-2xl px-4 py-3 text-sm font-semibold sm:text-base", won ? "bg-accent text-accent-fg" : "bg-down text-down-fg")}>
      {banner.what}. {money}
    </div>
  );
}

function Pick({
  title,
  sub,
  on,
  onClick,
  disabled,
}: {
  title: string;
  sub?: string;
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      className={cn("min-h-20 rounded-2xl px-2 text-center capitalize", on ? "bg-paper text-ink" : "bg-black/40 text-fg", disabled && "opacity-50")}
    >
      <span className="block text-xl font-semibold">{title}</span>
      {sub ? <span className="mt-0.5 block font-mono text-sm">{sub}</span> : null}
    </button>
  );
}

function NameRail({
  book,
  pick,
  onPick,
  disabled,
}: {
  book: HouseListing[];
  pick: string;
  onPick: (symbol: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-full gap-2 overflow-x-auto pb-1">
      {book.map((n) => {
        const on = pick === n.symbol;
        return (
          <button
            key={n.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onPick(n.symbol)}
            className={cn(
              "flex w-24 shrink-0 flex-col items-center rounded-2xl px-2 py-3",
              on ? "bg-paper text-ink" : "bg-black/40 text-fg",
              disabled && "opacity-60",
            )}
          >
            <Face symbol={n.symbol} className="size-12" />
            <span className="mt-2 w-full truncate text-center text-[11px] font-semibold">{n.symbol}</span>
          </button>
        );
      })}
    </div>
  );
}

function CardFace({ n }: { n: HouseListing }) {
  return (
    <div className="grid h-64 w-full place-items-center rounded-[22px] bg-paper text-ink sm:h-72">
      <div className="text-center">
        <Face symbol={n.symbol} className="mx-auto size-16 sm:size-20" />
        <p className="mt-3 font-display text-2xl">{n.symbol}</p>
        <p className="font-mono text-lg">{formatUsd(n.last)}</p>
      </div>
    </div>
  );
}

function Felt({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn("overflow-hidden rounded-[22px] border border-white/[0.08]", className)}
      style={{
        backgroundColor: "#0c3d32",
        backgroundImage: "radial-gradient(120% 90% at 50% 42%, rgb(8 16 13 / 0.05), rgb(5 9 8 / 0.42)), url(/felt.jpg)",
        backgroundSize: "cover",
      }}
    >
      {children}
    </section>
  );
}

function Wheel(props: {
  book: HouseListing[];
  lit: number;
  turn: number;
  pick: string;
  landed: string;
  pays: number;
  under?: HouseListing;
  busy: boolean;
  onPick: (s: string) => void;
}) {
  const { book, lit, turn, pick, landed, pays, under, busy, onPick } = props;
  const n = book.length;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-xl">
      <div className="absolute top-1 left-1/2 z-20 -translate-x-1/2">
        <div className="h-0 w-0 border-x-[12px] border-x-transparent border-t-[18px] border-t-accent" />
      </div>
      <div className="absolute inset-[8%] rounded-full border border-white/15" style={{ transform: `rotate(${turn}deg)` }}>
        {book.map((item, i) => {
          const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(ang) * 38;
          const y = 50 + Math.sin(ang) * 38;
          const hot = pick === item.symbol || landed === item.symbol || (busy && lit === i);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (!busy) onPick(item.symbol);
              }}
              className="absolute"
              style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) rotate(${-turn}deg)` }}
            >
              <span className={cn("grid size-12 place-items-center rounded-full sm:size-14", hot && "bg-paper ring-2 ring-accent")}>
                <Face symbol={item.symbol} className="size-12 sm:size-14" />
              </span>
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-bg/90 text-center">
        <p className="px-2 text-xs font-semibold">{under?.symbol}</p>
        <p className="font-mono text-lg text-accent">{pays}×</p>
      </div>
    </div>
  );
}

function Face({ symbol, className }: { symbol: string; className?: string }) {
  const src = LOGO[symbol] ?? LOGO[symbol.toUpperCase()];
  if (!src) return <span className={cn("grid place-items-center rounded-full bg-white text-[10px] font-semibold text-black", className)}>{symbol.slice(0, 2)}</span>;
  return <img src={src} alt="" className={cn("rounded-full bg-white object-contain p-1", className)} />;
}
