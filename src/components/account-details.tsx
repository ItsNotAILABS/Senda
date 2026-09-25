import { useState } from "react";
import { Copy, Landmark } from "lucide-react";
import { toast } from "sonner";
import { openReceiveAccount, type IssuedAccount } from "@/lib/receive-account";
import { cn } from "@/lib/utils";

type Ccy = "usd" | "eur" | "mxn" | "usdc";
type Lane = "local" | "international";

const POCKETS: { id: Ccy; label: string }[] = [
  { id: "usd", label: "US dollar" },
  { id: "eur", label: "Euro" },
  { id: "mxn", label: "Mexican peso" },
  { id: "usdc", label: "USDC" },
];

function Row({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  const empty = !value || value === "—";
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-[13px] text-subtle">{label}</p>
        <p className={cn("mt-0.5 text-[15px] leading-snug break-all", empty ? "text-subtle" : "text-[#9ec1ff]")}>{value || "—"}</p>
      </div>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        disabled={empty}
        onClick={onCopy}
        className="mt-4 grid size-8 shrink-0 place-items-center text-[#9ec1ff] disabled:opacity-30"
      >
        <Copy className="size-4" />
      </button>
    </div>
  );
}

export function AccountDetails({ owner }: { owner: string }) {
  const [ccy, setCcy] = useState<Ccy>("usd");
  const [lane, setLane] = useState<Lane>("local");
  const [busy, setBusy] = useState(false);
  const [book, setBook] = useState<Partial<Record<"usd" | "eur" | "mxn", IssuedAccount>>>({});

  const issued = ccy === "usdc" ? null : book[ccy] ?? null;

  async function copy(text: string) {
    if (!text || text === "—") return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied.");
    } catch {
      toast.error("Could not copy.");
    }
  }

  async function open() {
    if (ccy === "usdc") return;
    if (!owner) {
      toast.error("Connect the wallet. The dollars are sent there as USDC.");
      return;
    }
    setBusy(true);
    try {
      const res = await openReceiveAccount({ data: { wallet: owner, currency: ccy } });
      if (!res.ok) toast.error(res.error);
      else {
        setBook((prev) => ({ ...prev, [ccy]: res }));
        toast.success("The bank issued the number.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The account did not open.");
    } finally {
      setBusy(false);
    }
  }

  const rows = rowsFor(ccy, lane, owner, issued);

  async function share() {
    const text = rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "Account details", text });
      else await navigator.clipboard.writeText(text);
      toast.success(navigator.share ? "Shared." : "Copied the details.");
    } catch {
      /* cancelled */
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-2xl tracking-tight">Account details</h2>
      <div className="flex flex-wrap gap-2">
        {POCKETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setCcy(p.id)}
            className={cn(
              "min-h-9 rounded-full px-3 text-[13px] font-medium",
              ccy === p.id ? "bg-white/12 text-fg" : "text-muted",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {ccy !== "usdc" ? (
        <div className="grid grid-cols-2 rounded-full bg-white/6 p-1">
          {(["local", "international"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setLane(id)}
              className={cn(
                "min-h-9 rounded-full text-[13px] font-semibold capitalize",
                lane === id ? "bg-white/14 text-fg" : "text-muted",
              )}
            >
              {id}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-[22px] border border-white/10 bg-[#141414] px-4 py-2">
        <p className="pt-3 text-[13px] text-subtle">
          {ccy === "usdc" ? "On Solana. This one already works." : lane === "local" ? "For domestic transfers only" : "For international transfers"}
        </p>
        <div className="divide-y divide-white/8">
          {rows.map((r) => (
            <Row key={r.label} label={r.label} value={r.value} onCopy={() => void copy(r.value)} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => void share()}
          className="mb-3 mt-1 min-h-11 w-full rounded-full bg-white/8 text-[14px] font-semibold"
        >
          Share details
        </button>
        {ccy !== "usdc" && !issued ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void open()}
            className="mb-3 min-h-11 w-full rounded-full bg-accent text-[14px] font-semibold text-accent-fg"
          >
            {busy ? "Asking the bank…" : "Open this account"}
          </button>
        ) : null}
      </div>

      <div className="flex gap-3 rounded-[22px] border border-white/10 bg-[#141414] px-4 py-4">
        <Landmark className="mt-0.5 size-5 shrink-0 text-subtle" />
        <p className="text-[13px] leading-snug text-muted">
          When the number is open, the dollars sit at Lead Bank, Member FDIC, the same partner bank Revolut uses in the US. Insurance is the bank’s, up to $250,000. Senda does not hold the deposit. Bridge turns it into USDC and sends it to the wallet. A Visa, if you add one, is issued by Rain against that USDC. A one-time card is a scoped Rain card: one merchant, one amount, then the number dies. This screen does not paint either number.
        </p>
      </div>
    </section>
  );
}

function rowsFor(ccy: Ccy, lane: Lane, owner: string, issued: IssuedAccount | null) {
  if (ccy === "usdc") {
    return [
      { label: "Network", value: "Solana" },
      { label: "Asset", value: "USDC" },
      { label: "Address", value: owner || "Connect the wallet" },
    ];
  }
  if (!issued) {
    return [
      { label: "Beneficiary", value: "—" },
      { label: "Account", value: "—" },
      { label: lane === "international" ? "SWIFT / BIC" : "ACH routing number", value: "—" },
      { label: "Wire routing number", value: "—" },
      { label: "Bank name and address", value: "—" },
    ];
  }
  if (lane === "international" || ccy !== "usd") {
    return [
      { label: "Beneficiary", value: issued.beneficiary || "—" },
      { label: ccy === "usd" ? "Account" : "IBAN / account", value: issued.iban || issued.account },
      { label: "SWIFT / BIC", value: issued.bic || issued.wire || "—" },
      { label: "Bank name and address", value: [issued.bank, issued.address].filter(Boolean).join("\n") || "—" },
    ];
  }
  return [
    { label: "Beneficiary", value: issued.beneficiary || "—" },
    { label: "Account", value: issued.account },
    { label: "ACH routing number", value: issued.routing || "—" },
    { label: "Wire routing number", value: issued.wire || "—" },
    { label: "Bank name and address", value: [issued.bank, issued.address].filter(Boolean).join(", ") || "—" },
  ];
}
