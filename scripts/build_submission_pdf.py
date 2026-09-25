#!/usr/bin/env python3
"""Build the Senda submission note. Target about five thousand words."""

from pathlib import Path

from fpdf import FPDF

OUT = Path("/workspace/public/senda-submission.pdf")
FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

SECTIONS: list[tuple[str, list[str]]] = []


def add(title: str, *paragraphs: str) -> None:
    SECTIONS.append((title, list(paragraphs)))


add(
    "Senda",
    "Senda is a desk for tokenized pre-IPO names that already trade on Solana. The person using it already has a wallet. The names already have mints. The routes already exist on Jupiter. What did not exist is a place that treats those names as something you can buy, hold, cover, spend against, play, and hand to an agent, without first becoming a brokerage customer.",
    "This note is the submission document for that desk. It says what the product is, who it is for, how a session actually runs, what is signed on Solana, what stays in the browser, and what is deliberately not claimed. The app is the demo. This file is the map a judge can read without clicking.",
    "The project is original work by ItsNotAILABS. The repository is github.com/ItsNotAILABS/Senda. Open-source pieces it stands on are named where they are used: the Solana wallet providers a person already installed, Jupiter for routes, and the public PreStocks market data for prints. Senda does not reimplement a chain. It is the layer in front of one.",
)

add(
    "The person",
    "The user is not a hypothetical retail trader invented for a pitch. It is someone who already holds SOL or USDC in Phantom, Solflare, Backpack, or another injected Solana wallet, and who wants exposure to companies that are still private. Those companies are not on a brokerage screen at midnight. On Solana they are tokens with a last price, a mark, and a mint, and they trade when the brokerage apps are closed.",
    "That person does not want a second account, a second login that holds the key, or a transfer into a platform balance before the product becomes useful. They already have money. It is in the wallet. The product should start there.",
    "They also do not want a terminal that only brokers understand. A pre-IPO print is a new object for most people. They need to see the name, the price, what they would pay, and what they would receive, and they need a way to learn the rest of the desk without risking the wallet. That is why play has a practice balance, why the portfolio is empty until the chain says otherwise, and why an agent can queue an order and still cannot sign it.",
    "The same person, later, wants the name to do more than sit there. They want to know what they hold, in tokens and in dollars at the live print. They want a way to sell a slice back. They want a cover if the print drops. They want a number they can aim at a store without selling the token first. They want to send cash to someone. They want an agent that watches the book overnight in the only sense this browser can: while the page is open, inside a bound they set. Senda is that list, built as one account, not seven products.",
)

add(
    "The problem",
    "Tokenized stocks on Solana proved that a share-like asset can move at the speed of the chain. The missing piece is not another mint. It is the set of things a person expects once they own one. A brokerage app, for all of its faults, has a portfolio, a ticket, a history, and a story about what happens if the price falls. A raw swap interface has a route. Between those two, the owner of a pre-IPO token is left to invent the rest.",
    "The bounty asked for what makes owning and using these assets better than today's brokerage app. The categories were trading, investing, credit and yield, infrastructure, and consumer use. Senda does not pretend to be all of them at institutional grade. It picks the consumer wedge and builds the desk around it: 24/7 access to the names, a portfolio that is the wallet, routes into and out of them, a cover on a drop, a way to spend without selling, games faced with the live book, and an agent that can propose and cannot sign.",
    "A brokerage account cannot do the Solana half of that. It does not see the mint. It does not ask Phantom to sign. It closes. A pure DeFi front end can do the swap and then abandons the person. The gap is the operating layer: programming, games, payoffs, agents, controlled spending, and a record, sitting on top of custody the user already has.",
    "Judges were asked one question. Could this be a real app that people will actually use? The test is a real user, a real problem, a working path from wallet to name and back, a reason the path belongs on Solana, and the quality of the thing in the hand. This note is written to that test. Where the desk does less than a sentence might imply, the sentence says so.",
)

