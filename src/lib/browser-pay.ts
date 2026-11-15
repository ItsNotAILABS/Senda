/** The card already on this computer. The sheet is not a charge. The number is not kept. */

const SCRIPT = "https://pay.google.com/gp/p/js/pay.js";

type PayInfo = { cardDetails?: string; cardNetwork?: string };

type PayResult = { paymentMethodData?: { info?: PayInfo } };

type PaymentsClient = {
  loadPaymentData: (request: unknown) => Promise<PayResult>;
};

function client(): PaymentsClient | null {
  const google = (window as unknown as { google?: { payments?: { api?: { PaymentsClient?: new (o: { environment: string }) => PaymentsClient } } } }).google;
  const Ctor = google?.payments?.api?.PaymentsClient;
  return Ctor ? new Ctor({ environment: "TEST" }) : null;
}

function loadScript(): Promise<void> {
  if (client()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Pay did not load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Pay did not load."));
    document.head.appendChild(script);
  });
}

export async function openGooglePay(usd: number): Promise<{ last4: string; network: string }> {
  await loadScript();
  const pay = client();
  if (!pay) throw new Error("Google Pay is not in this browser.");
  const price = Math.max(1, usd).toFixed(2);
  const result = await pay.loadPaymentData({
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [
      {
        type: "CARD",
        parameters: {
          allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
          allowedCardNetworks: ["MASTERCARD", "VISA"],
        },
        tokenizationSpecification: {
          type: "PAYMENT_GATEWAY",
          parameters: { gateway: "example", gatewayMerchantId: "exampleGatewayMerchantId" },
        },
      },
    ],
    merchantInfo: { merchantName: "Senda" },
    transactionInfo: { totalPriceStatus: "FINAL", totalPrice: price, currencyCode: "USD", countryCode: "US" },
  });
  const info = result.paymentMethodData?.info;
  const last4 = String(info?.cardDetails || "").replace(/\D/g, "").slice(-4);
  if (!/^\d{4}$/.test(last4)) throw new Error("Google Pay did not return a card.");
  return { last4, network: info?.cardNetwork || "Card" };
}
