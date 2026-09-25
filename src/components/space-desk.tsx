import { useState } from "react";
import { toast } from "sonner";
import { payUsdc } from "@/lib/solana-pay";
import {
  attachReceipt,
  connectMine,
  membersOf,
  newNonce,
  openSpace,
  publicCard,
  readNote,
  rememberCard,
  sealNote,
  spaceId,
  type Space,
} from "@/lib/space";

const field =
  "min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none placeholder:text-subtle";

export function SpaceDesk() {
  const [me, setMe] = useState("");
  const [them, setThem] = useState("");
  const [nonce, setNonce] = useState(newNonce);
  const [id, setId] = useState("");
  const [space, setSpace] = useState<Space | null>(null);
  const [note, setNote] = useState("");
  const [usd, setUsd] = useState("40");
  const [card, setCard] = useState("");
  const [plain, setPlain] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const owner = me || (await connectMine());
      setMe(owner);
      const opened = await openSpace(owner, them, nonce);
      setId(opened.id);
      setSpace(opened.space);
      toast.success("Room open. Only the two wallets can read what is sealed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The room did not open.");
    } finally {
      setBusy(false);
    }
  }

  async function takeCard() {
    setBusy(true);
    try {
      const next = rememberCard(card);
      const owner = me || (await connectMine());
      setMe(owner);
      if (!next.members.includes(owner)) throw new Error("This wallet is not on that card.");
      const opened = await openSpace(owner, next.members.find((m) => m !== owner) as string, next.nonce);
      setThem(opened.space.members.find((m) => m !== owner) || "");
      setNonce(opened.space.nonce);
      setId(opened.id);
      setSpace(opened.space);
      toast.success("Your key is in the room.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That card did not open.");
    } finally {
      setBusy(false);
    }
  }

  async function seal(tx: string | null) {
    if (!id || !me) return;
    setBusy(true);
    try {
      const next = await sealNote(id, me, note, tx);
      setSpace(next);
      setNote("");
      toast.success(tx ? "Transfer is in the room. The token did not move unless you signed it." : "Note sealed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not seal.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!id || !me || !space) return;
    const amount = Number(usd);
    const other = space.members.find((m) => m !== me);
    if (!other) return;
    setBusy(true);
    try {
      const paid = await payUsdc({
        owner: me,
        to: other,
        usd: amount,
        memo: `Senda space ${id.slice(0, 18)} ${amount}`,
      });
      if (space.members.every((m) => space.arms[m])) {
        const next = await sealNote(id, me, note || `USDC ${amount}`, paid.signature);
        setSpace(next);
        setNote("");
      } else {
        setSpace(attachReceipt(id, me, paid.signature));
      }
      toast.success("USDC is in their wallet. The receipt is in the room.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The transfer did not send.");
    } finally {
      setBusy(false);
    }
  }

  async function unseal(eventId: string) {
    if (!id || !me || !space) return;
    const event = space.events.find((item) => item.id === eventId);
    if (!event) return;
    try {
      const text = await readNote(id, me, event);
      setPlain((prev) => ({ ...prev, [eventId]: text }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This browser cannot open that note.");
    }
  }

  const ready = space && id;
  const otherIn = ready && space.members.every((m) => space.arms[m]);

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="text-[11px] font-semibold tracking-wide text-accent uppercase">Space</p>
      <h2 className="mt-1 font-display text-3xl leading-none tracking-tight">The door is a pubkey.</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Two wallets. A note only they can open. USDC goes to their address, and the wallet signs. The mint stays in the sender’s account until that signature. This page cannot read the note.
      </p>

      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        <input className={field} placeholder="Your wallet" value={me} onChange={(e) => setMe(e.target.value)} />
        <input className={field} placeholder="Their wallet" value={them} onChange={(e) => setThem(e.target.value)} />
        <input className={`${field} font-mono text-xs lg:col-span-2`} value={nonce} onChange={(e) => setNonce(e.target.value)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void open()} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
          Open with this wallet
        </button>
        <button
          type="button"
          disabled={!space}
          onClick={() => {
            if (!space) return;
            void navigator.clipboard.writeText(publicCard(space));
            toast.success("Card copied. It has no secret.");
          }}
          className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold"
        >
          Copy card
        </button>
      </div>

      <textarea
        className={`${field} mt-3 min-h-20 py-3`}
        placeholder="Paste their card"
        value={card}
        onChange={(e) => setCard(e.target.value)}
      />
      <button type="button" disabled={busy || !card.trim()} onClick={() => void takeCard()} className="mt-2 min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold">
        Put my key in their room
      </button>

      {ready ? (
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="font-mono text-[11px] text-subtle">{otherIn ? "Both keys are in." : "Waiting for their key. A note cannot be sealed yet."}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-muted">{id}</p>
          <textarea
            className={`${field} mt-3 min-h-20 py-3`}
            placeholder="Here is $40 against Neuralink"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || !otherIn} onClick={() => void seal(null)} className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold">
              Seal note
            </button>
            <input className="min-h-11 w-24 rounded-full border border-white/10 bg-black/30 px-3 text-sm" value={usd} onChange={(e) => setUsd(e.target.value)} />
            <button type="button" disabled={busy} onClick={() => void send()} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
              Send USDC in this room
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {space.events.map((event) => (
              <li key={event.id} className="rounded-2xl border border-white/10 px-3 py-3">
                <p className="font-mono text-[11px] text-subtle">{event.from.slice(0, 4)}…{event.from.slice(-4)}</p>
                <p className="mt-1 text-sm">{plain[event.id] || (event.box ? "Sealed." : "Transfer. No note.")}</p>
                {event.tx ? <p className="mt-1 break-all font-mono text-[11px] text-muted">{event.tx}</p> : null}
                {!plain[event.id] && event.box ? (
                  <button type="button" onClick={() => void unseal(event.id)} className="mt-2 text-xs font-semibold text-accent">
                    Open
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function sameRoom(a: string, b: string, nonce: string): string {
  return spaceId(membersOf(a, b), nonce);
}
