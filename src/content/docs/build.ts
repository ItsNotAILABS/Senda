import type { DocBook } from "./types";

export const build: DocBook = {
  id: "build",
  label: "Building",
  lede: "How the desk is built, and how to tell a live path a wallet signs from a note that never leaves the browser.",
  pages: [
    {
      id: "map",
      title: "What the repo is",
      body: [
        {
          h: "The application",
          p: [
            "The user-facing desk is a web app. Vite serves it, React draws the desks, TanStack Router owns the file routes under src/routes, and the source is TypeScript. TanStack Start is why a few calls, including the sealed store, can run on the server from the same tree. Styles are the Tailwind tokens in src/styles.css. Optional login is Better Auth, and it is not the account. No environment variable is required to read the book or to ask a wallet to sign. From the repo root, npm install and then npm run dev put the desk on port 8080. npm run typecheck has to pass. Do not move that port, and do not commit .env, a seed, or a full card number.",
            "The pages a person sees are React desks under src/components, listed from app-shell and mounted by those routes. Home, PreStocks, Convert, Play, Shop, Agents, Send, Portfolio, Make, Cover, and Docs are one app, not a set of products. Functions that touch Solana live in src/lib, next to functions that only touch this browser. chain/senda-chain is Rust and chain/python is Python. Both encode a USDC transfer and a cover memo so the bytes can be tested without a wallet popup. chain/senda-program is a separate crate. Read it as an exercise in program layout. A change belongs in the function the button already calls.",
          ],
        },
        {
          h: "The path a person signs",
          p: [
            "A live path is a mainnet transaction an injected wallet is asked to sign. The swap is built in src/lib/jup-sign.ts. The payment is built in src/lib/solana-pay.ts. The cover premium is built in src/lib/cover-chain.ts. Each one uses the provider already in the window, from src/lib/wallets.ts and src/lib/phantom.ts. A missing extension is not drawn as connected. Portfolio is not on this list. It reads token accounts and signs nothing. A quote that never becomes a transaction is not a fill. A control that only writes localStorage did not move money, even when the label says buy, send, pay, or settle.",
            "There is no Senda program on the path a user signs. Do not tell a reader to expect an Anchor program, a CPI, or a program id as the product. src/lib/senda-program.ts exports a placeholder address and an instruction codec. That address is not what the payment or the swap puts in the message. chain/devnet.json records a devnet deploy of the cover exercise. The web app does not attach that id to the premium. User money moves as ordinary mainnet transactions of their own wallet: a Jupiter swap transaction, or an SPL Token transfer of USDC plus a memo. Cluster for that money is mainnet-beta.",
          ],
        },
        {
          h: "Three stores",
          p: [
            "Keep three stores separate when you read a screen. The browser ledger is localStorage: Senda cash, pockets, notes, listings, practice play, and the books digest computed from that journal. The optional server stores sealed blobs in Postgres, and only after a wallet signature grants the write. The public chain stores what a wallet already signed: token accounts, signatures, and memo text. A number can be copied from one store onto the page. Copying it does not promote it. If you add a figure, the component that renders it should say which store it came from. A reader should not have to open a reducer to learn that a balance dies when they clear site data.",
            "Prints for the names come from the public pre-IPO feed loaded in src/lib/sol-house.ts. Senda does not set that print and does not warehouse the other side of a swap. Jupiter quotes the route. The wallet that signs receives the tokens. Rust and Python can rank the same print against its mark, and they can rebuild the payment bytes. They do not submit the transaction and they do not hold a key. If a comment, a badge, or this book names a cluster, open the call and check the RPC host. A devnet line in a JSON file is not the cluster a Shop payment uses.",
          ],
        },
        {
          h: "This book",
          p: [
            "Docs live in the Docs tab of the app, route /docs, rendered by DocsDesk inside the same shell as the rest of the desk. This file is one of those books. It exports a DocBook: an id, a label, a lede, and pages. Each page has an id, a title, and sections. A section is a heading and a list of paragraphs. The type sits in src/content/docs/types.ts. The book does not sign, store a key, or create a balance. When a money path changes, change the sentence that described the old path in the same work, or delete it. A stale paragraph is worse than a short one, because a later reader will trust it over the function.",
            "Read this book beside the code, not instead of it. Start from the control on the desk, then the function it calls, then the instructions in the transaction. If this page and that function disagree, the function is the source and this page is late. AGENTS.md is the short manual for the same rule, copied out to the other agent files in the repo. Prefer the code when a memory from another project disagrees. Do not add a venue, tickets, or a guest list. That work was removed. Do not invent a balance, a card, or a position the wallet does not hold, and do not add a program id that was not deployed onto a transaction this app actually sends.",
          ],
        },
      ],
    },
    {
      id: "path",
      title: "A change that moves money",
      body: [
        {
          h: "Ask the wallet, or stop",
          p: [
            "If the wallet is not asked, money did not move. That is the test for a change that claims to buy, sell, convert, pay, or cover. Build the transaction, simulate it, and only then hand it to the injected provider. src/lib/phantom.ts simulates before send. If simulation fails, the wallet is not asked. The same refusal applies when the amount is above the spend cap in src/lib/spend-cap.ts. The cap lives in this browser under senda.spendcap, defaults to 100 dollars, and will not store a value above 5000. Raising it is a local write. It is not an approval from a bank, and it does not increase the USDC in the token account.",
            "The provider is whatever Solana injector is actually in the window. Phantom, Solflare, Backpack, and the other ids in src/lib/wallets.ts are offered only when their object is present. Connect returns a public key. The secret never enters this process. A buy, a sell, a convert, a cover premium, and a USDC payment are transactions the desk builds and the wallet signs. A message signature is a different ask. The seal grant uses signMessage on one fixed line. Do not reuse a grant signature as permission to move USDC. Do not add a code path that signs with a key this app generated and then describe it as the user paying.",
          ],
        },
        {
          h: "Jupiter quote and swap",
          p: [
            "A buy, sell, or convert is a Jupiter quote, then a swap transaction, then a signature. quoteRoute and signRoute in src/lib/jup-sign.ts call the quote host and fall back to the lite host. The query fixes slippage at 100 basis points and restricts intermediate tokens. The pair must be SOL, USDC, or a PreStock mint in the allow list. Anything else throws before the wallet is asked. Price impact above five percent throws the same way. The dollar size is checked against the spend cap first. USDC amounts for a buy are six-decimal atoms. The swap request sends the quote and the user's public key. Jupiter returns a versioned transaction. This app deserializes it and sends it through sendVersioned.",
            "Senda does not warehouse the other side and does not invent a fill. The out amount on the ticket is the quote, not a credit in the browser ledger. After the signature, the token account of the wallet that signed is what Portfolio should read. If you change the route, keep the allow list, the impact check, the cap, and the simulation. Do not add a local balance that pretends the swap settled while the signature is still missing. Do not route a pair that is not SOL, USDC, or a listed PreStock mint. A server function may fetch a quote for display. Display is not execution. Execution is the signed swap.",
          ],
        },
        {
          h: "USDC and the memo",
          p: [
            "A Shop payment is payUsdc in src/lib/solana-pay.ts. The mint is EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v, six decimals, so one dollar is 1000000 atoms. Source and destination are the associated token accounts of the payer and the receiver. If the receiver has no USDC account, the same transaction creates it and the payer funds the rent. The transfer instruction is SPL Token discriminator 3, then the amount as a little-endian u64. That is Transfer, not TransferChecked. The bytes are the same shape in chain/senda-chain and in chain/python, and the tests lock them. Do not silently switch the discriminator and leave the tests describing the old instruction.",
            "The memo sits on that same transaction. The memo program is MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr. The text carries the dollar amount and a reference public key so the payment can be found later. The signature is the receipt. Open it on a mainnet explorer. RPC tries the public mainnet host, then the public node host. A private RPC belongs in the same call sites in phantom.ts when the public hosts rate-limit. The whole amount goes to the address on the payment. This app does not take a fee in that instruction. There is no card network, no authorization code, and no issuer in this function.",
          ],
        },
        {
          h: "Cover without a program id",
          p: [
            "openChainCover in src/lib/cover-chain.ts moves a premium in USDC and writes the terms in a memo. The destination is an associated token account for a key this browser generated. That secret is stored locally so a later settle in this browser can pay it back. The user signs the premium from their own wallet. The PreStock stays in that wallet. The memo names the kind, the symbol or title, the premium, the size, and the strike. This is a drop the person can read on chain. It is not a licensed policy, and the app does not print an insurance payout. If the wallet refuses, nothing was covered.",
            "Do not splice the devnet program, or the placeholder in senda-program.ts, into this transaction and call it the product. A devnet deploy may exist as an exercise. It is not the path user money takes. If you are working on that exercise, say devnet in the comment and do not point the Shop or Cover button at it. Do not copy the cover secret to the server, to a log, or into a sealed blob in the clear. The seal is for ciphertext. A secret key in Postgres is a bug even if the column is named box. The wallet remains the signer of the premium.",
          ],
        },
      ],
    },
    {
      id: "state",
      title: "Local, sealed, and public",
      body: [
        {
          h: "The browser ledger",
          p: [
            "Senda cash is the balances map on the wallet object in src/lib/wallet.ts, stored under senda.wallet.v2. A fresh browser is at zero. The loader does not seed cash, a card, or a position. Pockets, vaults, notes, contacts, and the journal live on that same object. Listings people post are a different key, senda.make.v1, in src/lib/make-board.ts. Paying a listing is still the USDC transfer to the address on the row, not a debit of the listing file. Practice play is senda.practice.usd. Loading it writes a practice figure and does not touch the wallet or Senda cash. Real play, when it stakes, moves Senda cash in this browser. It still does not move USDC.",
            "The books digest is not a server close. digestBooks in src/lib/books.ts replays the journal on the wallet object and reports assets, equity, and the plug that keeps the trial balanced. It is a reading of local notes. Clearing site data clears the journal and the digest with it. Say that on the page if you show the figure. Other local keys exist for tickets, covers, and the spend cap. Treat each one as this machine only. Login does not copy them to another computer. A second browser is a second ledger at zero until the person acts there. Never hydrate a demo balance to make a screenshot look funded.",
          ],
        },
        {
          h: "What sealed means",
          p: [
            "When a wallet connects, src/lib/seal.ts can unlock a key that lives only in memory for the visit. The key is the SHA-256 of one signature, imported as AES-GCM. Values under keys that start with senda. or the-pit. are packed as ciphertext with the prefix sen1. Two flags, senda.seen.v1 and senda.howto.v1, stay in the clear and are not uploaded. They are needed before a wallet exists. If the server can read a room, it is not sealed. A blob the server can decrypt, a column of plaintext JSON, or a log line of the journal fails that test. The browser may keep the ciphertext. The server must not hold the key that opens it.",
            "The grant is a signature over the line senda-grant:v1, the wallet address, and a nonce. finishGrant checks that Ed25519 signature and stores a row that expires in twelve hours. putBlob and listBlobs refuse the call when the grant is missing or expired. The slot name is checked, and the body must match the sen1 ciphertext shape. A failed upload does not roll back the local write. The browser copy is already sealed. Do not treat a grant as a session that may move funds. It is permission to store ciphertext for that wallet. signMessage and signTransaction are different prompts. Keep them on different buttons.",
          ],
        },
        {
          h: "Postgres, if it is there",
          p: [
            "The optional server is src/lib/sealed-store.ts, backed by the tables in migrations/0006_sealed.sql. sealed_grant holds a wallet, a nonce, and an expiry. sealed_blob holds a wallet, a slot, and a box. The box is ciphertext. The handler rejects a body that is not the sen1 shape, and it rejects a slot in the skip list. There is no column for a seed, a PAN, a CVV, or a Solana secret. Do not add one. Database URL and other server settings stay in server env. They are not required to ask a wallet to sign. If Postgres is down, the desk can still quote, sign, and pay. The chain does not read this database.",
            "Auth tables, if present, are a separate login. They are not the wallet and they do not sync Senda cash. Do not join a user id to a balance and present it as the chain. Do not write the cover keypair, a Jupiter transaction that is not yet signed, or the practice figure into these tables in the clear. A backup of the database must be useless without the signature that only the wallet can produce. If you add a new slot, keep the name inside the existing pattern and keep the value encrypted in the browser before the request leaves. The server checks the shape. It should not learn the meaning.",
          ],
        },
        {
          h: "What the chain already published",
          p: [
            "Public state is what an explorer can show without this app. A signature, a token account balance, and a memo are public after the wallet signs and the transaction lands. Portfolio should match the token accounts of the connected address, marked at the last print. Empty means the wallet holds none. Do not fill the gap with the browser ledger. SOL and USDC on the wallet page, when they are read from the chain, are not the same numbers as Senda cash. Label them apart. A memo can carry cover terms or a payment reference. It does not create a legal contract inside this repo, and it does not update the browser ledger by itself.",
            "Anyone can read those accounts. Do not put a secret in a memo, a reference, or an account name. The reference on a payment is a public key generated for lookup, not a password. The cover destination address is also public once the premium lands. The secret that can move those funds later is the local key, and it must stay off the chain and off the server. If a feature needs a fact the chain does not store, keep it local or sealed, and say which. If a feature needs a fact the chain does store, read it. Do not cache a fill in localStorage and call the cache the position.",
          ],
        },
      ],
    },
    {
      id: "refuse",
      title: "What not to build on top",
      body: [
        {
          h: "The list that is not built",
          p: [
            "This repo does not have a brokerage account, margin, a bank wire, a Visa or Mastercard BIN, or Apple Pay. It does not have an agent-held key, or a background agent that keeps running after the tab closes. It does not have a central limit order book. It does not have a CPA export. It does not have a login that syncs browser cash across computers. It does not mint or redeem for an issuer, and it does not transfer legal title in a company. A screen that looks like one of those things is a drawing unless you can point at the signature, the counterparty, and the record outside this browser.",
            "Do not stub them with a success toast. A pain message assembled in the browser is not a wire that a bank will post. An order ticket that never leaves localStorage is not a book that matches two customers. An agent that can read the print and queue a trade still cannot sign, which is the point of src/components/agent-workspace.tsx. When the tab closes, the queue stops. Do not add a worker, a cron, or a key in env that signs on the user's behalf. If the person is not at the machine to approve the transaction, the transaction does not get to exist.",
          ],
        },
        {
          h: "A number is not a network",
          p: [
            "The desk can make a number, show it once, and keep the last four and a cap. A charge against that number debits Senda cash in this browser. The code in src/lib/card-issuing.ts may stamp a local primary account number and a check digit. That does not make it a scheme BIN. A merchant terminal will decline it. Visa never sees it. Do not draw a network mark that claims acceptance. Do not store a full number, a CVV, or a secret in a log, a ticket, or Postgres. The last four on the page are a reminder of a local instrument. They are not a credential a checkout elsewhere will honor.",
            "Until a real issuer is in this product, the payment a Solana address can clear is the USDC transfer in solana-pay.ts. Say that next to any number you render. If a balance is only in localStorage, say so on the page, in the same view, not in a footnote three routes away. Practice cash needs the same sentence. Senda cash needs the same sentence. A visitor should be able to tell, without reading this book, which figure a merchant cannot charge and which figure a wallet signature can move. Confusion here is a product bug, not a copy preference.",
          ],
        },
        {
          h: "Issuers that exist elsewhere",
          p: [
            "Rain and Bridge can issue cards, and Lead Bank can hold a virtual account, in the wider market. Phantom Cash, Jupiter, and other wallets already spend Solana dollars through those firms or through their own custody. Each of those is someone else's program and someone else's KYC. This repo does not have that relationship. src/lib/receive-account.ts knows the Bridge shape for a virtual account that would convert incoming funds to USDC on the connected address. The call returns no number to copy when the program key is not on the server. Do not invent a routing number, an IBAN, or a deposit slip to fill that gap.",
            "Both the card and the virtual account need a program relationship and KYC this repo does not have. Until then the app must not present a number as a card a merchant will clear. Do not put a Bridge or Rain response, even a real one from a key someone pasted in, onto the Shop card face and imply the desk issued it. Do not ask the user for identity documents in this UI and pretend that file is a completed program. If a partner integration is added later, it has to fail closed, name the partner, and stay off the path that only moves browser cash. Absence of a key is the current, correct state.",
          ],
        },
        {
          h: "Title, mint, and the other side",
          p: [
            "A holder of a PreStock token has the price the market prints, not the company. There is no vote, no dividend, and no legal share in this app. Open the issuer's own terms before you write a sentence that sounds like ownership. Senda does not mint the token and does not redeem it. A buy is a swap into a mint that already exists. Selling is the route in reverse. Do not add a redeem button that burns a local row and credits Senda cash. Do not add a transfer of legal title, a cap table, or a subscription agreement and store it as JSON. Those are not features you can finish inside this tree.",
            "Do not become the counterparty to make a screen feel full. The house float and chip ledger in src/lib/ledger.ts are a local double entry for play and paper. They are balanced notes, not a bank. A central limit order book would need resting orders, a matcher, and settlement you can point at. This app does not have them. Jupiter is the route for the token. USDC is the payment. If a design needs margin, a wire, or a synced cash balance, stop and say it is not built. Shipping a local imitation trains the next reader to lie in the same place.",
          ],
        },
      ],
    },
    {
      id: "check",
      title: "How to check a claim",
      body: [
        {
          h: "Three questions",
          p: [
            "Use three questions on any change that mentions money, privacy, or a balance. If the wallet is not asked, money did not move. If the server can read a room, it is not sealed. If a balance is only in localStorage, say so on the page. The questions are mechanical. Open the click handler. If it calls signTransaction, signAndSendTransaction, or signMessage, write down which. If it calls saveWallet, localStorage.setItem, or a paper ledger, the result is local. If it calls putBlob, confirm the body is already sen1 ciphertext and that the handler never receives a raw key. A claim that fails one of these is not ready to merge.",
            "Apply them to copy as well as code. A heading that says paid is false when the function only appended a journal row. A heading that says private is false when the payload is plaintext JSON. A heading that says USDC is false when the number is w.balances.USDC on the browser object. The chain USDC balance is a token account read. Name the source in the component. You should be able to answer the three questions in a few minutes by reading the call, without starting the app. If you cannot, the change is too indirect and should be split until the path is visible.",
          ],
        },
        {
          h: "Read the call, not the label",
          p: [
            "For a swap, read signRoute. Check the allow list, the impact limit, the spend cap, the quote host, and sendVersioned. For a payment, read payUsdc. Check the mint, the six-decimal atoms, discriminator 3, the create-account instruction when the destination is missing, and the memo. For a cover, read openChainCover and confirm the program id list does not include a Senda program. For a portfolio line, confirm the function is a read. Then simulate or, on a small amount you can afford, sign and open the signature. The explorer should show your wallet as the signer and the USDC mint on a transfer, or Jupiter on a swap. A local toast is not that evidence.",
            "For state, search the key. senda.wallet.v2 is the cash ledger. senda.make.v1 is listings. senda.practice.usd is practice. senda.spendcap is the cap. senda.cover.kp.v1 is the cover secret. If the seal is open, that value may leave the browser only as sen1 ciphertext. Never send the raw key. The digest has no table. It is digestBooks on the wallet object. For the seal, read seal.ts and sealed-store.ts together. The message string, the sen1 check, and the twelve-hour grant should match. For the devnet exercise, read chain/devnet.json and then grep the web app for that program id. If the id is absent from the transaction builders, it is not on the path. Write that down before you describe the deploy as the product.",
          ],
        },
        {
          h: "The quality bar",
          p: [
            "The bar for a new piece of desk is one user, one problem, an end-to-end path a person can sign, and a reason it is on Solana. One user means you can name who is sitting at the browser and what they are trying to finish. One problem means you are not also inventing a bank, a broker, and a card network in the same change. The path a person can sign means a wallet prompt with a transaction they can read, or an honest refusal before that prompt. The reason it is on Solana is a mint, a USDC transfer, a memo, or a token account. If the change does not need any of those, it does not need to pretend it is a chain feature.",
            "A note can still be useful. Practice play, a local pocket, and a digest of the journal help someone learn the desk without moving funds. They stay inside the bar only if the page says they are local. A sealed backup stays inside the bar only if the server cannot read it. A devnet program stays inside the bar only if it is labeled as an exercise and is not wired to user funds. When a change fails the bar, cut it back to the path that already exists: quote, sign, or an honest local note. Do not widen the product with a facade that will have to be disclaimed later.",
          ],
        },
        {
          h: "Before you call it done",
          p: [
            "A change is done when a buy still asks the wallet to sign a Jupiter route, a payment is still the USDC transfer plus a memo, and a cover premium is still a transfer the user signs. No balance, card, or position appears that the person did not create. npm run typecheck passes. The port is still 8080. You did not commit a secret, a PAN, or a seed. You did not add a program id that the transaction builders do not use. If you touched a sentence in the Docs tab or in this book, it still matches the function. If you touched a figure on a page, a stranger can tell whether it is chain, sealed, or local.",
            "When you are unsure, do the small path yourself. Load practice cash and confirm the wallet was not asked. Connect and quote a name and confirm the wallet is asked only after the quote is acceptable. On Shop, a dollar of USDC to an address you control should show a signature, a memo, and a token balance that moved. If any of those steps surprises you, the surprise is the bug. Fix the code or fix the sentence. Do not add a second path that hides the first. The desk is finished for that change when a reader of the repo can predict the prompt from the button, and the prompt is the one you intended.",
          ],
        },
      ],
    },
  ],
};