add(
    "Why Solana",
    "The names are Solana tokens. That is the whole reason the desk is a Solana app and not a wrapper around a stockbroker. A buy is not an IOU entered in a database. It is a route from the USDC in the wallet to the mint of the name, quoted by Jupiter and signed by the wallet. The portfolio is not a row Senda stores. It is the token account, read back, multiplied by the last print.",
    "That is also why a second custodian would make the product worse. If Senda held the tokens, the user would be trusting a new balance, and the Solana half would be a back office detail. By refusing the key, the chain stays the source of what is owned. The browser ledger is only for the cash the desk itself moves: play, shop charges, sends, and the premiums that are taken in-app. Those are labeled as such.",
    "Solana is the right chain for the rest of the desk for a practical reason. The names trade around the clock, the routes are cheap enough to quote in front of a person, and the wallets people already use speak a common signing surface. Phantom is the default. Solflare, Backpack, and the other injected providers are accepted when they are actually present. A wallet that is not in the browser is not drawn as if it were connected.",
    "There is a limit that belongs in this section. The desk does not run when the tab is closed. An agent shift is a function on a timer in the open page. A mobile wallet that does not inject a provider into this window is not signed through a deep link. Those are honest boundaries of a browser desk, not missing adjectives.",
)

add(
    "A session",
    "A person opens Senda on a laptop. The left rail is the product: Home, PreStocks, Convert, Play, Shop, AI Agent, Send, Portfolio, and under them Cover, Work, Trade, Solana, Books, Docs, and Account. The top of the window searches a name or jumps to a desk by a word. Connect asks for the wallet that is installed, not for a Senda password. Signing in is optional and is not the wallet.",
    "Home shows the wallet total it can actually add up, the live book, and the six things you can do next. From there the path is short. Buy a company goes to the book. Convert goes to the swap. Play goes to the floor. Shop goes to the number. Send goes to a person. An agent goes to a bound.",
    "Nothing on that path requires the person to understand an associated token account, a versioned transaction, or a memo program. Those exist underneath the buttons that need them. The surface is the name, the size, and the signature.",
    "The docs tab, this file's sibling inside the app, is the same map in shorter form. It is there so a person inside the product can see what is live and what is not, without a pitch. The PDF is the long version for the submission.",
)

add(
    "The book",
    "PreStocks is the list of names. Each row has a last print and a premium against its mark. The prints come from the issuer's public market data. Senda does not invent them, smooth them, or take the other side of the trade. A name with no last price is not offered as if it had one.",
    "The ticket is the first working control. You choose the name, you set a dollar size, you see the Jupiter quote, and you buy. Buying three is the same act three times: three names, one size, three signatures, each leg reported with its signature or its error. A failure on the second leg does not pretend the first leg failed, and it does not pretend the third leg happened.",
    "On the same name you can open a cover, mint a number aimed at a store, or stand on the print. Those are not separate products with separate accounts. They are things you can do with the name you are already looking at. The strip above the ticket shows what this wallet already holds of the book, and it links to the portfolio.",
    "The premium is the interesting number. It is how far the print sits from the mark. The games that ask which name is furthest or closest are asking that question with money on it. The agent job that buys the cheap print is the same question, queued instead of played. One book, several uses, no second price.",
)

add(
    "How a buy is signed",
    "A buy starts as a size in dollars and a mint. The desk asks Jupiter for a route. The person sees what leaves and what comes back, including the route, before any signature is requested. If the quote fails, the button does not invent a fill.",
    "The transaction is simulated before the wallet is asked to sign. The simulation does not require the signature to be present. If the chain would reject it, the person hears that first, and the wallet is not opened for a transaction that cannot land. When it can, the connected Solana wallet is asked to sign and send, or to sign so the desk can broadcast the signed bytes. The signature that comes back is the receipt.",
    "The token arrives in the wallet that signed. Senda's portfolio reads it back by matching the mint on the token account to the mint on the book. Until that balance exists, the portfolio does not show a position. There is no optimistic row.",
    "Selling a slice back is the route in the other direction. Convert is that same idea made into the page: you pay, you receive, you sign. SOL can be the thing you pay. The route underneath can pass through USDC into the name. The person does not have to leave the desk, swap on another site, and come back. That path is the one that makes an existing wallet already useful.",
    "What this is not: a matching engine, a market-maker balance, or a promise of a fill better than the route. The venue is the route. The desk's job is to show it and to get it signed by the right wallet.",
)

