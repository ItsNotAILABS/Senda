import { useState } from "react";
import { cn } from "@/lib/utils";

/** Standing live videos, checked against YouTube. The player starts muted because a phone will not autoplay sound. */
const CHANNELS = [
  { name: "Bloomberg", line: "Live", video: "QB5BNdBFujE" },
  { name: "CNBC", line: "24/7", video: "9NyxcX3rhQs" },
] as const;

export function CryptoTv() {
  const [on, setOn] = useState(0);
  const air = CHANNELS[on];
  const src = `https://www.youtube.com/embed/${air.video}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;

  return (
    <div className="bg-black pb-4">
      <div className="relative aspect-video w-full bg-black">
        <iframe
          key={air.video}
          title={`${air.name} live`}
          src={src}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#d7e36a] uppercase">Live</p>
          <h1 className="text-xl tracking-tight">{air.name}</h1>
        </div>
        <p className="text-xs text-white/50">Sound is off until you tap the picture.</p>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto px-4">
        {CHANNELS.map((c, i) => (
          <button
            key={c.video}
            type="button"
            onClick={() => setOn(i)}
            className={cn("min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold", i === on ? "bg-[#d7e36a] text-black" : "bg-white/10 text-white")}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
