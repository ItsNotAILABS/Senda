import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { CorridorCard } from "@/components/corridor-card";
import { MoneyVenues } from "@/components/money-venues";
import { PayQr } from "@/components/pay-qr";
import { PayScan } from "@/components/pay-scan";
import { openDeposit } from "@/components/fund-sheet";
import { rememberClear } from "@/lib/clearing";
import { PhonePassport } from "@/components/phone-passport";
import { PrivateCover, useCover } from "@/components/private-cover";
import { finalLine, readChainStack, watchFinal, type ChainStack } from "@/lib/finality";
import { USDC_RAILS, quoteUsdcMove, type UsdcMove, type UsdcRailId } from "@/lib/lifi";
import { signLifiChain } from "@/lib/lifi-sign";
import { sendLifiSolana } from "@/lib/lifi-solana";
import { connectPhantom, readChain } from "@/lib/phantom";
import { keepPrivateSend, privacyOn } from "@/lib/privacy";
import { parseTransfer, payUsdc, transferRequest, USDC_MINT } from "@/lib/solana-pay";
import { CLOCKS, chargeMemo, readSlip, TIPS, withTip, type ClockId } from "@/lib/pay-bill";
import { spendCap } from "@/lib/spend-cap";
import { solTxLink, txLink } from "@/lib/trade-book.mjs";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const HANDLES = "senda.handles.v1";
const PRESETS = [10, 25, 50, 100];
const WAYS = [
  { id: "instant", label: "Instant" },
  { id: "bank", label: "Bank" },
  { id: "card", label: "Card" },
  { id: "qr", label: "QR" },
  { id: "ramp", label: "Ramp" },
  { id: "convert", label: "Convert" },
  { id: "venues", label: "Venues" },
  { id: "chain", label: "Chain" },
] as const;

type Way = (typeof WAYS)[number]["id"];
type Handle = { tag: string; name: string; address: string };
type Flight = {
  sig: string;
  href: string;
  title: string;
  line: string;
  tone: "wait" | "final" | "bad";
};
type Track = (row: { sig: string; href: string; title: string; chain: "solana" | "evm" }) => void;

const field = "min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none";

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function short(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function tagOf(raw: string): string {
  const t = raw.trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  return t ? `@${t}` : "";
}

function solanaAddress(raw: string): string {
  try {
    return new PublicKey(raw.trim()).toBase58();
  } catch {
    return "";
  }
}

function loadHandles(): Handle[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HANDLES) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((row): row is Handle => Boolean(row) && typeof row.tag === "string" && typeof row.address === "string" && typeof row.name === "string")
      .filter((row) => tagOf(row.tag) === row.tag && solanaAddress(row.address))
      .slice(0, 24);
  } catch {
    return [];
  }
}

function saveHandles(rows: Handle[]) {
  localStorage.setItem(HANDLES, JSON.stringify(rows.slice(0, 24)));
}

function useFlights() {
  const [rows, setRows] = useState<Flight[]>([]);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  function track(row: { sig: string; href: string; title: string; chain: "solana" | "evm" }) {
    const line =
      row.chain === "solana"
        ? "Signed. Finality is still playing. Do not send this one again."
        : "The Ethereum wallet signed. This desk does not watch finality on that chain.";
    setRows((prev) => [{ sig: row.sig, href: row.href, title: row.title, line, tone: "wait" as const }, ...prev].slice(0, 8));
    if (row.chain !== "solana") return;
    void watchFinal(row.sig).then((watched) => {
      const next = finalLine(watched);
      const tone: Flight["tone"] = watched.state === "final" ? "final" : watched.state === "rejected" ? "bad" : "wait";
      if (live.current) setRows((prev) => prev.map((item) => (item.sig === row.sig ? { ...item, line: next, tone } : item)));
      if (watched.state === "final") toast.success(next);
      else if (watched.state === "rejected") toast.error(next);
      else toast.message(next);
    });
  }

  return { rows, track };
}

