/** The outside book. Shown on Docs. The math it describes is in market-engine.ts. */

export const OUTSIDE = {
  id: "outside",
  label: "Outside",
  lede: "How a euro, an ounce, and a bitcoin sit on more than one chain without Senda taking either side.",
  pages: [
    {
      id: "problem",
      title: "The split",
      body: [
        {
          h: "Outside money is not one mint",
          p: [
            "A euro, an ounce of gold, and a bitcoin are already traded. They are not waiting for a new token. What they do not have is one place that can say, at the same time, what the print is, what a margined position costs, and what it costs to hold the thing itself.",
            "Those three facts live on different chains, because the venues that already do the work were built there. Ostium prints FX and metals on Arbitrum. Avantis runs the perp on Base, in USDC, and publishes the fee, the leverage cap, and the open interest. On Solana, a few of the same underlyings exist as mints you can actually keep: Circle's euro, Paxos gold, Portal bitcoin, Portal ether.",
            "Senda does not invent a fourth price. It reads the ones that are already live and refuses to merge them into a single fake instrument.",
          ],
        },
      ],
    },
    {
      id: "objects",
      title: "Three objects",
      body: [
        {
          h: "Print, perp, hold",
          p: [
            "The print is a bid and an ask. On this desk that print is Ostium's. Crossing it means buying the ask or selling the bid. The distance from the mid, in basis points, is the spread you pay. If Ostium says the pair is shut, the print is still shown and the ticket says so.",
            "The perp is a margined position. Collateral is USDC on Base. Leverage is theirs, up to the cap they publish for that pair. The open fee they publish is in percent: 0.02 is two basis points, not two percent. The position is not a token in the wallet. Closing it is a second transaction on their contract.",
            "The hold is a mint. A buy is a Jupiter route from USDC, signed by the Solana wallet, and the token stays in that wallet. EURC is one euro. PAXG tracks one ounce. Portal BTC is bitcoin that can sit on Solana. None of these is the perp. The basis between the hold and the print is the point of showing both.",
          ],
        },
      ],
    },
    {
      id: "router",
      title: "The router",
      body: [
        {
          h: "All-in, in basis points",
          p: [
            "For a long, the spread is the ask minus the mid, divided by the mid, in basis points. For a short, the bid. The Base door adds the open fee. That sum is the all-in cost to get on, before funding. Funding is a separate meter and is not folded in, because the hold period is not known at the click.",
            "Arbitrum is scored on spread alone. It is the print. This desk does not yet build Ostium's transaction, so that door does not sign. If Arbitrum is tighter than Base, the ticket says so, and the signature still offered is the one that can be built: Avantis on Base, or the Solana hold.",
            "The Solana hold is not given a basis-point score against the perp. It is a different object. Comparing them as if they were the same trade is how a desk lies.",
          ],
        },
      ],
    },
    {
      id: "margin",
      title: "Margin, as a preview",
      body: [
        {
          h: "Half the margin",
          p: [
            "The liquidation number on the ticket is a preview, not their contract. Maintenance is taken as half the margin you post. At 5x, half the margin is ten percent of notional, so a long previews a liquidation ten percent under the entry, and a short ten percent over. The formula is entry times one minus 0.5 over leverage for a long, and one plus that for a short.",
            "Avantis decides the real liquidation. Their max leverage, their minimum notional, and their fee are read from their book and enforced before the button will build a transaction. If the position is under their minimum, the signature is refused here, not after the wallet opens.",
            "Senda does not lend the margin and does not hold the USDC. The approval and the open are two transactions, both signed by the EVM wallet, both on Base mainnet, chain 8453.",
          ],
        },
      ],
    },
    {
      id: "basis",
      title: "Basis and crosses",
      body: [
        {
          h: "When the token and the perp disagree",
          p: [
            "Basis is the Solana hold minus the perp mid, in basis points of the mid. Positive means the token is rich to the print. That gap is the thing a desk is for. It is not rounded away, and it is not called an arbitrage. An arbitrage would require both legs to be signable in size, at the same moment, after fees. Often only one leg is.",
            "A cross is built only when both legs have a mid. Euro-yen is euro-dollar times dollar-yen. Pound-euro is pound-dollar over euro-dollar. Gold in euros is the ounce over euro-dollar. The cross is labeled derived. It is not a venue, it has no open interest, and it does not sign. If a leg is missing, the cross is missing.",
          ],
        },
      ],
    },
    {
      id: "signs",
      title: "What actually signs",
      body: [
        {
          h: "Two signatures, and one that does not",
          p: [
            "Base: the desk asks Avantis's builder for the calldata, checks the chain id is 8453, and hands it to the EVM wallet. If the USDC allowance is short, the approval is a separate signature first. Senda never sees the key.",
            "Solana: Jupiter quotes the mint and the Solana wallet signs. The token arrives in that wallet. That is the hold.",
            "Arbitrum: the bid, the ask, and the open flag are live. The transaction is not built here yet. The ticket does not offer a button that pretends otherwise.",
            "Nothing in this book is a Senda balance. Nothing is matched against another Senda user. The outside world keeps the market. This desk is the place the chains are read together, and the place the signature leaves from.",
          ],
        },
      ],
    },
  ],
};