add(
    "Portfolio and the sleeve",
    "Portfolio is the PreStocks this wallet holds, marked live. The total is the sum of token amounts times last prints. Each row is the symbol, the name, the tokens, the last, the value, and the premium. Logos are shown for the names the desk has marks for. A wallet that is not connected, or that holds none of the mints, sees an empty book and a way to the ticket. It does not see sample shares.",
    "Under the book is the cash sleeve. Wrapping marks USDC the wallet already holds so the desk can treat a slice of it as reserved. Sending it back releases that mark to the same wallet. The USDC does not move into a Senda key. The sleeve is a label on funds the wallet still controls, which is why the release path exists and why it matters.",
    "This split is the accounting of the product. Chain balances are truth for tokens and for USDC. The browser ledger is truth for Senda cash. The portfolio page is about the first. The send page, the shop, and real-money play are about the second. Mixing them into one number without saying which is which would make the desk look richer than it is. The home total only adds figures the desk has actually read.",
    "There is no margin and no broker account behind the portfolio. You cannot borrow against the names inside a credit facility Senda does not operate. The cover, described later, is a payoff the desk can settle in its own cash. It is not a loan.",
)

add(
    "Convert",
    "Convert is the swap, and it is the whole page. The amount you pay, the amount you receive, and the route are the content. The button signs. If a sell-back of a name you hold is available, it is the same control in the other direction.",
    "The reason this page exists separately from the ticket is that not every conversion is a purchase of a name. A person may hold SOL and need USDC before they need a name, or they may be done with a name and want USDC back in the wallet. Forcing that through the buy ticket would hide it. Putting it here makes the wallet a source of funds rather than a login.",
    "There is no limit order, no recurring schedule on this page, and no fiat ramp that is not the card path described under shop. Those are listed as not built because a convert page that implied them would be a different product.",
)

add(
    "Play",
    "Play is ten games on the same book. The result of each one is taken from the live prints, not from a hidden random draw. The wheel stops on a pocket derived from the prices. The slots stop on faces derived from them. Up or down locks a print and pays if the name moves the way you called. Furthest and closest pay if you picked the name with the widest or the tightest premium. The ride climbs until a bust level that was fixed from the lead print, and you choose when to get off. Higher or lower reveals the next name on the book. A parlay is two calls, cheap or rich, and both have to be right. Dice faces come from the cents of the prints. Mines hides three cells from the same prices, and you lift three.",
    "The pay table is on the felt. A hit on the wheel pays the field. A pair pays twice and three of a kind pays twelve. Up or down pays twice. Furthest and closest pay five. The ride pays the multiple you cashed. Higher pays just under twice. A clean parlay pays three point four. Dice pays twice, or five on seven. Three safe tiles pay four. A push, where the print did not move, returns the stake. These numbers are the game. They are not a claim about a fair casino odd, and they are not a security.",
    "Practice and real are different balances, and the desk says which one you are on. Practice starts empty until you load five hundred. That five hundred lives in this browser. A practice round never calls the cash ledger and never asks the wallet. Real rounds move Senda cash: the stake leaves, the payout comes back, in one write, so a crash of the page cannot take the stake and forget the win. If real cash is empty, the desk says so and leaves you on practice.",
    "The games are faced with the names. That is the point. You are not spinning a generic wheel that happens to sit near a market. You are taking a side on a print you can also buy. The floor is a way to learn the book with practice money, and a way to use the book once you understand it. It is not a promise of profit, and the house edge is visible in the pay table.",
)

add(
    "Shop",
    "Shop is how a holding becomes spendable without being sold. You mint a number. It can be a virtual card or a one-time number with a merchant and a cap. Store tiles fill the merchant and the cap. They do not charge anything by being tapped. The number is created when you ask for it. The full number is shown once. What is kept is the last four and the cap.",
    "A charge debits Senda cash and lands in expenses, grouped by the merchant you actually charged. If you have not charged anything, the list is empty. There are no sample expenses.",
    "This has to be said plainly, because a card-shaped object is easy to overread. The number is minted by the desk. It is not a bank identification number. A merchant may decline it. Apple Pay is not built. A licensed issuer is not built. What is built is the cap, the one-time reveal, the charge against the cash ledger, and the record. That is a spending instrument for the demo and for any rail that later accepts it. It is not a claim that every terminal will.",
    "The reason it belongs next to PreStocks is the consumer half of the bounty. Owning a tokenized name is more useful if the person can aim a bounded number at a store without first routing the name back to USDC. The bound is the cap. The source is Senda cash. The token stays where it was.",
)