function quietTitle(title: string): string {
  return title
    .replace(/\$[\d,]+(\.\d+)?/g, "")
    .replace(/\b\d+(\.\d+)?\s+(USDC|SOL|USDT)\b/gi, "$2")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function Flights({ rows, cover }: { rows: Flight[]; cover: boolean }) {
  if (!rows.length) return null;
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((row) => (
        <li key={row.sig} className="rounded-2xl border border-white/10 px-3 py-2">
          <p className="text-sm text-white/85">{cover ? quietTitle(row.title) : row.title}</p>
          <p className={cn("mt-1 text-xs", row.tone === "final" ? "text-[#d6ff4a]" : row.tone === "bad" ? "text-[#ff5d73]" : "text-white/55")}>{row.line}</p>
          <a className="mt-1 block truncate font-mono text-[11px] text-[#d6ff4a]" href={row.href} target="_blank" rel="noreferrer">
            {short(row.sig)}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** One Phantom USDC balance. A rail signs only when the address or the quote is real. */
export function MoneyLife({ start = "instant", only = false }: { start?: Way; only?: boolean } = {}) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [usdc, setUsdc] = useState<number | null>(null);
  const [way, setWay] = useState<Way>(start);
  const [tick, setTick] = useState(0);
  const [stack, setStack] = useState<ChainStack | null>(null);
  const [stackFault, setStackFault] = useState("");
  const { rows, track } = useFlights();
  const cover = useCover();

  useEffect(() => {
    if (!owner) {
      setUsdc(null);
      return;
    }
    let live = true;
    readChain(owner)
      .then((row) => {
        if (live) setUsdc(row.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
      })
      .catch(() => {
        if (live) setUsdc(null);
      });
    return () => {
      live = false;
    };
  }, [owner, tick]);

  useEffect(() => {
    let live = true;
    readChainStack()
      .then((row) => {
        if (!live) return;
        setStack(row);
        setStackFault("");
      })
      .catch((e: unknown) => {
        if (live) setStackFault(e instanceof Error ? e.message : "The chain did not answer.");
      });
    return () => {
      live = false;
    };
  }, []);

  async function ensure(): Promise<string> {
    if (owner) return owner;
    const who = await connectPhantom();
    const linked = wallet.linkChain(who, "Phantom", "phantom");
    if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
    return who;
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#07080d] p-4">
      <p className="text-[11px] tracking-[0.16em] text-[#d6ff4a] uppercase">One balance</p>
      <p className="mt-2 font-mono text-[40px] leading-none tracking-tight tabular-nums">{cover ? "Hidden" : money(owner ? usdc : null)}</p>
      <p className="mt-2 text-sm text-white/55">USDC in this Phantom. Not a card balance and not a bank balance. The chain is open on Saturday. Senda does not hold the key.</p>
      <p className="mt-1 truncate font-mono text-[11px] text-white/40">{owner ? short(owner) : "Connect when you sign. Nothing is read until then."}</p>
      <p className="mt-1 text-xs text-white/45">
        {stack?.spread
          ? `${stack.spread.n} samples on this RPC. Slot p50 ${stack.spread.p50} ms, p90 ${stack.spread.p90} ms, p99 ${stack.spread.p99} ms (${stack.spread.min}–${stack.spread.max}). That is slot time, not finality. The next send does not wait. 150 ms is not a promise.`
          : stackFault || "Asking this RPC how fast slots are."}
      </p>
      <PrivateCover />
      <div className="mt-3">
        <PhonePassport compact />
      </div>
      <div className={cn("mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", only && "hidden")}>
        {WAYS.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setWay(row.id)}
            className={cn("min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold", way === row.id ? "bg-[#d6ff4a] text-black" : "border border-white/10 text-white/70")}
          >
            {row.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {way === "instant" ? <Instant owner={owner} ensure={ensure} track={track} onDone={() => setTick((n) => n + 1)} /> : null}
        {way === "bank" ? <Bank /> : null}
        {way === "card" ? <CardRail /> : null}
        {way === "qr" ? <QrRail owner={owner} ensure={ensure} track={track} onDone={() => setTick((n) => n + 1)} /> : null}
        {way === "ramp" ? <Ramp /> : null}
        {way === "convert" ? <Convert owner={owner} ensure={ensure} track={track} onDone={() => setTick((n) => n + 1)} /> : null}
        {way === "venues" ? <MoneyVenues usdc={owner ? usdc : null} /> : null}
        {way === "chain" ? <ChainRail stack={stack} fault={stackFault} /> : null}
      </div>
      <Flights rows={rows} cover={cover} />
    </section>
  );
}

function Instant({ owner, ensure, track, onDone }: { owner: string; ensure: () => Promise<string>; track: Track; onDone: () => void }) {
  const [handles, setHandles] = useState<Handle[]>([]);
  const [who, setWho] = useState("");
  const [addr, setAddr] = useState("");
  const [usd, setUsd] = useState("25");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState("");
  const lock = useRef(false);
  useEffect(() => setHandles(loadHandles()), []);

  const typed = solanaAddress(who);
  const tag = tagOf(who);
  const saved = handles.find((row) => row.tag === tag);
  const dest = typed || saved?.address || "";

  function keep() {
    const address = solanaAddress(addr);
    if (!tag || tag.length < 3) {
      setFault("Use a handle, or paste the Solana address itself.");
      return;
    }
    if (!address) {
      setFault("That is not a Solana address.");
      return;
    }
    const next = [{ tag, name: tag, address }, ...handles.filter((row) => row.tag !== tag)];
    saveHandles(next);
    setHandles(next);
    setFault("");
    toast.success("Saved in this browser. Nobody else can look this handle up.");
  }

  async function send() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFault("");
    try {
      const amount = Number(usd);
      if (!(amount > 0)) throw new Error("Enter an amount.");
      if (amount > spendCap()) throw new Error(`That is over the spend cap of ${spendCap()}.`);
      if (!dest) throw new Error(tag ? "Save a Solana address for this handle. It only exists in this browser." : "Paste a Solana address or a saved handle.");
      const from = owner || (await ensure());
      const paid = await payUsdc({ owner: from, to: dest, usd: amount, memo: tag || "Senda USDC" });
      rememberClear({
        desk: "send",
        title: `USDC to ${tag || short(dest)}`,
        legs: [{ side: "out", asset: "USDC", amount, where: dest }],
        feeUsd: paid.feeUsd,
        sig: paid.signature,
        status: "signed",
      });
      track({ sig: paid.signature, href: solTxLink(paid.signature), title: `USDC to ${tag || short(dest)}`, chain: "solana" });
      if (privacyOn()) keepPrivateSend({ title: `USDC to ${tag || short(dest)}`, usd: amount, asset: "USDC" });
      toast.message("Signed. The next send can start. Finality is still playing.");
      onDone();
    } catch (e) {
      setFault(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-white/55">A handle is a name you saved on this phone. It is not a directory. Phantom signs USDC to the address under that name. The next send starts when the signature comes back.</p>
      <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="@name or a Solana address" aria-label="Handle" className={cn(field, "mt-3")} />
      {handles.length > 0 ? (
        <div className="mt-2 flex gap-1.5 overflow-x-auto">
          {handles.map((row) => (
            <button key={row.tag} type="button" onClick={() => setWho(row.tag)} className="min-h-10 shrink-0 rounded-full border border-white/10 px-3 text-sm">
              {row.tag}
            </button>
          ))}
        </div>
      ) : null}
      {dest ? <p className="mt-2 font-mono text-xs text-white/45">Pays {short(dest)}</p> : tag ? (
        <div className="mt-2">
          <input value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="Their Solana address" aria-label="Solana address" className={cn(field, "font-mono text-xs")} />
          <button type="button" onClick={keep} className="mt-2 min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold">
            Save handle
          </button>
        </div>
      ) : null}
      <Amount usd={usd} setUsd={setUsd} />
      <button type="button" disabled={busy} onClick={() => void send()} className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        {busy ? "Opening the wallet…" : "Sign USDC"}
      </button>
      <Fault fault={fault} />
    </div>
  );
}

function Bank() {
  return (
    <div>
      <p className="text-sm text-white/55">What the other side would see, from live prints. This is not a deposit into a bank, and it does not pay out.</p>
      <div className="mt-3">
        <CorridorCard />
      </div>
    </div>
  );
}

function CardRail() {
  return (
    <div>
      <p className="text-sm text-white/55">No Visa number is issued here. There is no second balance for a card. Spend is this same USDC, and Phantom signs it.</p>
      <Link to="/cards" className="mt-3 inline-flex min-h-12 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
        Open the spend desk
      </Link>
    </div>
  );
}

function routeKey(move: UsdcMove): string {
  if (!move.ok) return "";
  if (move.kind === "solana") return move.tx;
  return `${move.fromChainId}:${move.quote.to}:${move.quote.data}`;
}

function QrRail({ owner, ensure, track, onDone }: { owner: string; ensure: () => Promise<string>; track: Track; onDone: () => void }) {
  const [side, setSide] = useState<"show" | "pay">("pay");
  const [usd, setUsd] = useState("10");
  const [bill, setBill] = useState("");
  const [shop, setShop] = useState("");
  const [note, setNote] = useState("");
  const [clock, setClock] = useState<ClockId>("1h");
  const [tip, setTip] = useState<(typeof TIPS)[number]>(0);
  const [opened, setOpened] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState("");
  const lock = useRef(false);
  const amount = Number(usd);
  const span = CLOCKS.find((row) => row.id === clock) ?? CLOCKS[1];
  const dies = span.ms > 0 ? opened + span.ms : null;
  const receive =
    owner && amount > 0
      ? transferRequest({
          recipient: owner,
          amount,
          splToken: USDC_MINT.toBase58(),
          label: shop.trim() || "Senda",
          message: note.trim() || "USDC",
          memo: chargeMemo(note, dies) || undefined,
        })
      : "";
  const slip = bill.trim() ? readSlip(parseTransfer(bill)) : null;
  const named = slip && slip.ok ? slip.bill : null;
  const base = named ?? (amount > 0 ? Math.round(amount * 100) / 100 : null);
  const priced = slip && slip.ok && base != null && base > 0 ? withTip(base, tip) : null;

  useEffect(() => {
    setOpened(Date.now());
  }, [clock, usd, shop, note]);

  useEffect(() => {
    setTip(0);
  }, [bill]);

  async function pay() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFault("");
    try {
      if (!slip || !slip.ok) throw new Error(slip && !slip.ok ? slip.error : "Paste a bill or a Solana address.");
      if (slip.expired) throw new Error("This bill has expired. Ask them for a new one.");
      if (!priced || !(priced.total > 0)) throw new Error("Enter the amount. The bill did not name one.");
      if (priced.total > spendCap()) throw new Error(`That is over the spend cap of ${spendCap()}.`);
      const from = owner || (await ensure());
      const memo = [slip.label, slip.memo, priced.tip > 0 ? `tip ${priced.tip.toFixed(2)}` : ""].filter(Boolean).join(" ").slice(0, 80);
      const paid = await payUsdc({ owner: from, to: slip.to, usd: priced.total, memo: memo || "shop" });
      rememberClear({
        desk: "send",
        title: slip.label ? `${slip.label} · USDC` : "USDC shop",
        legs: [{ side: "out", asset: "USDC", amount: priced.total, where: slip.to }],
        feeUsd: paid.feeUsd,
        sig: paid.signature,
        status: "signed",
      });
      const title = priced.tip > 0 ? `USDC ${priced.bill.toFixed(2)} + tip ${priced.tip.toFixed(2)}` : `USDC ${priced.total.toFixed(2)}`;
      track({ sig: paid.signature, href: solTxLink(paid.signature), title, chain: "solana" });
      if (privacyOn()) keepPrivateSend({ title, usd: priced.total, asset: "USDC" });
      toast.message("Signed. The next pay can start. Finality is still playing.");
      onDone();
    } catch (e) {
      setFault(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        {(["pay", "show"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setSide(id)} className={cn("min-h-10 rounded-full px-3 text-sm font-semibold", side === id ? "bg-white text-black" : "border border-white/10 text-white/70")}>
            {id === "pay" ? "Pay a bill" : "Make a bill"}
          </button>
        ))}
      </div>
      {side === "pay" ? (
        <div className="mt-3">
          <p className="text-sm text-white/55">The camera reads a Solana address or a solana: bill. USDC only. A clock that has already passed will not sign. A tip is added into the same signature.</p>
          <div className="mt-3">
            <PayScan onCode={(text) => { setBill(text); setFault(""); }} />
          </div>
          <input value={bill} onChange={(e) => { setBill(e.target.value.trim()); setFault(""); }} placeholder="Or paste the bill" aria-label="Payment code" className={cn(field, "mt-3 font-mono text-xs")} />
          {slip && !slip.ok ? <p className="mt-2 text-sm text-[#ff5d73]">{slip.error}</p> : null}
          {slip && slip.ok ? (
            <div className="mt-3 rounded-2xl border border-white/10 px-3 py-3">
              <p className="text-sm font-semibold">{slip.label || "USDC"}</p>
              <p className="mt-1 font-mono text-xs text-white/45">{short(slip.to)}{slip.message ? ` · ${slip.message}` : ""}</p>
              <p className="mt-2 text-sm text-white/70">
                {slip.bill != null ? `The bill names ${money(slip.bill)}.` : "The bill did not name an amount. The box below is what you pay."}
              </p>
              {slip.expiresAt ? (
                <p className={cn("mt-1 text-xs", slip.expired ? "text-[#ff5d73]" : "text-white/50")}>
                  {slip.expired ? "This bill has expired." : `Open until ${new Date(slip.expiresAt).toLocaleTimeString()}.`}
                </p>
              ) : (
                <p className="mt-1 text-xs text-white/45">No clock on this bill.</p>
              )}
            </div>
          ) : null}
          {named == null ? <Amount usd={usd} setUsd={setUsd} /> : null}
          {priced ? (
            <>
              <p className="mt-3 text-xs text-white/45">Tip, in the same signature</p>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {TIPS.map((n) => (
                  <button key={n} type="button" onClick={() => setTip(n)} className={cn("min-h-10 rounded-full text-sm font-semibold", tip === n ? "bg-white text-black" : "border border-white/10 text-white/70")}>
                    {n === 0 ? "None" : `${n}%`}
                  </button>
                ))}
              </div>
              <p className="mt-3 font-mono text-2xl tabular-nums">{money(priced.total)}</p>
              <p className="text-xs text-white/45">{priced.tip > 0 ? `${money(priced.bill)} plus ${money(priced.tip)}` : "No tip"}</p>
            </>
          ) : null}
          <button type="button" disabled={busy || !slip || !slip.ok || slip.expired || !priced} onClick={() => void pay()} className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            {busy ? "Opening the wallet…" : priced ? `Sign ${money(priced.total)}` : "Sign USDC"}
          </button>
          <p className="mt-2 text-xs text-white/40">One signature. Nothing else is charged.</p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-white/55">This code asks for USDC to the Phantom that is connected. Showing it does not move money. After the clock, a pay desk will refuse it.</p>
          <input value={shop} onChange={(e) => setShop(e.target.value.slice(0, 32))} placeholder="Shop name" aria-label="Shop name" className={cn(field, "mt-3")} />
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 48))} placeholder="What it’s for" aria-label="What the bill is for" className={cn(field, "mt-2")} />
          <Amount usd={usd} setUsd={setUsd} />
          <div className="mt-2 grid grid-cols-4 gap-1">
            {CLOCKS.map((row) => (
              <button key={row.id} type="button" onClick={() => setClock(row.id)} className={cn("min-h-10 rounded-full text-xs font-semibold", clock === row.id ? "bg-white text-black" : "border border-white/10 text-white/70")}>
                {row.label}
              </button>
            ))}
          </div>
          {receive ? (
            <>
              {dies ? <p className="mt-2 text-xs text-white/45">Dies {new Date(dies).toLocaleTimeString()}.</p> : <p className="mt-2 text-xs text-white/45">No clock. The bill stays valid.</p>}
              <div className="mt-3">
                <PayQr value={receive} />
              </div>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(receive).then(() => toast.success("Bill copied.")).catch(() => toast.error("Could not copy."))}
                className="mt-3 min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold"
              >
                Copy bill
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-white/55">{owner ? "Name an amount. The code is that many USDC." : "Connect Phantom. The code is that address, and there is nothing to show until it is connected."}</p>
          )}
        </div>
      )}
      <Fault fault={fault} />
    </div>
  );
}

function Ramp() {
  return (
    <div>
      <p className="text-sm text-white/55">A ramp counts only when a provider returns a session. A card charge is not USDC in this wallet until something delivers it. No bank account is linked here.</p>
      <button type="button" onClick={() => openDeposit()} className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg">
        Add from a provider
      </button>
    </div>
  );
}

function Convert({ owner, ensure, track, onDone }: { owner: string; ensure: () => Promise<string>; track: Track; onDone: () => void }) {
  const [from, setFrom] = useState<UsdcRailId>("solana");
  const [to, setTo] = useState<UsdcRailId>("base");
  const [usd, setUsd] = useState("20");
  const [evmFrom, setEvmFrom] = useState("");
  const [toAddr, setToAddr] = useState("");
  const [move, setMove] = useState<UsdcMove | null>(null);
  const [fault, setFault] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [round, setRound] = useState(0);
  const lock = useRef(false);
  const spent = useRef(new Set<string>());
  const tries = useRef(0);
  const quoteFor = useRef("");
  const source = USDC_RAILS.find((row) => row.id === from) ?? USDC_RAILS[0];
  const dest = USDC_RAILS.find((row) => row.id === to) ?? USDC_RAILS[1];
  const fromAddress = source.kind === "solana" ? owner : evmFrom.trim();
  const amount = Number(usd);

  useEffect(() => {
    setMove(null);
    const key = `${from}|${to}|${amount}|${fromAddress}|${toAddr.trim()}`;
    if (quoteFor.current !== key) {
      quoteFor.current = key;
      tries.current = 0;
    }
    if (from === to) {
      setQuoting(false);
      setFault("Pick two chains. USDC on the same chain is already USDC.");
      return;
    }
    if (!(amount >= 1) || amount > spendCap()) {
      setQuoting(false);
      setFault(amount > spendCap() ? `That is over the spend cap of ${spendCap()}.` : "");
      return;
    }
    if (!fromAddress || !toAddr.trim()) {
      setQuoting(false);
      setFault("");
      return;
    }
    let live = true;
    setQuoting(true);
    const timer = window.setTimeout(() => {
      setFault("");
      quoteUsdcMove({ data: { from, to, usd: amount, fromAddress, toAddress: toAddr.trim() } })
        .then((row) => {
          if (!live) return;
          const id = routeKey(row);
          if (row.ok && id && spent.current.has(id)) {
            if (tries.current < 2) {
              tries.current += 1;
              window.setTimeout(() => {
                if (live) setRound((n) => n + 1);
              }, 800);
              return;
            }
            setMove(null);
            setQuoting(false);
            setFault("LI.FI returned the route that was just signed. Change the amount to quote another.");
            return;
          }
          setMove(row);
          setQuoting(false);
          if (!row.ok) setFault(row.error);
        })
        .catch((e: unknown) => {
          if (!live) return;
          setMove(null);
          setQuoting(false);
          setFault(e instanceof Error ? e.message : "LI.FI did not quote.");
        });
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [from, to, amount, fromAddress, toAddr, round]);

  async function useEvm(into: "from" | "to") {
    try {
      const eth = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<unknown> } }).ethereum;
      if (!eth) throw new Error("No Ethereum wallet in this browser.");
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const who = accounts?.[0] || "";
      if (!/^0x[a-fA-F0-9]{40}$/.test(who)) throw new Error("The wallet returned no account.");
      if (into === "from") setEvmFrom(who);
      else setToAddr(who);
    } catch (e) {
      setFault(e instanceof Error ? e.message : "The Ethereum wallet did not answer.");
    }
  }

  async function sign() {
    if (lock.current || !move?.ok) return;
    const quoted = move;
    const id = routeKey(quoted);
    if (id && spent.current.has(id)) {
      setMove(null);
      setFault("This route was already signed. The next quote is on the way.");
      setRound((n) => n + 1);
      return;
    }
    lock.current = true;
    setBusy(true);
    setFault("");
    try {
      if (quoted.kind === "solana") {
        const who = owner || (await ensure());
        if (who !== fromAddress) throw new Error("Quote again. Phantom is a different account than the one on this quote.");
        const signature = await sendLifiSolana(quoted.tx);
        if (id) spent.current.add(id);
        rememberClear({
          desk: "send",
          title: `USDC to ${dest.label}`,
          legs: [
            { side: "out", asset: "USDC", amount, where: "Solana" },
            { side: "in", asset: "USDC", amount: quoted.toUi, where: toAddr.trim() },
          ],
          feeUsd: Math.max(0, Math.round((Number(quoted.fromUsd) - Number(quoted.toUsd)) * 100) / 100),
          sig: signature,
          status: "signed",
        });
        track({ sig: signature, href: solTxLink(signature), title: `${amount} USDC toward ${dest.label}`, chain: "solana" });
        if (privacyOn()) keepPrivateSend({ title: `USDC toward ${dest.label}`, usd: amount, asset: "USDC" });
        toast.message("Signed. The next convert can start. Finality is still playing.");
      } else {
        const raw = BigInt(Math.round(amount * 1_000_000));
        const hash = await signLifiChain(quoted.fromChainId, quoted.quote, { token: quoted.fromToken, amount: raw, usd: amount }, fromAddress);
        if (id) spent.current.add(id);
        const chainId = quoted.quote.chainId || quoted.fromChainId;
        track({ sig: hash, href: txLink(chainId, hash), title: `${amount} USDC toward ${dest.label}`, chain: "evm" });
        if (privacyOn()) keepPrivateSend({ title: `USDC toward ${dest.label}`, usd: amount, asset: "USDC" });
        toast.message("The Ethereum wallet signed. The next convert can start.");
      }
      setMove(null);
      setRound((n) => n + 1);
      onDone();
    } catch (e) {
      setFault(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const ready = Boolean(move?.ok);
  return (
    <div>
      <p className="text-sm text-white/55">LI.FI builds the route. Your wallet signs it. Same-chain swaps stay on the market ticket. A quote that is not ready is not a fill. The next route can be signed before this one is final.</p>
      <p className="mt-3 text-[11px] tracking-[0.14em] text-white/40 uppercase">From</p>
      <Rails id={from} onPick={setFrom} />
      <p className="mt-3 text-[11px] tracking-[0.14em] text-white/40 uppercase">To</p>
      <Rails id={to} onPick={setTo} />
      <Amount usd={usd} setUsd={setUsd} />
      {source.kind === "solana" ? (
        <p className="mt-2 font-mono text-xs text-white/45">{owner ? `From ${short(owner)}` : "Connect Phantom. That address is the USDC this spends."}</p>
      ) : (
        <div className="mt-2 flex gap-2">
          <input value={evmFrom} onChange={(e) => setEvmFrom(e.target.value.trim())} placeholder="Your 0x on that chain" aria-label="From address" className={cn(field, "font-mono text-xs")} />
          <button type="button" onClick={() => void useEvm("from")} className="min-h-12 shrink-0 rounded-full border border-white/15 px-3 text-xs font-semibold">
            Use wallet
          </button>
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <input value={toAddr} onChange={(e) => setToAddr(e.target.value.trim())} placeholder={dest.kind === "solana" ? "Their Solana address" : "Their 0x on that chain"} aria-label="To address" className={cn(field, "font-mono text-xs")} />
        {dest.kind === "evm" ? (
          <button type="button" onClick={() => void useEvm("to")} className="min-h-12 shrink-0 rounded-full border border-white/15 px-3 text-xs font-semibold">
            Use wallet
          </button>
        ) : owner ? (
          <button type="button" onClick={() => setToAddr(owner)} className="min-h-12 shrink-0 rounded-full border border-white/15 px-3 text-xs font-semibold">
            This Phantom
          </button>
        ) : null}
      </div>
      {source.kind === "solana" && !owner ? (
        <button type="button" onClick={() => void ensure().catch((e: unknown) => setFault(e instanceof Error ? e.message : "Phantom did not open."))} className="mt-3 min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">
          Connect Phantom
        </button>
      ) : null}
      {move?.ok ? (
        <div className="mt-3 rounded-2xl border border-white/10 px-3 py-3 text-sm">
          <p className="font-mono tabular-nums">{move.toUi.toFixed(2)} USDC on {dest.label}</p>
          <p className="mt-1 text-white/45">via {move.tool} · ${move.fromUsd} in · ${move.toUsd} out</p>
          <p className="mt-1 text-white/45">They receive USDC on {dest.label}, not a bank deposit.</p>
        </div>
      ) : null}
      <button type="button" disabled={busy || !ready} onClick={() => void sign()} className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        {busy ? "Opening the wallet…" : ready ? "Sign the route" : quoting ? "Quoting the next route" : "Waiting for a quote"}
      </button>
      <Fault fault={fault} />
    </div>
  );
}

function Rails({ id, onPick }: { id: UsdcRailId; onPick: (id: UsdcRailId) => void }) {
  return (
    <div className="mt-1 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {USDC_RAILS.map((row) => (
        <button key={row.id} type="button" onClick={() => onPick(row.id)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold", id === row.id ? "bg-white text-black" : "border border-white/10 text-white/70")}>
          {row.label}
        </button>
      ))}
    </div>
  );
}

function ChainRail({ stack, fault }: { stack: ChainStack | null; fault: string }) {
  const ring = stack?.marks.find((row) => row.id === "ring");
  const registry = stack?.marks.find((row) => row.id === "registry");
  const tree = stack?.marks.find((row) => row.id === "tree");
  const dvp = stack?.marks.find((row) => row.id === "dvp");
  const ringsLive = Boolean(ring?.executable && registry?.executable && tree?.present && ring && tree?.owner === ring.address);
  if (!stack) {
    return <p className="text-sm text-white/60">{fault || "Asking this RPC."}</p>;
  }
  return (
    <div className="space-y-3 text-sm leading-snug text-white/70">
      <p>
        {stack.spread
          ? `This RPC, ${stack.spread.n} samples. Slot p50 ${stack.spread.p50} ms, p90 ${stack.spread.p90} ms, p99 ${stack.spread.p99} ms. The band is ${stack.spread.min}–${stack.spread.max} ms.`
          : fault || "The slot sample has not come back."}{" "}
        Alpenglow is the consensus. A published look at mainnet put median finality near 400 ms. This desk does not advertise 150 ms. Slot time is not that finality.
      </p>
      {stack.spread && stack.spread.bars.length > 0 ? (
        <div className="flex items-end gap-1">
          {stack.spread.bars.map((bar) => {
            const top = Math.max(...stack.spread!.bars.map((row) => row.n), 1);
            return (
              <div key={bar.ms} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-sm bg-[#d6ff4a]" style={{ height: `${Math.max(6, Math.round((bar.n / top) * 48))}px` }} />
                <span className="font-mono text-[10px] text-white/45">{bar.ms}</span>
                <span className="font-mono text-[10px] text-white/35">{bar.n}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      <p>
        {ringsLive
          ? "Privacy Rings and its registry are executable, and the state tree is owned by that program."
          : "Privacy Rings did not match the published accounts on this RPC."}{" "}
        There is no Helius key on this host, so a private balance is not read and nothing here shields USDC. Private on this phone covers the balance, the tokens, and the send amounts. A send from this desk stays public. On the default ring, addresses stay visible.
      </p>
      <p>
        {dvp?.executable ? `DvP is executable at ${dvp.address.slice(0, 4)}…${dvp.address.slice(-4)}.` : "DvP did not answer as an executable program."}{" "}
        Both sides fund escrow and a named releaser settles them together, or neither side moves. This screen does not open that trade.
      </p>
      <p>This app does not build durable-nonce transactions. Signers are web3.js 1. Privacy is encrypted on this phone with Senda’s own key. There is no hardware attestation. Samsung Wallet, Western Union, and Open Money Stack are not contracted.</p>
    </div>
  );
}

function Amount({ usd, setUsd }: { usd: string; setUsd: (v: string) => void }) {
  return (
    <div className="mt-3">
      <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="USDC" className="w-full bg-transparent font-mono text-4xl tabular-nums outline-none" />
      <div className="mt-2 flex gap-1.5 overflow-x-auto">
        {PRESETS.map((n) => (
          <button key={n} type="button" onClick={() => setUsd(String(n))} className={cn("min-h-10 shrink-0 rounded-full px-3 font-mono text-sm", Number(usd) === n ? "bg-[#d6ff4a] text-black" : "border border-white/10 text-white/70")}>
            ${n}
          </button>
        ))}
      </div>
    </div>
  );
}

function Fault({ fault, note, sig, href }: { fault: string; note?: string; sig: string; href: string }) {
  return (
    <div>
      {fault ? <p className="mt-2 text-sm text-[#ff5d73]">{fault}</p> : null}
      {note ? <p className="mt-2 text-sm text-white/70">{note}</p> : null}
      {sig && href ? (
        <a className="mt-2 block truncate font-mono text-xs text-[#d6ff4a]" href={href} target="_blank" rel="noreferrer">
          {sig}
        </a>
      ) : null}
    </div>
  );
}
