import { useEffect, useState } from "react";
import { DW_MODELS, dwStatus } from "@/lib/drivewealth";
import { cn } from "@/lib/utils";

/** The four DriveWealth funding models. Cashless is selected. The others stay visible so the choice is the choice. */
export function DriveWealthDesk() {
  const [line, setLine] = useState("Checking whether a DriveWealth session exists.");
  const [live, setLive] = useState(false);

  useEffect(() => {
    let on = true;
    dwStatus()
      .then((row) => {
        if (!on) return;
        setLive(row.live);
        setLine(row.reason);
      })
      .catch(() => on && setLine("The session check did not answer. No order was sent."));
    return () => {
      on = false;
    };
  }, []);

  return (
    <section className="px-4 pb-6">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Brokerage</p>
      <h2 className="mt-1 text-lg font-semibold">DriveWealth</h2>
      <p className="mt-1 text-sm text-white/55">
        A real brokerage account, not a Solana mint. The model on this desk is cashless. The wallet stays the cash.
      </p>
      <p className={cn("mt-2 text-sm", live ? "text-[#c6f56a]" : "text-white/70")}>{line}</p>
      <ul className="mt-3 grid gap-2">
        {DW_MODELS.map((row) => {
          const chosen = row.id === "cashless";
          return (
            <li key={row.id} className={cn("rounded-2xl border px-3 py-3", chosen ? "border-[#d7e36a]/50 bg-white/[0.04]" : "border-white/10")}>
              <p className="text-sm font-semibold">
                {row.name}
                {chosen ? <span className="ml-2 text-[11px] font-medium tracking-wide text-[#d7e36a] uppercase">This desk</span> : null}
              </p>
              <p className="mt-1 text-sm text-white/60">{row.hold}</p>
              <p className="mt-1 text-sm text-white/45">{row.fit}</p>
            </li>
          );
        })}
      </ul>
      <a href="https://developer.drivewealth.com/apis/docs/choosing-your-integration-model" className="mt-3 inline-block text-sm text-[#d7e36a]">
        DriveWealth’s four models
      </a>
    </section>
  );
}
