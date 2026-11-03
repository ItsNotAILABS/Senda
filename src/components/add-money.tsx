import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  ClipboardList,
  CreditCard,
  Landmark,
  Smartphone,
  Wallet,
  Banknote,
  X,
} from "lucide-react";
import { formatMoney, formatPan, sendaDeposit, type FundSource, type PayMethod } from "@/lib/wallet";
import { sealFunding } from "@/lib/card-mask";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Step = "list" | "card" | "bank" | "amount" | "ach" | "cash" | "mask" | "app";
type AppRail = "cashapp" | "chime" | "venmo";

const WAYS: { id: Step | "apple" | "usdc" | "sol"; title: string; blurb: string; icon: typeof CreditCard; app?: AppRail }[] = [
  { id: "mask", title: "One-time encrypted card", blurb: "We keep the last four. The number is sealed and dropped.", icon: CreditCard },
  { id: "app", app: "cashapp", title: "Cash App", blurb: "Your $cashtag only. Send to your Senda tag.", icon: Smartphone },
  { id: "app", app: "chime", title: "Chime", blurb: "Email or $Cashtag only. Send to your Senda tag.", icon: Smartphone },
  { id: "app", app: "venmo", title: "Venmo", blurb: "Your @handle only. Pay your Senda tag.", icon: Smartphone },
  { id: "apple", title: "Apple Pay", blurb: "Usually arrives instantly", icon: Smartphone },
  { id: "card", title: "Debit card", blurb: "Saved for later. Not one-time.", icon: CreditCard },
  { id: "cash", title: "Deposit cash", blurb: "At a deposit point near you", icon: Banknote },
  { id: "ach", title: "Regular bank transfer", blurb: "Send to your Senda account", icon: ArrowLeftRight },
  { id: "ach", title: "Direct deposit", blurb: "Give payroll these details", icon: ClipboardList },
  { id: "bank", title: "Connect a bank account", blurb: "Routing and account you type in", icon: Landmark },
  { id: "usdc", title: "USDC on Solana", blurb: "From Phantom", icon: Wallet },
  { id: "sol", title: "SOL", blurb: "Sell SOL into USD cash", icon: Wallet },
];

export function AddMoneyScreen({ onClose }: { onClose: () => void }) {
  const w = useWallet();
  const [step, setStep] = useState<Step>("list");
  const [source, setSource] = useState<FundSource>("card");
  const [app, setApp] = useState<AppRail>("cashapp");
  const [maskedToken, setMaskedToken] = useState<string | null>(null);
  const [raw, setRaw] = useState("250");
  const amount = Number(raw) || 0;

  function toAmount(src: FundSource) {
    setSource(src);
    setStep("amount");
  }

  function confirm() {
    const ccy = source === "sol" ? "SOL" : source === "usdc" ? "USDC" : "USD";
    const r =
      source === "masked" && maskedToken
        ? w.fundMasked(amount, maskedToken)
        : w.add(amount, ccy, source);
    if (!r.ok) toast.error(r.error);
    else {
      toast.success(`${formatMoney(amount, ccy)} added.`);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg text-fg">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-3 pb-6">
        <header className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (step === "list" ? onClose() : setStep("list"))}
            className="grid size-11 place-items-center rounded-full bg-elevated"
            aria-label={step === "list" ? "Close" : "Back"}
          >
            {step === "list" ? <X className="size-4" strokeWidth={1.75} /> : <ArrowLeft className="size-4" strokeWidth={1.75} />}
          </button>
          <h1 className="flex-1 text-center text-base font-semibold">
            {step === "list"
              ? "Add money"
              : step === "card"
                ? "Add a card"
                : step === "mask"
                  ? "One-time card"
                  : step === "app"
                    ? app === "cashapp"
                      ? "Cash App"
                      : app === "chime"
                        ? "Chime"
                        : "Venmo"
                    : step === "bank"
                      ? "Connect a bank"
                      : step === "ach"
                        ? "Your Senda account"
                        : step === "cash"
                          ? "Cash deposit"
                          : "Amount"}
          </h1>
          <span className="size-11" />
        </header>

        <div className="mt-6 flex-1 overflow-y-auto">
          {step === "list" ? (
            <List
              methods={w.w.methods}
              onPaper={() => {
                const r = w.add(250, "USD", "cash");
                if (!r.ok) toast.error(r.error);
                else {
                  toast.success("$250 paper cash in.");
                  onClose();
                }
              }}
              onSaved={(m) => {
                if (m.kind === "masked" && m.token) setMaskedToken(m.token);
                const src: FundSource =
                  m.kind === "bank"
                    ? "bank"
                    : m.kind === "apple"
                      ? "apple"
                      : m.kind === "usdc"
                        ? "usdc"
                        : m.kind === "masked"
                          ? "masked"
                          : m.kind === "cashapp" || m.kind === "chime" || m.kind === "venmo"
                            ? m.kind
                            : "card";
                toAmount(src);
              }}
              onWay={(id, rail) => {
                if (id === "apple") {
                  w.addApple();
                  toAmount("apple");
                } else if (id === "usdc") {
                  w.addUsdc();
                  toAmount("usdc");
                } else if (id === "sol") toAmount("sol");
                else if (id === "app" && rail) {
                  setApp(rail);
                  setStep("app");
                } else if (id === "card" || id === "bank" || id === "ach" || id === "cash" || id === "mask") setStep(id);
              }}
            />
          ) : null}
          {step === "mask" ? (
            <MaskForm
              onSave={async (pan, exp, cvv, name) => {
                const sealed = await sealFunding(pan, cvv);
                if ("error" in sealed) {
                  toast.error(sealed.error);
                  return;
                }
                const r = w.addMasked(sealed.last4, exp, name, sealed.token);
                if (!r.ok) toast.error(r.error);
                else {
                  setMaskedToken(sealed.token);
                  toast.success(`Masked ··${sealed.last4}. Number was not saved.`);
                  toAmount("masked");
                }
              }}
            />
          ) : null}
          {step === "app" ? (
            <AppForm
              app={app}
              tag={w.w.tag}
              onSave={(handle) => {
                const r = w.addApp(app, handle);
                if (!r.ok) toast.error(r.error);
                else toAmount(app);
              }}
            />
          ) : null}
          {step === "card" ? (
            <CardForm
              onSave={(pan, exp, cvv, name) => {
                const r = w.addCard(pan, exp, cvv, name);
                if (!r.ok) toast.error(r.error);
                else toAmount("card");
              }}
            />
          ) : null}
          {step === "bank" ? (
            <BankForm
              onSave={(bank, routing, account) => {
                const r = w.addBank(bank, routing, account);
                if (!r.ok) toast.error(r.error);
                else toAmount("bank");
              }}
            />
          ) : null}
          {step === "ach" ? <AchDetails tag={w.w.tag} onDone={() => toAmount("ach")} /> : null}
          {step === "cash" ? (
            <p className="text-sm text-muted">Enter how much you’ll drop at a deposit point. It credits when you confirm.</p>
          ) : null}
          {step === "amount" || step === "cash" ? (
            <Amount value={raw} onChange={setRaw} onConfirm={confirm} disabled={!(amount > 0)} />
          ) : null}
        </div>

        {step === "list" ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 min-h-12 rounded-full bg-fg text-base font-semibold text-bg"
          >
            Done
          </button>
        ) : null}
      </div>
    </div>
  );
}

