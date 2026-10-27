import type { DocBook } from "./types";

export const pay: DocBook = {
  id: "pay",
  label: "Pay",
  lede: "Pay is the desk where a card already on the computer is recognized, and where a store is paid only when a wallet signs USDC.",
  pages: [
    {
      id: "what",
      title: "What Pay is",
      body: [
        {
          h: "A desk, not a network",
          p: [
            "Pay is the name of the desk that used to be called Shop. The route is unchanged. The change is the job. A shop implied a catalog. The desk does not sell a catalog. It recognizes a card the computer already has, and it pays a destination the wallet can actually reach.",
            "The card and the payment are different objects. The card is a last-four and a seal kept in this browser. The payment is a Solana transaction. Confusing the two is how a screen starts to claim a charge it cannot clear. Pay is built so that the distinction stays on the screen.",
          ],
        },
        {
          h: "What remains underneath",
          p: [
            "The desks already wired stay on the same page. A funding wallet can be opened for cash and for MoonPay. Helio opens a pay link, or creates a charge when both of its keys are present. Flexa opens a payment page it has already returned. A cash machine is a map, not a fee. Receive is USDC into the connected wallet. Spend is a signature out of that wallet, toward a send, a PreStock, or a cover.",
            "None of those rails was replaced in order to add the card sheet. A later change that removes a signature in favor of a stored number would be a different product, and it is not this one.",
          ],
        },
      ],
    },
    {
      id: "sheet",
      title: "The card on this computer",
      body: [
        {
          h: "Why the number appears",
          p: [
            "Windows, Edge, and Chrome offer a virtual card when a page asks for a card number in the ordinary way. The fields are marked for a card, a name, an expiry, and a code. The browser, not Senda, decides whether to offer the Mastercard it already holds. If the person accepts, the digits arrive in the fields. Senda then checks the number, seals it, and keeps the last four. The full number and the code are not written down. The seal cannot be opened again, because the key that made it is not stored.",
            "Google Pay is the second door. The sheet is the Google Pay sheet in test mode. It can return a network and a last four. It does not return a charge, and Senda does not submit one. A merchant identifier and a processor would be required before that sheet could move money on a card network. Those are not present.",
          ],
        },
        {
          h: "What the last four is for",
          p: [
            "The last four tells the person which card they offered. It does not authorize a merchant. It does not increase a balance. It does not load a Revolut card, and it does not become the sixteen-digit number this desk can also draw for use on its own cash. That drawn number still does not clear at a store. The last four from the computer and the drawn number are not the same object, and the page does not treat them as one.",
          ],
        },
      ],
    },
    {
      id: "settle",
      title: "What actually settles",
      body: [
        {
          h: "USDC, signed",
          p: [
            "A payment leaves Pay only when Phantom signs. The destinations already on the desk are a Solana address, a PreStock buy through Jupiter, and a cover premium into the cover account. Each of those is a transaction the wallet can refuse. If it refuses, nothing is recorded as paid.",
            "The amount on the Google Pay sheet is a label for the sheet. It is not captured. A person can open the sheet for one dollar and still owe nothing to Senda, because Senda is not the merchant of record for that card.",
          ],
        },
        {
          h: "Funding is a different signature",
          p: [
            "Cash at a machine, MoonPay, and a new funding wallet put money onto an address. They do not pass through the card sheet. MoonPay locks the address into its page only when its secret is set. Until then the person pastes the address. A funding wallet is a Solana address whose key stays in this browser. MetaMask can be the destination for Base USDC. Phantom can be the destination for Solana USDC. The card on the computer is not a destination.",
          ],
        },
      ],
    },
    {
      id: "refused",
      title: "What Pay refuses",
      body: [
        {
          h: "No scheme charge",
          p: [
            "Pay does not clear Visa or Mastercard. It does not describe the Google Pay sheet as a purchase. It does not describe the Windows virtual card as a purchase. A processor, a merchant account, and a scheme authorization would be required, and none of those is claimed. Apple Pay is not offered. A Revolut virtual card is not loaded from this desk. Revolut spends a balance that already sits inside Revolut.",
            "Browser cash is not a payment. A ledger entry that never left this browser is not USDC and it is not a card authorization. The audit on the page says so, and a control that only moves that ledger is not labeled as paid.",
          ],
        },
        {
          h: "How to read a claim",
          p: [
            "A claim that a card was charged is false unless a scheme authorization code exists, and this desk does not have one. A claim that a store was paid is true only when a signature is on the chain. The last four is evidence of which card was offered. It is not evidence of either of those events. The paper stops at that line so the software cannot be described as more than it signs.",
          ],
        },
      ],
    },
  ],
};
