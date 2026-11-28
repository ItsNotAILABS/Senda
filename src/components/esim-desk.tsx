import { useEffect, useState } from "react";
import { toast } from "sonner";
import { esimBalance, esimLookup, esimOrder, esimPlans, TRAVEL, type EsimPlan } from "@/lib/global-rails";
import { readEsims, saveEsim, type HeldEsim } from "@/lib/esim-hold";
import { cn } from "@/lib/utils";

function dollars(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function dataLine(plan: { gb: number; days: number; speed: string }) {
  const data = plan.gb > 0 ? `${plan.gb} GB` : "Data";
  const days = plan.days > 0 ? `${plan.days} days` : "";
  return [data, days, plan.speed].filter(Boolean).join(" · ");
}

/** Live ESIMaccess catalog. An order spends their merchant balance, not the wallet. */
export function EsimDesk() {
  const [code, setCode] = useState("MX");
  const [q, setQ] = useState("");
  const [plans, setPlans] = useState<EsimPlan[]>([]);
  const [note, setNote] = useState("Asking ESIMaccess…");
  const [reason, setReason] = useState<"key" | "empty" | "down" | "ok" | "">("");
  const [balance, setBalance] = useState<string>("");
  const [held, setHeld] = useState<HeldEsim[]>([]);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState("");
  const place = TRAVEL.find((row) => row.code === code) ?? TRAVEL[0];
  const needle = q.trim().toLowerCase();
  const countries = TRAVEL.filter((row) => !needle || row.name.toLowerCase().includes(needle) || row.code.toLowerCase().includes(needle));

  useEffect(() => {
    setHeld(readEsims());
    void esimBalance()
      .then((row) => setBalance(row.ok ? `Server balance ${dollars(row.usd)}. An order spends this. The wallet does not sign.` : row.error))
      .catch(() => setBalance("ESIMaccess did not answer."));
  }, []);

  useEffect(() => {
    let live = true;
    setPlans([]);
    setAsk("");
    setNote("Asking ESIMaccess…");
    setReason("");
    void esimPlans({ data: { location: code } })
      .then((row) => {
        if (!live) return;
        setPlans(row.plans);
        setReason(row.reason);
        setNote(row.ok ? `${row.plans.length} plans. Cheapest first. The price is theirs.` : row.error);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setReason("down");
        setNote(e instanceof Error ? e.message : "ESIMaccess did not answer.");
      });
    return () => {
      live = false;
    };
  }, [code]);

  async function buy(plan: EsimPlan) {
    setBusy(plan.code);
    try {
      const placed = await esimOrder({ data: { packageCode: plan.code } });
      if (!placed.ok) throw new Error(placed.error);
      let install = { orderNo: placed.orderNo, iccid: "", qr: "", ac: "", status: "" };
      for (let i = 0; i < 4; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, i === 0 ? 1600 : 2500));
        const look = await esimLookup({ data: { orderNo: placed.orderNo } });
        if (look.ok && look.profile) {
          install = look.profile;
          if (install.qr || install.iccid) break;
        }
      }
      const next = saveEsim({
        orderNo: install.orderNo,
        code: plan.code,
        name: plan.name,
        usd: plan.usd,
        iccid: install.iccid,
        qr: install.qr,
        ac: install.ac,
        status: install.status,
        at: Date.now(),
      });
      setHeld(next);
      setAsk("");
      toast.success(install.qr ? "The QR is on this profile." : "Ordered. The QR was not ready yet. Refresh it below.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ESIMaccess did not order it.");
    } finally {
      setBusy("");
    }
  }

  async function refresh(row: HeldEsim) {
    setBusy(row.orderNo);
    try {
      const look = await esimLookup({ data: { orderNo: row.orderNo } });
      if (!look.ok) throw new Error(look.error);
      if (!look.profile) throw new Error("ESIMaccess has no profile for that order yet.");
      const next = saveEsim({
        ...row,
        iccid: look.profile.iccid || row.iccid,
        qr: look.profile.qr || row.qr,
        ac: look.profile.ac || row.ac,
        status: look.profile.status || row.status,
      });
      setHeld(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ESIMaccess did not return it.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4 sm:p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">On this profile</p>
        <h2 className="mt-1 text-2xl tracking-tight">Travel eSIM</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Pick the country. The plans are ESIMaccess’s list, not a price made here. Ordering spends the server balance. Phantom does not sign it, and Senda does not keep the line.
        </p>
        {balance ? <p className="mt-2 text-sm text-white/70">{balance}</p> : null}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h3 className="text-sm font-semibold">Installed here</h3>
        {held.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None yet. A plan you order shows its QR on this browser only.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {held.map((row) => (
              <li key={row.orderNo} className="rounded-2xl border border-white/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{row.name}</p>
                    <p className="mt-1 font-mono text-[11px] text-white/50">{row.orderNo}{row.status ? ` · ${row.status}` : ""}</p>
                    {row.iccid ? <p className="mt-1 break-all font-mono text-[11px] text-white/70">ICCID {row.iccid}</p> : null}
                    {row.ac ? <p className="mt-1 break-all font-mono text-[11px] text-white/70">Code {row.ac}</p> : null}
                  </div>
                  {row.qr ? <img src={row.qr} alt="" className="size-28 rounded-xl bg-white p-2" /> : null}
                </div>
                <p className="mt-2 text-xs text-muted">Settings, Cellular, Add eSIM. Scan the QR. It is the one they returned.</p>
                <button type="button" disabled={busy === row.orderNo} onClick={() => void refresh(row)} className="mt-2 min-h-9 rounded-full border border-white/15 px-3 text-xs font-semibold disabled:opacity-40">
                  {busy === row.orderNo ? "Asking…" : "Refresh this line"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <label className="block text-xs text-white/45">
          Country
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mexico, Japan, US"
            className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none"
          />
        </label>
        <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
          {countries.map((row) => (
            <button
              key={row.code}
              type="button"
              onClick={() => setCode(row.code)}
              className={cn("min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold", code === row.code ? "bg-white text-black" : "bg-white/10 text-white/80")}
            >
              {row.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">{note}</p>
        {reason === "key" ? (
          <p className="mt-2 text-sm text-white/55">No plan is shown until that key is on the server. A blank list is not a price.</p>
        ) : null}
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {plans.map((plan) => {
            const confirming = ask === plan.code;
            return (
              <li key={plan.code} className="flex flex-col rounded-2xl border border-white/10 bg-black/30 p-3">
                <p className="text-sm font-semibold">{plan.name}</p>
                <p className="mt-1 text-xs text-white/50">{dataLine(plan)}</p>
                <p className="mt-2 font-mono text-2xl tabular-nums">{dollars(plan.usd)}</p>
                {plan.retail > plan.usd ? <p className="font-mono text-[11px] text-white/40">Counter {dollars(plan.retail)}. The charge is the first number.</p> : null}
                {confirming ? (
                  <button type="button" disabled={busy !== ""} onClick={() => void buy(plan)} className="mt-3 min-h-11 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
                    {busy === plan.code ? "Ordering…" : `Charge ${dollars(plan.usd)} on the server`}
                  </button>
                ) : (
                  <button type="button" disabled={reason === "key" || !(plan.usd > 0)} onClick={() => setAsk(plan.code)} className="mt-3 min-h-11 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
                    Order {place.name}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
