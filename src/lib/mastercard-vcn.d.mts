export const SANDBOX: string;
export const PRODUCTION: string;

export function rfc3986(value: unknown): string;
export function baseStringUri(raw: string): string;

export function oauthHeader(input: {
  method: string;
  url: string;
  body?: string;
  consumerKey: string;
  privateKeyPem: string;
  nonce?: string;
  timestamp?: number;
}): string;

export function oneTimeBody(input: {
  entityId: string;
  realCardId: string;
  spendUsd: number;
  now?: number;
  hours?: number;
}): {
  entityId: string;
  cardDetails: { cardExpiration: string; realCardId: string };
  cardControls: Array<{
    alias: string;
    transactionLimit: { spendAmount: number };
    continuousLimit: { transactionCount: number; spendAmount: number };
    validityPeriod: { startDate: string; endDate: string };
  }>;
};

export function readVirtualCard(body: unknown): {
  accountId: string;
  last4: string;
  expiry: string;
  pan: string;
  cvv: string;
  masked: boolean;
};

export function paymentOnAccount(input: {
  accountId: string;
  supplierId?: string;
  email?: string;
  amount: number;
  debtorName: string;
  country: string;
  postalCode: string;
  requestedExecutionDate: string;
  endToEndId?: string;
}): Record<string, unknown>;

export function readPayment(body: unknown): { paymentId: string; status: string };

export function connectConfig(env: Record<string, string | undefined> | undefined): {
  ready: boolean;
  missing: string[];
  base: string;
  consumerKey: string;
  privateKeyPem: string;
  entityId: string;
  realCardId: string;
};
