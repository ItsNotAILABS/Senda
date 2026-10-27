import type { DocBook } from "./types";

/** Research note and spec for the outside book. The functions are in market-engine.ts. */
export const outside: DocBook = {
  id: "outside",
  label: "Outside",
  lede: "How a euro, an ounce, and a bitcoin are read across Arbitrum, Base, and Solana without this desk taking either side.",
  pages: [
    {
      id: "split",
      title: "The split",
      body: [
        {
          h: "Outside money is already a market",
          p: [
            "Foreign exchange is the largest market that exists. Gold and silver have prices that do not come from a token launch. Bitcoin, ether, and SOL already trade in more than one wrapper. The work is not to invent a price for them. The work is to stop pretending that the print, the margined position, and the thing you can keep are one object, just because a screen can put them on one row.",
            "Those three facts are already published, on chains that were not built to agree with each other. Ostium publishes a bid, an ask, a mid, and an open flag for FX and metals from Arbitrum. Avantis publishes, from Base, the open fee, the leverage cap, the open interest, the interest cap, a minimum position, an hourly funding percent, and a rollover figure. On Solana, Jupiter will quote a mint when one exists: Circle's euro, Paxos gold, Portal bitcoin, Portal ether, and SOL itself. Senda reads those three feeds. It does not average them into a fourth price.",
          ],
        },
        {
          h: "Why a desk is still the missing piece",
          p: [
            "A person who wants the euro can already do three different things, on three different sites, and none of those sites will tell them the difference. They can buy a euro token and keep it. They can post USDC margin against the euro-dollar print and be liquidated if they are wrong. They can look at a bid and an ask and never trade. Collapsing those into one button called Buy is how a desk becomes a brochure.",
            "The desk's job is the sentence between the feeds. Here is the print. Here is what it costs, in basis points, to cross it and to open on Base. Here is whether their book still has room for that size. Here is the mint, if you would rather hold the thing. Here is the gap between the mint and the print. The signature, when there is one, goes to the venue that already runs the market.",
          ],
        },
      ],
    },
    {
      id: "objects",
      title: "Three objects",
      body: [
        {
          h: "Print",
          p: [
            "The print is Ostium's bid and ask. A long crosses the ask. A short crosses the bid. The spread in basis points is the absolute distance from the mid to that price, divided by the mid, times ten thousand. If they say the pair is shut, the numbers stay on the row and the ticket says shut. This desk does not build Ostium's transaction. A button that claimed to would be a lie, so there isn't one.",
          ],
        },
        {
          h: "Perp",
          p: [
            "The perp is a position on Avantis, collateralized in USDC on Base, chain 8453. Leverage is theirs. The cap on the ticket is the cap they publish, not a number chosen for comfort. The open fee they publish is in percent: 0.02 is two basis points, not two percent. Adding that fee to the spread is the all-in cost to get on, before funding. The position is not a token in the wallet. Closing it is another transaction on their contract.",
          ],
        },
        {
          h: "Hold",
          p: [
            "The hold is a mint. A buy is a Jupiter route, signed by the Solana wallet, and the tokens remain in that wallet. EURC is one euro. PAXG tracks one ounce. Portal BTC is bitcoin that can sit on Solana. None of these is the perp, and none of them is scored in basis points against the perp as if the trades were substitutes. The comparison that is allowed is the basis: the mint's price minus the print, in basis points of the print. Positive means the token is rich. That gap is shown. It is not called an arbitrage, because an arbitrage would require both legs to be signable, in size, at the same moment, after fees.",
          ],
        },
      ],
    },
    {
      id: "gates",
      title: "Size, room, and carry",
      body: [
        {
          h: "What blocks a signature",
          p: [
            "Notional is margin times leverage. Avantis publishes a minimum position in USDC. If the notional is under that minimum, the signature is refused here, before the wallet opens. They also publish open interest and a cap. Room is the cap minus the interest, floored at zero. A notional larger than the room is refused for the same reason. A missing figure does not become a zero, and it does not become permission. A missing minimum means that check is skipped. A missing cap means the room check is skipped. The other checks still run.",
          ],
        },
        {
          h: "Funding, and what is not funding",
          p: [
            "Avantis publishes fundingFeePerHourP. The name is the unit: percent per hour. The dollar magnitude over a stated number of hours is notional times that percent, over one hundred, times the hours. Who pays is their contract. The ticket shows the percent and, when it is not zero, the eight-hour magnitude. It does not assign the payment to the long or the short.",
            "They also publish marginFee, a long figure and a short figure, on the same pair. The name does not say the period. Those numbers are stored and they are not turned into dollars. Annualizing a rollover whose clock you have not read is how a research note becomes a brochure. When the period is in the field, the conversion is in the engine. When it is not, the conversion is absent.",
          ],
        },
        {
          h: "The liquidation preview",
          p: [
            "The liquidation on the ticket is a preview. Maintenance is taken as half the margin posted. At five times leverage, half the margin is ten percent of notional, so a long previews a liquidation ten percent under the entry and a short ten percent over. The formula is the entry times one minus one-half over leverage, for a long, and one plus that fraction for a short. Avantis decides the real liquidation. The preview exists so a person can see the distance before they sign, not so the desk can claim their risk engine.",
          ],
        },
      ],
    },
    {
      id: "crosses",
      title: "Derived prices",
      body: [
        {
          h: "Only when both legs exist",
          p: [
            "A cross is a product or a ratio of two mids that are already on the book. Euro-yen is euro-dollar times dollar-yen. Pound-yen is pound-dollar times dollar-yen. Pound-euro is pound-dollar divided by euro-dollar. Gold in euros is the ounce divided by euro-dollar. If either mid is missing, the cross is missing. It is labeled derived. It has no open interest, no fee, and no signature. It is there so a book of dollar pairs can be read as a book of crosses, which is how FX is actually used, without inventing a venue that does not exist.",
          ],
        },
      ],
    },
    {
      id: "signs",
      title: "What signs",
      body: [
        {
          h: "Two chains, and a third that only prints",
          p: [
            "Base. The desk asks Avantis's builder for the calldata, checks that the chain id is 8453, and hands it to the EVM wallet. If the USDC allowance is short of the margin, the approval is a separate signature first. After the trade signature returns, the hash is written on this machine as a record of what was signed. That list is not a balance, and it is not a position the desk can close. The position is on their contract. Clearing the site clears the note.",
            "Solana. Jupiter quotes the mint. The Solana wallet signs. The token arrives in that wallet. That is the hold.",
            "Arbitrum. The bid, the ask, and the open flag are live. The transaction is not built. Nothing on this page offers to sign it.",
            "Nothing in the outside book is a Senda balance. Nothing is matched against another user of this desk. The outside world keeps the market. This desk is where the chains are read together, and where the signature leaves from.",
          ],
        },
      ],
    },
    {
      id: "workspace",
      title: "The workspace",
      body: [
        {
          h: "Three panes, one pair",
          p: [
            "The left pane is the watchlist. The center is the candle chart for the timeframe you picked. The right pane is the order: margin, leverage, stop, take profit, and the bid and the ask. Under the three panes, the blotter is what this browser has signed, marked against the live print.",
            "Open pnl is the print minus the entry, divided by the entry, times the notional. A short flips the sign. That number is a mark. It is not cash, and this desk cannot close the position, because the position is on their contract. Distance to the preview liquidation is the absolute gap between the print and that preview, in basis points of the print. Both figures update when the print updates. Neither of them is their liquidation engine.",
          ],
        },
      ],
    },
    {
      id: "mainnet",
      title: "Mainnet",
      body: [
        {
          h: "What is already mainnet, and what is not a Senda chain",
          p: [
            "A buy of a PreStock, a USDC payment, and a Solana hold are mainnet-beta transactions of the wallet that signs them. The USDC mint on that path is the mainnet mint. A Base perp is chain id 8453, which is Base mainnet, and the wallet signs Avantis's contract there. The print for FX, metals, oil, indices, and softs is Ostium's live book. None of those signatures go to a Senda program. There is no Senda balance on any of them.",
            "A devnet deploy of an exercise program is not this path. It is not attached to the ticket. The plan for a later Senda program, if one is ever required, is a separate instruction the wallet still signs, on mainnet, after the same quote. Until that instruction exists and a user can inspect it, the desk does not pretend the program is the product. Adding an index, a soft, or another coin means the same test: a live print, and a signature on a chain that already trades it. If only the print exists, the chart shows it and the order button does not.",
          ],
        },
      ],
    },
  ],
};
