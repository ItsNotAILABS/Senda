import { useEffect, useState } from "react";
import { PhonePassport } from "@/components/phone-passport";
import { askSeal, sealCard, verifySeal, type Seal } from "@/lib/private-ai";
import { keepPrompt, listPrompts, type KeptPrompt } from "@/lib/prompt-book";
import { cn } from "@/lib/utils";

const PROMPTS = [
  "What does this signature actually prove?",
  "Can this host show a hardware quote?",
  "One risk note for a desk that signs its own answers.",
];

type Check = { k: string; title: string; line: string; state: "wait" | "pass" | "miss" };

function checksFor(seal: Seal | null, verified: boolean | null, shown: number, kept: boolean): Check[] {
  const rows: Check[] = [
    {
      k: "store",
      title: kept ? "Encrypted on this phone" : "Not saved here",
      line: kept
        ? "The question and the answer are ciphertext on this phone. Not a database row."
        : "Nothing was written on this phone. The model still read the question.",
      state: "pass",
    },
    {
      k: "model",
      title: seal?.inferred ? "Answered" : "No inference",
      line: seal?.inferred ? `grok-4.5 wrote the words.` : seal?.fault || "Nothing was inferred.",
      state: seal?.inferred ? "pass" : "miss",
    },
    {
      k: "sig",
      title: verified ? "Signature matches" : "Signature failed",
      line: verified ? "Checked in this browser against the exact bytes." : "These bytes do not match the signature.",
      state: verified ? "pass" : "miss",
    },
    {
      k: "hw",
      title: "No hardware quote",
      line: seal?.hardware.note || "This host is not an enclave.",
      state: "miss",
    },
  ];
  return rows.map((row, i) => (i < shown ? row : { ...row, state: "wait", title: "Checking", line: "" }));
}

