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
const PANEL = "rounded-[22px] border border-white/[0.08] bg-[#10131c]";

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
  const [note, setNote] = useState("Practice cash is not your wallet. Load $500 and learn the felt. Real uses the cash you already have.");
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
    setNote("Practice loaded. $500. It never touches Phantom.");
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
      setNote(payout > 0 ? `${label} paid $${payout.toFixed(2)} practice.` : `${label}. Practice stake stayed.`);
      return true;
    }
    const r = wallet.playRound(stake, payout, label);
    if (!r.ok) {
      toast.error(r.error || "Not enough cash. Switch to practice.");
      return false;
    }
    setNote(payout > 0 ? `${label} paid $${payout.toFixed(2)}.` : `${label}. Stake stayed.`);
    return true;
  }

  const meta = GAMES.find((g) => g.id === game)!;

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Play"
        title="Ten games on the live book."
        accent="Practice first."
        line="Every result comes from a PreStock print, not a hidden roll. Practice cash lets you learn the felt. Real cash is the balance you already hold. The two never mix."
        live={["Wheel, slots, up/down, furthest, closest, ride, higher, parlay, dice, and mines.", "Practice bankroll on this browser.", "Real stakes leave Senda cash and wins come back."]}
        coming={["A shared table with another wallet.", "A prize that leaves this browser."]}
      />
      <header className={cn(PANEL, "px-5 py-5 lg:px-7")}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{meta.line}</p>
            <p className="mt-1 font-mono text-xs text-accent">{meta.pay}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">{mode === "practice" ? "Practice" : "Real cash"}</p>
            <p className="font-mono text-4xl">${pot.toFixed(0)}</p>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setMode("practice")} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", mode === "practice" ? "bg-accent text-accent-fg" : "bg-black/40")}>Practice</button>
              <button type="button" onClick={() => setMode("real")} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", mode === "real" ? "bg-accent text-accent-fg" : "bg-black/40")}>Real</button>
              <button type="button" onClick={loadPractice} className="min-h-9 rounded-full border border-white/15 px-3 text-xs font-semibold">Load $500</button>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setGame(g.id);
                setNote(g.line);
              }}
              className={cn("rounded-2xl px-3 py-3 text-left", game === g.id ? "bg-accent text-accent-fg" : "bg-black/40")}
            >
              <span className="block text-sm font-semibold">{g.name}</span>
              <span className="block font-mono text-[11px] opacity-80">{g.pay}</span>
            </button>
          ))}
        </div>
      </header>

      <Board game={game} book={book} stake={stake} cash={pot} take={take} line={meta.line} />

      <section className={cn(PANEL, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between")}>
        <div>
          <p className="text-sm text-muted">{note}</p>
          <div className="mt-3 flex gap-2">
            {STAKES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStake(n)}
                className={cn(
                  "grid size-12 place-items-center rounded-full font-mono text-sm font-semibold",
                  stake === n ? "bg-accent text-accent-fg" : "bg-[#171c12] text-accent",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <p className="font-mono text-xs text-subtle">Stake ${stake}. {mode === "practice" ? "Practice" : "Real"} ${pot.toFixed(0)}.</p>
      </section>
    </div>
  );
}

function Board({
  game,
  book,
  stake,
  cash,
  take,
  line,
}: {
  game: GameId;
  book: HouseListing[];
  stake: number;
  cash: number;
  take: (payout: number, label: string) => boolean;
  line: string;
}) {
  if (!book.length) {
    return (
      <Felt className="grid min-h-64 place-items-center">
        <p className="text-sm text-muted">The book has no prints yet.</p>
      </Felt>
    );
  }
  if (game === "wheel") return <WheelGame book={book} stake={stake} cash={cash} take={take} />;
  if (game === "slots") return <SlotsGame book={book} stake={stake} cash={cash} take={take} />;
  if (game === "updown") return <UpGame book={book} stake={stake} cash={cash} take={take} />;
  if (game === "race") return <GapGame book={book} stake={stake} cash={cash} take={take} far />;
  if (game === "closest") return <GapGame book={book} stake={stake} cash={cash} take={take} far={false} />;
  if (game === "crash") return <CrashGame book={book} stake={stake} cash={cash} take={take} />;
  if (game === "hilo") return <HiLo book={book} stake={stake} cash={cash} take={take} />;
  if (game === "parlay") return <Parlay book={book} stake={stake} cash={cash} take={take} />;
  if (game === "dice") return <Dice book={book} stake={stake} cash={cash} take={take} />;
  return <Mines book={book} stake={stake} cash={cash} take={take} line={line} />;
}

function need(cash: number, stake: number) {
  if (cash + 0.001 < stake) {
    toast.error("Not enough cash. Add it on Send.");
    return false;
  }
  return true;
}

function WheelGame({ book, stake, cash, take }: Common) {
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
    <Felt>
      <Wheel book={book} lit={lit} turn={turn} pick={pick} landed={landed} pays={pays} under={book[lit]} busy={busy} onPick={setPick} />
      <Act label={busy ? "Spinning" : `Spin $${stake}`} disabled={busy} onClick={spin} hint={`Hit pays ${pays}×`} />
    </Felt>
  );
}

function SlotsGame({ book, stake, cash, take }: Common) {
  const [reels, setReels] = useState<string[]>([book[0].symbol, book[1 % book.length].symbol, book[2 % book.length].symbol]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  function pull() {
    if (book.length < 2 || busy || !need(cash, stake)) return;
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
    <Felt className="px-4 py-8">
      <div className="mx-auto grid max-w-3xl grid-cols-3 gap-3">
        {reels.map((sym, i) => (
          <div key={i} className="grid min-h-48 place-items-center rounded-[18px] border border-white/10 bg-black/45">
            <Face symbol={sym} className="size-20" />
            <p className="mt-2 text-xs font-semibold">{sym}</p>
          </div>
        ))}
      </div>
      <Act label={busy ? "Spinning" : `Pull $${stake}`} disabled={busy} onClick={pull} hint="Pair 2×. Three 12×." />
    </Felt>
  );
}

function UpGame({ book, stake, cash, take }: Common) {
  const [pick, setPick] = useState(book[0].symbol);
  const [dir, setDir] = useState<"up" | "down">("up");
  const [locked, setLocked] = useState<{ symbol: string; start: number } | null>(null);
  const face = book.find((n) => n.symbol === (locked?.symbol || pick)) ?? book[0];

  function go() {
    if (!locked) {
      setLocked({ symbol: face.symbol, start: face.last });
      toast.success(`${face.symbol} locked at ${formatUsd(face.last)}.`);
      return;
    }
    if (!need(cash, stake)) return;
    const now = book.find((n) => n.symbol === locked.symbol);
    if (!now) return;
    const won = dir === "up" ? now.last > locked.start : now.last < locked.start;
    const push = now.last === locked.start;
    take(push ? stake : won ? stake * 2 : 0, `UpDown ${locked.symbol} ${dir}`);
    setLocked(null);
  }

  return (
    <Felt className="px-4 py-6">
      <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto pb-4">
        {book.map((n) => (
          <button key={n.id} type="button" onClick={() => !locked && setPick(n.symbol)} className={cn("grid w-24 shrink-0 place-items-center rounded-2xl border px-2 py-3", pick === n.symbol ? "border-accent" : "border-white/10")}>
            <Face symbol={n.symbol} className="size-12" />
            <span className="mt-1 text-[11px] font-semibold">{n.symbol}</span>
          </button>
        ))}
      </div>
      <div className="mx-auto max-w-md text-center">
        <Face symbol={face.symbol} className="mx-auto size-24" />
        <p className="mt-2 text-2xl">{face.symbol}</p>
        <p className="font-mono text-accent">{formatUsd(face.last)}</p>
        {locked ? <p className="mt-1 font-mono text-xs text-muted">Locked {formatUsd(locked.start)}</p> : null}
        <div className="mt-4 flex justify-center gap-2">
          {(["up", "down"] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDir(d)} className={cn("min-h-10 rounded-full px-4 text-sm font-semibold", dir === d ? "bg-accent text-accent-fg" : "bg-black/40")}>
              {d === "up" ? "Up" : "Down"}
            </button>
          ))}
        </div>
      </div>
      <Act label={locked ? `Stand $${stake}` : "Lock the print"} disabled={false} onClick={go} hint="A move your way pays 2×." />
    </Felt>
  );
}

