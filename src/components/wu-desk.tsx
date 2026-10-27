import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Opens Western Union's own finder. Senda does not keep a store list or file the note. */
export function WuDesk() {
  const [city, setCity] = useState("");
  const [country, setCountry] = useState<"US" | "MX">("US");
  const [mtcn, setMtcn] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const q = encodeURIComponent(city.trim());
  const href = country === "MX"
    ? `https://location.westernunion.com/global-services/find-locations?WUCountry=MX&WULanguage=es&q=${q}`
    : `https://location.westernunion.com/global-services/find-locations?WUCountry=US&WULanguage=en&q=${q}`;

  async function copy() {
    const text = [`MTCN: ${mtcn || "—"}`, `Name: ${name || "—"}`, `City: ${city || "—"}`, `Country: ${country}`, `Note: ${note || "—"}`].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Note copied. Western Union does not have it.");
    } catch {
      toast.error("Could not copy the note.");
    }
  }

  return (
    <section className="mt-4 space-y-3 rounded-2xl border border-white/10 p-3">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Western Union</p>
      <div className="flex gap-2">
        {(["US", "MX"] as const).map((row) => (
          <button key={row} type="button" onClick={() => setCountry(row)} className={cn("min-h-10 flex-1 rounded-full text-xs font-semibold", country === row ? "bg-white text-black" : "bg-white/10")}>{row === "US" ? "United States" : "Mexico"}</button>
        ))}
      </div>
      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <a href={href} target="_blank" rel="noreferrer" className="flex min-h-16 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-black">Find a store</a>
        <a href={country === "MX" ? "https://www.westernunion.com/mx/es/track-transfer.html" : "https://www.westernunion.com/us/en/track-transfer.html"} target="_blank" rel="noreferrer" className="flex min-h-16 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold">Track</a>
        <a href={country === "MX" ? "https://www.westernunion.com/mx/es/send-money.html" : "https://www.westernunion.com/us/en/send-money.html"} target="_blank" rel="noreferrer" className="flex min-h-16 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold">Send cash</a>
        <a href="https://wucare.westernunion.com/s/customer-care-home" target="_blank" rel="noreferrer" className="flex min-h-16 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold">Care</a>
      </div>
      <input value={mtcn} onChange={(e) => setMtcn(e.target.value)} placeholder="MTCN, if you have one" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What you need at the store" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void copy()} className="min-h-11 w-full rounded-full border border-white/10 text-sm font-semibold">Copy the note for the counter</button>
    </section>
  );
}