add(
    "Cover",
    "Cover is the drop. You pick a name and cover a ten percent fall. The premium is a slice of the size. The strike is the print you locked, ten percent under. If the live price falls through that strike, the cover pays the size back into cash. The token is not taken from the wallet to do it.",
    "It is not a licensed insurance policy. There is no carrier, no schedule of benefits, and no claim against anyone but the desk's own rules. The page says that. The button still has to be real: premium, strike, and status come back from the cover you opened, not from a picture of a policy.",
    "Where the on-chain path is the one the page already uses, opening the cover is a transaction you sign. The policy is recorded, and the premium moves as that transaction says. Settlement pays back through the same desk when the print is through the strike. Where a cover is still a cash-ledger contract, it is that, and it is not described as a carrier. The agent can flag a name that is down hard. It cannot open the cover. Opening it is still your button.",
)

add(
    "Agents",
    "An agent in Senda is an envelope, not a model with a key. The envelope has a name, a mandate, the symbols it is allowed to watch, a maximum size, a side, and a job. The jobs are scout, discount, rich, daily, cover, and clerk. Scout writes which name is cheapest and which is richest. Discount queues a buy when a name is more than three percent under its mark. Rich queues a sell when a name is more than three percent over. Daily queues one buy and will not queue a second the same day. Cover writes a line when something is down hard, and stops. Clerk writes the premium onto the sheet.",
    "You can make that envelope yourself: type the name, the mandate, the job, the side, the size, and the symbols. Leaving the symbols empty means the whole book. You can arm one of four ready desks that build the same kind of envelope. You can paste one in as JSON, and a bad paste is a toast, not a crash. The mandate is stored with the envelope. The shift does not treat the mandate as a prompt it is free to reinterpret into a larger trade. The job and the size are the bound.",
    "A shift runs on a short timer while the page is open, and it will not run twice inside eighteen seconds. It holds one queued order. The next shift replaces it. Before a buy or a sell is queued, the order passes a gate. The size cannot exceed the spend cap. A buy is cut when the tape is weak. New buys stop when the book is fifteen percent off its recent peak. If the tape matches a send you already made in this browser, the size is cut again and the log says why. The gate's reason is the log line you read. The agent still does not sign.",
    "Memory is the last sends, stored as the premium, the day's change, the drawdown, and the side. It is not a language-model embedding. There is no embedding model in the app, and inventing one would be a fake. The computer next to the agent can show the book, quote a symbol, print that memory, show the wrap, and write a note. Those are the only commands. Signing remains a separate press, in the wallet, on the queue the gate allowed.",
    "This is the advanced workflow the desk actually has. Propose, gate, remember, wait. It is not a committee of agents, and it is not a background worker with its own key. A second signer would break the bound that makes the agent safe to arm. A shift that continued after the tab closed would be a claim this browser cannot keep.",
)

add(
    "Send, work, trade, and the record",
    "Send moves Senda cash. You name a person, you set an amount, you send. Presets fill twenty, fifty, a hundred, or two hundred and fifty. Pay again is built only from people you have actually transacted with, and tapping one fills the form. It does not send until you press send. Request, a nearby pass, exchange, and add are on the same page because they are the same cash. None of them is a bank wire, and none of them creates a balance on another computer.",
    "Work is the sheet. It sits next to the book. You can edit it. The clerk job can write onto it. It is a place to keep a note beside a name, not a document suite and not a shared drive.",
    "Trade is a ticket. Size, side, sign. It is not a central limit order book, and the page does not draw one. If the signature path is the same wallet path as a buy, that is because there is one signer in this product, not a second matching venue.",
    "Solana is the mint list. Each name you can trade has an address. The page shows those addresses from the book it already loaded, and you can copy one. That page exists so the token is visible as a token. A ticker without a mint would be a brokerage costume.",
    "Books is the ledger of this browser. Lines appear because something moved: a send, a play round, a charge, an add. If nothing has moved, the page is empty. Account is the wallets you linked, the cash, and the privacy note. Privacy is also its own page. It says the key stays in the wallet, the browser ledger stays in the browser, the card number is shown once, and the prices are not Senda's.",
)

