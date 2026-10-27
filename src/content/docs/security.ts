import type { DocBook } from "./types";

export const security: DocBook = {
  id: "security",
  label: "Privacy & security",
  lede: "The desk can see the public key you connect and what that key already shows on chain, plus what this browser keeps; it must not be able to see a secret key, a seed phrase, a real-network card number, or the plaintext of a sealed room.",
  pages: [
    {
      id: "sees",
      title: "What is visible",
      body: [
        {
          h: "The connected key",
          p: [
            "A connection starts in a wallet that is already injected into this window. You accept a prompt. The provider returns a public key. That string is what Senda treats as the account: the address it reads, the address it puts on a transaction, and the address a later signature will be checked against. It is the same address a block explorer would show if you pasted it there. Nothing about the handshake is private to Senda. The desk did not generate the key, and it does not receive the material that could produce another signature from it. Disconnecting removes the address from the page. It does not close the account, freeze a mint, or change who can sign.",
            "The public key is the only identity chain actions use. There is no separate customer number that can move SOL, USDC, or a PreStock. If two browsers connect the same wallet, they are looking at the same accounts, because those accounts live on the chain under that key, not under a Senda profile. The page can remember the address for the visit so it does not ask you to connect on every read. Remembering an address is not authority. A read needs no signature. A move does. Anyone who learns the address learns the balances that key already publishes. They do not learn a seed, and they do not gain a way to sign for you.",
          ],
        },
        {
          h: "Balances already on the chain",
          p: [
            "SOL, USDC, and PreStock balances are read from the connected account. Those amounts sit in token accounts anyone can query. Senda does not learn them through a private channel, and it does not keep a second set of figures that outrank the chain. A portfolio line is a formatted read of that public state, marked at the last print the desk already fetched. Empty means the wallet holds none of that mint. It does not mean a balance is hidden from the page, and it does not mean the desk is waiting to reveal one. The same read is what a block explorer shows for that address. Refreshing asks the chain again. Refreshing does not move tokens.",
            "When a balance changes after a swap, the chain has updated. Every reader of that account can see the new amount: an indexer, another wallet pointed at the same key, a person you sent the address to. The change is not a disclosure unique to this origin. Senda can show it sooner or later depending on which RPC answered, and two readers can disagree for a moment while a slot is still settling. That lag is not a private balance. The settled account is public. What the desk adds is the layout: the mint name, the last print, the difference from the mark. The tokens themselves were never inside Senda.",
          ],
        },
        {
          h: "Quotes, landings, and this browser",
          p: [
            "A buy, a sell, a convert, a cover premium, or a USDC payment starts as a quote you asked for. The request leaves this browser: a mint, a size, a route. The quote is how the page shows what would leave and what would come back. It is not a fill, and it is visible to the routing service that priced it. After you sign and the transaction lands, the signature and the accounts it touched are public. Senda can see that landed transaction the same way any indexer can. It cannot see a transaction you composed in the wallet and never sent. It cannot see one that simulation rejected before the wallet was asked.",
            "Notes, Senda cash, and the books digest live in this browser. They are not chain balances. Notes are text the desk stored for you. Senda cash is a local ledger. The books digest is the journal summary the page keeps so it can reopen the same sheet: tokens, totals, and the difference the close reports. Those three are visible to this origin because this origin wrote them. They are not visible to someone who only has your public key, and they do not appear on a block explorer. Another computer starts without them. The chain still shows SOL, USDC, and PreStocks. The local sheet does not travel with the key.",
          ],
        },
        {
          h: "What it must not be able to see",
          p: [
            "Senda does not see the secret key. It does not see a seed phrase. Connect returns a public key, and the signing material stays in the wallet. The desk never asks you to type twelve or twenty-four words, and it has no field that would accept them. A page that requests a seed in order to \"restore\" an account is not this desk, whatever chrome it copies. The wallet may ask you to approve a connection, a transaction, or a short message. Those prompts are the wallet speaking. They are not a request for the phrase that can recreate the key on a different machine.",
            "Senda does not see a card number on a real network, because it does not have a bank identification number that would make one. A figure drawn for Senda cash is a label on the local ledger. A card terminal will not clear it. Visa and Mastercard do not authorize it, and there is no processor lookup in this repo that could return a PAN, a limit, or a decline from a scheme. Keeping the last four of that local figure is not the same as storing a network primary account number. If a flow needed a real PAN, it would need an issuer. This page is not that issuer.",
            "Senda does not see the plaintext of a sealed room. A note sealed there is encrypted in the browser before it is stored. What may be kept is ciphertext. The key that opens it is not kept where staff can use it. There is no support tool that decrypts a room, and no break-glass copy held for a ticket. If such a tool existed, the feature would be an inbox with a lock on the door and a key at the desk. That is a different product. The rest of this book says what the room actually does, and what an agent is allowed to touch.",
          ],
        },
      ],
    },
    {
      id: "signs",
      title: "The signature boundary",
      body: [
        {
          h: "Offered only when injected",
          p: [
            "Wallets are offered only when their provider is injected into this window. Phantom, Solflare, Backpack, and the other names in the picker are checked against what the page can actually see. A missing extension is not drawn as connected, and it is not replaced with a hosted signer that Senda operates. The desk does not ship a key, does not email a key, and does not ask you to paste a secret so it can reconstruct a public key. If the provider object is absent, that choice is absent. Installing the wallet, then opening this origin in that same browser, is the whole availability test.",
            "Connect returns a public key and stops there. The call is the wallet's connect method, not an import of a secret, and not a registration of a customer. Senda stores the address so later reads and later transactions name the right account. It does not receive a signing callback it can invoke without you. Each later move is a fresh request to the provider that is still injected. If you remove the extension, or the provider disappears from the window, the desk can still display the last address it saw. It cannot sign with a memory of a public key. A public key does not sign.",
          ],
        },
        {
          h: "Built here, then simulated",
          p: [
            "A buy, a sell, a convert, a cover premium, and a USDC payment are transactions. The desk builds them here. A swap is a Jupiter route between SOL, USDC, and a PreStock mint, and a route outside that set is refused before the wallet is involved. A payment is a USDC transfer to a Solana address, with a memo. A cover premium is USDC you send under terms the transaction carries. None of these are entries in a private book that Senda settles later. After the transaction is built, the desk simulates it against the chain. If simulation fails, the wallet is not asked. The error stays on the page.",
            "Simulation is a preflight, not a second signature and not a receipt. The chain is asked whether the unsigned transaction, with a fresh blockhash substituted for the check, would fail. A failure, including an insufficient balance the logs make obvious, stops the flow. A pass means the desk is willing to hand the transaction to the wallet. It does not freeze the quote. It does not reserve inventory. Senda does not take the other side of the trade. Between the pass and the prompt, and again between the prompt and the landing, an account can change. A passed simulation is permission for the desk to ask. It is not proof you already hold the output.",
          ],
        },
        {
          h: "The signature is the move",
          p: [
            "The wallet signs. The accounts in the transaction move. A buy lands the mint in the wallet that signed. A sell sends that mint out along the route. A convert is the same kind of swap, named for the direction. A cover premium leaves as USDC because you signed that transfer. A USDC payment credits the recipient token account in that same signed transaction, and creates the account first if they do not have one, with you paying the rent. Refusal sends nothing. Closing the prompt sends nothing. The desk has no background path that completes the move while the tab sits idle.",
            "There is no batch of signatures applied on a timer, and no session in which the page may sign \"the next one\" without a new prompt. Each transaction is its own ask. If you sign, the signature is public once it lands, and anyone can match it to the accounts it named. If you do not sign, there is no transaction to match. The desk can still show the quote you requested, because the quote already happened. A quote is not authority. Authority is the signature, and the signature is produced in the wallet, by a provider this page does not contain.",
          ],
        },
        {
          h: "Not a custodian",
          p: [
            "Senda is not a custodian. Moving a token without the owner's signature would be custody: the desk would hold the mint, or hold a key that can move it, and deliver it on its own later. This flow does not do that. The token stays in the wallet that holds it until a transaction that wallet signs says otherwise. A read of a balance is not possession. A quote is not possession. An agent queue is not possession. If a design required Senda to receive the PreStock and return something else from its own keys, that design would be a different business. It is not this one.",
            "Do not read these pages as a SOC 2 report, a bank charter, a KYC program, or an insurance license. None of those are claimed, because none of those are in this repo. Rain, Bridge, and Lead Bank can issue real accounts and cards elsewhere, in programs they operate, under their own identification of the customer. This repo does not have that program and does not have that KYC. A dollar account is not invented here. Until someone else's program is actually wired and the customer has passed that program's checks, the payment a Solana address can clear from this desk is the USDC transfer you sign.",
          ],
        },
      ],
    },
    {
      id: "room",
      title: "Rooms and agents",
      body: [
        {
          h: "Read and queue",
          p: [
            "An agent can read the book and the sheet you pointed it at. It can write a line about what moved. It can queue a buy or a sell: a symbol, a side, a dollar size, and a reason. The queue is a proposal sitting on the page. It is not a transaction, and it is not a signature waiting to be broadcast. The agent uses the same public prints you can see, plus the local notes and limits already in this browser. It does not receive a private feed. It does not get a copy of the wallet. Reading the book is the same read the desk already performs for you.",
            "The agent cannot sign. There is no agent key. Nothing in the job is a secret that could produce a Solana signature, and the wallet's secret is not shared with the shift. When a queued trade should actually move tokens, it has to come back through the same boundary as a trade you typed: the desk builds a transaction, simulates it, and asks the wallet. If you decline, the queue remains a line you can ignore. It does not become a fill. If simulation fails, the wallet is not asked for that one either. The agent has no second door around that check.",
          ],
        },
        {
          h: "The shift ends with the tab",
          p: [
            "The shift runs in this tab. It does not continue after the tab closes. There is no server process that keeps scouting names, writing the sheet, or queueing orders while the browser is shut. Reopening the desk does not replay a night of trades. It shows what this browser still has stored, and what the chain currently says. A job you configured can still be listed tomorrow. Listed is not running. The work happens while the page is open and the code is executing in that page. Close the laptop and the loop stops, even if the configuration is still on disk.",
            "A saved job is a setting in this browser, not a delegate with authority. It does not wake on another computer. It does not attach itself to your public key and follow you. It does not hold a session that can answer a wallet prompt. If you wanted the shift to survive the tab, the design would need a process somewhere else, and that process would need a key or a standing approval. This repo does not give it either. The bound is intentional. An agent that can read and queue is a clerk. A clerk who can sign while you are away is an operator. The desk does not employ one.",
          ],
        },
        {
          h: "A room is not an inbox",
          p: [
            "A sealed room is two wallets and a key this page cannot read on its own. The test for whether the feature is actually sealed is dull and decisive. If staff can decrypt a note \"for support\", the feature is an inbox. Inboxes are a normal product. Someone on the payroll opens the message, answers, and the plaintext existed on a server the company can reach. That is not what a room is for. This desk does not keep a recovery key, a staff key, or a break-glass copy of the room. A ticket cannot be solved by opening the note, because the people reading the ticket do not have the key.",
            "The plaintext of a sealed room is therefore on the list of things Senda must not be able to see. Seeing a box, a public arm, or a wallet signature over that arm is not seeing the sentence. A card you copy to the other member carries the nonce, the two member addresses, and the public halves with their signatures. It does not carry the private key, and it does not carry the note. The other person can open the room from their own browser, with their own key, and read what they are a member of. Senda is not a member. Support is not a member. Adding either would end the distinction.",
          ],
        },
        {
          h: "The key stays here",
          p: [
            "The implementation uses X25519 and AES-GCM in the browser. Each member generates an X25519 key on this page. The public half is signed by their wallet, and the other member checks that signature against the wallet address before trusting the arm. The two public halves are used to derive shared bits, and those bits are hashed into an AES-GCM key. A note is encrypted with that key. The initialization vector and the box can be stored with the room. The Web Crypto calls run in the browser that holds the private half. The plaintext is not posted to a server to be encrypted there.",
            "Ciphertext may be stored. The key is not. The private X25519 key remains in the browser that created it. A stored box, on this machine or copied as ciphertext, is not readable by the desk as text. Losing this browser can lose your ability to open notes you sealed here. The other member can still read with their own key, because the room has two arms, not a key escrow. Senda cannot reset the room, reissue the private half, or decrypt a backup you did not make. A reset that staff could perform would mean staff could read. The room does not offer that comfort, because the comfort is the hole.",
          ],
        },
      ],
    },
    {
      id: "local",
      title: "This browser",
      body: [
        {
          h: "The local sheet",
          p: [
            "Notes, Senda cash, and the books digest are kept in this browser. Senda cash is a ledger on this machine. A send inside that ledger, a shop charge, real play, and some premiums move it. It is denominated for the desk. It is not SOL, and it is not USDC in a token account. Nothing in a Senda cash entry is a signature on mainnet. Clearing site data clears the ledger. A private window does not see the normal window's ledger. Another profile on the same computer does not inherit it. The number can be useful on this page. It is not a balance a bank, an explorer, or a second device can query.",
            "The books digest replays the local journal and reports the difference: the tokens the app is using, the totals, whether the sheet ties. It is how the desk reopens its own arithmetic. It is not a broker statement, not a chain receipt, and not a tax record. A landed signature is the receipt for a move of tokens. The digest can drift from the chain if storage was partial, if a local entry was edited, or if a transaction landed that this page never wrote down. When they disagree, the chain is the token balance. The digest is the desk's memory of its own book. Memory is not the mint.",
          ],
        },
        {
          h: "The spend cap",
          p: [
            "The spend cap is a local control, not a chain program. It is a number stored in this browser. Before the desk asks the wallet to sign a send or a route, it compares the size with that number. Over the cap, it stops and tells you to raise it. Raising the cap is an edit on the page. It is not a transaction, and the chain is not notified. The cap does not travel inside the Solana instruction. Validators do not enforce it. Another front end pointed at the same wallet has never heard of it. The default exists so the desk does not casually ask for a large signature. It is a preference of this origin.",
            "The cap can stop the desk from asking. It cannot stop a user who signs in the wallet directly. If you open the wallet yourself and approve a transfer this page did not build, the cap is not consulted, because the cap lives in the page. A program on the chain would have to reject the instruction for the limit to bind everywhere. There is no such program in this flow. Treat the cap as a guard on prompts Senda is about to show you. Do not treat it as a lock on the account, a daily limit a bank would honor, or a control an attacker must defeat on chain. Bypassing it is just using the wallet.",
          ],
        },
        {
          h: "No second login for the chain",
          p: [
            "There is no login besides the wallet for chain actions. A swap, a convert, a cover premium, and a USDC payment are authorized when the injected wallet signs them. An email address, a hosted identity button, or a session cookie does not move SOL, USDC, or a PreStock. If the site offers a sign-in, that sign-in is not the signer. It cannot be presented to the chain in place of your signature. A guest browser and a signed-in browser are in the same position when a transaction is required: the provider must be injected, and you must approve the prompt. The session does not shorten that.",
            "Do not confuse a session that restores a layout with custody of the tokens. Restoring chrome, a book, or a local cash figure is a browser concern. Moving a mint is a wallet concern. The page will not ask you for a password whose entry releases SOL from a Senda account, because there is no Senda account holding SOL. It will ask the wallet to sign, and the wallet will ask you, on the wallet's own screen. A stolen password to a site session, where a session even exists, is not a stolen signing key. The signing key was never part of the login.",
          ],
        },
        {
          h: "It does not follow you",
          p: [
            "Browser cash does not follow you to another computer. Notes and the books digest do not either. This flow does not upload those figures as a cloud profile you can reopen by signing in elsewhere. A new machine, connected to the same public key, shows the chain again: SOL, USDC, and whatever PreStocks that key holds. The local ledger starts empty. The spend cap starts at the default. The agent settings are the ones on that machine, not the ones you left at home. The public key is portable because it was always public. The sheet is not portable because it was never on the chain.",
            "That split is deliberate, and it has a cost. A cleared cache, a replaced phone, or a broken profile drops the local ledger with no statement to reprint it from. There is no support desk that can look up Senda cash and put it back, because looking it up from a server would mean it had been stored as a balance Senda holds for you. It was not. Write down anything in the local sheet you cannot afford to lose, in a place that is not this origin, if you need it later. The chain balances remain available from any wallet that can read the same key. They never lived in the browser.",
          ],
        },
      ],
    },
    {
      id: "threats",
      title: "What can still go wrong",
      body: [
        {
          h: "A malicious injected wallet",
          p: [
            "The desk trusts the provider injected into the page. It offers a wallet only when that provider is present, and it sends the built transaction to that provider to sign. If the object in the window is not the wallet you installed, the prompt can misname the request, the account you are shown can be one an attacker expects you to fund, or the bytes signed can differ from the bytes this page built. Senda cannot inspect a closed extension. It sees the provider's methods and the values those methods return. Presence is not authenticity. The check is \"is something injected\", not \"is this the publisher's unaltered build\".",
            "Install the wallet from the publisher you can verify, and do not keep a second extension that claims the same slot in the window. A malicious script sitting in the provider position is closer to the signature than this page is. The simulation Senda runs is on the transaction it just built. Something else in the browser can still ask the wallet to sign a different transaction, or to sign a message you did not intend as a payment. Read the wallet's own screen before you approve. The row on this desk is context. It is not the signature, and it is not a guarantee about what the extension displayed.",
          ],
        },
        {
          h: "Address, slippage, wrapper",
          p: [
            "A wrong address paste is final in the way token transfers are final. USDC sent to an address you mistyped does not return because the desk regrets the field. There is no chargeback on a Solana transfer, and Senda is not a party who can reverse one it did not sign. The page can show you what you typed. It cannot know that you typed the person you meant. Compare the address in the wallet prompt with the address you intended, not only the first and last four characters, when the amount matters. A memo does not correct a wrong destination. The accounts in the transaction are the destination.",
            "Slippage is the gap between the quote on the screen and the fill the route will still accept. The desk asks for a quote and refuses to involve the wallet when the reported price impact is past the line it set. Inside the bound, you can still receive less than the headline figure. A passed simulation does not freeze the pool. If you wait and then sign, you are signing in a later moment, against whatever the route does at that moment. Dynamic movement within the slippage the transaction allows is not a malfunction of the signature boundary. It is the market moving after the number was drawn.",
            "A voided wrapper is a mint that no longer means the name you associated with it. A PreStock is exposure through the issuer's wrapper. It is not a legal share, not a vote, and not a dividend. The desk reads a public print. It does not set that print, and it does not insure the link between the mint and the company. If the issuer voids the wrapper, the token can remain in your wallet while the claim it suggested is gone. Senda will still be able to see that the account holds the mint, because that fact is public. Seeing the balance does not restore the wrapper. No signature available on this desk reverses an issuer's void.",
          ],
        },
        {
          h: "The prompt is the attack",
          p: [
            "Phishing of the wallet prompt is the attack that fits this architecture, because the prompt is where value can move. A page that resembles this desk, a bookmark that is not this origin, or a request that arrives when you did not just build a transaction, is enough to put a signature in front of you. The secret key and the seed phrase are not required for a legitimate connect. A prompt, a form, or a \"support\" chat that asks you to type either of them is the attack, including when the surrounding page looks right. Senda cannot see the phrase, and it will not ask. Anyone who asks is outside the product.",
            "Sign what you can read on the wallet's screen. A message signature is still your wallet speaking. It may open a room, or satisfy a check the page requested, and it is not the same object as a token transfer, but it is not harmless by category. Do not approve a prompt you did not start. The desk's rule is narrow: it asks the wallet after a transaction was built and simulation did not fail, or when you explicitly connect or sign a room arm. A prompt that appears with no action of yours did not come from that rule. Reject it in the wallet, then leave the page that provoked it. The chain will not undo a signature you already approved.",
          ],
        },
        {
          h: "This origin's storage",
          p: [
            "localStorage on this origin holds the local desk: notes, Senda cash, the books digest, the spend cap, agent settings, and other state the page wrote. Clearing site data deletes that set. There is no remote copy of browser cash to restore, and no statement to download later from an account Senda keeps. That loss is not a theft of the chain balances. It is still a way to lose the record you were using, including a room secret that lived only in this profile. Export anything you must keep before you clear the site. After the clear, the public key can be connected again. The sheet cannot.",
            "Any other script that runs on this origin can read what the page can read. A compromised script, an unexpected dependency, or an extension that can touch this origin can copy that storage. The sealed room's private key, kept in this browser so the room can open, is in reach of such a script. Ciphertext stored apart from the key is not the note. The key sitting in the same origin as the box is a different problem: the room protects the note from Senda's servers and from staff, not from a hostile page on this origin. The chain still requires your wallet for a transfer. The local sheet has no such second lock. Use a profile you do not share with scripts you do not trust.",
          ],
        },
      ],
    },
  ],
};
