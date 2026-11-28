import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Page = { id: string; title: string; body: { h: string; p: string[] }[] };

const BOOKS: { id: string; label: string; lede: string; pages: Page[] }[] = [
  {
    id: "start",
    label: "Start",
    lede: "What this desk is, and what it refuses to pretend.",
    pages: [
      {
        id: "what",
        title: "What Senda is",
        body: [
          {
            h: "The desk",
            p: [
              "Senda is the operating layer on tokenized pre-IPO names that already trade on Solana. You connect a wallet you already have. You buy a mint. You hold it there. You can pay someone in USDC, cover a drop, play the print, or hand a bounded job to an agent.",
              "A brokerage cannot see the mint, and it is closed at midnight. A swap page can fill a route and then leaves you there. This is the desk in between.",
            ],
          },
          {
            h: "What it is not",
            p: [
              "Not a broker. Not a bank. Not a card network. Not a custodian. The private key never enters Senda. If a wallet is not installed in this browser, it is not offered.",
            ],
          },
        ],
      },
      {
        id: "map",
        title: "The pages",
        body: [
          {
            h: "Where to go",
            p: [
              "Home is the money and the book. PreStocks is the names. Convert is the route. Play is the print. Shop is a number and a USDC payment. Agents is the workspace. Send moves cash in this browser. Portfolio is what the wallet holds. Make is work other people can pay for in USDC. Cover is a drop. Docs is this set.",
              "A chart has three books. Desk is the pool, with candles and studies. Price is that same pool drawn as a line. Mark is a DefiLlama price, so you can see a second number. Phantom’s chart stays inside Phantom. None of the three is a TradingView session.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "wallets",
    label: "Wallets",
    lede: "The signer is the account.",
    pages: [
      {
        id: "connect",
        title: "Connect",
        body: [
          {
            h: "Injected only",
            p: [
              "Phantom, Solflare, Backpack, and the other Solana wallets in the picker are offered only when their provider is actually in this window. Connect returns a public key. Senda does not receive the secret, and it does not create a key for you.",
            ],
          },
          {
            h: "What a signature is",
            p: [
              "A buy, a sell, a convert, a cover premium, and a USDC payment are transactions. The desk builds them, simulates them, and asks the wallet to sign. If simulation fails, the wallet is not asked.",
            ],
          },
        ],
      },
      {
        id: "cash",
        title: "Two balances",
        body: [
          {
            h: "On the chain",
            p: ["SOL, USDC, and PreStock tokens are read from the connected account. Portfolio marks tokens at the last print. Empty means the wallet holds none."],
          },
          {
            h: "In this browser",
            p: ["Senda cash is a ledger on this machine. Send, a shop charge, real play, and some premiums move it. Clearing the site clears it. It is not a bank balance and it does not follow you to another computer."],
          },
        ],
      },
    ],
  },
  {
    id: "prestocks",
    label: "PreStocks",
    lede: "A name is a mint with a print.",
    pages: [
      {
        id: "book",
        title: "The book",
        body: [
          {
            h: "The row",
            p: [
              "Each name has a last price, a premium versus its mark, and a mint. The print comes from the public pre-IPO market. Senda does not set it and does not take the other side.",
              "A buy is a dollar size. Jupiter quotes USDC into that mint. You see what leaves and what comes back. You sign. The token arrives in the wallet that signed.",
            ],
          },
        ],
      },
      {
        id: "hold",
        title: "Holding one",
        body: [
          {
            h: "Portfolio",
            p: ["Portfolio is only the PreStocks this wallet holds, token account times last print. There is no paper share. Selling a slice is the same route in reverse."],
          },
        ],
      },
    ],
  },
  {
    id: "pay",
    label: "Pay",
    lede: "USDC to an address. The wallet signs.",
    pages: [
      {
        id: "usdc",
        title: "A payment",
        body: [
          {
            h: "The transaction",
            p: [
              "Shop can pay a Solana address in USDC. The mint is EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v, six decimals. Source and destination are the USDC accounts of the two wallets. If the receiver has no USDC account, the same transaction creates it and you pay the rent.",
              "A memo carries a reference so the payment can be found on chain. The signature opens on Solscan. There is no BIN and no issuer.",
            ],
          },
          {
            h: "The cap",
            p: ["A payment cannot exceed the spend cap on this browser. The default is $100. The ceiling is $5,000. Raise it on the wallet before you send a larger amount."],
          },
        ],
      },
    ],
  },
  {
    id: "cards",
    label: "Cards",
    lede: "A number is not a network. A transfer is.",
    pages: [
      {
        id: "number",
        title: "The number",
        body: [
          {
            h: "What it does",
            p: [
              "Make a number, see it once, keep the last four and the cap. A charge debits Senda cash in this browser. Visa never sees it, so a terminal will decline it. The mark on the card is Senda, not a scheme.",
            ],
          },
        ],
      },
      {
        id: "rails",
        title: "Rails a store will clear",
        body: [
          {
            h: "Already live, not ours",
            p: [
              "Phantom Cash spends Bridge’s CASH on Solana. The issuer is Lead Bank. Jupiter spends USDC on a Visa issued through Rain or DCS. KAST spends USDC, USDT, or PYUSD deposited on Solana, custodial, Visa. Solflare’s card paused on 28 Jul 2026 when Kulipa wound down.",
              "The pipes under those cards are Rain and Bridge. Both require a program and KYC. This repo does not have a BIN. Until it does, the payment a Solana merchant can clear is the USDC transfer.",
              "Shop shows three faces. USDC is the payment. Cash is Phantom’s token, and their Visa stays in the Phantom app. Route is a Mayan move, where this desk can take 8 basis points. A store’s card fee is not that.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "play",
    label: "Play",
    lede: "The result is the print, not a hidden draw.",
    pages: [
      {
        id: "felt",
        title: "The ten",
        body: [
          {
            h: "Games",
            p: ["Wheel, slots, up or down, furthest from the mark, closest to the mark, a ride, higher or lower, a two-name parlay, dice from the cents, and three safe tiles. The pay table is on the felt."],
          },
          {
            h: "Practice and real",
            p: ["Practice is a separate balance. Loading it does not touch the wallet or Senda cash. Real stakes move Senda cash in one write. If real cash is empty, the round refuses."],
          },
        ],
      },
    ],
  },
  {
    id: "cover",
    label: "Cover",
    lede: "A drop, not a policy.",
    pages: [
      {
        id: "drop",
        title: "Ten percent",
        body: [
          {
            h: "The terms",
            p: [
              "There is no listed put. The hedge is a Jupiter sell of the token the wallet holds. A premium is not sent to a key stored in this browser.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "agents",
    label: "Agents",
    lede: "A workspace. The purpose is yours. The signature is yours.",
    pages: [
      {
        id: "workspace",
        title: "Make one",
        body: [
          {
            h: "What you write",
            p: [
              "An agent is a name and a purpose. The purpose can be anything you need it to do with the tools on the page: read the book, queue a trade, remember the tape. A buyer, a clerk, a watch on one name, or a sentence you write yourself.",
            ],
          },
          {
            h: "What it cannot do",
            p: ["It cannot sign. Run writes a log and, if you allowed a trade, queues one. Sign asks the wallet. The shift does not continue after you close the tab. It does not hold its own key."],
          },
        ],
      },
      {
        id: "model",
        title: "A model on the desk",
        body: [
          {
            h: "Open the door",
            p: [
              "Agents, then Harness. Open a harness once. Copy the desk call. That token is a bearer for this browser’s harness. It is not a wallet key and it is not a seed.",
              "The model posts to POST /api/agent, or the same tools at POST /api/mcp. First call is desk. If missions is 0, it stops and tells you to open a mission. It cannot open the wallet.",
            ],
          },
          {
            h: "Quote, then queue",
            p: [
              "list_missions returns the id. quote is a live Jupiter quote for a catalog name. It is not a fill. queue_trade reserves today’s aim. A clip mission can buy or sell. A dip mission still waits for a down day. Pass model and the name shows on the card you sign.",
              "The Harness pill shows a count when something is waiting. You sign it there. A call with no token is rejected. Nothing leaves the wallet until you sign.",
            ],
          },
          {
            h: "What the model does not get",
            p: [
              "It does not get a key. It cannot trade a mint that is not on the catalog, except a new mint that already passed the launch gate, and that is still a queue. It does not see other people’s wallets. Marking a trade signed is the phone, after the signature, not the model.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "make",
    label: "Make",
    lede: "Work a person will pay for.",
    pages: [
      {
        id: "board",
        title: "The board",
        body: [
          {
            h: "What you can post",
            p: [
              "A job, software, a service, hardware, robotics, or what a teacher’s class needs. You set a price in USDC and the Solana address that should receive it. Pay signs a transfer. The whole amount goes to that address. Senda does not take a cut.",
            ],
          },
          {
            h: "Where the listing lives",
            p: ["The listing is stored in this browser. The payment is on mainnet. Another computer does not see the listing until it is posted there."],
          },
        ],
      },
    ],
  },
  {
    id: "limits",
    label: "Limits",
    lede: "Live, and not built.",
    pages: [
      {
        id: "live",
        title: "Live",
        body: [
          {
            h: "What runs",
            p: [
              "Prints. A Jupiter quote and a signature. Portfolio from token accounts. A USDC payment. Practice and real play. A shop number against browser cash. A cover premium you sign. An agent that runs and waits. A board you can pay.",
            ],
          },
        ],
      },
      {
        id: "not",
        title: "Not built",
        body: [
          {
            h: "Do not read these as done",
            p: [
              "A brokerage account. Margin. A bank wire. A Visa or Mastercard BIN. Apple Pay. An agent key. A shift after the tab closes. Limit orders. A login that carries this browser’s cash to another computer. A Senda program. There is no program id. A ZelleUSD mainnet mint. The Zelle desk is a devnet drill: the amount is hidden, a bank can be frozen, and the auditor cannot move the dollars. It does not sign, and it does not pay India. Jupiter’s verified identity, credit score, and proof of wealth are not called. The passport on this phone is a key, not a document. Jupiter Lend’s BLSH market was announced and is not open, so there is no borrow. USDPT is not a mint on this desk. Polymarket prices are live, and the trade stays on their site.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "chains",
    label: "Chains",
    lede: "Solana, Bitcoin, Ethereum, Arbitrum, Base, Monad. Nothing else was taken off the desk.",
    pages: [
      {
        id: "map",
        title: "Where each chain clears",
        body: [
          {
            h: "Solana",
            p: [
              "This is the account. Phantom, Solflare, or Backpack signs. Jupiter quotes the route. PreStocks, xStocks, perps, USDC sends, and the coin book all land in that wallet.",
              "Bitcoin and ether on this desk are the Solana wrappers, WBTC, cbBTC, and portal ETH. Native bitcoin is not signed here.",
            ],
          },
          {
            h: "Ethereum and its rollups",
            p: [
              "Ostium longs and shorts clear in USDC on Arbitrum. Phantom’s Ethereum account or MetaMask signs. The margin stays in the wallet until the contract locks it.",
              "Base is the Ethereum account already on the Wallets desk. It is not a second Solana buy.",
            ],
          },
          {
            h: "Monad",
            p: [
              "Chain 143. The Chains desk asks the wallet to add it. A Monad token swap is not listed until a router is actually called. The button does not pretend one.",
            ],
          },
        ],
      },
      {
        id: "kept",
        title: "What stays",
        body: [
          {
            h: "Desks that are not replaced",
            p: [
              "Chart, Quotes, Spot, PreStocks, xStocks, Perps, FX and metals, Commodities, Pairs, Ostium, Options, Stakes, Borrow, Cover, Send, and Portfolio each keep their own page.",
              "A new chain is a row on the Chains desk. It is not a reason to delete a market.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "contracts",
    label: "Contracts",
    lede: "Two books. One writes a signature. One lists programs this desk already calls.",
    pages: [
      {
        id: "two",
        title: "Two books",
        body: [
          {
            h: "Do not mix them",
            p: [
              "Contracts opens on Business. That is a document you write and then sign. Registry is the list of programs, markets, pools, and APIs the desk already uses. Pay link is the QR, the hold, and the transfer, on their own tab so they do not sit on the form.",
              "Senda did not deploy the programs on the registry. A placeholder agency id in the repo is not listed, because it is not on mainnet.",
            ],
          },
        ],
      },
      {
        id: "business",
        title: "Business contracts",
        body: [
          {
            h: "Six families",
            p: [
              "Sell is an invoice, a milestone, a retainer, a change order, one subscription period, a delivery, or earnest money. Hire is freelance, a service, a statement of work, a referral, or a kill fee. Place is rent, a security deposit, or a vendor prepay. Capital is a repayment, one revenue split, or a partner draw. Cover is a written premium. Desk is a spend mandate, a trade mandate, a scope note, an acceptance, or a quiet note.",
            ],
          },
          {
            h: "What the signature does",
            p: [
              "A payment is one USDC transfer from the connected wallet to the address you typed, on the chain you picked. Monad is on the chain row and cannot pay yet, because this desk has no USDC address there. A mandate sets the spend cap and moves no USDC. A scope note, an acceptance, and a quiet note save words on this phone and do not change the cap.",
              "None of these deploy a program. None of them renew. A partner draw is not equity and not a token. A cover note is not an insurance policy. Voiding the record later does not pull a payment back. A refund is a new payment the other way.",
            ],
          },
          {
            h: "How to sign one",
            p: [
              "Pick the family, pick the contract, pick the chain, type the address or the name, the amount, the date, and the sentence that makes it specific. Review the signature. The contract text on the card is the text that is saved. Then sign. Share copies that text. It is not filed with a court.",
            ],
          },
        ],
      },
      {
        id: "registry",
        title: "The program registry",
        body: [
          {
            h: "What a row is",
            p: [
              "A Program row is an address this app already calls: System, SPL Token, Token-2022, the associated-token program, Memo, and Circle’s CCTP messenger and transmitter. A Market is Kamino’s main market, the xStocks market, or an Aave pool on Ethereum or Base. A Pool is a Meteora pool the program desk can add to. A Mint is USDC, JitoSOL, or Sanctum INF.",
              "An API row has no program id on this desk, so none is shown. Jupiter quotes and swaps, Jupiter perps, DFlow as a second quote, and Marginfi rates are APIs. Marginfi is rates only. There is no deposit button.",
            ],
          },
          {
            h: "Open",
            p: ["Each row opens the desk that already talks to that program. The registry does not send a transaction by itself."],
          },
        ],
      },
    ],
  },
  {
    id: "markets",
    label: "Terminal",
    lede: "The left list is a cabinet. Open a market and that market becomes the list. Either side can close so the chart takes the room.",
    pages: [
      {
        id: "list",
        title: "The left list",
        body: [
          {
            h: "Where it is",
            p: [
              "Trade, then Terminal. The left column is the book. The center is the chart. The right is the trading box. Each side column collapses the same way the app sidebar does, and the chart takes that width and grows taller. On a phone the list sits under the box so the chart stays first.",
              "The dropdown is labeled Open a market. Choosing one opens a cabinet and makes that cabinet the list. PreStocks, Spot, Crypto, Listed, Stakes, Tessera, Held, and Watch are the markets. A price is a live print. An empty cabinet says the market has not priced, or the wallet holds nothing. It does not invent a price.",
              "The trading box is buy or sell, a dollar size, and who the order is for. This wallet signs now. An open harness mission is listed when one exists on this phone. Choosing it queues against that mission's aim, then this same wallet signs. If the signature is refused, the aim is put back. The agent never receives a key. A name the catalog will not trade is refused before the wallet opens.",
            ],
          },
          {
            h: "More than one cabinet",
            p: [
              "Open a second market and it stacks under the first. The header shows the name and the count. Tap a header to switch the list. Close removes that cabinet. The last one stays. Which cabinets are open is remembered on this phone.",
            ],
          },
          {
            h: "The watch list",
            p: [
              "The circle beside a name adds it to Watch. Open the Watch cabinet from the same dropdown. Starring does not trade and does not alert by itself. The list stays on this phone. It is not the single price alarm elsewhere on the desk.",
            ],
          },
          {
            h: "The ticket",
            p: [
              "Pick a row and the chart follows that mint. Buy and sell still ask the wallet. A quote on the ticket is not a fill. Search only filters the cabinet that is open.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "crew",
    label: "Three seats",
    lede: "The desk is built for a small crew. Three seats. One wallet.",
    pages: [
      {
        id: "seats",
        title: "Who sits where",
        body: [
          {
            h: "The signer",
            p: [
              "One person holds the wallet. Phantom, Solflare, or Backpack. Every buy, sell, USDC send, loan, and business payment waits for that signature. Senda never receives the secret. If the wallet is not in this window, it is not offered.",
            ],
          },
          {
            h: "The operator",
            p: [
              "One person runs the screen. They open markets in the quote list, keep the watch list, write the business contract, and check the registry before they tell someone a program is callable. They do not sign unless they are also the signer.",
            ],
          },
          {
            h: "The model",
            p: [
              "One model, or a person pasting for it, uses the harness token. It calls desk, then list_missions, then quote, then queue_trade. It stops when there is no mission. It cannot raise the cap, cannot sign, and cannot invent a fill. The signer sees the card and decides.",
            ],
          },
          {
            h: "What the three share",
            p: [
              "They share this browser’s harness, the open cabinets, and the signed contract records. They do not share a key. Clearing the site clears the notes, the watch list, and the cabinets. It does not move the tokens. Those stay in the wallet.",
            ],
          },
        ],
      },
      {
        id: "day",
        title: "A working day",
        body: [
          {
            h: "Open",
            p: [
              "Connect the wallet. Open the trading terminal and the markets you actually trade. Star the names you will look at again. If a model is working today, open a harness mission with a bankroll and a daily aim. The aim is the most that can be queued. It is not a promised profit. Pick that mission in the trading box when the order should count against it.",
            ],
          },
          {
            h: "During",
            p: [
              "The operator watches the cabinet. The model queues. The signer signs or releases. A business payment is a separate signature on Contracts, with the address and the sentence filled in. Do not treat a queued card as a fill, and do not treat a saved note as a filed agreement.",
            ],
          },
          {
            h: "Close",
            p: [
              "Release anything still queued if you do not want it waiting tomorrow. The aim comes back when you release. Voiding a contract record does not reverse USDC. Check the wallet, not the note, for what actually moved.",
            ],
          },
        ],
      },
    ],
  },
];

export function DocsDesk({ bookId }: { bookId?: string }) {
  const start = BOOKS.find((b) => b.id === bookId) ?? BOOKS[0];
  const [bookIdState, setBookId] = useState(start.id);
  const book = BOOKS.find((b) => b.id === bookIdState) ?? BOOKS[0];
  const [pageId, setPageId] = useState(book.pages[0].id);
  const page = book.pages.find((p) => p.id === pageId) ?? book.pages[0];

  function openBook(id: string) {
    const next = BOOKS.find((b) => b.id === id) ?? BOOKS[0];
    setBookId(next.id);
    setPageId(next.pages[0].id);
  }

  useEffect(() => {
    if (!bookId) return;
    openBook(bookId);
  }, [bookId]);

  return (
    <main className="flex min-h-[calc(100dvh-88px)] flex-col">
      {bookId ? null : (
      <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-4">
        {BOOKS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => openBook(b.id)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-3 text-sm",
              b.id === book.id ? "border-accent text-white" : "border-transparent text-white/45 hover:text-white",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
      )}
      <div className="grid flex-1 lg:grid-cols-[220px_minmax(0,1fr)_200px]">
        <aside className="border-white/10 px-3 py-5 lg:sticky lg:top-0 lg:h-[calc(100dvh-6rem)] lg:overflow-auto lg:border-r">
          <p className="px-2 font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">{book.label}</p>
          <p className="mt-2 px-2 text-xs leading-relaxed text-white/45">{book.lede}</p>
          <nav className="mt-4 space-y-0.5">
            {book.pages.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPageId(p.id)}
                className={cn("flex w-full items-baseline gap-2 rounded-xl px-3 py-2 text-left text-sm", p.id === page.id ? "bg-white text-black" : "text-white/55 hover:bg-white/5 hover:text-white")}
              >
                <span className="font-mono text-[10px] opacity-50">{String(i + 1).padStart(2, "0")}</span>
                {p.title}
              </button>
            ))}
          </nav>
        </aside>
        <article className="min-w-0 px-5 py-8 lg:px-10 lg:py-10">
          <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">{book.label}</p>
          <h1 className="mt-2 max-w-3xl font-display text-4xl tracking-tight">{page.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">{book.lede}</p>
          <div key={page.id} className="senda-in mt-8 max-w-3xl space-y-4">
            {page.body.map((block) => (
              <section key={block.h} id={block.h.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <h2 className="text-base font-semibold">{block.h}</h2>
                {block.p.map((para) => (
                  <p key={para.slice(0, 48)} className="mt-2 text-sm leading-relaxed text-white/70">
                    {para}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </article>
        <aside className="hidden px-4 py-10 lg:block">
          <p className="font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">On this page</p>
          <ul className="mt-3 space-y-2">
            {page.body.map((block) => (
              <li key={block.h}>
                <a href={`#${block.h.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="text-xs leading-snug text-white/50 hover:text-white">
                  {block.h}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