add(
    "What the desk refuses to fake",
    "A competition demo is under pressure to look finished by filling holes with numbers. This desk has a rule instead. If the wallet is not connected, balances that come from the chain are zero or absent. If a name has no print, it is not on the felt. If a game has not been played, it does not celebrate a win. If no card has been charged, expenses are empty. If no agent has been made, the roster is empty. If a wallet extension is not in the browser, it is listed as not here.",
    "Practice cash is the one balance you can create on purpose, and it is labeled practice. Loading it does not increase the wallet and does not increase Senda cash. Real play will not spend it. That separation is the difference between a way to learn and a fake account.",
    "The same rule cuts the other way. The desk does not hide behind a modal that explains the product instead of showing it. Each page leads with the control that page exists to perform. A short line says what is live and what is still coming. The long form is this document and the docs tab, not a paragraph sitting on top of the button.",
    "Transitions are the small motion when you change desks, and the small motion on a button. They are there so the app feels like one surface. They are not a feature. Reduced motion in the browser turns them off.",
)

add(
    "Security",
    "The private key never enters Senda. Connect returns a public key. A swap, a cover that is on-chain, and any other chain write are signed in the wallet. The desk can build the transaction and simulate it. It cannot approve it.",
    "The browser ledger is not encrypted against the person at the machine. Anyone who can open the site on that profile can see the cash balance, the agent logs, and the sheet. That is stated because calling localStorage a vault would be false. The vault in this product is the wallet. The sleeve is a mark on the wallet's USDC. The cash ledger is a convenience balance with a spend cap in front of the agent.",
    "The agent gate is the control that matters once a queue exists. A queued buy is clipped to the cap, clipped again on a weak tape, blocked on a deep drawdown, and reduced when it rhymes with a send already made. None of that is a substitute for the signature. It is what keeps a bored shift from presenting a reckless ticket.",
    "Card numbers are shown once and stored as a last four and a cap. They should be treated as desk instruments, not as payment credentials you type into a stranger's checkout and then forget. The docs say a merchant may decline them. That sentence is a security property as much as a product limit: the number is not laundering a real PAN through the app.",
    "There is no claim of a post-quantum scheme, a hardware enclave, or a custody audit in this submission. Those would be different documents. This one claims a narrow thing. The signer is the user's wallet. The desk does not get a key. The agent does not become a signer. The ledger that is not on-chain is labeled as not on-chain.",
)

add(
    "What is live, and what is not",
    "Live: the book and the prints. A Jupiter quote and a wallet signature for a buy, a three-name buy, a convert, and a sell-back. A portfolio read from token accounts. A sleeve you can mark and release. Ten games with a practice balance and a real cash balance. A shop number, a one-time reveal, a charge, and an expense line. A cover with a premium, a strike, and a status. An agent you create, paste, or arm, which queues inside a gate and waits for you. Send, request, nearby, and add on the browser ledger. A sheet. A trade ticket. The mints. The ledger. The docs. This note.",
    "Not built, and not decorated to look built: a brokerage account, margin, a bank wire, a card network a merchant must accept, Apple Pay, an agent that signs with its own key, a shift that runs after the tab closes, a limit order, a shared table between two wallets, and a login that carries the browser ledger to another computer.",
    "The distinction is the product. A judge who connects a wallet can buy a name and see it on the portfolio because the chain says so. A judge who does not connect a wallet can still read the book, load practice cash, and play the print. A judge who reads this file can see which of those two moments was which.",
)

add(
    "How to run it",
    "Open the app. The rail is the map. Connect a Solana wallet if one is installed in the browser. If none is installed, the picker says so, and the chain-backed actions wait. Load practice cash on Play if you want to see a game pay without funding the cash ledger. Open PreStocks to quote a name. Open Portfolio to see whether the wallet holds any of the mints. Open Agents and make one with a small size. It will write. It will not sign. Open Docs for the short map, or download this PDF from that page.",
    "A signature always happens in the wallet, and the wallet will ask. Declining it cancels the action. The desk does not retry a rejected signature in the background.",
    "The code is in the Senda repository under ItsNotAILABS. The app is a web desk, built to be used on a laptop, which is where the book, the ticket, the felt, and the agent roster fit on one screen. The rail stays put. The desk changes. That is the whole navigation model.",
)

