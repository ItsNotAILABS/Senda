import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/listing")({
  component: ListingPage,
});

const USES = [
  { k: "Wallet", v: "Holdings, the day change, and a price on each name." },
  { k: "Trade", v: "One market. Chart, depth, and a Jupiter swap the wallet signs." },
  { k: "Receive", v: "The address for this Phantom, and the same 0x on every EVM chain." },
  { k: "Move", v: "Solana USDC to Hyperliquid or another chain. Every fee is its own line." },
];

const SCREENS = [
  {
    eyebrow: "Wallet",
    title: "$4,280.12",
    sub: "−$18.40 today",
    rows: [
      ["SOL", "$186.20"],
      ["USDC", "$1,240.00"],
      ["POPCAT", "$0.182"],
    ],
  },
  {
    eyebrow: "POPCAT",
    title: "$0.182",
    sub: "Jupiter · Solana",
    rows: [
      ["Bid", "0.181"],
      ["Ask", "0.183"],
      ["Buy $10", "Sign"],
    ],
  },
  {
    eyebrow: "Receive",
    title: "Addresses",
    sub: "This wallet",
    rows: [
      ["Solana", "4mwA…G4fF"],
      ["Ethereum", "0x…"],
      ["Base", "same 0x"],
    ],
  },
  {
    eyebrow: "Move",
    title: "$100.00",
    sub: "Hyperliquid perps",
    rows: [
      ["You send", "$100.00"],
      ["Senda 8 bps", "$0.08"],
      ["You receive", "$99.48"],
    ],
  },
];

function Phone({ eyebrow, title, sub, rows }: { eyebrow: string; title: string; sub: string; rows: string[][] }) {
  return (
    <article className="w-[220px] shrink-0 rounded-[28px] border border-white/15 bg-black p-3">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-white/15" />
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">{eyebrow}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{title}</p>
      <p className="text-xs text-white/45">{sub}</p>
      <ul className="mt-3 divide-y divide-white/10">
        {rows.map(([a, b]) => (
          <li key={a} className="flex items-center justify-between py-2 text-sm">
            <span>{a}</span>
            <span className="font-mono text-xs text-white/70">{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px] text-white/35">
        <span className="text-accent">Home</span>
        <span>Markets</span>
        <span>Send</span>
        <span>Wallets</span>
      </div>
    </article>
  );
}

function ListingPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Play listing</p>
        <div className="mt-4 flex items-center gap-4">
          <img src="/play/icon.svg" alt="" className="size-16 rounded-[18px]" />
          <div>
            <h1 className="text-4xl tracking-tight">Senda</h1>
            <p className="text-sm text-muted">Finance · The wallet signs.</p>
          </div>
        </div>
        <img src="/play/feature.svg" alt="Senda. The wallet signs." className="mt-6 w-full rounded-2xl border border-white/10" />

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Uses</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {USES.map((row) => (
              <li key={row.k} className="rounded-2xl border border-white/10 bg-black px-4 py-3">
                <p className="text-sm font-semibold">{row.k}</p>
                <p className="mt-1 text-sm text-white/50">{row.v}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">The phone</h2>
          <p className="mt-1 text-sm text-white/50">Four screens a listing would lead with. The figures are the layout, not a balance.</p>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {SCREENS.map((screen) => (
              <Phone key={screen.eyebrow} {...screen} />
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Design</h2>
          <div className="mt-3 flex gap-2">
            {[
              ["#07080d", "Ground"],
              ["#d6ff4a", "Accent"],
              ["#ff5d73", "Down"],
              ["#f5f7fb", "Type"],
            ].map(([hex, name]) => (
              <div key={hex} className="flex-1">
                <div className="h-12 rounded-xl border border-white/10" style={{ background: hex }} />
                <p className="mt-1 font-mono text-[10px] text-white/45">{name}</p>
                <p className="font-mono text-[10px] text-white/30">{hex}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-white/50">The phone is the page. A listing does not add a second visual system.</p>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-black p-4">
          <h2 className="text-lg font-semibold">Store copy</h2>
          <p className="mt-3 text-sm"><span className="text-white/40">Title. </span>Senda</p>
          <p className="mt-2 text-sm"><span className="text-white/40">Short. </span>Trade, send, and receive from the wallet you already have. You sign.</p>
          <p className="mt-2 text-sm text-white/70">Senda is a desk for the wallet you connect. You buy and sell on Solana through Jupiter. You move USDC to Hyperliquid or another chain through Mayan, and the fee is printed before you sign. You receive on the address Phantom already gave you. Senda does not hold the key, does not custody the balance, and is not a bank or a broker.</p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">What this is not</h2>
          <p className="mt-2 text-sm text-white/50">This is the listing portfolio. It is not uploaded to Google Play. A Play Console account and a signed app bundle are still required. Until then, Android can install the same desk from Wallets.</p>
          <Link to="/wallets" className="mt-4 inline-flex text-sm text-accent">Wallets</Link>
        </section>
      </main>
    </AppShell>
  );
}
