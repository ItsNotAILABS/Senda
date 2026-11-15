import { useEffect, useState } from "react";
import { listHeld, listHeldTrades } from "@/lib/offline-rail";
import { spendCap } from "@/lib/spend-cap";

/** One line every money screen can share. Network, wallet, cash, fee, cap, holds. */
export function DeskStatus({ owner, usdc, sol }: { owner?: string; usdc?: number | null; sol?: number | null }) {
  const [online, setOnline] = useState(true);
  const [held, setHeld] = useState(0);
  const [cap, setCap] = useState(100);

  useEffect(() => {
    const sync = () => {
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
      const sends = listHeld().filter((row) => row.status === "held").length;
      const trades = listHeldTrades().filter((row) => row.status === "held").length;
      setHeld(sends + trades);
      setCap(spendCap());
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const who = owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "No wallet";
  return (
    <p className="font-mono text-[11px] leading-relaxed text-white/45">
      {online ? "Network up" : "Network down. Holds stay on this phone."}
      {" · "}
      {who}
      {usdc != null ? ` · $${usdc.toFixed(2)} USDC` : ""}
      {sol != null ? ` · ${sol.toFixed(3)} SOL for fees` : ""}
      {` · cap $${cap}`}
      {held > 0 ? ` · ${held} held` : ""}
    </p>
  );
}