add(
    "Why this should be considered",
    "The bounty asked for a reason these tokens are better to own inside a new app than inside a brokerage. Senda's reason is specific. The wallet is already the account. The mint is already the position. The route is already the trade. The desk adds the layer the brokerage would have added, and the layer a brokerage cannot add: a cover on the print, a floor that uses the print, a number aimed at a store, and an agent that is allowed to look and not allowed to sign.",
    "It belongs on Solana because the asset is on Solana and the signature is a Solana signature. Moving it off the chain to make the interface familiar would throw away the only thing that makes a pre-IPO name tradable at midnight.",
    "It is not finished in the way a bank is finished. It is finished in the way an alpha of this wedge should be finished. Every desk does the thing its name says, the thing is wired to a real balance or a real signature, and the places it stops are written down. That is the submission.",
    "ItsNotAILABS built it as one app, one wallet, one book. The PDF is the account of that app. The app is the thing to use.",
)

# --- expand with a worked session so the note carries a judge through the desk ---

add(
    "A worked session, from an empty browser",
    "Start with nothing connected. Home still shows the live book, because the prints do not require a wallet. The wallet total is zero, and it says so by being zero. The action tiles still go where they say. This is the first honesty check. A desk that invented a balance here would be easier to screenshot and worse to use.",
    "Open Play. The mode is practice. The balance is zero until you load five hundred. Load it. The figure is marked practice. Pick the wheel, pick a name, set a stake of ten, and spin. The pocket is a function of the prints on the book at that moment. If your name hits, practice goes up by the field multiple. If it does not, the stake is gone from practice and real cash is untouched. Switch the toggle to real. If Senda cash is empty, the round refuses and tells you to go back to practice or to add cash. That refusal is the product working.",
    "Open PreStocks. The ticket is in front. Choose a name that has a mint and a last price. Set a small size. Ask for the quote. If Jupiter returns a route, you see the out-amount. If it does not, you see the error and there is nothing to sign. Connect the wallet when you are ready to sign, not before you have read the quote. Approve in the wallet. The signature is the result. Open Portfolio. If the token account has caught up, the row is there, valued at the last print. If it has not, the book stays empty rather than showing a pending fantasy share.",
    "Go back to the name and look at the cover. The premium and the strike are functions of the size and the print, not of a story. Opening it either produces a policy with those fields or it tells you why it did not. The agent page is the last stop in this session. Make an envelope called Scout, job scout, size twenty-five, no symbol filter. Arm it. The log will name a cheap print and a rich one. It will not open a wallet. Change the job to discount only if you want a queue, and only then look at the queued size. If the gate cut it, the line says the cap, the tape, or the memory. Pressing sign is a separate, later decision.",
    "That session is the end-to-end demo. It does not require a judge to believe a paragraph. It requires a wallet if they want a signature, and it requires nothing if they want to see the book and the floor.",
)

add(
    "The data the desk trusts",
    "Three sources are allowed to put a number on the screen. The issuer's public print puts the last price and the premium on a name. The wallet and the chain put SOL, USDC, and token amounts on the account. Jupiter puts the route and the out-amount on a ticket. Everything else is derived. Portfolio value is amount times last. A game pocket is a reduction of the lasts. A cover strike is the print times nine tenths. An agent queue is a name from that book, clipped by the cap and the gate.",
    "The browser ledger is a fourth source, and it is only allowed to speak for itself. Senda cash, practice cash, the sheet, the agent log, the spend cap, and the card's last four are local. They are not displayed as chain balances. A send of Senda cash does not claim a Solana transfer. A practice win does not claim a wallet credit. This separation is why the product can be both a chain app and a cash app without lying about which dollar moved where.",
    "When one of the three external sources fails, the desk keeps the last honest state or shows the error. It does not substitute a model price. A missed quote is an error string. A missing print drops the name out of the games. A missing wallet leaves the chain figures at nothing. The agent, if the book is empty, writes that it has nothing to watch. Silence is preferred to a fictional tick.",
)