function List({
  methods,
  onSaved,
  onWay,
  onPaper,
}: {
  methods: PayMethod[];
  onSaved: (m: PayMethod) => void;
  onWay: (id: (typeof WAYS)[number]["id"], app?: AppRail) => void;
  onPaper: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onPaper}
        className="min-h-16 rounded-2xl bg-accent px-4 py-3 text-left text-accent-fg"
      >
        <span className="block text-sm font-semibold">Paper $250</span>
        <span className="block text-xs opacity-80">One tap. Not a bank. Use the book now.</span>
      </button>
      {methods.length > 0 ? (
        <div>
          <p className="mb-2 px-1 text-xs font-medium tracking-wide text-subtle uppercase">Yours</p>
          <ul className="overflow-hidden rounded-2xl bg-elevated">
            {methods.map((m, i) => (
              <li key={m.id} className={cn(i > 0 && "border-t border-border")}>
                <button
                  type="button"
                  onClick={() => onSaved(m)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 text-left"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-bg">
                    {m.kind === "bank" ? (
                      <Building2 className="size-4" strokeWidth={1.75} />
                    ) : m.kind === "apple" ? (
                      <Smartphone className="size-4" strokeWidth={1.75} />
                    ) : m.kind === "usdc" ? (
                      <Wallet className="size-4" strokeWidth={1.75} />
                    ) : (
                      <CreditCard className="size-4" strokeWidth={1.75} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{m.label}</span>
                    {m.expiry ? <span className="block text-xs text-muted">{m.expiry}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="mb-2 px-1 text-xs font-medium tracking-wide text-subtle uppercase">Ways to add</p>
        <ul className="overflow-hidden rounded-2xl bg-elevated">
          {WAYS.map((m, i) => {
            const Icon = m.icon;
            return (
              <li key={`${m.title}-${i}`} className={cn(i > 0 && "border-t border-border")}>
                <button
                  type="button"
                  onClick={() => onWay(m.id, m.app)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 text-left"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-bg">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{m.title}</span>
                    <span className="block text-xs text-muted">{m.blurb}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "text" | "decimal";
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-subtle">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode === "text" ? undefined : inputMode}
        autoComplete={autoComplete}
        className="min-h-12 rounded-2xl bg-elevated px-4 text-base outline-none placeholder:text-subtle"
      />
    </label>
  );
}

function MaskForm({
  onSave,
}: {
  onSave: (pan: string, expiry: string, cvv: string, name: string) => void;
}) {
  const [pan, setPan] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");

  function expiry(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const snap = { pan, exp, cvv, name };
        setPan("");
        setCvv("");
        onSave(snap.pan, snap.exp, snap.cvv, snap.name);
      }}
    >
      <p className="text-sm text-muted">
        Used once to add cash. The number is encrypted in this tab, then dropped. Senda stores ·· and a token, not the card.
      </p>
      <Field label="Card number" value={pan} onChange={(v) => setPan(formatPan(v))} placeholder="ACCT-000003" inputMode="numeric" autoComplete="cc-number" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry" value={exp} onChange={(v) => setExp(expiry(v))} placeholder="MM/YY" inputMode="numeric" autoComplete="cc-exp" />
        <Field label="CVV" value={cvv} onChange={(v) => setCvv(v.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" autoComplete="cc-csc" />
      </div>
      <Field label="Name on card" value={name} onChange={setName} placeholder="Name" autoComplete="cc-name" />
      <button type="submit" className="mt-2 min-h-12 rounded-full bg-fg text-base font-semibold text-bg">
        Seal and continue
      </button>
    </form>
  );
}

function AppForm({
  app,
  tag,
  onSave,
}: {
  app: AppRail;
  tag: string;
  onSave: (handle: string) => void;
}) {
  const [handle, setHandle] = useState("");
  const label = app === "cashapp" ? "$cashtag" : app === "venmo" ? "@handle" : "Email or $Cashtag";
  const hint =
    app === "cashapp"
      ? `In Cash App, pay ${tag}. We never see the card behind it.`
      : app === "chime"
        ? `In Chime, pay ${tag}. We store the handle you type, nothing else.`
        : `In Venmo, pay ${tag}. We store @handle only.`;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(handle);
      }}
    >
      <p className="text-sm text-muted">{hint}</p>
      <Field label={label} value={handle} onChange={setHandle} placeholder={label} autoComplete="off" />
      <button type="submit" className="mt-2 min-h-12 rounded-full bg-fg text-base font-semibold text-bg">
        Continue
      </button>
    </form>
  );
}

function CardForm({
  onSave,
}: {
  onSave: (pan: string, expiry: string, cvv: string, name: string) => void;
}) {
  const [pan, setPan] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");

  function expiry(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(pan, exp, cvv, name);
      }}
    >
      <Field label="Card number" value={pan} onChange={(v) => setPan(formatPan(v))} placeholder="ACCT-000003" inputMode="numeric" autoComplete="cc-number" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry" value={exp} onChange={(v) => setExp(expiry(v))} placeholder="MM/YY" inputMode="numeric" autoComplete="cc-exp" />
        <Field label="CVV" value={cvv} onChange={(v) => setCvv(v.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" autoComplete="cc-csc" />
      </div>
      <Field label="Name on card" value={name} onChange={setName} placeholder="Name" autoComplete="cc-name" />
      <button type="submit" className="mt-2 min-h-12 rounded-full bg-fg text-base font-semibold text-bg">
        Save card
      </button>
    </form>
  );
}

function BankForm({
  onSave,
}: {
  onSave: (bank: string, routing: string, account: string) => void;
}) {
  const [bank, setBank] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(bank, routing, account);
      }}
    >
      <Field label="Bank name" value={bank} onChange={setBank} placeholder="Your bank" />
      <Field label="Routing number" value={routing} onChange={(v) => setRouting(v.replace(/\D/g, "").slice(0, 9))} placeholder="9 digits" inputMode="numeric" />
      <Field label="Account number" value={account} onChange={(v) => setAccount(v.replace(/\D/g, "").slice(0, 17))} placeholder="Account" inputMode="numeric" />
      <button type="submit" className="mt-2 min-h-12 rounded-full bg-fg text-base font-semibold text-bg">
        Connect bank
      </button>
    </form>
  );
}

function AchDetails({ tag, onDone }: { tag: string; onDone: () => void }) {
  const d = sendaDeposit(tag);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">These are your Senda deposit details — not a bank you already have. Wire or ACH here, then enter the amount.</p>
      <dl className="rounded-2xl bg-elevated px-4 py-4 text-sm">
        <div className="flex justify-between py-2">
          <dt className="text-muted">Bank</dt>
          <dd className="font-medium">{d.bank}</dd>
        </div>
        <div className="flex justify-between border-t border-border py-2">
          <dt className="text-muted">Routing</dt>
          <dd className="font-mono tabular-nums">{d.routing}</dd>
        </div>
        <div className="flex justify-between border-t border-border py-2">
          <dt className="text-muted">Account</dt>
          <dd className="font-mono tabular-nums">{d.account}</dd>
        </div>
      </dl>
      <button type="button" onClick={onDone} className="min-h-12 rounded-full bg-fg text-base font-semibold text-bg">
        I’ve sent it
      </button>
    </div>
  );
}

function Amount({
  value,
  onChange,
  onConfirm,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 pt-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-subtle">Amount · USD</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          className="min-h-16 rounded-2xl bg-elevated px-4 text-3xl font-semibold tabular-nums outline-none"
        />
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={onConfirm}
        className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40"
      >
        Add {value ? formatMoney(Number(value) || 0) : ""}
      </button>
    </div>
  );
}
