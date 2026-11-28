import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  SECTIONS,
  approveSection,
  createPassphrasePassport,
  createPhonePassport,
  lockPassport,
  passportMeta,
  passportUnlocked,
  unlockPassphrasePassport,
  unlockPhonePassport,
  visibleReceipt,
  verifyReceipt,
  type Door,
  type Receipt,
  type Section,
} from "@/lib/passport";
import { sealOpen } from "@/lib/seal";
import { cn } from "@/lib/utils";

const field = "min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none";

function short(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function when(exp: number): string {
  return new Date(exp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function doorLine(door: Door): string {
  if (door === "kept") return "The desk was already open. This passport did not swap that key.";
  return "This visit encrypts the desk with the phone’s master key. Phantom still signs money. This is not an enclave.";
}

export function PhonePassport({ compact = false }: { compact?: boolean }) {
  const [meta, setMeta] = useState<ReturnType<typeof passportMeta>>(null);
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState("");
  const [agent, setAgent] = useState("Desk");
  const [section, setSection] = useState<Section>("private");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [passOpen, setPassOpen] = useState(!compact);

  function refresh(door?: Door) {
    setMeta(passportMeta());
    setOpen(passportUnlocked());
    const shown = visibleReceipt();
    setReceipt(shown?.receipt ?? null);
    setChecked(shown ? shown.ok : null);
    if (door) setNote(doorLine(door));
  }

  useEffect(() => {
    refresh();
    setReady(true);
  }, []);

  async function run(work: () => Promise<{ door: Door } | Receipt>) {
    setBusy(true);
    setFault("");
    try {
      const out = await work();
      if ("door" in out) {
        refresh(out.door);
        toast.success(out.door === "kept" ? "Passport open. The desk key stayed." : "Passport open. The desk is encrypted for this visit.");
      } else {
        refresh();
        setReceipt(out);
        setChecked(verifyReceipt(out));
        toast.success("Receipt signed. It expires in 24 hours.");
      }
    } catch (e) {
      setFault(e instanceof Error ? e.message : "The passport did not open.");
    } finally {
      setBusy(false);
    }
  }

  const shown = receipt;
  const live = shown ? shown.exp > Date.now() && checked === true : false;

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-[#d6ff4a] uppercase">Phone key</p>
      {compact ? null : <h2 className="mt-1 text-lg font-semibold tracking-tight">Our key. Not an enclave.</h2>}
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        {compact
          ? "This phone unwraps the desk key. It does not sign USDC."
          : "A phone prompt or a passphrase only unwraps the master key. The identity that signs the receipt is separate, and it stays on this device. Confidential Compute is not used."}
      </p>

      {!ready ? <p className="mt-3 text-sm text-white/45">Reading this phone.</p> : null}

      {ready && !meta && !open ? (
        <div className="mt-3 space-y-2">
          <button type="button" disabled={busy} onClick={() => void run(createPhonePassport)} className="min-h-12 w-full rounded-full bg-[#d6ff4a] text-sm font-semibold text-black disabled:opacity-40">
            {busy ? "Waiting on this phone…" : "Use this phone"}
          </button>
          {passOpen ? (
            <>
              <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" autoComplete="new-password" placeholder="Passphrase, 8 or more" aria-label="Passphrase" className={field} />
              <button
                type="button"
                disabled={busy || pass.length < 8}
                onClick={() => void run(() => createPassphrasePassport(pass))}
                className="min-h-11 w-full rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40"
              >
                Create with a passphrase
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setPassOpen(true)} className="min-h-10 text-sm font-semibold text-white/70">
              Use a passphrase instead
            </button>
          )}
        </div>
      ) : null}

      {ready && meta && !open ? (
        <div className="mt-3 space-y-2">
          <p className="font-mono text-[11px] text-white/45">{short(meta.pub)} · {meta.wrap === "prf" ? "phone wrap" : "passphrase wrap"}</p>
          {meta.wrap === "prf" ? (
            <button type="button" disabled={busy} onClick={() => void run(unlockPhonePassport)} className="min-h-12 w-full rounded-full bg-[#d6ff4a] text-sm font-semibold text-black disabled:opacity-40">
              {busy ? "Waiting on this phone…" : "Unlock with this phone"}
            </button>
          ) : (
            <>
              <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" autoComplete="current-password" placeholder="Passphrase" aria-label="Passphrase" className={field} />
              <button
                type="button"
                disabled={busy || pass.length < 8}
                onClick={() => void run(() => unlockPassphrasePassport(pass))}
                className="min-h-12 w-full rounded-full bg-[#d6ff4a] text-sm font-semibold text-black disabled:opacity-40"
              >
                {busy ? "Opening…" : "Unlock"}
              </button>
            </>
          )}
        </div>
      ) : null}

      {ready && open ? (
        <div className="mt-3 space-y-2">
          <p className="font-mono text-[11px] text-white/45">Encrypted for this visit · {short(meta?.pub || "")}</p>
          {compact ? null : (
            <>
              <input value={agent} onChange={(e) => setAgent(e.target.value)} maxLength={24} aria-label="Agent" placeholder="Agent name" className={field} />
              <div className="flex gap-1.5">
                {SECTIONS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSection(id)}
                    className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold capitalize", section === id ? "bg-white text-black" : "border border-white/10 text-white/70")}
                  >
                    {id}
                  </button>
                ))}
              </div>
              <button type="button" disabled={busy || !agent.trim()} onClick={() => void run(() => approveSection(agent, section))} className="min-h-12 w-full rounded-full bg-[#d6ff4a] text-sm font-semibold text-black disabled:opacity-40">
                {busy ? "Signing…" : "Approve for 24 hours"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              lockPassport();
              setOpen(false);
              setPass("");
              setNote(sealOpen() ? "Passport locked. This visit’s desk key stayed open." : "Locked. The desk copy is ciphertext.");
            }}
            className="min-h-10 w-full rounded-full border border-white/15 text-sm font-semibold"
          >
            Lock this visit
          </button>
        </div>
      ) : null}

      {note ? <p className="mt-3 text-sm text-white/70">{note}</p> : null}
      {fault ? <p className="mt-2 text-sm text-[#ff5d73]">{fault}</p> : null}

      {shown && !compact ? (
        <div className="mt-3 rounded-2xl border border-white/10 px-3 py-3">
          <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Receipt</p>
          <p className="mt-1 text-sm">{shown.agent} can read {shown.section} until {when(shown.exp)}.</p>
          <p className={cn("mt-1 text-xs", live ? "text-[#d6ff4a]" : "text-[#ff5d73]")}>
            {checked === false ? "This receipt does not check." : live ? "Signature matches. Not a spend. Not a hardware quote." : "Signature matches. The 24 hours are over."}
          </p>
          <p className="mt-2 truncate font-mono text-[10px] text-white/35">{shown.signature}</p>
        </div>
      ) : null}
    </section>
  );
}
