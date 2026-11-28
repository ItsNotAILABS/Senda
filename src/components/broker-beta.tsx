import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { alpacaPaperBuy, alpacaPaperStatus } from "@/lib/alpaca-paper";
import { DW_MODELS, dwStatus } from "@/lib/drivewealth";
import { XSTOCK_LAW } from "@/lib/xstock-law";
import { cn } from "@/lib/utils";

/** Hidden. Open /lab?book=broker. Not linked from the dock, and not the xStocks buy. */
export function BrokerBeta() {
  const [dw, setDw] = useState("Checking DriveWealth.");
  const [alpaca, setAlpaca] = useState("Checking Alpaca paper.");
  const [symbol, setSymbol] = useState("AAPL");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    dwStatus().then((row) => on && setDw(row.reason)).catch(() => on && setDw("DriveWealth did not answer."));
    alpacaPaperStatus().then((row) => on && setAlpaca(row.reason)).catch(() => on && setAlpaca("Alpaca paper did not answer."));
    return () => {
      on = false;
    };
  }, []);

  async function send() {
    setBusy(true);
    setResult("");
    try {
      const row = await alpacaPaperBuy({ data: { symbol } });
      setResult(row.reason);
    } catch {
      setResult("The paper order did not leave this desk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-4 pb-16">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Hidden beta</p>
      <h1 className="mt-1 text-2xl font-semibold">Brokerage lab</h1>
      <p className="mt-2 text-sm text-white/60">
        Not on the rails, and not the Buy button. Alpaca paper can take a $5 day order when keys exist. DriveWealth cannot, until they open UAT. Neither one buys an xStock.
      </p>
      <Link to="/lab" className="mt-3 inline-block text-sm text-[#d7e36a]">Back to the lab</Link>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">xStocks stay put</h2>
        <ul className="mt-2 space-y-2 text-sm text-white/65">
          {XSTOCK_LAW.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Alpaca paper</h2>
        <p className="mt-1 text-sm text-white/60">{alpaca}</p>
        <p className="mt-2 text-sm text-white/45">Sandbox is free and self-serve. A paper fill is a real API order on fake money. It is not a share in a live account, and it does not move AAPLx.</p>
        <div className="mt-3 flex gap-2">
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} className="min-h-11 flex-1 rounded-xl bg-white/10 px-3 font-mono text-sm outline-none" aria-label="Share symbol" />
          <button type="button" disabled={busy} onClick={() => void send()} className="min-h-11 rounded-full bg-[#d7e36a] px-4 text-sm font-semibold text-black disabled:opacity-50">
            {busy ? "Sending" : "$5 paper"}
          </button>
        </div>
        {result ? <p className="mt-2 text-sm text-white/80">{result}</p> : null}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">DriveWealth</h2>
        <p className={cn("mt-1 text-sm", dw.startsWith("Session accepted") ? "text-[#c6f56a]" : "text-white/60")}>{dw}</p>
        <p className="mt-2 text-sm text-white/45">No self-serve start. Sales, then due diligence, then UAT. Cashless stays the model. The other three are not selected.</p>
        <ul className="mt-3 grid gap-2">
          {DW_MODELS.map((row) => (
            <li key={row.id} className={cn("rounded-2xl border px-3 py-3", row.id === "cashless" ? "border-[#d7e36a]/50" : "border-white/10")}>
              <p className="text-sm font-semibold">{row.name}{row.id === "cashless" ? " · this desk" : ""}</p>
              <p className="mt-1 text-sm text-white/55">{row.hold}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
