import { useEffect, useState } from "react";
import { PhonePassport } from "@/components/phone-passport";
import { coverDesk, privacyOn, setPrivacy } from "@/lib/privacy";
import { sealOpen } from "@/lib/seal";
import { cn } from "@/lib/utils";

/** Shown is the public wallet. Private covers this phone until its key is open. */
export function PrivateCover({ askKey = false }: { askKey?: boolean }) {
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      setOn(privacyOn());
      setOpen(sealOpen());
      setReady(true);
    };
    sync();
    window.addEventListener("senda-privacy", sync);
    window.addEventListener("senda-seal", sync);
    return () => {
      window.removeEventListener("senda-privacy", sync);
      window.removeEventListener("senda-seal", sync);
    };
  }, []);

  if (!ready) return null;

  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-white/[0.06] p-1">
        <button type="button" onClick={() => setPrivacy(false)} className={cn("min-h-10 rounded-full text-sm font-semibold", !on ? "bg-white text-black" : "text-white/60")}>
          Shown
        </button>
        <button type="button" onClick={() => setPrivacy(true)} className={cn("min-h-10 rounded-full text-sm font-semibold", on ? "bg-[#d6ff4a] text-black" : "text-white/60")}>
          Private
        </button>
      </div>
      {on ? (
        <p className="mt-2 text-xs leading-snug text-white/50">
          {open
            ? "This phone can see the balance, the tokens, and the send amounts. On the device they are ciphertext. The chain still shows the wallet. Not a Helius shield, and not a zero-knowledge transfer."
            : "Hidden on this phone: how much you hold, which tokens, and how much you send. Open the phone key to see them. The chain still shows the wallet. Nothing here shields USDC."}
        </p>
      ) : (
        <p className="mt-2 text-xs text-white/40">Shown is the public wallet. Private covers this phone only.</p>
      )}
      {on && askKey && !open ? (
        <div className="mt-3">
          <PhonePassport compact />
        </div>
      ) : null}
    </div>
  );
}

/** True after mount when private is on and the phone key is locked. */
export function useCover(): boolean {
  const [cover, setCover] = useState(false);
  useEffect(() => {
    const sync = () => setCover(coverDesk());
    sync();
    window.addEventListener("senda-privacy", sync);
    window.addEventListener("senda-seal", sync);
    return () => {
      window.removeEventListener("senda-privacy", sync);
      window.removeEventListener("senda-seal", sync);
    };
  }, []);
  return cover;
}