function GapGame({ book, stake, cash, take, far }: Common & { far: boolean }) {
  const [pick, setPick] = useState(book[0].symbol);
  const [shown, setShown] = useState(false);
  const winner = byGap(book, far);

  function run() {
    if (!need(cash, stake) || !winner) return;
    setShown(true);
    const mine = book.find((n) => n.symbol === pick);
    const hit = mine && Math.abs(mine.premium ?? 0) === Math.abs(winner.premium ?? 0);
    take(hit ? stake * 5 : 0, `${far ? "Furthest" : "Closest"} ${winner.symbol}`);
  }

  return (
    <Felt className="px-4 py-6">
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 md:grid-cols-4">
        {book.slice(0, 8).map((n) => (
          <button key={n.id} type="button" onClick={() => { setPick(n.symbol); setShown(false); }} className={cn("rounded-2xl border px-3 py-3 text-left", pick === n.symbol ? "border-accent bg-accent/10" : "border-white/10 bg-black/30")}>
            <Face symbol={n.symbol} className="size-10" />
            <p className="mt-2 text-sm font-semibold">{n.symbol}</p>
            <p className="font-mono text-[11px] text-muted">{shown ? `${((n.premium ?? 0) * 100).toFixed(1)}%` : "hidden"}</p>
          </button>
        ))}
      </div>
      <Act label={`${far ? "Who is furthest" : "Who is closest"} · $${stake}`} disabled={false} onClick={run} hint={shown && winner ? `${winner.symbol} ${((winner.premium ?? 0) * 100).toFixed(1)}% vs mark` : "5× if you have it."} />
    </Felt>
  );
}

