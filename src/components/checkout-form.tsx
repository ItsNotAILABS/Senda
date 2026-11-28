import { useEffect, useState } from "react";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const appearance = {
  theme: "stripe",
  labels: "auto",
  inputs: "spaced",
  variables: {
    borderRadius: "4px",
    colorBackground: "#ffffff",
    colorDanger: "#df1b41",
    colorPrimary: "#0570de",
    colorSuccess: "#00c853",
    colorText: "#30313d",
    fontFamily: "default",
    fontSizeBase: "16px",
    spacingUnit: "4px",
  },
} as const;

type ConfirmEvent = unknown;

type CheckoutFormSdk = {
  createForm: (opts: { layout: "expanded" }) => {
    mount: (selector: string) => void;
    on: (event: "confirm", handler: (event: ConfirmEvent) => void) => void;
  };
  loadActions: () => Promise<
    | { type: "success"; actions: { confirm: (opts: { formConfirmEvent: ConfirmEvent }) => Promise<void> } }
    | { type: string }
  >;
};

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => {
      initCheckoutFormSdk: (opts: { clientSecret: Promise<string>; appearance: typeof appearance }) => CheckoutFormSdk;
    };
  }
}

/** The publishable key mounts this form. The secret key creates the session. Stripe charges the card. */
export function CheckoutForm() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((link) => link.kind === "phantom" || link.kind === "solana")?.address ?? "";
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  const mode = publishableKey?.startsWith("pk_live_") ? "live" : publishableKey?.startsWith("pk_test_") ? "test" : "";
  const [usd, setUsd] = useState("25");
  const [name, setName] = useState("Senda card payment");
  const [secret, setSecret] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState("");
  const [paid, setPaid] = useState("");

  useEffect(() => {
    if (!secret || !publishableKey || !window.Stripe) return;
    const node = document.getElementById("checkout-form");
    if (node) node.replaceChildren();
    const stripe = window.Stripe(publishableKey);
    const checkout = stripe.initCheckoutFormSdk({ clientSecret: Promise.resolve(secret), appearance });
    const form = checkout.createForm({ layout: "expanded" });
    form.mount("#checkout-form");
    let live = true;
    void checkout.loadActions().then((loadActionsResult) => {
      if (!live || !("actions" in loadActionsResult)) return;
      form.on("confirm", async (event) => {
        try {
          await loadActionsResult.actions.confirm({ formConfirmEvent: event });
          if (!sessionId) return;
          const res = await fetch(`/api/checkout-status?id=${encodeURIComponent(sessionId)}`);
          const json = (await res.json()) as { paid?: boolean; amount?: number | null; error?: string };
          if (!live) return;
          if (json.paid && json.amount) setPaid(`Stripe marked $${(json.amount / 100).toFixed(2)} paid. No USDC was sent.`);
          else setPaid(json.error || "Submitted to Stripe. The payment is not marked paid yet. No USDC was sent.");
        } catch (error) {
          if (live) setPaid(error instanceof Error ? error.message : "Stripe did not confirm.");
        }
      });
    });
    return () => {
      live = false;
    };
  }, [secret, publishableKey, sessionId]);

  async function openForm() {
    setFault("");
    setPaid("");
    if (!publishableKey || !window.Stripe) {
      setFault("The publishable key is not on this page, so Stripe.js cannot open.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usd: Number(usd), name, wallet: owner }),
      });
      const json = (await res.json()) as { client_secret?: string; id?: string; error?: string };
      if (!res.ok || !json.client_secret || !json.id) throw new Error(json.error || "Stripe did not open a session.");
      setSessionId(json.id);
      setSecret(json.client_secret);
    } catch (error) {
      setFault(error instanceof Error ? error.message : "Stripe did not open a session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-white px-4 py-4 text-[#30313d]">
      <h2 className="text-xl font-semibold">Pay with a card</h2>
      <p className="mt-1 text-sm text-[#30313d]/70">
        {mode === "live"
          ? "The live publishable key opens Stripe’s form. The secret key, on the server, creates the charge. Stripe collects the card. This does not send USDC."
          : mode === "test"
            ? "The test publishable key opens Stripe’s form. The secret key creates the charge."
            : "The publishable key is not on this page."}
      </p>
      <label className="mt-3 block text-xs text-[#30313d]/60">
        What this payment is
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#30313d]/15 px-3 text-sm" />
      </label>
      <label className="mt-2 block text-xs text-[#30313d]/60">
        Dollars
        <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-xl border border-[#30313d]/15 px-3 font-mono text-sm" />
      </label>
      <button type="button" disabled={busy} onClick={() => void openForm()} className="mt-3 min-h-11 rounded-full bg-[#0570de] px-4 text-sm font-semibold text-white disabled:opacity-40">
        {busy ? "Asking Stripe" : "Open the card form"}
      </button>
      {fault ? <p className="mt-3 text-sm text-[#df1b41]">{fault}</p> : null}
      {paid ? <p className="mt-3 text-sm">{paid}</p> : null}
      <div id="checkout-form" className="mt-4 min-h-12" />
    </section>
  );
}
