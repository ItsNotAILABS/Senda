import type { DocBook } from "./types";

export const research: DocBook = {
  id: "research",
  label: "Research",
  lede: "The wrappers this desk marks are economic exposure on Solana, not shares, and the 2026 rule that opened listed stocks does not cover them.",
  pages: [
    {
      id: "exposure",
      title: "Exposure, not title",
      body: [
        {
          h: "What the token is",
          p: [
            "A PreStock mint is an SPL token. The balance sits in a token account. The print is a price other people have traded, not a statement from the company whose name is on the wrapper. Holding the mint is a way to take economic exposure to that wrapper. It is not a way to become a shareholder. There is no vote attached to the token, no dividend the company pays into the wallet, and no right to inspect the cap table. A reader who treats the symbol as a line in a brokerage account will misread every screen that follows.",
            "The distinction is not a disclaimer pasted under a buy button. It is the legal shape of the product. The company did not issue the token. An intermediary wrapped a claim, often through a special purpose vehicle, and put a tradeable receipt on a chain. The receipt can change hands without the company's transfer agent. That is why the market exists, and it is also why the company can refuse to recognize the transfer. Exposure and title are different objects. This desk marks exposure. It does not convey title.",
          ],
        },
        {
          h: "What a buyer receives",
          p: [
            "A buyer who signs a route receives tokens in the wallet that signed. The quantity is whatever the quote delivered after fees and price impact. The buyer does not receive a stock certificate, an entry on the company's register, or a right to participate in a future financing. If the company later lists, the wrapper may or may not have a path to the listed shares. That path is the wrapper's business, not a promise this desk can make. The desk shows the mint, the last print, and the mark. It does not show a conversion ratio into listed stock, because it does not have one to show.",
            "Selling is the same object in reverse. A sell is a route out of the mint into USDC, signed by the holder. It is not a redemption with the issuer. The issuer is not on this page. If the on-chain book is thin, the quote will say so by the impact, and a route worse than five percent is refused before the wallet is asked. Thinness is a property of the market. The desk does not fill it by taking the other side.",
          ],
        },
        {
          h: "Why the name still matters",
          p: [
            "The economic point of the wrapper is that a private company's trajectory is otherwise hard to hold in small size, and hard to hold outside the hours and the accreditation rules of a traditional pre-IPO desk. The token lets a wallet express a view, mark it, and exit when someone else will take the other side. That is a real use. It is also a narrow one. It does not include governance of the company, information rights, or a claim on assets in a bankruptcy that a shareholder might have. A serious reader keeps those out of the position.",
            "For the desk, the consequence is mechanical. Portfolio value is tokens times the last print. It is not a statement of net asset value from the company, and it is not a valuation the desk has appraised. PRE8 weights the names on the book by the mark value of the wrappers. One thousand means the token price matches that mark. A number above or below is a premium or a discount of the chain print to the mark the wrapper advertises. It is a spread. It is not an opinion.",
          ],
        },
        {
          h: "What this desk will not say",
          p: [
            "The desk will not say that a holder owns OpenAI, Anthropic, SpaceX, or any other company whose name is on a mint. It will not say that a buy is an allocation in a round. It will not say that a future listing will convert the token into listed shares at a stated rate. Those sentences are how this market gets mis-sold. They are not on the pages, and they should not be added by a later screen that wants a shorter headline.",
            "The desk will say what it can check. The mint address. The last trade it can read. The mark it was given. The quote Jupiter returns for a size. The signature the wallet produces. Everything else is outside the book. A research note that needs a fair-value model, a comparable set, or a cap table has to get those from somewhere else. This software does not invent them to fill a card.",
          ],
        },
      ],
    },
    {
      id: "regs",
      title: "Regulation S and the 2026 split",
      body: [
        {
          h: "The offshore lane",
          p: [
            "Most of these offerings are sold under Regulation S. They are aimed offshore. Official minting, redemption, and the interfaces that perform them commonly block United States internet addresses or require a declaration that the person is not a U.S. person. The restriction is not a style choice of one website. It is how the offering was structured so that it would not be a distribution into the United States. A desk that sits on top of the tokens inherits that structure. It does not get to ignore it because the chain itself has no nationality.",
            "Solana is permissionless. Anyone who can pay the fee can submit a transaction, and a U.S. person who already holds a wallet can ask Jupiter for a route into the mint. Permissionless settlement is not permission to market the offering into the United States, and it is not a cure for a resale restriction. The chain will process the transfer. The securities law question is a different book, and it does not clear because the transaction succeeded.",
          ],
        },
        {
          h: "A U.S. person on a DEX",
          p: [
            "A U.S. person who buys the token on a decentralized exchange still faces the distribution compliance period that attaches to a Regulation S offering. That period is often forty days, and in some cases a year, depending on the category of the issuer and the offering. During it, resales into the United States are restricted. After it, the token is not thereby transformed into a registered security or into a listed share. The buyer also carries the risk that a platform's marketing is later judged to have been directed at the U.S. market, which can pull the offering back into the registration question the structure was built to avoid.",
            "Senda does not onboard U.S. persons into these wrappers, and it does not present the book as available to them. A geoblock or a declaration on someone else's mint site is not a feature this repo reimplements as a checkbox. The honest statement is the split itself. The compliant path for an American retail buyer or an American institution remains the traditional one: Forge, EquityZen, and the accredited funds that actually sell private shares under U.S. rules. This desk is not that path.",
          ],
        },
        {
          h: "The Innovation Exemption",
          p: [
            "In September 2026 the Securities and Exchange Commission adopted an Innovation Exemption that lets real tokenized public stocks trade on chain with the rights of the share. The stocks in view are already listed on a national market system. The token is a representation of that listed share, including voting and dividends, and the venues are permissioned U.S. venues. That is a different instrument from a pre-IPO wrapper. It is the share, on a new rail, under a stated relief. It is not a receipt on a private company that the company has not acknowledged.",
            "Pre-IPO wrappers sit outside that safe harbor. The exemption does not reach them, and it should not be cited as if it did. A sentence that says tokenized stocks are now allowed, and then shows a private-company mint, is a category error. Listed NMS stock with full rights is one market. Offshore Regulation S exposure to a private company is another. Senda is built for the second, and it says so. The first market, when it is live on a permissioned venue, is not this book.",
          ],
        },
        {
          h: "What the split means for the product",
          p: [
            "The practical result is a hard geographic and legal split. A wallet-native desk can stay open around the clock for people who are allowed to hold the wrapper, because the chain does not close. It cannot, by staying open, become the U.S. retail channel for pre-IPO stock. Hours are not the thing the law is restricting. The thing being restricted is the offer and the resale. A twenty-four hour book does not change the distribution compliance period, and it does not create shareholder rights the wrapper never had.",
            "For a reviewer, the test is simple. If a page implies that a U.S. person may buy, that the token votes, or that the Innovation Exemption covers the mint, the page is wrong. If a page shows a last print, a quote, and a signature, and it says the holder has exposure only, the page matches the instrument. The research position of this desk is the second page. It is not a loophole and it is not a workaround. It is a description of a market that already exists offshore, and of a desk that will not pretend to be the onshore one.",
          ],
        },
      ],
    },
    {
      id: "liquidity",
      title: "Liquidity and the voided transfer",
      body: [
        {
          h: "When the issuer refuses",
          p: [
            "Issuers have not been silent. OpenAI and Anthropic, among others, have publicly treated unauthorized transfers of interests in the vehicles that hold their shares as void. The token can still move on chain. The company's refusal does not halt the chain. What it does is separate the on-chain receipt from any claim the vehicle might have had. A buyer who paid a premium for the token, on the belief that it was a quiet way into the company, discovers that the company does not agree. The price then has to find a level that reflects a receipt the issuer will not honor.",
            "The drops that followed those announcements were large, on the order of a third of the price in the cases that were widely reported, and they exposed how little size the on-chain book could absorb. A valuation printed next to a name is not a bid. It is a mark. The bid is whatever the next route will actually pay. When the news arrived, the route paid much less, and it paid that on very little volume. A desk that shows the mark and the last print side by side is showing that gap on purpose. The gap is the risk.",
          ],
        },
        {
          h: "Thin books",
          p: [
            "Liquidity in these names is not the liquidity of a listed stock. A listed stock has a continuous two-sided market, a displayed depth, and a closing auction. A wrapper on Solana has the routes a DEX can find at the moment of the quote. There may be minutes in which a modest size clears, and hours in which it does not. The chart on this desk does not invent the missing hours. It draws a line from the twenty-four hour open to the last print, and it says that it is not a candle history. A reader who wants depth, or a time and sales tape from an exchange, will not find it here, because the venue does not publish it in that form.",
            "The five percent impact refusal is the desk's response to that thinness. A quote that would move the print by more than that, for the size requested, is not offered to the wallet. The holder can request a smaller size. The desk will not complete a heroic fill by widening the tolerance and hoping. Impact is visible before the signature. After the signature, the fill is the chain's, and the desk does not adjust it.",
          ],
        },
        {
          h: "Mark versus last",
          p: [
            "The mark is the figure associated with the wrapper's stated valuation, scaled into a token price. The last is the figure the chain last traded. When they diverge, the premium is the whole story available on this screen. A token at a deep discount to the mark may be cheap relative to the wrapper's claim, or it may be correctly priced as a claim the issuer will not recognize. The desk cannot tell those apart. It can only refuse to collapse them into a single number labeled value. Portfolio multiplies tokens by last, not by mark, because last is the figure a sale would have to beat. The mark remains visible so the discount is not hidden.",
            "A research user should treat a large premium as a question, not as a signal to buy. Why is the chain paying more than the mark, or much less? The answers live in the wrapper's documents, in the issuer's public statements, and in the depth of the pool. None of those answers are generated by this application. The screen is a place to see the divergence. It is not a place that explains it away.",
          ],
        },
        {
          h: "No other side",
          p: [
            "Senda does not warehouse these tokens and does not quote its own bid. If the route fails, the buy fails. There is no internal crossing book that fills the user against the house. That is a constraint on the product and a protection for the user. A house that takes the other side of a thin wrapper has a reason to prefer a print, and a reason to delay a redemption. This desk has neither, because it never holds the inventory. The cost of that choice is that a determined buyer cannot always get filled. The benefit is that a fill, when it happens, is someone else's on the same venue.",
            "The same rule applies to cover. The premium is a transfer of USDC into an account, with the terms in the memo. It is not a pool of premiums underwritten against a book of risks, and it is not reinsurance. If the named print falls and the holder settles, the amount that can come back is the amount that account holds. A research description that calls this insurance is using the wrong word. The right word is a signed premium against a stated print, limited to the cash that moved.",
          ],
        },
      ],
    },
    {
      id: "measurement",
      title: "What a print measures",
      body: [
        {
          h: "Last, mark, premium",
          p: [
            "Three figures travel with a name. Last is the most recent price the desk can read for the mint. Mark is the token price implied by the wrapper's valuation. Premium is last relative to mark, signed so that a discount and a premium are not the same color by accident. A page that shows only one of them is hiding the spread. The book shows all three. A buy ticket shows the last, because that is the neighborhood of the quote, and it shows the mark beside it so the spread is still in view at the moment of the signature.",
            "None of the three is a fair value computed by this desk. There is no discounted cash flow, no revenue multiple, and no probability of a listing. Adding one would mean inventing an input. The desk does not have the company's numbers, and it will not scrape a story into a model and present the output as a price. The print is a market fact. The mark is a published reference. The difference is left as a difference.",
          ],
        },
        {
          h: "The index",
          p: [
            "PRE8 is a weighted view of the names on this book, weighted by mark value. It is a way to see whether the set, taken together, is trading through or under the marks. One thousand is the level at which the tokens, in aggregate, match the marks. It is computed in the client from the names the book already holds. It is not a token. Buying PRE8 is not a thing a person can sign, unless a separate basket route is explicitly built and labeled as a basket of the underlying mints. A number on the Solana page is an index. It is not a position.",
            "Because the weights are mark values, a name with a large stated valuation dominates the index even when its on-chain volume is small. That is a property of the construction, and it should be read that way. PRE8 answers a specific question: how far is this set from its own marks. It does not answer which name is liquid, and it does not answer which name the issuer will honor. Those questions stay on the row, next to the mint, where the last print and the copyable address live.",
          ],
        },
        {
          h: "The line on the chart",
          p: [
            "The chart draws a line whose ends are the twenty-four hour open and the last print. The bends between them exist so the line can be read. They are not ticks. A control that offers seven days, thirty days, or all history will say, when selected, that this feed does not publish that window. The desk would rather show an empty state than a history it does not have. A candle chart implies a high, a low, an open, and a close for each interval. Those four numbers are not in the feed. Drawing them would be a fabrication.",
            "For a trading decision, the honest inputs are the last, the twenty-four hour change, the mark, and the quote for the size in front of the user. The quote is the one that matters at the moment of signing, because it is the price the route will actually use, subject to the minimum the wallet is shown. A chart that looks like a professional terminal and is built from two points should say it is built from two points. This one does.",
          ],
        },
        {
          h: "The quote",
          p: [
            "A quote is a Jupiter route for a dollar size into or out of the mint. The inputs the desk will allow are SOL, USDC, and the listed PreStock mints. A token outside that set is not routed, even if a pool exists, because the desk is not a general swap page. The user sees what leaves, what is expected back, and a minimum. If the impact of that size is over five percent, the route is refused and the wallet is not opened. The refusal is the measurement. It says the book cannot carry the size without a large move.",
            "After a signature, the measurement becomes a transaction. The tokens arrive in the signer's associated token account, or they do not, and the signature is the record. The desk does not keep a second set of positions that can disagree with the chain. Portfolio reads the wallet. If the wallet is not connected, the book of holdings is empty, even if this browser remembers a cash ledger from earlier. Those are different measurements, and the research note keeps them apart so a later total does not add them twice.",
          ],
        },
      ],
    },
    {
      id: "desk",
      title: "What a desk may claim",
      body: [
        {
          h: "Claims that match the instrument",
          p: [
            "A desk may claim that it shows the live print of a mint, that it asks a wallet to sign a quoted route, and that the tokens remain in that wallet. It may claim that a payment in USDC is a transfer the chain can show, with a memo, to an address the user pasted. It may claim that a cover is a premium the user signed, limited to the cash in the cover account. It may claim that an agent prepared a request and that the user signed it, or that the user did not. It may claim that a journal in the browser replays to a digest, and that the digest is not a chain balance. Each of those sentences can be checked.",
            "The check is the same in every case. If the wallet was not asked, money on chain did not move. If the wallet was asked and the user signed, the signature is public and can be opened. If a figure exists only in this browser, the page should say so. A research standard for the product is that a reviewer can walk a claim to one of those three places and find it. A claim that cannot be walked there does not belong on the desk.",
          ],
        },
        {
          h: "Claims that do not",
          p: [
            "A desk may not claim that the holder owns the company. It may not claim that the Innovation Exemption covers a pre-IPO wrapper. It may not claim that a U.S. person is the intended buyer. It may not claim a brokerage account, a bank deposit, a card network, or an insurance policy. It may not claim a program id it does not have, or an order book it does not run, or custody it has refused. It may not claim that an agent will keep working after the tab closes, or that a number on a card face will clear at a merchant.",
            "These are not modest omissions. They are the difference between a tool a person can use and a story that will be read as an offer of a regulated product. The market this research describes is already easy to oversell, because the names are famous and the tokens are easy to buy. The desk's job is to make the buy legible and to keep the oversell off the page. A feature that needs one of the forbidden sentences in order to make sense is a feature that should not ship.",
          ],
        },
        {
          h: "How to read the book",
          p: [
            "Read a row as a mint with two prices and a spread. Read a ticket as a request for a signature at a quoted size. Read a portfolio as the token accounts of the connected wallet, marked at last. Read PRE8 as a client-side index of marks, not as a holding. Read a cover as a premium. Read a payment as a USDC transfer. Read the books as a replay of this browser's journal. Read a sealed room as ciphertext this server cannot open. If a screen asks to be read as something larger, it is ahead of the instrument.",
            "The instrument is a wrapper, on a chain, under Regulation S, outside the exemption that now exists for listed stock. The desk is software that lets an allowed holder see it, quote it, and sign. That is the research position. It is enough to build on. It is not enough to imply a share.",
          ],
        },
        {
          h: "Open questions",
          p: [
            "Several questions are real and unanswered here. Whether a given wrapper's documents give any contractual claim if the issuer voids a transfer. Whether a particular mint's pool is deep enough, on a particular day, for a particular size. Whether a holder outside the United States has a local restriction this desk does not know. Whether a future listed token under the Innovation Exemption should ever sit on the same screen. The desk does not resolve those by silence or by a badge. They stay open because the inputs are not in the feed.",
            "What the desk can keep doing is narrow and checkable. Show the mint. Show the last and the mark. Quote a size or refuse it. Ask for a signature. Leave the token where the signer put it. Say, in the same voice as the rest of this note, what the signature did not buy. A research reader who wants more than that is asking a different institution. This one should be able to point at the page and mean it.",
          ],
        },
      ],
    },
  ],
};