function CrashGame({ book, stake, cash, take }: Common) {
  const bust = 1.15 + ((Math.round(book[0].last * 100) % 8) + 1) * 0.28;
  const [mult, setMult] = useState(1);
  const [live, setLive] = useState(false);
  const [done, setDone] = useState("");
  const ref = useRef({ mult: 1, live: false });

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      ref.current.mult = Math.round((ref.current.mult + 0.08) * 100) / 100;
      setMult(ref.current.mult);
      if (ref.current.mult >= bust) {
        window.clearInterval(id);
        setLive(false);
        setDone(`Bust ${bust.toFixed(2)}×`);
        take(0, `Ride bust ${bust.toFixed(2)}`);
      }
    }, 90);
    return () => window.clearInterval(id);
  }, [live, bust]);

  function start() {
    if (live || !need(cash, stake)) return;
    ref.current.mult = 1;
    setMult(1);
    setDone("");
    setLive(true);
  }

  function cashOut() {
    if (!live) return;
    setLive(false);
    const m = ref.current.mult;
    setDone(`Out at ${m.toFixed(2)}×`);
    take(stake * m, `Ride ${m.toFixed(2)}`);
  }

  return (
    <Felt className="grid place-items-center px-4 py-10">
      <p className="font-mono text-7xl text-accent">{mult.toFixed(2)}×</p>
      <p className="mt-2 text-sm text-muted">{done || (live ? "Cash out before the print busts it." : `The bust is hidden. It comes from ${book[0].symbol}.`)}</p>
      <div className="mt-6 flex gap-2">
        <button type="button" disabled={live} onClick={start} className="min-h-12 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg disabled:opacity-40">Ride ${stake}</button>
        <button type="button" disabled={!live} onClick={cashOut} className="min-h-12 rounded-full border border-white/15 px-6 text-sm font-semibold disabled:opacity-40">Cash out</button>
      </div>
    </Felt>
  );
}