add(
    "Programming the name, without giving away the key",
    "The bounty language about programmable assets is easy to overbuild. A programmable share, in this desk, means the name is an input to more than one function, and each function has a bound. The ticket buys it. The portfolio marks it. The cover takes a strike from it. The floor reads it. The agent watches it. The shop does not need to sell it in order to spend. The sleeve does not need to take it in order to reserve USDC. That is composability at the level of a person, which is the level this product is for.",
    "Each of those functions returns to the same constraint. If it changes the chain, the wallet signs. If it changes the browser ledger, the ledger writes both sides of the round together. If it only writes a sentence, it does not also move money. Scout and clerk and the cover flag are sentences. Discount and rich and daily are queues. The signature is never inside the sentence and never inside the queue.",
    "This is also why the agent computer is closed. An open tool loop that could add a function at runtime would eventually add a send. The commands are the book, a quote, the memory, the vault, and a note, because those are the questions a watcher needs and none of them is a signature. A person who wants a different watcher pastes a new envelope. They do not paste a new authority.",
    "Composability of that kind is the Solana argument in product language. The mint is the object. The wallet is the capability. The desk is a set of functions over both. Adding a function does not require a new custodian. Removing a function does not strand the token, because the token was never here.",
)

add(
    "What a brokerage still does better, and why that is acceptable",
    "A brokerage has transfer agents, tax lots, a telephone, insurance on the cash sweep, and a regulatory perimeter. Senda has none of those, and a submission that implied them would be a worse app, not a better one. The person who needs a retirement account and a 1099 is not the person this desk is for, this year. The person who has USDC at midnight and wants a pre-IPO print is.",
    "What the brokerage does worse is the thing the chain already solved. It is closed. It does not speak to the wallet. It cannot show the mint. It will not let an agent you bounded propose a trade you then sign in public. It will not let you learn the names on a practice felt that settles against the same prints the ticket uses. Those are not decorative differences. They are the reason to build on the token instead of on a replica of the token.",
    "The quality bar for this alpha is therefore not feature parity with a broker. It is that a person can tell, on each page, what will happen if they press the button, that the button does that and not a cousin of that, and that the pages agree with each other about what a dollar is. Home, the book, the portfolio, convert, the floor, the shop, the agent, send, and cover are one desk because they share that definition.",
)

add(
    "The submission, in the form the bounty asked for",
    "The user is a wallet holder who wants pre-IPO names without a brokerage day. The problem is that the token exists and the operating layer does not. The demo is the desk: quote, sign, hold, cover, play, spend, propose. The Solana reason is that the position is a mint and the signature is a wallet signature. The execution is the app in the repository, plus this note, plus the docs tab that says the same things in fewer words.",
    "Individuals and teams were allowed one submission of original work. This is that submission. Open-source components are Jupiter, the wallet providers, and the public market data, and they are used as services the user already has, not relabeled as Senda inventions.",
    "If a judge only has time for one path, the path is this. Open the book. Read a print. Load practice cash and play that print. Then connect a wallet and quote the same name. The two moments use the same number. That is the product.",
)


def words() -> int:
    n = 0
    for title, paras in SECTIONS:
        n += len(title.split())
        for p in paras:
            n += len(p.split())
    return n


class Note(FPDF):
    def footer(self) -> None:
        self.set_y(-15)
        self.set_font("Body", "", 9)
        self.set_text_color(90, 90, 90)
        self.cell(0, 8, f"Senda  ·  ItsNotAILABS  ·  {self.page_no()}", align="C")


def main() -> None:
    n = words()
    print("words", n)
    if n < 5000:
        raise SystemExit(f"short by {5000 - n}")
    pdf = Note(format="Letter")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(18, 18, 18)
    pdf.add_font("Body", "", FONT)
    pdf.add_font("Body", "B", BOLD)
    pdf.set_title("Senda — submission note")
    pdf.set_author("ItsNotAILABS")
    pdf.add_page()
    pdf.set_font("Body", "B", 22)
    pdf.set_x(18)
    pdf.multi_cell(0, 10, "Senda")
    pdf.set_font("Body", "", 12)
    pdf.set_text_color(40, 40, 40)
    pdf.set_x(18)
    pdf.multi_cell(0, 7, "A desk for tokenized pre-IPO names on Solana. Submission note. ItsNotAILABS.")
    pdf.ln(4)
    for title, paras in SECTIONS:
        pdf.set_x(pdf.l_margin)
        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Body", "B", 14)
        pdf.multi_cell(0, 8, title)
        pdf.ln(1)
        pdf.set_font("Body", "", 11)
        pdf.set_text_color(20, 20, 20)
        for p in paras:
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(0, 6, p)
            pdf.ln(2)
        pdf.ln(2)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    print("wrote", OUT, "pages", pdf.page_no())


if __name__ == "__main__":
    main()
