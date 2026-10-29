import { useEffect, useState } from "react";

type Prompt = { prompt: () => Promise<void> };

/** The same desk, installed on Android. There is no Play Store listing. */
export function AndroidInstall() {
  const [android, setAndroid] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const phone = /Android/i.test(navigator.userAgent);
    setAndroid(phone);
    if (window.matchMedia("(display-mode: standalone)").matches) setDone(true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      const next = event as Event & { prompt: () => Promise<void> };
      setPrompt({ prompt: () => next.prompt() });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!android || done) return null;

  return (
    <section className="rounded-[22px] border border-white/10 bg-black p-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Android</p>
      <h2 className="mt-1 text-lg font-semibold">Install Senda on this phone</h2>
      <p className="mt-1 text-sm text-white/50">Same desk, its own icon. It is not a Play Store app. Chrome can add it to the home screen.</p>
      {prompt ? (
        <button
          type="button"
          onClick={() => void prompt.prompt().then(() => setDone(true))}
          className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
        >
          Install
        </button>
      ) : (
        <p className="mt-3 text-sm text-white/70">In Chrome, open the menu and tap Install app. If that line is missing, tap Add to Home screen.</p>
      )}
    </section>
  );
}
