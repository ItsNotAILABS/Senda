import type { DocBook } from "./types";

export const paper: DocBook = {
  id: "paper",
  label: "White paper",
  lede: "Senda is a non-custodial desk for tokenized pre-IPO names on Solana, where a connected wallet signs, Jupiter quotes the route, and USDC settles, without the private key ever entering the application.",
  pages: [
    {
      id: "problem",
      title: "The missing desk",
      body: [
        {
          h: "Two records",
          p: [
            "A brokerage record and a token account are not two views of the same claim. The brokerage records a position against an issuer or a clearing member, and it is open only while that market is open. The token account records an SPL balance that can change whenever the chain accepts a transaction. Nothing in the ordinary plumbing joins those books. A holder who has acquired a wrapped pre-IPO name therefore has an object the brokerage cannot see and a swap page will not keep. The absence is practical. There is no place, short of the wallet itself, that treats the mint as a position with a mark, a quote, and a set of signed actions around it.",
            "That gap is not closed by a longer list of features on either side. The brokerage will not list a mint it does not underwrite, and it will not stay open when its own session ends. The swap interface is built to return a route and a signature request, then to leave. Between those two products sits the work a desk usually does: keep the name in view, show the print against a mark, refuse a bad quote, and ask the owner to sign only when something must move. Senda is that desk, and only that desk. It does not replace the brokerage, and it does not replace the venue that already quotes the route.",
          ],
        },
        {
          h: "After the fill",
          p: [
            "A completed swap is a change in token accounts, not the start of a relationship with an intermediary. USDC, or another allowed input, leaves the signer's account. The PreStock mint arrives in the same wallet. From that moment the position is the balance. No one at Senda holds it, lends it, or rehypothecates it, because the application never takes delivery. The holder can leave, and the tokens remain where the chain says they are. What is missing, if the holder stays, is a way to treat that balance as something other than an idle line on a portfolio screen that forgets the name after the route has landed.",
            "The uses that follow a purchase are ordinary, and they are easy to overstate. A holder may want a payment in USDC that refers to a purpose without selling the name. A holder may want a bounded cover against a drop, paid as premium, with no promise beyond the account that received the premium. A holder may want a record of cash movements on this machine, a note a second wallet can unseal, or an agent that can prepare a request and then stop. None of those acts requires a new custodian. Each of them requires a place that will build a transaction, show it plainly, and stop at the signature.",
          ],
        },
        {
          h: "What the desk is",
          p: [
            "Senda is a non-custodial desk for tokenized pre-IPO names on Solana. The account is the wallet the person connects. A buy is a route Jupiter quotes and the wallet signs. Settlement, when the action is a payment or a premium, is USDC. The application reads public balances and public prints. It does not invent a fill, and it does not take the other side of the trade. If the wallet declines, nothing moves. If the wallet is absent, there is no account to operate, and the desk does not manufacture one in its place or hold a stand-in balance for later.",
            "The narrowness is the design. A desk in this sense is a set of screens and a set of refusals around assets that already exist. It is not a matching engine, not a transfer agent, and not a place where deposits are accepted in the banking sense. The holder remains the signer. Senda remains the software that prepares what the signer is asked to approve. That division is the custody story, and it is restated wherever a signature is required so that a later screen cannot quietly undo it by taking delivery of the mint.",
          ],
        },
        {
          h: "Names it will not take",
          p: [
            "Senda is not a broker. It does not open a brokerage account, does not hold customer securities, and does not recommend a name in the way a regulated intermediary would. It is not a bank. It does not take deposits, pay depository interest, or insure a balance. It is not a custodian of the PreStock. The mint stays in the wallet that bought it. It is not an insurer, and a cover screen does not create a licensed policy. It is not a card network. A figure kept in the browser is not a scheme brand, and a merchant terminal is not a rail this software operates.",
            "There is also no Senda program id. The desk does not deploy a program that escrows the token, matches orders, or sits in the middle of settlement. Routes, token transfers, and memos use programs that already exist on Solana. That choice keeps the trust boundary where the wallet already put it. A reader who looks for a program address owned by this project, and for authority over user tokens granted to that program, will not find one, because none is part of the design. The signature on the user's transaction is the authority that moves funds.",
          ],
        },
        {
          h: "Hours without depth",
          p: [
            "Solana does not close at the hour a stock exchange closes. A quote can be requested late, and a wallet can sign it if a route exists. That fact is often treated as a virtue in itself. It is only a fact about when a transaction may be submitted. It says nothing about how much size the pool can absorb, who is on the other side, or what the print will be after the trade. A desk that is open when the brokerage is dark still has to refuse a quote that would move the price too far. Availability is not liquidity, and the software should not speak as if it were.",
            "The same restraint applies to the mark. A pre-IPO wrapper can display a figure taken from a private valuation and a token price taken from a thin on-chain book. Those two numbers are not the same unit, and a quiet hour does not make them converge. Senda shows both and does not blend them into a claim about fair value. The holder is left with a print, a mark, and the decision whether to sign. The desk's job at that hour is to be precise about which number is which, and to decline the trade when the route itself says the cost of crossing it is too high.",
          ],
        },
      ],
    },
    {
      id: "object",
      title: "The token as an object",
      body: [
        {
          h: "Economic exposure",
          p: [
            "A PreStock token is economic exposure offered by a wrapper, not a line on a share register. Buying it changes the balance of a mint in a token account. It does not make the holder a stockholder of the company whose name appears on the screen. The company did not issue the token in the way it issues shares to investors on its own cap table. A wrapper, often through a special-purpose vehicle, put a mint on Solana. The object the desk can see is that mint, its print, and its mark. Everything else is a statement about a market the desk does not administer.",
            "The distinction matters on the day something goes wrong. A stockholder can look to corporate law for a vote, a dividend, an information right, or a place in a liquidation. A token holder cannot look to Senda for any of those, because Senda did not issue the wrapper and cannot confer rights the wrapper does not carry. The desk will mark the position at the live print and will quote a route out of it. It will not convert the token into a share, and it will not tell the holder that the purchase itself performed that conversion.",
          ],
        },
        {
          h: "Absent rights",
          p: [
            "The rights that are absent should be named rather than left as atmosphere. There is no vote attached to the token that Senda can exercise or pass through. There is no dividend that Senda receives and distributes. There is no transfer-agent record in which the holder appears as a registered owner of the underlying company. Screens that show a company name or a valuation are identifying a market object. They are not a proxy statement and not a confirmation of beneficial ownership. Treating them as either would misread both the wrapper and the desk that displays it.",
            "What the holder does have is a market, and it should be described at that size. The print moves when the token trades. The mark is the reference the wrapper publishes beside that print. The difference is a premium or a discount, and it can be large, because the on-chain book is not the private market in which the company's shares change hands. Senda reports the difference. It does not close it. A buyer who pays above the mark is paying the token market, not purchasing the company at the valuation printed next to the name.",
          ],
        },
        {
          h: "Voided transfers",
          p: [
            "Issuers have voided unauthorized transfers of exposure held through special-purpose vehicles. The event is not a hypothetical risk factor written to be ignored. Where a company has concluded that a transfer of an SPV interest was not permitted, the premise of the wrapper can fail even though the mint continues to exist on the chain. The token account still shows a balance. That balance may no longer track the interest the buyer thought had been acquired. The print then adjusts, often sharply. The adjustment is a fact about the wrapper, not a malfunction of the wallet or of the desk.",
            "Senda cannot repair that event and does not pretend to. It does not custody tokens in order to freeze them, and it has no standing with the issuer to restore a voided interest. The desk can continue to show the print the public market is making, and it can let the holder sign a route if a route still exists. A reader should treat an issuer's refusal as part of the object, not as an incident the software will absorb. Unauthorized SPV exposure can be cancelled by the company that never agreed to it. The chain does not reverse that legal act.",
          ],
        },
        {
          h: "Who the wrapper addresses",
          p: [
            "Most of these wrappers exclude U.S. persons under Regulation S. Minting, redemption, and the issuer's own interface commonly block a U.S. address or require a declaration that the buyer is not a U.S. person. Those controls sit with the issuer, not with Solana. The chain will process a transfer from any wallet that can pay the fee. A U.S. person can therefore reach a mint on a public route even when the offering materials place that person outside the sale. Reaching the mint is not the same thing as standing inside the exemption the issuer relied on when the wrapper was sold.",
            "The resale limits that follow a Regulation S offering belong to that structure. The distribution compliance period is often discussed as forty days or one year, depending on the security and the buyer, and the wrapper's own documents control the point where they speak. Senda does not decide which period applies to a given mint, and it does not police the residency of a wallet. It states the exclusion so a successful signature is not mistaken for a determination that the purchase was permitted. For many U.S. persons the compliant path remains a private-market venue built for that sale, not a public token route.",
          ],
        },
        {
          h: "The September 2026 line",
          p: [
            "In September 2026 the SEC's Innovation Exemption addressed already-listed NMS stocks tokenized with full shareholder rights. The measure is about public companies whose shares already trade in the national market system, and about tokens meant to carry the rights of those shares. It is not a general permission for pre-IPO wrappers. It does not turn economic exposure to a private company into a listed share. A desk that sits on these mints cannot borrow the exemption by using the same chain, or by using the word token, or by pointing at a public quote. The text covers something else.",
            "The line prevents a category error that would otherwise be easy to make. Listed NMS stock, tokenized with the votes and dividends the exemption contemplates, is one market. A pre-IPO wrapper that excludes U.S. persons and conveys no corporate rights is another. Senda operates in the second, and only as software around mints that already trade. It does not onboard a buyer into an exemption the wrapper sits outside. It does not describe a PreStock as a tokenized share of a public company. Where the September 2026 exemption applies, it applies to an instrument this book does not hold.",
          ],
        },
      ],
    },
    {
      id: "path",
      title: "Wallet, quote, signature",
      body: [
        {
          h: "The quote",
          p: [
            "A buy begins as a request for a quote, not as an order resting on a book Senda operates. The desk asks Jupiter for a route into the PreStock mint, paid in USDC, or in SOL where that is the path the screen has built. Jupiter returns an expected output, a minimum, a price impact, and the pools it intends to cross. Senda does not improve that quote, internalize it, or substitute a price of its own. If Jupiter does not quote, there is no trade to offer. The desk does not invent a fill so that the screen can stay busy while the aggregator is silent.",
            "The route is constrained on purpose. The inputs and outputs the desk will carry as far as a wallet are SOL, USDC, and the PreStock mints on the book. A pair outside that set is rejected before a signature is requested. The constraint is not a view about the merit of other assets. It keeps a pre-IPO desk from becoming a general swap page that will sign whatever an aggregator returns. The holder came for a named mint. The transaction should be about that mint, and the quote on the screen should be readable as a route into it or out of it, not as an unrelated detour.",
          ],
        },
        {
          h: "Simulated first",
          p: [
            "A buy is simulated before the wallet is asked to sign. The simulation asks whether the transaction, as built, would succeed. A route that fails the check is not presented as something the holder should approve. The order is deliberate. A signature on a transaction that cannot land wastes attention and can still cost a fee if it is submitted and then rejected by the chain. The desk would rather show the failure in its own words than hand the wallet a payload the network will refuse. Preparation that skips this step is not a faster buy. It is a worse one.",
            "Simulation is not a promise about the next block. State can move between the check and the signature, and a quote can go stale while the holder reads. What the check provides is a refusal at the moment of building: if the transaction does not pass, signing is not requested. The holder still reads the wallet's own prompt, which is the confirmation that matters. Senda's screen prepares the request. The wallet is the gate. A failed simulation stops the path. A passed simulation only earns the right to ask the signer, who remains free to decline.",
          ],
        },
        {
          h: "Impact and the cap",
          p: [
            "Price impact over five percent is refused. The figure is taken from the quote, and the threshold is applied before the wallet is asked to sign. A thin pool can show a large impact on a dollar size that looks modest on the ticket. That is information about the book, not an inconvenience to be clicked past. The desk treats impact above the line as a reason to decline, not as a warning the holder may override on the same screen. If the size is wanted, it has to fit the pool, or the holder has to wait for a quote that does not move the price as far.",
            "A spend cap applies to the dollar size as well. The cap is a limit kept in this browser, and a request above it is rejected with the same result: the wallet is not asked to sign. The cap is not a credit line, not a margin facility, and not a compliance approval of the buyer. It is a brake the holder sets so that one action cannot quietly exceed an amount already chosen. Impact and the cap are independent tests. A small trade in a thin pool can fail on impact. A large trade in a deeper pool can fail on the cap. Either failure is enough to stop the path.",
          ],
        },
        {
          h: "Settlement in USDC",
          p: [
            "USDC on this desk is the mainnet mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v. It has six decimals, so one unit of the stablecoin is one million raw units, and a payment is scaled that way before it is written into the instruction. The desk does not accept a similarly named asset as a substitute. Settlement of a payment or a premium is a transfer of this mint from the signer's token account to a destination token account. If the signer has no account for the mint, there is nothing to send. The action stops there, rather than offering a different coin and calling it the same payment.",
            "A payment is a transferChecked instruction plus a memo. The checked transfer binds the amount to this mint and to its six decimals, so a later reader cannot mis-scale the raw units into a different dollar figure. The memo carries a reference so the payment can be found among other transfers of the same mint. The signature is the receipt. There is no second ledger at Senda that confirms what the chain has already recorded. If the destination has no USDC account yet, the same transaction can create it, and the signer pays the rent that creation requires. The payee is the address the holder named.",
          ],
        },
        {
          h: "Wallets in the window",
          p: [
            "The wallet on offer is the wallet injected into this window. Phantom, Solflare, and Backpack are named because the desk knows how to detect those providers. Any other wallet is offered only when it is actually present. A wallet that is not installed is not shown as if it were a choice, and the desk does not ask the holder to create a substitute account inside Senda. Connect returns a public key. That key identifies the token accounts to read and the signer the transactions will name. Nothing in the connect step asks for a seed phrase, and nothing stores one.",
            "The private key never enters Senda. It does not pass through a form, a network request, or a stored session. The wallet signs inside its own boundary and returns a signed transaction or a signed message. Senda can broadcast what was signed. It cannot sign a second time on its own, and it cannot move funds the holder did not approve in that prompt. Closing the tab ends the session on the screen. It does not move the tokens. They remain under the key the wallet still holds, which this application has not seen and cannot ask the holder to export.",
          ],
        },
      ],
    },
    {
      id: "uses",
      title: "Uses past the ticket",
      body: [
        {
          h: "Past the purchase",
          p: [
            "The purchase is a ticket into a mint. It is not the remainder of the desk. Once the token account holds the PreStock, the holder still has to decide what the position is for. It can be left in place and marked at the print. It can be reduced by a route in the other direction, which uses the same machinery as the buy: a quote, a simulation, and a signature. It can sit beside actions that do not transfer the mint at all. Those later actions are the uses past the ticket. They exist because the wallet is still the account, not because a venue has taken the token into inventory.",
            "Keeping the mint where it is makes the later uses intelligible. A payment does not sell the name. A cover premium does not deliver the name into a margin account. An agent that prepares a trade does not become the owner of the name. Each use either moves USDC under a signature or writes a record that never touches the mint. Where a use would move the mint, it returns to the same path as the original buy. There is no internal transfer that treats the desk as a place with its own book of customer tokens. The chain account remains the only inventory that matters.",
          ],
        },
        {
          h: "A payment in USDC",
          p: [
            "A holder can pay a Solana address in USDC without selling the PreStock and without a card network. The screen takes an address and an amount. The transaction names the signer's USDC account, the receiver's USDC account, and a memo. The wallet signs. If the receiver does not yet have an account for the mint, the transaction creates it and the signer bears the rent. The amount in the instruction is the amount paid. Senda is not the payee. It does not sit in the transfer and retain a part of it, because it is not a party to the movement of the mint.",
            "The payment is narrow, and the narrowness is part of the description rather than a temporary limit. It settles on Solana, in this one mint, to one address, with a reference a later reader can search on the chain. It does not become a bank wire, a card authorization, or a debit the receiver can pull. The spender is the signer, every time. The spend cap still applies, so an amount above the cap never reaches the wallet as a request to sign. A merchant who cannot accept a Solana transfer cannot be paid by relabeling the button. The rail is the transfer itself.",
          ],
        },
        {
          h: "Cover",
          p: [
            "Cover starts as a premium, not as a policy. The holder signs a USDC transfer into a cover account, and the terms of that cover travel with the act, including a memo the chain retains. The PreStock stays in the holder's wallet. Senda does not take the token as collateral and does not lend against it. The premium is the cash the cover moves at the start. A later claim is not a draw on some other balance sheet the operator keeps. It is a return from the cover account, and the return cannot exceed what that account holds at the time the claim is paid.",
            "The limit is the difference between this screen and insurance. An insurer pools premium, holds capital under a license, and may have to pay a claim whether or not one particular wallet is funded at the moment of loss. Senda is not an insurer, and the cover is not a licensed policy. If the cover account does not hold the USDC, there is nothing honest to send back, and the software will not invent a payout to fill the gap. The holder should read the premium as a transfer under a stated condition. The condition cannot create dollars that were never transferred in.",
          ],
        },
        {
          h: "An agent that cannot sign",
          p: [
            "An agent on this desk can read the book, write a log, and queue a trade the holder has allowed it to prepare. It can ask. The ask is a prepared action: a name, a side, and a size, waiting for a person. Queuing is not submission. The agent does not hold a key, does not receive a session that is able to sign, and does not keep working after the tab is closed. Its purpose is the purpose the holder wrote, inside the tools the page actually exposes. A broader sentence of intent does not add a tool, and it does not create a signer where the page refused one.",
            "The inability to sign is the safety property, not a missing permission. A process that can read prices will eventually be early, wrong, or aimed at the wrong mint. If that process can also sign, the error settles on the chain. If it cannot, the error remains a proposal the holder can ignore. When the holder does sign, it is in the wallet, under the same simulation, the same five percent impact limit, and the same spend cap as a trade started by hand. The agent does not receive a quieter path around those checks. The queue ends at the same gate as everything else.",
          ],
        },
        {
          h: "A sealed space",
          p: [
            "A sealed space is a room between two wallets, not a folder on a server. Each side generates an X25519 key in the browser and signs a known message binding that public key to the room. A shared secret is derived from the two keys, and the payload is AES-GCM ciphertext. A note, or a pointer to a transfer, is encrypted before it is stored. The server may retain the ciphertext. It cannot read it, because the private material does not leave the browsers that created the room. An operator cannot open what was sealed. A person who can open it holds one of the keys.",
            "The space is not an account and not a balance of any asset. Opening it does not custody USDC and does not move a PreStock. Attaching a receipt records that a transaction exists; the transaction still had to be signed in the ordinary way, by the wallet, for the amount the signer approved. If the browser that holds the secret is lost, the ability to decrypt what was sealed there is lost with it. Senda cannot restore the plaintext, because Senda never received it. Confidentiality against the server is bought by refusing the server any power to help. A room an operator can read is a different object.",
          ],
        },
        {
          h: "Cash in this browser",
          p: [
            "Senda cash and the books digest live in this browser. Senda cash is a ledger of amounts the application has recorded on this machine. The books digest replays that journal and reports whether the internal figures still tie. Both are records of software state on one device. Neither is a deposit, a trust account, or a balance a bank would recognize or insure. Clearing the site data clears them. Another computer does not inherit them. They begin at nothing, and they remain nothing until this browser writes an entry. They should be read as notes the machine kept, not as client money.",
            "The split from chain balances is supposed to stay visible, because the two numbers can sit near each other on a screen. SOL, USDC, and PreStock tokens are read from the connected wallet, and anyone with the public key can check them on the chain. Senda cash cannot be checked that way. It will not pay a merchant by itself, it will not survive a wiped browser, and the operator cannot make it whole, because the operator does not hold a matching liability at a depository. The digest checks the local journal. It is not an audit of the chain and not a regulatory statement. It is not a bank balance.",
          ],
        },
      ],
    },
    {
      id: "boundary",
      title: "The boundary",
      body: [
        {
          h: "No borrowed charter",
          p: [
            "The boundary of the desk is the list of institutions it will not imitate in order to sound complete. It will not become a broker to explain a trade. It will not become a bank to explain cash. It will not become a custodian to explain a holding. It will not become an insurer to explain a premium. It will not become a card network to explain a payment. Each of those names carries a charter, a supervisor, and a duty to hold assets or to pay. Senda has none of those charters. Borrowing the vocabulary without the duty would misstate who is obliged when a transaction fails or a balance disappears.",
            "The lack of a program id is the same boundary in the form a chain can check. A program with authority over user token accounts would be custody in software, whatever sentence sat above the button. This desk does not request that authority. Transactions are built for the holder to sign, and the signer's key is the only authority they carry onto the network. There is no admin path that seizes a mint the desk never held. The cost is real: Senda also cannot reverse a mistake the holder has signed. The corresponding fact is that it cannot commit that mistake in the holder's place.",
          ],
        },
        {
          h: "What is visible",
          p: [
            "What Senda can see is largely what the chain already publishes. A connected public key. The SOL, USDC, and PreStock balances of that account. The quotes that were requested from Jupiter. The transactions the holder signs, which anyone can read once they land. None of this is a secret from an observer of Solana. The desk does not keep a second, private book of positions behind the public one. If the wallet holds no PreStock, the portfolio is empty. The software does not fill the empty row with a holding the person did not buy, and it does not carry a position forward from a session that never signed.",
            "What must stay off the server is the material that would make the desk a custodian of secrets even though it is not a custodian of tokens. The wallet's private key is the first item. The plaintext of a sealed space is the second: the server, if it stores the room, stores AES-GCM ciphertext produced from X25519 keys it does not have. Senda cash and the books digest are the third. They live in this browser. They are not a balance the operator can open, edit, and call reconciled. A signature may authorize a sealed blob to be stored. The signature proves who asked. It does not decrypt the blob.",
          ],
        },
        {
          h: "The local books",
          p: [
            "A person looking at the screen, without exporting anything, should still be able to tell the two ledgers apart. One ledger is the chain. It changes when a transaction is confirmed, and it does not depend on this tab remaining open. The other ledger is the browser. It changes when the application writes Senda cash or replays the books digest, and it depends entirely on storage that belongs to this machine. Using one vocabulary for both is how a local figure is mistaken for money on deposit. The desk has to keep the words apart even when the layout places the numbers side by side for convenience.",
            "The digest can look more formal than its standing allows. It names internal tokens, sums figures, and says whether the journal ties. Those are the habits of a back office, applied here to entries the browser wrote for itself. A tie means the local entries agree with one another. It does not mean a custodian has reconciled client assets, and it does not add anything to the PreStock balance beyond the token-account read that any observer can repeat. The digest is a tool for the person at this keyboard. It is not a statement issued to a counterparty, an auditor, or a supervisor, and it should not be forwarded as if it were.",
          ],
        },
        {
          h: "Persons outside the wrapper",
          p: [
            "The boundary around the buyer is drawn by the wrapper, and the desk does not redraw it. Most of these offerings exclude U.S. persons under Regulation S. Connecting a wallet does not collect a residency, and a swap that succeeds does not generate a finding that the buyer was an eligible purchaser. Senda will not turn that silence into an offer directed at a person the documents exclude. It also will not pretend to operate the issuer's own gate. That gate, where it exists, sits on minting, redemption, and the issuer's site. The public chain is not the gate. A route can still be signed by someone the wrapper refused.",
            "The Innovation Exemption of September 2026 does not remove the point. It covers already-listed NMS stocks with full rights, on the terms written for those stocks. These pre-IPO wrappers are outside that cover. They are not the listed shares the exemption names, and they do not carry the votes and dividends that full rights would include. A holder who wants those rights wants a different instrument, acquired on the terms that apply to it. Senda will not rename a PreStock so that it appears to fall inside a rule written for listed NMS stock. Eligibility is a property of the offering. A wallet that can reach the mint does not amend the offering.",
          ],
        },
        {
          h: "Three limits",
          p: [
            "Three operating limits belong together, because each is a place the desk could otherwise promise more than it can perform. A claim on a cover can return only the USDC sitting in the cover account. It cannot pay a face amount out of an empty account, and the arrangement is not a licensed policy. An agent can queue a request and ask the holder to look at it. It cannot sign. A wallet is offered only when it is injected in this window: Phantom, Solflare, Backpack, or another provider that is actually present. If none is present, the desk does not generate a key and call the result the holder's wallet.",
            "Taken together, the limits describe software that prepares a step and then waits. It waits for Jupiter to quote. It waits for the buy to be simulated. It waits for price impact to be no more than five percent, and for the dollar size to sit inside the spend cap. It waits for the wallet to sign. On a claim, it waits on the USDC the cover account already holds. On a sealed space, it waits on the browsers that hold the X25519 keys, because the server cannot read the AES-GCM payload. Skipping a wait would mean Senda had become the signer, the carrier, or the reader of a secret. It does not take that step.",
          ],
        },
        {
          h: "What PRE8 may mean",
          p: [
            "PRE8 is the book weighted by mark. It is one reading of the names on the desk. It is not a fund, not a share of a portfolio the desk holds for clients, and not a product that can be subscribed or redeemed. One thousand means the token price matches the mark. A reading above one thousand means that, on this weighting, the book prints above the mark. A reading below one thousand means it prints under the mark. The level moves when the prints move. It is not a net asset value, because there is no fund whose assets it could value, and it adds nothing to the mark that was not already in the mark.",
            "The index is a way to see the book without pretending the book is deep or unified. Weighting by mark lets a larger mark speak louder in the level than a smaller one. It does not create liquidity in any name, and it does not shield a buyer from price impact on a single mint. A holder who buys one token is exposed to that token, not to PRE8, unless the holder has gone out and assembled the names. Senda does not assemble them into a basket it keeps. The number exists so the gap between token price and mark can be seen across the book at once. It is a reading. It is not an instrument.",
          ],
        },
      ],
    },
  ],
};
