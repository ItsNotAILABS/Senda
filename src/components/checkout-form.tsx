import { useEffect } from "react";

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

/** Embedded Checkout form. Stripe.js is loaded from js.stripe.com, not bundled. */
export function CheckoutForm() {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

  useEffect(() => {
    if (!publishableKey || !window.Stripe) return;
    const stripe = window.Stripe(publishableKey);
    const clientSecret = fetch("/api/create-checkout-session", { method: "POST" })
      .then((response) => response.json())
      .then((json: { client_secret?: string }) => json.client_secret ?? "");
    const checkout = stripe.initCheckoutFormSdk({ clientSecret, appearance });
    const form = checkout.createForm({ layout: "expanded" });
    form.mount("#checkout-form");
    let live = true;
    void checkout.loadActions().then((loadActionsResult) => {
      if (!live || !("actions" in loadActionsResult)) return;
      form.on("confirm", async (event) => {
        try {
          await loadActionsResult.actions.confirm({ formConfirmEvent: event });
        } catch (error) {
          console.error("Payment confirmation error:", error);
        }
      });
    });
    return () => {
      live = false;
    };
  }, [publishableKey]);

  return (
    <section className="rounded-[22px] border border-white/10 bg-white px-4 py-4 text-[#30313d]">
      <h2 className="text-xl font-semibold">Pay with a card</h2>
      <p className="mt-1 text-sm text-[#30313d]/70">One-time checkout. The form is Stripe’s. The price id is still a placeholder.</p>
      {!publishableKey ? <p className="mt-3 text-sm text-[#df1b41]">VITE_STRIPE_PUBLISHABLE_KEY is not set.</p> : null}
      <div id="checkout-form" className="mt-4 min-h-24" />
    </section>
  );
}
