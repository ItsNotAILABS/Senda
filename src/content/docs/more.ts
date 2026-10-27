import type { DocBook } from "./types";

const p = (h: string, a: string, b: string) => ({ h, p: [a, b] });

export const moreBooks: DocBook[] = [
  {
    id: "markets",
    label: "Markets",
    lede: "What the book is, when it is open, and which numbers on a row are a trade and which are a reference.",
    pages: [
      {
        id: "hours",
        title: "Hours",
        body: [
          p(
            "The chain does not close",
            "A PreStock mint is an SPL token. It can change hands whenever Solana accepts a transaction. There is no opening bell and no closing auction on this desk. A brokerage session is a different market, with a different record, and it is shut when that venue is shut. If you are looking at this book at midnight, the last print is still the last print.",
            "Open all night is not the same as liquid all night. A route exists when Jupiter can find one. Some hours a modest size clears. Some hours it does not. The desk does not invent a fill to cover a quiet hour, and it does not take the other side so that the screen can stay busy.",
          ),
          p(
            "What a row is",
            "A row is one mint. It has a symbol, a name, a last price, a mark, and a premium of last versus mark. The last is a trade the feed reported. The mark is the token price implied by the wrapper's stated valuation. They are not the same number, and a page that collapses them is hiding the only spread this book can show.",
            "The mint address is the identity. Two screens that disagree about a symbol and agree about a mint are talking about the same token. Copy the mint when you need to check the token account yourself. The symbol is a label. The mint is the object.",
          ),
          p(
            "What the book is not",
            "This is not a national market system. There is no displayed depth, no market-maker obligation, and no auction. There is not a second venue inside Senda that crosses orders against each other. If the route fails, the buy fails.",
            "It is also not a statement from the company. The company did not print the last price. Holders of the token have economic exposure to a wrapper. They do not have a vote, a dividend, or an entry on the company's register.",
          ),
        ],
      },
      {
        id: "prints",
        title: "Prints and the index",
        body: [
          p(
            "Last, mark, change",
            "Last is the figure a sale has to beat. Mark is the reference. Premium is the difference, signed so a discount is not painted the same as a premium. The twenty-four hour change is the last against the open of that window. Those are the inputs a ticket is allowed to show.",
            "The chart draws a line from that open to that last. The bends in the middle are there so the line can be read. They are not ticks, and they are not candles. A window longer than twenty-four hours is not in this feed. The control says so instead of drawing a history the desk does not have.",
          ),
          p(
            "PRE8",
            "PRE8 weights the names on this book by mark value. One thousand means the set, taken together, trades at its marks. A name with a large stated valuation moves the index even when its pool is thin. Read it as a spread of the book to its own marks. Do not read it as a position.",
            "PRE8 is computed in the client from the rows already on the screen. It is not a mint. You cannot buy the index by signing a ticket labeled PRE8. A basket, when one is offered, is a set of routes into the underlying mints, and it is labeled as that.",
          ),
        ],
      },
    ],
  },
  {
    id: "orders",
    label: "Orders",
    lede: "A ticket is a size, a side, and a signature. It is not an order resting on a book.",
    pages: [
      {
        id: "ticket",
        title: "The ticket",
        body: [
          p(
            "What you set",
            "You pick a name and a dollar size. The sizes on the card are 25, 100, 250, and 1000. You can type another size where the ticket allows it. Buy spends USDC, or SOL routed through USDC, into the mint. Sell spends tokens you already hold, up to the dollar size, and not more than the wallet contains.",
            "There is no limit price you leave working overnight. There is no stop. There is no iceberg. The quote is for this size, now. If you do not sign, nothing is resting, and nothing will fill later on your behalf.",
          ),
          p(
            "What you are shown",
            "Before the wallet opens, the ticket shows the quote: what leaves, what is expected back, and a minimum. Impact over five percent is refused. The wallet is not asked. Ask for a smaller size. The desk will not widen the tolerance so that a bad route can proceed.",
            "The chain simulates the transaction. A route that would fail does not reach the wallet. You still read the prompt. The prompt is the wallet's, and it is the only place the signature happens.",
          ),
          p(
            "Partial and none",
            "A sell of a dollar size sells that many dollars of tokens at the live price, or the whole balance if the balance is smaller. A buy that the route cannot fill at the shown minimum does not get a silent partial from this desk. You either sign the quote or you do not.",
            "Buying three names is three signatures, one after another, not one order. If the second declines, the first still happened. The screen says how many of the three signed.",
          ),
        ],
      },
      {
        id: "refuse",
        title: "What is refused",
        body: [
          p(
            "Allowlist",
            "A route may use SOL, USDC, and the PreStock mints on this book. Anything else is not offered, even if a pool exists. This is not a general swap page. A token that is not a listed name does not get a ticket.",
            "A size over the spend cap on this browser is refused before the quote is treated as sendable. The cap is a local control. It stops the desk from asking. It does not stop you from signing a different transaction in the wallet itself.",
          ),
          p(
            "No house fill",
            "If Jupiter has no route, Senda does not fill you from inventory. There is no inventory. A screen that says the buy did not send is telling the truth. Retrying with a smaller size is the next step, not a call to a desk that can work the order.",
            "An agent can queue a ticket. It cannot sign one. A queued trade sits until you sign it. Closing the tab ends the shift. Nothing works the order after you leave.",
          ),
        ],
      },
    ],
  },
  {
    id: "settlement",
    label: "Settlement",
    lede: "A fill is a change in token accounts. Settlement is the chain accepting that transaction.",
    pages: [
      {
        id: "where",
        title: "Where it lands",
        body: [
          p(
            "The signer's account",
            "USDC leaves the wallet that signed. The PreStock mint arrives in that same wallet, in the associated token account for that mint. If the account does not exist yet, the transaction creates it and you pay the rent. Senda does not receive the tokens and forward them later.",
            "Portfolio reads those token accounts and multiplies by the last print. If the wallet is disconnected, the holdings line is empty even if this browser still shows cash. Cash in the browser is not the fill. The token account is the fill.",
          ),
          p(
            "The receipt",
            "The signature is the receipt. It opens on Solscan. The memo, when the action is a payment or a cover premium, is on that transaction. A toast that shows the first characters of a signature is a pointer. The chain is the record.",
            "A failed simulation never produces a signature. A declined prompt never produces one either. If you cannot find the signature, the buy did not happen, whatever the screen was doing while it waited.",
          ),
        ],
      },
      {
        id: "usdc",
        title: "USDC",
        body: [
          p(
            "The mint",
            "Payments and buy routes settle in USDC, mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v, six decimals. The instruction is transferChecked when the desk is paying an address. A buy is a Jupiter route that spends USDC, or SOL swapped toward USDC, and delivers the PreStock mint.",
            "SOL is not left as the position. If you pay with SOL, the route converts and then buys. You should see what leaves in SOL, what the route expects in the mint, and the minimum. If those figures are missing, do not sign.",
          ),
          p(
            "Finality",
            "Once the transaction is confirmed, the balances are the chain's. This desk does not reverse a fill, does not recall a token, and does not offer a chargeback. A mistake in the address or the size is a mistake you signed. Read the wallet prompt.",
            "Cover settlement is a second signature. The premium moving is not the payout. The payout, if you settle, can only return what the cover account holds. It is not paid out of a reserve this desk does not have.",
          ),
        ],
      },
    ],
  },
  {
    id: "risk",
    label: "Risk",
    lede: "The risks that belong to this instrument, stated as risks and not as a feature list.",
    pages: [
      {
        id: "wrapper",
        title: "Wrapper risk",
        body: [
          p(
            "Not the company",
            "You can lose the entire amount you put into a mint. The token is not a share. Issuers have voided unauthorized transfers of the vehicles that hold their stock. When that happens the chain still shows a balance, and the price has to find a buyer for a receipt the company will not honor. Drops on the order of a third of the price have followed those announcements.",
            "A mark that still shows the old valuation after such a refusal is a stale reference. The last print is the number a sale has to beat. Trust the last print over the mark when they diverge, and treat a wide premium as a question, not as a reason to buy.",
          ),
          p(
            "Thin markets",
            "Size that looks small next to a headline valuation can be large next to the pool. Impact over five percent is refused so that the ticket does not hide that. Under five percent you can still move the print, and you can still be unable to exit later at anything like the price you paid.",
            "There is no market-maker obligation and no Senda bid under the market. If you need to leave and nobody will take the other side, you hold the token. The desk cannot manufacture an exit.",
          ),
        ],
      },
      {
        id: "you",
        title: "Your risks",
        body: [
          p(
            "The signature",
            "You can sign the wrong size, the wrong name, or the wrong address. The wallet prompt is the check. A malicious browser wallet can lie about what it will sign. Install the wallet from its own source, and do not approve a prompt you did not just ask for.",
            "A local number, a note, or a cash balance in this browser can be cleared by clearing the site. That is not a loss of the token. The token is on chain. It is a loss of the journal, the note, and any number you had not already used.",
          ),
          p(
            "What this is not",
            "This is not a diversified fund, not advice, and not a recommendation of a name. The desk shows every listed mint the same way. Cheap versus the mark means the token is under the wrapper's reference. It does not mean the token is cheap.",
            "Cover is not insurance. A premium buys a signed term limited to the cash in the cover account. If that account cannot pay the figure on the label, it does not pay the figure on the label.",
          ),
        ],
      },
    ],
  },
  {
    id: "fees",
    label: "Fees",
    lede: "What you pay, to whom, and what this desk does not add.",
    pages: [
      {
        id: "who",
        title: "Who is paid",
        body: [
          p(
            "The network and the route",
            "A signature pays a Solana fee. A new token account pays rent, and that rent is yours. A Jupiter route includes the pool fee and any platform fee the quote already states. Those amounts are inside the quote. The minimum you are shown is after them.",
            "Senda does not add a commission on the ticket, and it does not take a cut of a USDC payment. A listing on Make pays the seller's address the whole amount. If a figure on a screen is called a fee and it is not in the quote, it is this browser's own ledger, not a charge on chain.",
          ),
          p(
            "The spread",
            "The difference between last and mark is not a fee. It is the market. The difference between what you pay and the minimum you receive is the route. Read both. Do not add them together and call the sum a Senda charge.",
            "A currency pocket in this browser that is not USDC converts at the rate the exchange screen shows, with no spread added on that screen. That conversion does not move chain assets unless you then sign a route. Revolut's weekend fee, where it is mentioned, is a comparison. It is not charged here.",
          ),
        ],
      },
      {
        id: "cap",
        title: "The cap",
        body: [
          p(
            "A local ceiling",
            "The spend cap defaults near one hundred dollars and can be raised on this browser up to five thousand. It is a limit on what the desk will ask you to sign. It is not a limit the chain enforces, and it is not a credit line.",
            "Raising the cap does not give you money. It lets a larger ticket reach the wallet. The wallet still needs the USDC or the SOL. If it does not, the quote fails or the signature fails, and the cap was never the problem.",
          ),
          p(
            "No other tariff",
            "There is no subscription on this desk, no per-ticket schedule, and no custody fee, because there is no custody. If a later version adds a fee, it has to be on the quote before you sign. A fee that appears only after the signature is not a fee this design allows.",
            "Rent for an account you create is not refunded by Senda when you later empty it. Recovering rent is a chain operation on that account, and it is yours to do.",
          ),
        ],
      },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    lede: "Two books. One is the chain. One is this browser. They are not added together.",
    pages: [
      {
        id: "journal",
        title: "The journal",
        body: [
          p(
            "What is written down",
            "Sends, receives, card charges, cover premiums, and buys that this account recorded are lines in the journal. Each line has a kind, a counterparty, an amount, a currency, and a status. A failed line is not replayed into cash.",
            "The digest replays that journal and compares it with the cash the account can still spend. Suspense is the gap. Zero means the books tie. A gap means a line and a balance disagree. It does not mean the chain is wrong. It means this browser's ledger does not match itself.",
          ),
          p(
            "Tokens in the digest",
            "The digest also keeps internal tokens for the currencies this account uses: a code, a role, a supply, and a dollar value. They are the app's own units. They are not SPL mints, and they are not something you can send to another wallet.",
            "Ghost is what a one-time number can still charge against browser cash. It is not a chain hold. Exporting this to a CPA is not built. The table is the table.",
          ),
        ],
      },
      {
        id: "chainbook",
        title: "The chain book",
        body: [
          p(
            "Portfolio",
            "Portfolio is tokens in the connected wallet times the last print. It ignores browser cash on purpose. Adding the two totals would double-count nothing and still be wrong, because they are different objects. One can be withdrawn by a signature. The other disappears if you clear the site.",
            "A wrap is a claim on USDC that stays in the wallet. Push sends the claim back. The wrap is counted once. If a screen shows both the USDC and the wrap as spendable, that screen is wrong.",
          ),
          p(
            "No statements",
            "There is no monthly statement, no cost basis lot file, and no tax form. The signatures on Solscan are the on-chain record. The journal is the local record. You can read both. Neither is a brokerage statement, because this is not a brokerage.",
            "Corporate actions are not applied here. A split, a dividend, or a conversion of a wrapper into listed stock would be an event this feed does not post. If one happens, the mint either still trades or it does not. The desk will not invent the adjustment.",
          ),
        ],
      },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    lede: "Who this market is for, which rule actually changed in 2026, and which product that rule does not cover.",
    pages: [
      {
        id: "who",
        title: "Who this is not for",
        body: [
          p(
            "Regulation S",
            "These wrappers are offered offshore under Regulation S. Official minting and redemption block U.S. addresses or ask for a non-U.S. declaration. Solana will still process a transfer. That does not make a U.S. person an intended buyer, and it does not lift the distribution compliance period, often forty days and sometimes a year.",
            "Senda does not onboard U.S. persons into these wrappers. The path for an American buyer remains Forge, EquityZen, and the accredited funds that sell private shares under U.S. rules. A wallet connection is not a representation that you are outside the United States. Do not treat it as one.",
          ),
          p(
            "No advice, no account",
            "Nothing on this desk is a recommendation, a solicitation, or investment advice. There is no customer account, no suitability check, and no KYC file, because the account is the wallet you already have. If a product needs a file on you, this repo does not have that product.",
            "The desk is not a broker-dealer, not a bank, not an insurer, and not a transfer agent. It does not hold customer funds. It prepares a transaction and stops at your signature.",
          ),
        ],
      },
      {
        id: "exemption",
        title: "The 2026 exemption",
        body: [
          p(
            "Listed stock",
            "The SEC's September 2026 Innovation Exemption lets real tokenized public stocks trade on chain with the rights of the share. Those stocks are already listed. The token carries voting and dividends. The venues are permissioned U.S. venues. That is a listed share on a new rail.",
            "Pre-IPO wrappers are outside that relief. They stay in the Regulation S lane. A sentence that cites the exemption and then shows a private-company mint is a category error. This book does not make it.",
          ),
          p(
            "What we will not claim",
            "We will not claim the token votes. We will not claim a conversion into listed shares at a rate. We will not claim the exemption covers the mint. We will not claim a U.S. retail offering. If a screen needs one of those sentences, the screen does not ship.",
            "Issuers have voided unauthorized SPV transfers. That fact stays in the research note and on the risk page. It is not softened into a footnote about volatility.",
          ),
        ],
      },
    ],
  },
  {
    id: "glossary",
    label: "Glossary",
    lede: "The words this desk uses, and the words it refuses.",
    pages: [
      {
        id: "words",
        title: "Words we use",
        body: [
          p(
            "Mint, last, mark",
            "A mint is the SPL address of the token. Last is the latest price the feed has. Mark is the token price implied by the wrapper's valuation. Premium is last versus mark. A print is that pair, not a news release.",
            "A ticket is a size and a side waiting for your signature. A quote is the route Jupiter returned for that size. Impact is how far that size would move the price. The minimum is the least you have agreed to receive.",
          ),
          p(
            "Wallet, ATA, memo",
            "The wallet is the signer. The associated token account is where that mint sits for that wallet. A memo is extra text on a transaction, used so a payment or a cover can be found later. It does not move money by itself.",
            "USDC is the settlement mint named in the settlement note. SOL is the gas token and, when you choose it, the input to a route. Neither is a balance Senda holds for you.",
          ),
          p(
            "Desk words",
            "Suspense is the gap in the browser journal. Ghost is the unused room on a local number. PRE8 is the mark-weighted index of this book, not a token. A wrap is a claim on USDC that never leaves the wallet. A space is ciphertext between two wallets.",
            "Practice play uses a separate balance. Real play uses browser cash. Neither is the PreStock buy. The buy is the route.",
          ),
        ],
      },
      {
        id: "not-words",
        title: "Words we do not use",
        body: [
          p(
            "Share, account, insured",
            "Share, stockholder, dividend, and vote do not describe this token. Account, if it means a brokerage or bank account, does not describe a wallet connection. Insured, if it means a licensed policy or a deposit guarantee, does not describe cover or browser cash.",
            "Deposit, if it means money you gave us to hold, does not happen. You do not deposit into Senda. You sign from a wallet you already control.",
          ),
          p(
            "Order, card, program",
            "Order, if it means a resting instruction on a matching engine, is the wrong word. The ticket dies if you do not sign it. Card, if it means a scheme a merchant terminal will clear, is the wrong word for a number kept in this browser.",
            "Program, if it means a Senda program id that escrows your tokens, does not exist. Routes use programs that are already on Solana. There is no address of ours with authority over your mint.",
          ),
        ],
      },
    ],
  },
  {
    id: "actions",
    label: "Corporate actions",
    lede: "What a company or a wrapper might do, and what this desk will not pretend to process.",
    pages: [
      {
        id: "none",
        title: "Not processed here",
        body: [
          p(
            "The list",
            "Splits, reverse splits, dividends, spin-offs, tenders, and conversions of a wrapper into listed stock are not posted to your token account by Senda. We do not receive an instruction from a transfer agent, because we are not one. If the mint's supply changes on chain, the balance you see is the balance the chain reports after that change.",
            "A dividend declared by the company does not arrive as USDC on this desk. The token does not carry the dividend. Anyone who tells you otherwise is describing a different instrument, the listed share under the 2026 exemption, which is not this book.",
          ),
          p(
            "Voided transfers",
            "If an issuer announces that transfers of the underlying vehicle are void, the desk does not freeze the mint and does not confiscate it. The mint keeps trading for whoever will trade it. The last print will move. The mark may not. That gap is the event. Read it on the row.",
            "We do not file a claim for you, and we do not join a class. The token stays in your wallet. What it is worth is what the route will pay.",
          ),
        ],
      },
      {
        id: "if",
        title: "If a wrapper converts",
        body: [
          p(
            "Not our conversion",
            "Some wrappers describe a path to real shares if the company lists, for holders who meet the wrapper's own terms. That path is the wrapper's. It is not executed by a button here. We do not know your eligibility, and we do not hold the SPV interest in your name.",
            "Until a new mint or a new cash movement shows up in the wallet, nothing has converted. A headline is not a credit. Portfolio will show a new token only if the wallet holds it.",
          ),
          p(
            "What you can still do",
            "You can sell the mint you have, if a route exists. You can keep it. You can read the issuer's own notice. You should not wait for this desk to deliver listed shares into the same ticket. That delivery is not a feature, and it is not on the roadmap as a silent credit.",
            "If we ever listed a different instrument, a real tokenized NMS stock with votes and dividends, it would be a different row with a different disclosure. It would not be slipped into this book under the same symbol.",
          ),
        ],
      },
    ],
  },
  {
    id: "failures",
    label: "When it fails",
    lede: "A buy that does not send has a reason. These are the ones this desk actually hits.",
    pages: [
      {
        id: "before",
        title: "Before the wallet",
        body: [
          p(
            "No route, bad impact",
            "No live price means the book did not return a name. No route means Jupiter did not return a path for that size. Impact over five percent means the path exists and is too wide. All three stop before Phantom opens. Change the name or cut the size. Do not retry the same ticket and expect a different rule.",
            "No wallet injected means Phantom, Solflare, or Backpack is not in this window. The desk does not create a key for you. Install the wallet, then connect. A refused connection is the wallet's answer. There is no override.",
          ),
          p(
            "Empty hands",
            "A buy with no USDC and no SOL fails in the quote or in the simulation. A sell with none of that mint fails with the sentence that the wallet holds none. The cap, if you have hit it, fails before either. Read the error. It names the missing piece.",
            "A simulation failure means the transaction would not land. You are not asked to sign a transaction the chain would reject. If you are asked, the simulation passed, and the remaining risk is the one you can see: size, minimum, and address.",
          ),
        ],
      },
      {
        id: "after",
        title: "After you are asked",
        body: [
          p(
            "Decline and timeout",
            "If you decline the prompt, nothing moves. The ticket does not retry by itself. If the prompt sits until the wallet drops it, treat that as a decline. Look at the wallet before you look at this screen. The signature either exists or it does not.",
            "A signature that lands is final. A signature you cannot find on Solscan did not land, even if a toast appeared and then the page refreshed. Search the explorer for the account. The recent transactions are the list that matters.",
          ),
          p(
            "Wrong thing signed",
            "If you signed a payment to the wrong address, the desk cannot pull it back. If you bought the wrong name, you hold that name, and you can sell it only if a route exists. If you signed a cover premium, the premium is in the cover account until a second signature settles or cancels on the terms you wrote.",
            "If the page disagrees with the wallet, believe the wallet. Then believe the explorer. This screen is a view. It is not the ledger of record for anything that moved on chain.",
          ),
        ],
      },
    ],
  },
];