function HiLo({ book, stake, cash, take }: Common) {
  const seed = pocket(book);
  const cur = book[seed % book.length];
  const nxt = book[(seed * 3 + 1) % book.length];
  const [open, setOpen] = useState(false);

  function call(higher: boolean) {
    if (open) {
      setOpen(false);
      return;
    }
    if (!need(cash, stake)) return;
    setOpen(true);
    if (nxt.last === cur.last) {
      take(stake, `Higher ${nxt.symbol} push`);
      return;
    }
    const won = higher ? nxt.last > cur.last : nxt.last < cur.last;
    take(won ? stake * 1.9 : 0, `Higher ${nxt.symbol}`);
  }

  return (
    <Felt className="grid place-items-center gap-4 px-4 py-8 sm:grid-cols-2">
      <CardFace n={cur} show />
      {open ? <CardFace n={nxt} show /> : <button type="button" className="grid h-48 w-full max-w-xs place-items-center rounded-[22px] border border-dashed border-white/20 text-sm text-muted">Next name</button>}
      <div className="flex justify-center gap-2 sm:col-span-2">
        <button type="button" onClick={() => call(true)} className="min-h-12 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">Higher · ${stake}</button>
        <button type="button" onClick={() => call(false)} className="min-h-12 rounded-full border border-white/15 px-6 text-sm font-semibold">Lower</button>
      </div>
    </Felt>
  );
}

function Parlay({ book, stake, cash, take }: Common) {
  const a = book[0];
  const b = book[Math.min(1, book.length - 1)];
  const [side, setSide] = useState<Record<string, "cheap" | "rich">>({ [a.symbol]: "cheap", [b.symbol]: "rich" });
  const names = a.symbol === b.symbol ? [a] : [a, b];

  function run() {
    if (!need(cash, stake)) return;
    const ok = names.every((n) => ((n.premium ?? 0) < 0 ? "cheap" : "rich") === side[n.symbol]);
    take(ok && names.length === 2 ? stake * 3.4 : 0, `Parlay ${names.map((n) => n.symbol).join(" ")}`);
  }

  return (
    <Felt className="px-4 py-6">
      <div className="mx-auto grid max-w-xl gap-3">
        {names.map((n) => (
          <div key={n.id} className="flex items-center justify-between rounded-2xl bg-black/30 px-3 py-3">
            <span className="flex items-center gap-2"><Face symbol={n.symbol} className="size-10" /> {n.symbol}</span>
            <span className="flex gap-1">
              {(["cheap", "rich"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSide({ ...side, [n.symbol]: s })} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", side[n.symbol] === s ? "bg-accent text-accent-fg" : "bg-black/40")}>{s}</button>
              ))}
            </span>
          </div>
        ))}
      </div>
      <Act label={`Run the parlay $${stake}`} disabled={names.length < 2} onClick={run} hint="Both calls. 3.4×." />
    </Felt>
  );
}

function Dice({ book, stake, cash, take }: Common) {
  const [call, setCall] = useState<"over" | "under" | "seven">("over");
  const [faces, setFaces] = useState<[number, number] | null>(null);
  const a = (Math.round(book[0].last * 100) % 6) + 1;
  const b = (Math.round(book[Math.min(1, book.length - 1)].last * 100) % 6) + 1;

  function roll() {
    if (!need(cash, stake)) return;
    setFaces([a, b]);
    const sum = a + b;
    const won = call === "seven" ? sum === 7 : call === "over" ? sum > 7 : sum < 7;
    const pay = call === "seven" ? 5 : 2;
    take(won ? stake * pay : 0, `Dice ${sum}`);
  }

  return (
    <Felt className="grid place-items-center px-4 py-8">
      <div className="flex gap-3">
        {[faces?.[0] ?? "?", faces?.[1] ?? "?"].map((d, i) => (
          <div key={i} className="grid size-24 place-items-center rounded-2xl bg-white text-3xl font-semibold text-black">{d}</div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        {(["under", "seven", "over"] as const).map((c) => (
          <button key={c} type="button" onClick={() => setCall(c)} className={cn("min-h-10 rounded-full px-4 text-sm font-semibold capitalize", call === c ? "bg-accent text-accent-fg" : "bg-black/40")}>{c}</button>
        ))}
      </div>
      <Act label={`Roll $${stake}`} disabled={false} onClick={roll} hint="Over or under 2×. Seven 5×." />
    </Felt>
  );
}

function Mines({ book, stake, cash, take }: Common & { line: string }) {
  const mines = new Set<number>();
  const start = pocket(book) % 9;
  for (let i = 0; mines.size < 3; i += 1) mines.add((start + i * 4) % 9);
  const [picked, setPicked] = useState<number[]>([]);
  const [open, setOpen] = useState(false);

  function lift() {
    if (picked.length !== 3 || !need(cash, stake)) return;
    setOpen(true);
    const hit = picked.some((i) => mines.has(i));
    take(hit ? 0 : stake * 4, "Mines");
  }

  return (
    <Felt className="px-4 py-6">
      <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, i) => {
          const on = picked.includes(i);
          const show = open;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (open) return;
                setPicked(on ? picked.filter((n) => n !== i) : picked.length < 3 ? [...picked, i] : picked);
              }}
              className={cn("grid aspect-square place-items-center rounded-2xl border text-sm font-semibold", on ? "border-accent bg-accent/15" : "border-white/10 bg-black/40")}
            >
              {show ? (mines.has(i) ? "Mine" : book[i % book.length].symbol.slice(0, 4)) : on ? "Set" : ""}
            </button>
          );
        })}
      </div>
      <Act label={open ? "Lifted" : `Lift 3 · $${stake}`} disabled={picked.length !== 3 || open} onClick={lift} hint="Three safe tiles pay 4×." />
    </Felt>
  );
}

