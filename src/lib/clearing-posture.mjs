/** What this desk can say about cards and clearing. No invented PAN and no invented chain head. */

export const MASTERCARD_SECRET_NAMES = [
  "MASTERCARD_CONSUMER_KEY",
  "MASTERCARD_SIGNING_KEY",
  "MASTERCARD_ENTITY_ID",
  "MASTERCARD_REAL_CARD_ID",
];

export function clearingPosture() {
  return {
    parallax: {
      repo: "https://github.com/ItsNotAILABS/PARALLAX-Exchange-Clearinghouse",
      contract: "USMXCardRailReceiptRegistry",
      deployed: false,
      custody: false,
      note: "The contract anchors a receipt hash and rejects custody. This repo has no deployed address, so Senda does not read a chain head.",
    },
    stocklana: {
      repo: "https://github.com/ItsNotAILABS/Stocklana",
      panStored: false,
      note: "A one-time card leaves the issuer proxy. The ledger may store a hash of the provider token. It does not store a PAN or a CVV. This worker does not host that file ledger.",
    },
    mastercard: {
      secrets: MASTERCARD_SECRET_NAMES,
      note: "A virtual card is a Commercial Connect wrap of a registered real card. The button stays closed until those four worker secrets are set.",
    },
    monad: {
      chainId: 143,
      signed: false,
      note: "LI.FI has no Monad route. Wrapped MON on Solana is the market this desk can sign.",
    },
  };
}
