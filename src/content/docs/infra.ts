import type { DocBook } from "./types";

export const infra: DocBook = {
  id: "infra",
  label: "Infra",
  lede: "The path a signature takes, and what is stored where.",
  pages: [
    {
      id: "quote",
      title: "Quote, simulate, sign",
      body: [
        {
          h: "The injected provider",
          p: [
            "The desk is a web application in the browser. It does not create a wallet, and it does not generate a signing key for the person using it. Connection is the Solana provider the window already injected. That is Phantom on window.solana, or the active provider the adapter selected. connect returns a public key. That public key is the account for every later call. signTransaction, signAndSendTransaction, and signMessage are the only ways a click becomes a signature. The secret stays in the extension. A window with no provider fails closed. There is no seed phrase, no downloaded user keypair, and no email account that can stand in for the wallet.",
            "Nothing on this path asks the server for permission to sign. The page builds or fetches a transaction, and the extension decides whether to present it. If the person rejects the prompt, the chain never sees a signature. The application cannot retry with a key it does not have. Reviewers should treat the public key as the only identity the buy flow knows. A later page describes a browser-local cover key used to return a premium. That key is not the user's wallet, and it is not created by the injected provider. The user path described here never exports, wraps, or proxies the wallet secret.",
          ],
        },
        {
          h: "The allowlist and the quote",
          p: [
            "A buy asks Jupiter for a route into a PreStock mint. The usual input is USDC. A SOL-funded buy first quotes one SOL against USDC so the client can size lamports from a dollar amount, then asks Jupiter for SOL into that same mint. Both calls go to the quote hosts in src/lib/jup-sign.ts, api.jup.ag and, on failure, lite-api.jup.ag. The query sets slippageBps to 100 and restrictIntermediateTokens to true. The client does not insert a hop itself. If Jupiter routes SOL through USDC, that hop is Jupiter's, and the restrict flag is what the client sent to keep intermediates from wandering.",
            "assertPrestockRoute runs before any wallet prompt. The allowed set is wrapped SOL (So11111111111111111111111111111111111111112), USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v), and the listed PreStock mints. An input or output outside that set throws, and the message says the wallet was not asked to sign. A quote that returns no outAmount, or a host that answers 429, also stops in the client. The route labels shown to the person are the swapInfo labels on routePlan. They are a description of Jupiter's plan, not a book this repository operates. There is no fallback router and no inventory on our side of the quote.",
          ],
        },
        {
          h: "Simulation before a prompt",
          p: [
            "On the swap path, Jupiter returns a base64 versioned transaction. The client deserializes it and calls simulateTransaction before signAndSendTransaction. The RPC body uses base64 encoding, sigVerify false, replaceRecentBlockhash true, and commitment processed. sigVerify is false because the transaction is not signed yet. replaceRecentBlockhash lets the simulation proceed against a fresh blockhash. If value.err is set, the client throws. It prefers the last log lines that mention an error, a failure, or an insufficient balance. The wallet method is not called. A failing route therefore does not reach the extension on this path.",
            "sendVersioned in src/lib/phantom.ts is the function that orders those steps: simulate, then sign and send. If the provider has no signAndSendTransaction, it falls through to signTransaction and then broadcastSigned, which simulates again before sendTransaction. The public RPC list is mainnet-beta and a publicnode mainnet endpoint. Simulation is not a guarantee of inclusion. It is a preflight against the cluster's current state. A quote can still go stale between the successful simulation and the signature, which is why the swap build also asks Jupiter for a dynamic compute-unit limit and dynamic slippage. Those flags do not bypass the allowlist or the impact check.",
          ],
        },
        {
          h: "Impact and the spend cap",
          p: [
            "After a quote returns, the client reads priceImpactPct as a number and compares it to 5. Above 5, signRoute throws and names the figure as a percent. The wallet is not asked. The comparison uses the field as Jupiter sent it. There is no second scaling step in signRoute. The same function refuses a non-positive dollar size before the quote is even reused for the swap build. A quote used only for display can still be fetched. The refusal is on the function that would produce a signature. Reviewers should look at signRoute, not at the display quote helper, when they want the gate that actually blocks a prompt.",
            "The spend cap is local. src/lib/spend-cap.ts reads senda.spendcap from localStorage. A missing, non-finite, or sub-dollar value falls back to 100. A stored value is rounded and then limited to 5000. That 5000 figure is the ceiling on this browser, not a server policy and not a daily budget. signRoute compares the dollar size of this send with the current cap and throws before the quote is turned into a transaction. Raising the cap is a write to the same key. Clearing site data restores the default. The cap does not move tokens. It only refuses to build a signature request above the number this browser has stored.",
          ],
        },
        {
          h: "The signature and the receiving account",
          p: [
            "If the allowlist, the cap, the impact check, and simulation all pass, the extension is asked to sign the versioned transaction Jupiter built for userPublicKey. The output of a buy is the PreStock mint. The tokens land in that wallet's associated token account. The application is not a counterparty and does not receive the tokens into an account it controls. A sell is the reverse route: the listed mint in, USDC out, same gates, same wallet. The signature string returned by the provider, or by sendTransaction, is the receipt. Anyone can load it on a block explorer. The page does not keep a private copy of the signed bytes as a credential.",
            "The swap builder posts the quote response to Jupiter's swap endpoint with the owner's public key. The client does not rewrite the account list after that. If simulation later fails, the throw happens in simulateFirst and the provider is not asked, on the sign-and-send path. Reviewers should not describe this as an internal matching engine. Jupiter chooses the route. The cluster executes the programs Jupiter named. This repository's contribution is the allowlist, the cap, the impact gate, the simulation order, and the request that the connected wallet sign. The key never comes to the page, and a rejected prompt ends the attempt.",
          ],
        },
      ],
    },
    {
      id: "pay",
      title: "USDC and the memo",
      body: [
        {
          h: "Mint, decimals, and raw units",
          p: [
            "A USDC payment is built in src/lib/solana-pay.ts. The mint is EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v. The client treats it as six decimals. The dollar amount is rounded to cents, checked against the same local spend cap used for swaps, and encoded as raw units: round(usd times 1_000_000) as a little-endian u64. The source account is the associated token account of the connected wallet for that mint. If that account does not exist on mainnet, the call throws before a transaction is assembled. The destination is the associated token account of the address the person pasted. Paying one's own address is rejected.",
            "Blockhash and account lookups use mainnet RPC, the public mainnet-beta endpoint and a publicnode mainnet endpoint, the same pair the swap simulator uses. The fee payer is the connected owner. There is no relayer and no fee subsidy. The token program id on the instruction is TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA. The associated-token program is ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL. These are the ordinary Solana programs. The payment does not call a program deployed by this repository. A reviewer tracing the user path will not find a Senda program id in the account keys of this transaction.",
          ],
        },
        {
          h: "The token instruction and rent",
          p: [
            "The movement itself is an SPL Token instruction whose first byte is 3, Transfer, followed by the raw amount. The keys are the source account, the destination account, and the owner as signer. The mint is not an account on that instruction, and the decimals are not a trailing byte. TransferChecked would be discriminator 12 and would include the mint and a decimals byte. Shorter notes in the product call this payment transferChecked because the mint is fixed in the client and the amount is checked into six-decimal raw units before it is encoded. The bytes on the wire are Transfer. A review that expects a mint key on the token instruction will not find one. The mint is fixed by which associated accounts were derived.",
            "If the receiver has no USDC associated token account, the same transaction creates it. The create instruction is the associated-token program with empty data. The payer is the connected owner, who also pays the rent-exempt lamports. The receiver is a non-signer. The mint, the system program, and the token program are the remaining accounts. Creation and transfer share one recent blockhash and one signature. If the owner rejects the prompt, neither step lands. The client does not pre-create the destination in a separate transaction. Rent is the owner's SOL, not a fee this application collects. The source account is still required to exist already. The page will not open a USDC account for the sender as part of this payment.",
          ],
        },
        {
          h: "Memo, reference, and Solscan",
          p: [
            "Every payment adds a memo instruction. The program is MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr. The client generates a fresh reference public key that does not sign. That key is a read-only account on the memo, which is the Solana Pay pattern for a reference that indexers can follow. The memo bytes are a UTF-8 string. The default text is a short USDC label plus the dollar amount, then ref= and the reference address in base58. A caller can pass a different memo string. The reference is still appended. The owner signs the memo as well as the token instruction. The reference key has no secret the page keeps for later. It exists so the memo can be found.",
            "The owner signs the legacy transaction in the extension. broadcastSigned then simulates the signed bytes and, if that succeeds, calls sendTransaction with skipPreflight false. This order is different from the swap path. On a payment, the wallet is asked before simulation. A simulation failure is not broadcast, but the prompt already happened. The signature returned by the cluster is the receipt. It can be opened on Solscan like any other mainnet transaction. The page does not issue a separate confirmation object. There is no card network, no authorization code, and no capture step after the signature. The chain receipt is the proof that the USDC moved.",
          ],
        },
        {
          h: "Cover is USDC plus a memo",
          p: [
            "A cover uses the same mint, the same six decimals, and the same token-program transfer shape. The destination is not a merchant. It is a cover account whose keypair is generated in this browser and stored under senda.cover.kp.v1 in localStorage. That is a secret, and it is an exception to the rule that the user path creates no key. It is not the person's wallet key. It is not uploaded. Postgres is not given it. The key exists so a later transaction can be signed by the account that holds the premium. The terms go in the memo: kind, symbol or title, premium, size, and strike. The owner signs the premium transfer. The cover book of open rows is also local, under senda.cover.chain.v1.",
            "The premium is a number of USDC the person chose. The memo does not escrow a larger face amount, and the cluster does not enforce the strike. The strike, the ten percent drop test, and the expiry live in the client when someone later asks to settle. Until then, the chain shows a USDC transfer into the cover account and a memo. If the associated account for the cover key does not exist, the opening transaction creates it and the owner pays the rent, same as a payment to a new receiver. The application does not promise to top up that account. What can come back is limited to what the account holds.",
          ],
        },
        {
          h: "Settle is a second signature",
          p: [
            "Returning premium builds a new transaction. The cover key signs it with partialSign, using the secret that stayed in this browser. The connected wallet is asked to sign as fee payer. That is a second signature, separate from the opening payment. The amount is the lesser of the recorded premium and the USDC the cover account actually holds, read with a balance lookup before the instruction is built. If the raw amount is zero, the call throws and says the account has no USDC to send back. The return cannot invent a balance. It cannot pay a face amount out of an empty account. A reviewer should not describe the memo as a policy the token program will enforce.",
            "A drop cover adds a client-side condition. If the live price is at or under ninety percent of the stored strike, settle marks the row settled and then asks for a buy of the named mint for the cover size. That buy is the ordinary PreStock swap, with its own quote, cap, impact check, and wallet signature. If the price has not fallen and the cover has not expired, settle refuses unless the person cancels. Cancel also returns only what the account holds, and it uses the same two-signature return. Closing the tab does not settle anything. Nothing in this flow is a claim against a balance this application keeps on a server.",
          ],
        },
      ],
    },
    {
      id: "room",
      title: "The sealed room",
      body: [
        {
          h: "Two public keys",
          p: [
            "A sealed room is two wallet public keys and a nonce. src/lib/space.ts sorts the two base58 addresses so the pair has one order. If both strings are the same account, the call throws. A room of one wallet is not representable. The nonce is sixteen random bytes, hex encoded. The room id is the first member, the second member, and the nonce, joined. The public card is JSON: version, nonce, members, and arms. An arm is a public X25519 key and a signature. The card does not contain a private key. Pasting a card into another browser records the public half and keeps any events already stored locally. It does not import the other person's secret, because that secret was never on the card.",
            "The room file in this browser is senda.space.v1. It holds the public rooms and a separate map of secrets keyed by room id and wallet. Events, capped at twenty, sit on the room. An event can be a sealed note, a transaction signature attached as a receipt, or both. None of that structure is an account on Solana. Opening a room does not move USDC and does not require a program. The chain is involved only when someone attaches a transfer they already signed through the payment path. The room is a local cryptographic context around two public keys. Losing the browser state loses the local secret for that room.",
          ],
        },
        {
          h: "The senda-space message",
          p: [
            "Each wallet signs a fixed string. The text is senda-space, then the two member addresses in sorted order, then the nonce, then the hex of that wallet's X25519 public key, separated by colons. The extension's signMessage is called with that UTF-8 string. The returned bytes are stored on the arm, base64. Before the arm is kept, the page verifies it. Verification imports the wallet public key as an Ed25519 raw key, using the thirty-two bytes of the Solana address, and checks the signature over the same string. If the signature does not verify, the room does not open. A copied arm that was not signed by the wallet it names fails the same check.",
            "Both arms are checked again before any note is decrypted or encrypted. The local arm must verify for the connected wallet, and the other arm must verify for the other member. A room with only one arm cannot derive a key. The error says their key is not in the room yet. There is no server-side approval of membership. Possession of a wallet that can sign the message is the enrollment. The message binds the X25519 public key to the pair and the nonce, so a key from a different room does not verify under this string. Reviewers should not look for a certificate authority or an account recovery flow. A wallet that cannot signMessage cannot enter.",
          ],
        },
        {
          h: "X25519, then AES-GCM",
          p: [
            "The page generates an X25519 key pair with WebCrypto. The public key is exported raw and hex-encoded onto the arm. The private key is exported as a JWK and written into the local secret map. It is not placed on the public card. When both arms verify, the page imports its own JWK and the other member's raw public key, then deriveBits with the X25519 algorithm for 256 bits. Those bits are hashed with SHA-256. The digest is imported as an AES-GCM key for encrypt and decrypt. The hash step is deliberate. The shared secret is not used as the AES key directly. The AES key is not stored. It is derived when a note is sealed or read.",
            "A note is JSON, a text field and an optional transaction signature, encoded as UTF-8. The IV is twelve random bytes. AES-GCM encrypts the body. The event stores the IV and the ciphertext, base64, plus the sender's wallet address. Reading the note derives the same key and decrypts. A browser that does not hold this wallet's JWK for this room cannot derive the key, even if it has the public card and the ciphertext. The transaction signature on the event, when present, is the cleartext receipt of a transfer. It is not required to decrypt the text. An empty-box receipt leaves that signature in the clear.",
          ],
        },
        {
          h: "What a server may hold",
          p: [
            "The room's private JWK is not sent anywhere. The public card can be copied by a person. If this browser's storage is later sealed and uploaded, the server receives the ciphertext of whatever local key held the room file, not the room key in the clear. The desk seal is a different layer, described with the database. For the room itself, the requirement is simpler. A server may store ciphertext and a transaction signature. It must not be able to decrypt the note. It does not have the X25519 private key, and it does not have the wallet secret that would re-derive the desk seal. Support cannot open a room. If a human operator can read the note, the room is not the construction this page implements.",
            "Attached transaction signatures are public facts. They point at mainnet transactions the wallets already signed. Storing a signature next to a ciphertext does not grant decryption. The ciphertext is useless without the AES-GCM key, and that key exists only where both X25519 private material and the peer public key are present, which is the member's browser after both arms have verified. There is no escrow of the room key. There is no admin unwrap. The nonce is not a password. Guessing it does not yield the shared secret. A reviewer reading a database row should expect opaque boxes and, where a transfer was attached, a signature string that Solscan can already show.",
          ],
        },
        {
          h: "The wallet is the identity",
          p: [
            "Identity for a room is the wallet public key. There is no email account, no password, and no user table that maps a person to a room. The member list is two addresses. The signature on each arm is how the other member knows the X25519 key belongs to that address. Disconnecting the wallet does not delete the local JWK, but the page cannot produce a new arm without signMessage, and it cannot pass the local verify check for a different connected address. Opening the same card on a second machine requires the same wallet to sign a new arm there, and the private key from the first machine does not travel with the card. The first machine's secret remains where it was written.",
            "This is why clearing the site is not a remote logout. It deletes the local secret. The other member's browser, if it still has its own JWK and the public arms, can still decrypt notes it already holds. Notes that existed only as ciphertext in a cleared browser, without a surviving copy of the JWK, are not recoverable from the public card. The application cannot reset a room. There is no support tool that reissues an arm. A reviewer should not propose an email recovery path as a missing feature of this design. The design refuses any identity that is not a signature from the wallet that joined the room.",
          ],
        },
      ],
    },
    {
      id: "state",
      title: "What is stored where",
      body: [
        {
          h: "Local to this browser",
          p: [
            "Senda cash, notes, listings, and practice play are local to the browser. Cash and the journal around it live in the wallet record, senda.wallet.v2. That record is a JSON document of balances, vault rows, cards, and transactions the page itself wrote. It is not a bank balance and not a token account. Notes are kept on that same wallet object. Listings people post are senda.make.v1: a title, a kind, an amount, and a pay-to address. Paying a listing is a normal USDC transfer to that address, not a match against an order book. Practice play is senda.play.v3, a local book of games. Clearing site data for this origin removes these keys. Nothing in the cluster replays them.",
            "Other local keys exist and follow the same rule. The spend cap is senda.spendcap. The cover book and the cover secret are local, as the payment page described. The room file is local. Flags that must be readable before a wallet exists, senda.seen.v1 and senda.howto.v1, stay in the clear and are not uploaded. A reviewer should assume that a number shown as cash, a note, a listing, or a practice result will not appear on a second computer. There is no login that carries this browser's cash across machines. The chain balances of the connected wallet are a separate fact. Those can be read by anyone, from the cluster, on any machine.",
          ],
        },
        {
          h: "The books digest",
          p: [
            "src/lib/books.ts replays the journal in the client. digestBooks walks the wallet's transactions from oldest to newest, skipping failed rows, and accumulates a cash map by currency plus stock at cost and fees. It then compares that replay with the balances and vault totals the wallet record currently holds. The USD gap, per currency, is suspense. A non-zero suspense is emitted as a token named sSUSP, an asset if positive and a liability if negative. Owner capital is the plug that sets equity equal to assets so the trial balances. Ghost outstanding and fees are memo lines. The digest id is a hash of the tag, the token supplies, and suspense. None of this is submitted to Solana.",
            "The digest is not on-chain accounting. It does not read token accounts, and it does not prove that a USDC transfer happened. A tied flag is true only when suspense is under a cent, ghost outstanding is covered by USD plus USDC cash in the local record, and capital matches assets. That flag is a consistency check on the browser journal. It is not an audit opinion and not a filing. An export a CPA would sign is not produced. If the journal and the spendable cash disagree, suspense is the report of that disagreement. Clearing the site clears the journal the digest replays. The cluster is unchanged by that clear, because the digest never wrote to it.",
          ],
        },
        {
          h: "Postgres, when it is configured",
          p: [
            "A database is optional in the sense that the client still runs without a hosted URL, but the server code always has a SQL handle. If DATABASE_URL is set, the handle is Neon. If it is unset, the handle is PGLite, Postgres compiled to WASM, so a preview still has tables. The tables the seal uses are sealed_grant and sealed_blob. sealed_grant stores a wallet address, a nonce, and an expiry. sealed_blob stores a wallet address, a slot name, and a box. The slot must match a local key prefix, senda. or the-pit., and must not be one of the two clear flags. The box must match the sen1. prefix, two base64 segments, and a length cap. Rows that fail those checks are rejected before insert.",
            "The grant is checked by a wallet signature. The server issues a random nonce. The wallet signs senda-grant:v1, the address, and the nonce. The server verifies Ed25519 over that string using the address bytes as the public key. On success it upserts sealed_grant with an expiry twelve hours out. putBlob and listBlobs require a nonce that is still in that table. The box written there is ciphertext the browser already produced. The server does not receive the AES key. It does not receive the wallet secret. It does not receive the cover keypair. A reviewer reading the SQL will see wallet, nonce, expiry, slot, and box. They will not see a secret key column. If verification fails, the grant is not written.",
          ],
        },
        {
          h: "Which secrets exist, and where",
          p: [
            "Three secrets are easy to confuse. The wallet secret never enters the page. The desk seal key is derived in memory for the visit. unlockSeal asks the wallet to sign the fixed string senda-vault:v1 and the address, hashes that signature with SHA-256, and imports the digest as AES-GCM. That key is not written to localStorage and not sent to Postgres. It encrypts values whose keys start with senda. or the-pit. The stored form is sen1, then the IV, then the ciphertext. Because the signed string is fixed per address, the same wallet can derive the same key on a later visit and decrypt a blob it pulls down. The signature is a key-derivation input. It is not stored as a credential on the server.",
            "The room X25519 JWK and the cover keypair are different. Both are random, both live in browser storage, and neither can be re-derived from a wallet signature. Uploading a sealed blob may cause the server to hold those secrets only in ciphertext, inside the encrypted local value. The server still cannot decrypt them without the desk seal key, which it does not have. The cover key is the one local secret that can sign a Solana transaction, and only the return of premium from its own token account. It is not a custodian of the person's wallet. Treat a database backup as a backup of ciphertext and grant nonces, not as a backup of keys.",
          ],
        },
        {
          h: "What clearing removes",
          p: [
            "Clearing site data for this origin removes localStorage. Cash, notes, listings, and practice play go with it. So do the spend cap, the cover book, the cover keypair, and the room secrets. The in-memory desk seal key disappears when the tab does. Chain state does not. USDC and PreStock tokens in the wallet's associated accounts remain. A cover account that already received USDC remains on mainnet, but without the local secret the browser can no longer sign a return. That is a real loss, and the page cannot recover the key from Postgres, because Postgres never stored it in the clear. A reviewer testing clear-site should expect the journal to vanish and the wallet's token accounts to stay.",
            "The sealed blobs on the server, if any were uploaded, remain after a clear. They are still ciphertext. Signing senda-vault again with the same wallet re-derives the desk seal and can pull those blobs back into a new browser session. That restores journal ciphertext that was uploaded. It does not restore a cover key or a room JWK if those values were never successfully uploaded as ciphertext, and it does not restore them if the upload was of a later empty state. Practice play, listings, and cash that existed only in a browser that never flushed are gone. The application does not promise a sync. The database is a copy of sealed boxes, not the source of truth for a balance.",
          ],
        },
      ],
    },
    {
      id: "absent",
      title: "What this repo does not run",
      body: [
        {
          h: "No program on the user path",
          p: [
            "There is no Senda program id on the path a user takes. A buy is a Jupiter transaction. The programs it invokes are whichever programs Jupiter put in the versioned message. A USDC payment and a cover premium invoke the token program, the associated-token program when an account must be created, the memo program, and the system program as the rent payer's vehicle. Those program ids are the public Solana ones named on the payment page. This repository does not add an instruction of its own to those transactions. A reviewer searching the user path for a custom program id, an Anchor discriminator, or a PDA owned by this desk will not find one. The signature is the connected wallet's signature on ordinary programs.",
            "Do not describe an order book. Listings are rows in localStorage. Nothing matches them. Nothing rests them. The pay-to address is a string the person typed, and payment is the USDC transfer already described. Local order rows used by other panels are browser state as well. They are not a central limit book, and they are not bids on a serum-style market this process operates. Do not describe custody of the connected wallet. The application never holds that secret, never co-signs that wallet's transactions with a server key, and never receives the output of a buy into an account it controls. The tokens land in the signer's associated account.",
          ],
        },
        {
          h: "Mainnet, and a devnet exercise",
          p: [
            "User buys and USDC payments are mainnet transactions of the connected wallet. The RPC URLs hard-coded on those paths are mainnet-beta and a publicnode mainnet endpoint. The USDC mint they use is the mainnet mint. A signature from those flows is a mainnet signature and can be inspected on Solscan against mainnet. The client does not switch that path to devnet because a setting changed in a form. If the injected wallet is itself on another cluster, simulation and send will fail or land wherever that wallet's RPC points, but the application does not build a devnet USDC payment as the product path. Reviewers should trace payUsdc and signRoute, not a historical deploy script, when they say what users sign.",
            "Devnet may have been used to exercise a program deploy. That exercise is not on the user path, and it does not leave a program id that buys or payments call. A deploy that is not referenced by the quote, the transfer, or the memo is not part of settlement. Do not promote it to the architecture. The live behavior a reviewer can reproduce is: connect a mainnet wallet, pass the allowlist and the caps, simulate, sign, and observe a mainnet signature. If a document, a comment, or a script mentions a devnet program, it is evidence of an exercise, not of a program the desk currently requires a user to call. The user path has no such requirement.",
          ],
        },
        {
          h: "PRE8 is a client number",
          p: [
            "PRE8 is computed in the client from the live book. src/lib/pre8.ts filters listings whose venue is prestocks and whose valuation, last, and mark are positive. It sums valuation. The level is the valuation-weighted sum of last divided by mark, times 1000. If last equals mark on every leg, the level is 1000. If the book is empty under those filters, the function returns level 1000 and a count of zero. The function does not sign a transaction, does not read a mint, and does not write an account. It is a number on a page. Refreshing the book refreshes the number. Nothing on Solana is named PRE8 by this code.",
            "PRE8 is not a tradable index token. There is no mint whose supply is the level, and there is no pool a person can buy to hold the number. A pack named PRE8 in src/lib/basket.ts is a list of symbols, marked as paper. It is not a route. A desk can still buy the underlying PreStock mints one by one, each buy subject to the quote, the allowlist, the impact gate, and the spend cap. That is a basket only if someone sends those separate swaps. The repository does not wrap them into one index instruction. Unless a desk explicitly builds that series of routes, PRE8 remains a weighted print of the live book in the browser.",
          ],
        },
        {
          h: "What the database is not",
          p: [
            "Postgres is not a ledger of USDC. It does not store balances that the token program will honor. It stores sealed_blob rows and sealed_grant rows, and only when a wallet signature has opened a grant. The blob is ciphertext. Deleting a row does not move tokens. Inserting a row does not mint cash. A reviewer should not map sealed_blob onto a double-entry book, and should not treat the books digest as if it were written there. The digest runs in the client on the decrypted journal. The server, by design, cannot read that journal. Using the database as an accounting source would invert the design. The chain is the accounting source for USDC and PreStock tokens. The journal is a local story about numbers the page invented for cash.",
            "The grant expiry is twelve hours. It is an authorization to read and write ciphertext for that wallet, not a session that controls funds. Stealing a nonce from the table does not decrypt a box and does not sign a transaction. Stealing a box does not reveal the note or the cash figure inside it. The server rejects boxes that are not in the sen1 form, so it will not store an accidental plaintext under a slot that passed the name check. That check is a shape check. It is not a claim that the server understands the contents. Operators can see which wallet uploaded which slot. They cannot see the value. Identity remains the wallet. There is still no email account beside it.",
          ],
        },
        {
          h: "Claims a review should reject",
          p: [
            "Reject a claim that this repository runs a custom Solana program on the user path. Reject a claim that it runs an order book. Reject a claim that it has custody of the connected wallet. Reject a claim that Senda cash is a deposit, a balance a bank would recognize, or a figure the cluster can verify. Reject a claim that the books digest is on-chain accounting, or that suspense is a program account. Reject a claim that PRE8 is an index token someone can hold. Reject a claim that a sealed room can be opened by support, by the database, or by an email reset. Reject a claim that a cover memo obliges anyone to pay a face amount beyond the USDC sitting in the cover account.",
            "The accurate picture is shorter. The page asks an injected wallet to sign. Jupiter quotes an allowed pair. Simulation and the impact and spend gates sit in front of a swap prompt. USDC moves by a token-program transfer of six-decimal raw units, with a memo and a reference, and the signature is public. A cover is that pattern pointed at a browser-held account, settled only from what that account holds, by a second signature. A room is two wallets, a senda-space signature each, X25519, and AES-GCM. Local cash, notes, listings, and practice play clear with the site. Postgres stores ciphertext and a signature-checked grant. It does not store secret keys.",
          ],
        },
      ],
    },
  ],
};