export function PrivateDesk() {
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [busy, setBusy] = useState(false);
  const [seal, setSeal] = useState<Seal | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [shown, setShown] = useState(0);
  const [pubkey, setPubkey] = useState("");
  const [error, setError] = useState("");
  const [kept, setKept] = useState(false);
  const [book, setBook] = useState<KeptPrompt[]>([]);

  useEffect(() => {
    const sync = () => setBook(listPrompts());
    sync();
    window.addEventListener("senda-seal", sync);
    return () => window.removeEventListener("senda-seal", sync);
  }, []);

  useEffect(() => {
    let live = true;
    void sealCard()
      .then((card) => {
        if (live) setPubkey(card.pubkey);
      })
      .catch(() => {
        if (live) setError("The signing key did not come back.");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!seal) return;
    setShown(0);
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n >= 4) {
          window.clearInterval(id);
          return 4;
        }
        return n + 1;
      });
    }, 280);
    return () => window.clearInterval(id);
  }, [seal]);

  async function ask(text: string) {
    const next = text.trim();
    if (!next || busy) return;
    setBusy(true);
    setError("");
    setSeal(null);
    setVerified(null);
    setShown(0);
    try {
      const out = await askSeal({ data: { prompt: next } });
      const ok = verifySeal(out);
      const saved = keepPrompt(next, out.text);
      setVerified(ok);
      setSeal(out);
      setPubkey(out.pubkey);
      setKept(saved);
      setBook(listPrompts());
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The ask failed.");
    } finally {
      setBusy(false);
    }
  }

  const rows = seal ? checksFor(seal, verified, shown, kept) : [];
  const caption = busy ? "Asking Senda" : seal ? (shown < 4 ? "Checking the seal" : verified ? "Signed" : "Not signed") : "Ask, then check it here";

  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-[11px] tracking-[0.18em] text-white/40 uppercase">Senda private</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your model. Your check.</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Grok answers on Senda’s key. This browser verifies the signature. The desk’s own passport encrypts what stays on the phone. Nothing here moves money, and nothing here is a hardware enclave.
        </p>
      </div>

      <PhonePassport />

      <div className="relative h-44 overflow-hidden rounded-2xl bg-[#07080d]">
        <div className="absolute top-0 right-0 h-7 w-20 bg-[#d6ff4a]" />
        <div className="absolute top-7 right-8 h-2.5 w-14 bg-[#d6ff4a]/35" />
        <div className="absolute bottom-0 left-0 h-2.5 w-2/3 bg-[#d6ff4a]" />
        <span className={cn("absolute top-[22%] left-[18%] size-1.5 rounded-full", busy ? "animate-pulse bg-[#d6ff4a]" : "bg-[#d6ff4a]/70")} />
        <span className={cn("absolute top-[38%] left-[62%] size-1 rounded-full", busy ? "animate-pulse bg-[#d6ff4a]" : verified === false ? "bg-[#ff5d73]" : "bg-[#d6ff4a]/50")} />
        <span className="absolute right-[18%] bottom-[36%] size-1.5 rounded-full bg-[#ff5d73]" />
        <span className={cn("absolute bottom-[28%] left-[40%] size-1 rounded-full", busy ? "animate-pulse bg-white/70" : "bg-white/30")} />
        <div className="absolute inset-x-5 bottom-5">
          <p className="text-[11px] tracking-[0.2em] text-[#d6ff4a] uppercase">Senda</p>
          <p className="mt-1 text-lg font-semibold">{caption}</p>
        </div>
      </div>

      <p className="break-all font-mono text-[11px] leading-relaxed text-white/45">
        Process key {pubkey || "…"}
      </p>

      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PROMPTS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setPrompt(item)}
            className={cn(
              "min-h-10 max-w-[16rem] shrink-0 rounded-full px-3 text-left text-xs font-medium",
              prompt === item ? "bg-white text-black" : "bg-white/10 text-white/75",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <textarea
        value={prompt}
        maxLength={400}
        onChange={(event) => setPrompt(event.target.value)}
        className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none"
      />
      <button
        type="button"
        disabled={busy || !prompt.trim()}
        onClick={() => void ask(prompt)}
        className="min-h-12 w-full rounded-full bg-[#d6ff4a] text-sm font-semibold text-[#04140c] disabled:opacity-50"
      >
        {busy ? "Asking…" : "Ask Senda"}
      </button>
      <p className="text-xs leading-relaxed text-white/45">Open the phone key and this question is saved as ciphertext. Otherwise it is not written. The model still reads it to answer.</p>

      {error ? <p className="text-sm text-[#ff5d73]">{error}</p> : null}

      {seal ? (
        <div className="space-y-3">
          <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
            {rows.map((row) => (
              <li key={row.k} className="flex items-start gap-3 px-3 py-3">
                <span
                  className={cn(
                    "mt-1 size-2 shrink-0 rounded-full",
                    row.state === "pass" && "bg-[#d6ff4a]",
                    row.state === "miss" && "bg-[#ff5d73]",
                    row.state === "wait" && "bg-white/25",
                  )}
                />
                <span>
                  <span className="block text-sm font-semibold">{row.title}</span>
                  {row.line ? <span className="mt-0.5 block text-xs leading-relaxed text-white/50">{row.line}</span> : null}
                </span>
              </li>
            ))}
          </ul>

          <div className={cn("rounded-2xl px-4 py-3", verified ? "bg-white/[0.06]" : "bg-[#ff5d73]/10")}>
            <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">{verified ? "Signed answer" : "Unverified bytes"}</p>
            <p className="mt-2 text-sm leading-relaxed">{seal.text}</p>
            <p className="mt-3 break-all font-mono text-[10px] text-white/35">
              {seal.issuedAt} · {seal.signature.slice(0, 22)}…
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVerified(verifySeal(seal))}
            className="min-h-10 rounded-full bg-white/10 px-4 text-sm font-medium text-white/80"
          >
            Check the signature again
          </button>
        </div>
      ) : null}

      {book.length > 0 ? (
        <ul className="space-y-2">
          {book.slice(0, 4).map((row) => (
            <li key={row.at} className="rounded-2xl border border-white/10 px-3 py-2">
              <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Encrypted here</p>
              <p className="mt-1 text-sm">{row.q}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/50">{row.a}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs leading-relaxed text-white/40">
        The signature proves the words were not edited after signing. It does not hide the question from the model provider. What stays on this phone is encrypted with Senda’s key, and only while that key is open. This desk does not call Confidential Compute, and it will not paint a hardware pass it cannot produce.
      </p>
    </div>
  );
}
