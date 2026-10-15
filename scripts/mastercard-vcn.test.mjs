import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import test from "node:test";
import { baseStringUri, connectConfig, oauthHeader, oneTimeBody, paymentOnAccount, readVirtualCard, rfc3986 } from "../src/lib/mastercard-oauth.mjs";

test("a one-time card allows a single authorization for the cap", () => {
  const body = oneTimeBody({
    entityId: "entity",
    realCardId: "real",
    spendUsd: 40,
    now: Date.parse("2026-10-10T00:00:00.000Z"),
    hours: 24,
  });
  assert.equal(body.cardControls[0].continuousLimit.transactionCount, 1);
  assert.equal(body.cardControls[0].continuousLimit.spendAmount, 40);
  assert.equal(body.cardControls[0].transactionLimit.spendAmount, 40);
  assert.ok(body.cardControls[0].validityPeriod.startDate > "2026-10-10T00:00:00.000Z");
});

test("a masked mastercard number is not completed", () => {
  const masked = readVirtualCard({ accountId: "acct", cardDetails: { cardNumber: "xxxxxxxxxxxx4456", cvv: "123", cardExpiration: "2031-11" } });
  assert.equal(masked.masked, true);
  assert.equal(masked.pan, "");
  assert.equal(masked.cvv, "");
  assert.equal(masked.last4, "4456");
  const full = readVirtualCard({ accountId: "acct", cardDetails: { cardNumber: "5234567890123456", cvv: "123", cardExpiration: "2031-11" } });
  assert.equal(full.masked, false);
  assert.equal(full.pan, "5234567890123456");
  assert.equal(full.cvv, "123");
});

test("a payment names one creditor and the address the person typed", () => {
  const body = paymentOnAccount({
    accountId: "acct",
    email: "supplier@example.com",
    amount: 18,
    debtorName: "Ada",
    country: "US",
    postalCode: "10001",
    requestedExecutionDate: "2026-10-10",
    endToEndId: "senda1",
  });
  assert.equal(body.existingCard.cardType, "VIRTUAL");
  assert.equal(body.email, "supplier@example.com");
  assert.equal(body.supplierId, undefined);
  assert.throws(() => paymentOnAccount({ accountId: "acct", email: "a@b.co", supplierId: "s", amount: 1, debtorName: "A", country: "US", postalCode: "1", requestedExecutionDate: "2026-10-10" }));
});

test("commercial connect stays disconnected until the four credentials exist", () => {
  const empty = connectConfig({});
  assert.equal(empty.ready, false);
  assert.equal(empty.base.includes("sandbox"), true);
  const ready = connectConfig({
    MASTERCARD_CONSUMER_KEY: "key",
    MASTERCARD_SIGNING_KEY: "pem",
    MASTERCARD_ENTITY_ID: "entity",
    MASTERCARD_REAL_CARD_ID: "real",
  });
  assert.equal(ready.ready, true);
});

test("the oauth header is an rsa-sha256 signature over the body hash", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const url = "https://sandbox.apiedge.mastercard.com/commercial/accounts/virtual-cards";
  const body = "{\"a\":1}";
  const header = oauthHeader({ method: "POST", url, body, consumerKey: "consumer", privateKeyPem: pem, nonce: "nonce", timestamp: 1700000000 });
  assert.match(header, /^OAuth /);
  assert.match(header, /oauth_signature_method="RSA-SHA256"/);
  assert.equal(rfc3986("a b*"), "a%20b%2A");
  assert.equal(baseStringUri(url), "https://sandbox.apiedge.mastercard.com/commercial/accounts/virtual-cards");
  const take = (name) => decodeURIComponent(header.match(new RegExp(`${name}="([^"]+)"`))[1]);
  const signature = take("oauth_signature");
  const bodyHash = take("oauth_body_hash");
  const params = [
    ["oauth_body_hash", bodyHash],
    ["oauth_consumer_key", "consumer"],
    ["oauth_nonce", "nonce"],
    ["oauth_signature_method", "RSA-SHA256"],
    ["oauth_timestamp", "1700000000"],
    ["oauth_version", "1.0"],
  ]
    .map(([key, value]) => `${rfc3986(key)}=${rfc3986(value)}`)
    .join("&");
  const base = `POST&${rfc3986(baseStringUri(url))}&${rfc3986(params)}`;
  assert.equal(createVerify("RSA-SHA256").update(base).verify(publicKey, signature, "base64"), true);
});
