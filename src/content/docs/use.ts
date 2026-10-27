import type { DocBook } from "./types";

export const useBook: DocBook = {
  id: "use",
  label: "Use",
  lede: "Connect the wallet you already have, read the live book, and sign only the move you mean to send.",
  pages: [
    {
      id: "first",
      title: "Open the desk",
      body: [
        {
          h: "Find the page",
          p: [
            "The left column is the map. The first group is Home, PreStocks, Convert, Play, Shop, Make, AI Agent, Send, and Portfolio. Under the divider you will find Cover, Work, Trade, Solana, Books, Docs, and Account. If the column is collapsed you still see the marks; open it when you need the words. The search field above the stage takes a ticker, or a short word such as home, trade, send, cover, play, work, or docs, and it only changes the page. (1) Open Senda in this browser. (2) Read the column before you touch a ticket. (3) Use search to move, not to order. The column stores no key and it shows no fill.",
            "Until a wallet is linked, the header shows Connect Phantom. If the desk is sealed, the foot of the column shows Open with wallet. Both ask a provider that is already installed in this window. Phantom, Solflare, Backpack, and the other names in the picker appear only when that provider is actually present. Connect returns a public key. Senda does not receive the secret, and it does not invent a key for you. After the link, the header shows the wallet label and the first characters of the address, and a tap there opens Convert. Sign in, lower in the column, is a browser session. It does not replace the signer, and it does not carry this browser's cash to another computer.",
          ],
        },
        {
          h: "Read Home",
          p: [
            "Home is the wallet and the live book, on one screen. Your wallet shows a total and four lines: SOL in the connected wallet, USDC that the chain reports as spendable, Cash for send and shop, and PreStocks still in the wallet marked at the live price. SOL, USDC, and the token marks are read from the chain. Cash is a ledger kept in this browser. If nothing is connected, the total stays at zero and the line says so. Open, or Connect Phantom, goes to Convert. Get started opens PreStocks. Send opens the payments page. None of those three buttons moves money by itself.",
            "Under the balances, the live book is a row of names. Each chip shows the symbol, the last print, and the premium of that print against its mark. Tap a chip to select it. The selection is written in this browser so Cover, Work, and the other desks can open on the same name. View all opens the full PreStocks page. Below the chips are six tiles: Buy a company, Convert money, Play, Shop, Send, and Give an AI a budget. They are doors. A buy, if you want one from Home, is the card under the tiles: the chosen name, a dollar size, and a signature in the wallet that holds the mint. The token does not come to Senda.",
          ],
        },
        {
          h: "Pick a name",
          p: [
            "PreStocks is the book of tokenized names, open when a brokerage is not. The page leads with a chart of the selected name. The line runs from the 24-hour open to the last print. It is not a candle history, and the bends in the line are only so you can read it. Under the chart, the ticket asks you to choose a name. You see last, and the premium versus the mark. Type a dollar size, or use the chips 10, 25, 100, and 250. Jupiter quotes that many dollars of USDC into the mint. You see the amount out and the impact before anything is asked of the wallet.",
            "(1) Select the name. (2) Set the dollars. (3) Read the quote. (4) Press Buy, which is labeled with the dollars and the symbol. The wallet asks once. If the route would fail, or if impact is over five percent, or if the size is over the send cap, the wallet is not asked. The cap starts at $100 and cannot be set above $5,000. Raise it on Portfolio before you try a larger size. Pay with SOL instead leaves this page and opens Convert with that name already chosen. If the wallet already holds the mint, a second control sells the same dollar size back toward USDC. Selling does not create a paper share. There is no share.",
          ],
        },
        {
          h: "See the mint and the account",
          p: [
            "Solana is the list of mints behind those names, plus PRE8. PRE8 weights the live names by mark value. One thousand means the token price matches the mark. The card shows the index, the mint you have selected, and Copy mint, which puts that address on the clipboard. Trade it opens the ticket. Buy a name returns to PreStocks. Convert SOL opens the swap. The page also states the rule of a buy: Jupiter builds the route, only SOL, USDC, and these PreStock mints are allowed, the chain simulates the transaction, impact over five percent is refused, and you sign. Minting or redeeming with an issuer is not this page. The index is public. A buy still waits until a wallet is connected.",
            "Account is the wallet connection and the cash this browser already keeps. It lists every signer you linked, by label and shortened address, and it offers the picker again if none is connected. Open wallet goes to Convert. The cash figure beside it is the browser ledger, with pockets for USD, USDC, and SOL, and a count of cards. From there you can open Add money, Send, Nearby, or Exchange. Privacy opens the note. Sign in to keep this wallet is the session, not a new key. The address labels on the lower card, including ACH, BIC, and EUR, are labels on this account. The page says they are not an account at a bank. Do not treat them as a deposit a payroll file will clear.",
          ],
        },
      ],
    },
    {
      id: "trade",
      title: "Buy and sell",
      body: [
        {
          h: "Set the ticket",
          p: [
            "Trade is the ticket. The chart at the top is the selected name. Its line runs from the 24-hour open to the last print, not from candles. The window controls read 24H, 7D, 30D, and ALL, but they do not load a separate history. Read the last print, the mark, and the 24-hour change on the ticket itself. The name chips under the title change which PreStock the ticket is aimed at. The large figure is the size you have armed, in dollars. Type a size, or press $25, $100, $250, or $1000. Those four chips set the size. They do not send.",
            "(1) Choose the name. (2) Set the size. (3) Press Buy or Sell so the side is the one you mean. The live side is filled; the other stays an outline. (4) Press Sign, labeled with the side and the symbol, for example Sign buy or Sign sell plus the ticker. If the book has not loaded a PreStock, the ticket says there is nothing to sign and the button is not offered. Cash in the side column is the browser ledger plus the mark of paper positions on this book. It is not the USDC balance in Phantom. If that cash figure is short, the page can open Add money. The signature on Sign does not spend that paper figure. It spends what the wallet holds on Solana.",
          ],
        },
        {
          h: "Sign the route",
          p: [
            "Sign builds a Jupiter route and asks the wallet you connected. A buy spends USDC, six decimals, and receives the PreStock mint. A sell spends a slice of that mint, sized from the dollars and the last print, and receives USDC. Only SOL, USDC, and the listed PreStock mints are allowed on the route. Anything else never reaches the wallet. The chain simulates the transaction first. If simulation fails, the wallet is not asked. If price impact is over five percent, the wallet is not asked, and the desk says so. If the dollar size is above the send cap, the wallet is not asked. The default cap is $100. The ceiling is $5,000. Raise it on Portfolio, then come back.",
            "You sign in the wallet. The private key never enters Senda. While the wallet is deciding, the button reads Waiting for the wallet. After a signature, the token account of the signer holds the mint, or the USDC, depending on the side. Senda does not custody the position, and it does not take the other side of the trade. The print you bought against is the public last, not a price the desk set. A signature is public once it lands. There is no limit order on this ticket, and there is no central book that rests your size until a later print. If you do not sign, nothing moves.",
          ],
        },
        {
          h: "Convert inside the app",
          p: [
            "Convert is the way to go from SOL to USDC to a PreStock without leaving the desk. The swap card has two sides. You pay is an amount, then SOL, USDC, or a PreStock this wallet already holds. You receive is USDC or one of the listed names. The quote fills in the amount out. Under Fee you see the route Jupiter named, the impact, and Min, which is the least the swap will still accept. Read those before you press Convert. The network of the swap is Solana. There is no bank in the middle, and there is no field that wires fiat. If you pay and receive the same asset, the card tells you to pick a different name. Convert stays disabled until a quote exists.",
            "A typical path is three looks and one signature. (1) Pay SOL, receive USDC, read the minimum, press Convert, and sign. (2) Pay that USDC, receive the PreStock, read the minimum again, press Convert, and sign. (3) Open Portfolio and confirm the mint is in the wallet at the last print. Sell back, on the same page, is the reverse for a name you already hold. Pick the symbol, set dollars or use $10, $25, or $100, and sign the sale. The button tells you what that slice can raise at the live token price. If the wallet holds none of the mint, Sell back says so and does not invent a position. Impact over five percent, or a size over the cap, stops the wallet prompt here the same way it does on Trade.",
          ],
        },
        {
          h: "Use the desks under the ticket",
          p: [
            "Under the ticket, ten desks share the same size and the same selected name. Spot is buy or sell on Jupiter, the route Sign already uses. Protect pegs last to the SPV mark. Options is a call or a put on the print: a put is insurance on last, and lifting one signs a USDC premium the way Cover does, then you settle it on Cover. Perps is a levered long or short kept as paper on this browser, funded from the premium of last versus mark. It is not a position on an exchange, and it does not move the mint. Index is the PRE8 basket, the same names weighted by mark. Borrow is cash against a holding, and only for names Kamino already lists. The share, if you post one, stays yours.",
            "Launch points at Pump, LetsBonk, and Clanker. Curve is a bonding curve on this desk. Radar lists names that sit off their mark, which is a reading of the book, not an order. Rails names Jupiter, Meteora, and Raydium as the venues a route can already use. Open a desk by its tile. Do not assume every desk signs. Spot signs. An option premium signs. A perp or a paper book entry stays in this browser until a control on that desk explicitly asks the wallet. The ticket above them is still the place a plain buy or sell is signed. If you only wanted the mint, stay on Spot, set the size, choose the side, and sign once.",
          ],
        },
      ],
    },
    {
      id: "money",
      title: "Pay, send, and hold",
      body: [
        {
          h: "Read what you hold",
          p: [
            "Portfolio is the PreStocks in the connected wallet, token balance times the last print. Empty means the wallet holds none. It is not a brokerage account, and the page says a broker account and margin are not built. The total updates when the print moves. Each row shows the symbol, the token quantity, last, value, and the premium versus mark. Fills, lower down, are invest and cover lines this account already wrote. They are a journal in this browser. They are not a second copy of the chain. If the wallet is still being read, the total waits. Connect first if the address is missing. Open PreStocks is the way back to a buy when the table is empty.",
            "The cash sleeve is a claim, not a transfer of custody. Wrap marks USDC that stays in Phantom. Push back, the button beside Wrap, sends that claim back into the unwrapped figure. The token never moves to Senda. You can wrap what Phantom holds, or type an amount. You can push only what is already wrapped. Agent cap is the most one send may move. The chips on the sleeve are $25, $100, and $500. The default is $100, and the stored ceiling is $5,000. The cap is local. It does not freeze the wallet. It stops this desk from asking you to sign a larger swap or payment until you raise it. Fund an agent opens AI Agent, still inside that cap.",
          ],
        },
        {
          h: "Send on two rails",
          p: [
            "Send opens on Solana Pay. Type a USDC amount, paste their Solana address, and press Sign USDC. USDC leaves the wallet you connected. Nothing sits in a Senda balance in the middle. The mint is the mainnet USDC mint, six decimals. If the receiver has no USDC account, the same transaction creates it and you pay the rent. A memo can carry a reference so the payment can be found. When the signature returns, the line opens on Solscan. The send cap applies. If you are not connected, the button tells you to connect a Solana wallet and does not pretend to pay. This is the payment a Solana address can actually receive.",
            "The other controls on the same page move cash that lives in this browser, not on the chain. (1) Cash sends to a tag you type, in USD, EUR, GBP, MXN, USDC, or SOL, with chips at $20, $50, $100, and $250. Press Send. The tag is remembered on this machine. Another computer does not have it. (2) Nearby hands a payload to a device close by. It is not a server. (3) Exchange moves one pocket into another. USD and USDC are one to one. The other pairs show a mid-market rate and what you will hold. (4) Request asks a tag and then credits this ledger. It does not collect funds from someone else's bank. (5) Add opens Add money into a pocket. Treat that cash as local until a signature, not a toast, has moved USDC.",
          ],
        },
        {
          h: "Use the shop face",
          p: [
            "Shop shows a card face and, more important, a set of tiles that are real Solana actions. The tiles are PreStock through Jupiter, USDC through Solana Pay, SOL into USDC on Convert, Cover, Agent against the spend cap, Borrow for names Kamino already lists, Wrap as a claim on Phantom USDC, and The book for the names that are live now. Tap a tile to fill the amount and the rail. The tile does not invent a store, and it does not clear a purchase at a terminal. A Jupiter tile still ends in a signature. A Solana Pay tile still ends in Sign. A wrap still leaves the USDC in the wallet.",
            "You can also make a number on this cash. The kinds are Everyday, One charge, and Fleet. You set a name and a limit. The desk tells you the number is on this cash and that a store network will not clear it. A one-time number is shown so you can charge it here. That charge debits the browser ledger. Visa does not see it, Apple Pay is not built, and a merchant acquirer will decline the digits. Do not read the card art as a BIN. The payment a Solana merchant can clear is the USDC transfer on the tile, signed by the wallet. Freeze, if you use it, stops further charges against the local number. It does not freeze the mint.",
          ],
        },
        {
          h: "Pay a listing",
          p: [
            "Make is a board of work a person will pay for in USDC. The kinds are Job, Software, Service, Hardware, Robotics, and For a teacher. To post, choose a kind, name what it is, say who it helps, set a price in USDC, and paste the Solana address that should receive the payment. Put it on the board stores the listing in this browser. The price is not escrowed. Senda does not take a cut, and another computer does not see the listing until it is posted there. If the address is short of a public key, the board refuses the post.",
            "To pay, connect a wallet and press Pay in USDC, or Fund this on a teaching listing. The whole amount is a USDC transfer to the address on the card. You sign. The same rules apply as any other Solana Pay: the cap, the simulation, and the signature. The listing staying on this machine does not make the payment local. After the signature, the receiver's token account holds the USDC, whether or not they can see your board. If you wanted a private note instead of a paid listing, that is Work, not Make. If you wanted to buy a PreStock, that is Trade or PreStocks, not a listing.",
          ],
        },
      ],
    },
    {
      id: "cover",
      title: "Cover a print",
      body: [
        {
          h: "Cover a ten percent drop",
          p: [
            "Cover starts on a live name. The card is labeled 10% drop until you pick another tile. Choose the symbol. The strike is the last print at the moment you sign, not a mark you type. Set Size in dollars. The premium is four percent of that size, and at least one dollar, shown as USDC. The cover locks that print for a day. Press Cover 10%, or Sign the premium with the USDC amount, and the wallet asks once. While it waits, the button reads Waiting for Phantom. Premium, strike, and status fill in from the cover that comes back. Before a signature, status stays blank. A cover does not exist until the USDC moves.",
            "Read the line before you sign. If the token later prints at or under ninety percent of the strike, Settle returns the premium and asks you to sign a buy of the size you named. If it does not fall, Cancel returns the USDC. Neither button pays you out of a local cash balance, and neither button runs by itself. Settle is a separate signature. The screen that sold you the cover does not pay it in the same gesture. The PreStock you already hold is not pledged and is not sold. The token stays in the wallet. This is a parametric note on a print. It is not a put from an options exchange, and it is not a licensed policy.",
          ],
        },
        {
          h: "Cover the other tiles",
          p: [
            "The same card offers eight other tiles: Phone, Travel, Renters, Accident, Pet, Auto glass, Load, and Life. Each tile shows a term and a premium in USDC. Phone is thirty days. Travel is a trip of fourteen days. Renters, Accident, Pet, Auto glass, and Life are thirty days. Load is one haul. Premiums are fixed on the tile: nine, eighteen, fourteen, twenty-two, twelve, eleven, forty-five, and twenty-eight dollars. The face amounts on those tiles are larger than the premium. They are not a promise that a carrier will pay the face. Press the tile, read the blurb, and press Sign the premium. Life, as a mode switch, is this group. Drop is the ten percent print.",
            "These tiles are not underwriting. The page says they are not a licensed policy, and it says a licensed insurer and a pooled premium are not built. A phone crack, a delay, a rental loss, a vet bill, a windshield, a haul, or a death benefit is not adjusted by Senda, and no adjuster is in the loop. What you bought is a USDC transfer into the cover account, with the title and the terms written where the transaction can be read. If you need a regulated policy, buy one from a carrier. Use this desk only if you understand that the premium leaves, and that the payout cannot exceed what that account still holds.",
          ],
        },
        {
          h: "Pay the premium",
          p: [
            "The premium leaves as USDC from the wallet that signs. The desk shows Phantom USDC, which is what can pay, and the cover account, which is where the premium sits, with that account's address under the figure. The key for the cover account stays in this browser. Senda does not become the custodian of a general balance, and it does not pool your premium with anyone else's. One signature. The terms ride with the transfer. If you have no USDC, connect the wallet or convert into USDC first. The cover button will not invent a balance to debit.",
            "After the signature, Signed covers lists the row: title, status, premium, and the symbol or the word life. The signature opens on Solscan. Status open means the USDC is still in the cover account and neither Settle nor Cancel has been signed. Keep the same browser if you expect to settle later, because the cover record and the account key are local even though the USDC transfer is on chain. Clearing the site can separate you from the key that would return the premium. That is a property of this desk, not of Solana. Treat a premium like any other payment you cannot casually reverse from a second computer.",
          ],
        },
        {
          h: "Settle only what is held",
          p: [
            "A claim pays only what the cover account holds. It cannot pay a face amount out of nothing. On a ten percent drop, the honest sequence is: the print is at or under the line, you press Settle, the premium is sent back, and you sign a buy of the size you covered. If the print has not fallen, press Cancel and the USDC is sent back. You must be on the wallet that paid the premium. Both actions are signatures. The buy, if the drop has happened, is another signature, into the same mint, and it can still be refused for impact or for the send cap. Nothing in that sequence is an insurance check.",
            "On Phone, Travel, and the other tiles, the same limit is printed on the card. The premium is what moved. A claim can return only the USDC sitting in the cover account. It cannot pay the thousands named as cover. Do not file a loss against this page and expect a carrier's limit. Do not add the face amount to Portfolio. Portfolio marks tokens, not unearned claims. Books, if you open them, may show a cover line in the journal of this account. That line is not the cover account's on-chain balance. Read the cover account figure on this page, and the signature on Solscan, when you need to know what can still be paid.",
          ],
        },
      ],
    },
    {
      id: "work",
      title: "Notes, agents, and the books",
      body: [
        {
          h: "Keep a note beside the print",
          p: [
            "Work is a sheet beside the live book. The open row shows the symbol, the company name, the last print, the mark, and the premium. The note field is labeled by its placeholder, Why you care. What you type is saved on that row in this browser. It is not a transaction, it is not uploaded, and it is not shared. The page says sharing the sheet is not built. Under the note, every live name is a chip, and the table repeats token, mark, premium, and a note on each row. Put this on the page copies the open row into the longer note you keep as a page. A clerk agent can write the sheet. This page does not.",
            "Three modes sit on the card: Sheet, every name and one note; Desk, size it and compare; Page, the note that is yours. Cheap jumps to the name farthest under its mark and opens Desk. Rich jumps to the name farthest over its mark. Compare is the same size on two names, still a reading, not an order. Nothing on Work asks the wallet. If you want the mint after you have written the reason, leave for PreStocks or Trade and sign there. If you clear this browser's storage, the notes go with it. The prints do not. They are read again from the public book the next time the page loads.",
          ],
        },
        {
          h: "Write a purpose, then sign yourself",
          p: [
            "AI Agent is where you write a purpose. Make an agent asks for a name, a mandate, a job, a side of buy or sell, a max in dollars, and the symbols to watch. An empty watch list means every name. Create stores that agent in this browser. Bring one accepts the same fields as JSON if you already wrote them down. The agent can read the book. Look now checks the roster against the print and can queue a trade inside the max and inside the send cap. Ready desks can be armed the same way: they watch, and a queue shows the side, the symbol, and the dollars. Arm does not sign.",
            "Run writes the log. It does not sign. The line next to Run says so when nothing is queued, and it says a run writes the log when you press it. If a trade is queued, the wallet step is a different control: Sign, or Sign the queued trade, labeled with the dollars. You sign. The agent has no key, the shift does not continue after you close the tab, and an agent you host off this browser is not built. A blocked gate does not get a signature. The cap meter shows the ask against the cap you set on Portfolio. Lower the max, or raise the cap, before you sign. Until you do, the mint does not move.",
          ],
        },
        {
          h: "Play the print",
          p: [
            "Play is ten games settled on the live print: Wheel, Slots, Up / Down, Furthest, Closest, Ride, Higher, Parlay, Dice, and Mines. The pay table is on the felt. Wheel stops on a name you pick. Slots reads three faces from the book. Up / Down locks a print and you call the next move. Furthest and Closest use distance from the mark. Ride lets you step off a path the print is already on. Higher calls the next name. Parlay is two names, cheap or rich. Dice uses the cents of the print. Mines hides three mines in the print and pays three safe tiles. None of these is a random draw hidden from the book.",
            "Practice and Real are separate. Practice is the default. Load $500 fills a practice balance in this browser and does not touch the wallet or Senda cash. Stakes are $5, $10, $25, and $100. A practice round that you cannot afford tells you to load $500. Real stakes move Senda cash, the browser ledger, in one write. Wins come back to that same cash. If real cash is empty, the round refuses and tells you to switch to practice. The two balances never mix. A shared table with another wallet is not built, and a prize does not leave this browser. Play does not buy a PreStock. If the result makes you want the mint, that is still a signature on Trade.",
          ],
        },
        {
          h: "Close the books",
          p: [
            "Books is the digest of this account. It replays every send, card, cover, and buy the journal already stored, and it checks that replay against the cash this account can still spend. The large figure is suspense: the gap between the journal and that spendable cash. Zero means the books tie, and the pill says so. If they do not tie, the pill says that too. Beside it, Assets are cash plus stock at cost, Capital is what the books say you own, Suspense is the gap again, and Ghost is what a one-time number can still charge. The lines below are the journal rows, with kind, note, status, and amount. Nothing is filled in to make the page look busy.",
            "Read the digest as an internal book, not as a chain balance. It will not match Phantom. Portfolio is the chain, marked at last. Books is this browser. Suspense is not a debt a person can collect, and ghost is not USDC sitting in a token account. It is the remainder a local number can still charge against local cash. There is no export a CPA would file, and the page says that export is not built. Use Solscan for a signature, Portfolio for a mint, and this digest when you want to know whether the journal and the spendable cash still agree. If they do not, do not average them. Find the line that diverged.",
          ],
        },
      ],
    },
  ],
};