type Common = {
  book: HouseListing[];
  stake: number;
  cash: number;
  take: (payout: number, label: string) => boolean;
};

function Act({ label, onClick, disabled, hint }: { label: string; onClick: () => void; disabled: boolean; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 pt-2 pb-6">
      <button type="button" disabled={disabled} onClick={onClick} className="min-h-12 rounded-full bg-accent px-8 text-sm font-semibold text-accent-fg disabled:opacity-40">{label}</button>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function CardFace({ n, show }: { n: HouseListing; show: boolean }) {
  return (
    <div className="grid h-48 w-full max-w-xs place-items-center rounded-[22px] border border-white/10 bg-black/40">
      {show ? (
        <div className="text-center">
          <Face symbol={n.symbol} className="mx-auto size-16" />
          <p className="mt-2 font-semibold">{n.symbol}</p>
          <p className="font-mono text-accent">{formatUsd(n.last)}</p>
        </div>
      ) : null}
    </div>
  );
}

function Felt({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn("overflow-hidden rounded-[22px] border border-white/[0.08]", className)}
      style={{
        backgroundColor: "#07110e",
        backgroundImage: "linear-gradient(180deg, rgb(8 16 13 / 0.2), rgb(5 9 8 / 0.55)), url(/felt.jpg)",
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
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      <div className="absolute top-2 left-1/2 z-20 -translate-x-1/2">
        <div className="h-0 w-0 border-x-[10px] border-x-transparent border-t-[16px] border-t-accent" />
      </div>
      <div className="absolute inset-[8%] rounded-full border border-white/10" style={{ transform: `rotate(${turn}deg)` }}>
        {book.map((item, i) => {
          const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(ang) * 38;
          const y = 50 + Math.sin(ang) * 38;
          return (
            <button key={item.id} type="button" onClick={() => onPick(item.symbol)} className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) rotate(${-turn}deg)` }}>
              <span className={cn("grid size-12 place-items-center rounded-full", (pick === item.symbol || landed === item.symbol || (busy && lit === i)) && "ring-2 ring-accent")}>
                <Face symbol={item.symbol} className="size-12" />
              </span>
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 grid size-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-[#10131c]/90 text-center">
        <p className="text-xs font-semibold">{under?.symbol}</p>
        <p className="font-mono text-[10px] text-accent">{pays}×</p>
      </div>
    </div>
  );
}

function Face({ symbol, className }: { symbol: string; className?: string }) {
  const src = LOGO[symbol] ?? LOGO[symbol.toUpperCase()];
  if (!src) return <span className={cn("grid place-items-center rounded-full bg-white text-[10px] font-semibold text-black", className)}>{symbol.slice(0, 2)}</span>;
  return <img src={src} alt="" className={cn("rounded-full bg-white object-contain p-1", className)} />;
}
