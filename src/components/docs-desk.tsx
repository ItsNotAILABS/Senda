const SECTIONS: { id: string; title: string; blocks: { h: string; p: string[] }[] }[] = [
  {
    id: "product",
    title: "Product",
    blocks: [
      {
        h: "What Senda is",
        p: [
          "Senda is a desk for tokenized pre-IPO names that already trade on Solana. The wallet you connect is the account. A buy is a Jupiter route you sign. A holding is a token balance in that wallet, marked at the live print.",
          "It is not a broker, not a bank, and not a card network. Nothing on this desk can move until a wallet you control signs, except the cash ledger that lives in this browser.",
        ],
      },
      {
        h: "Who it is for",
        p: [
          "Someone who already holds SOL or USDC in Phantom, Solflare, or Backpack, and wants to buy, hold, cover, spend against, or play a pre-IPO print without opening a brokerage account that closes at four.",
        ],
      },
    ],
  },
  {
    id: "money",
    title: "Money",
    blocks: [
      {
        h: "Two balances",
        p: [
          "Wallet balances are on Solana. SOL and USDC are read from the connected account. PreStock tokens are read the same way, by mint. Senda does not custody them.",
          "Senda cash is a ledger in this browser. Send, shop charges, play, and some covers move that ledger. Clearing the site clears it. It is not a deposit at a bank.",
        ],
      },
      {
        h: "A buy",
        p: [
          "You pick a name and a dollar size. The desk asks Jupiter for a route from USDC into that mint. You see what you pay, what you receive, and the route. Phantom (or the last Solana wallet you connected) signs. The token lands in the wallet you signed with.",
        ],
      },
      {
        h: "Wallets",
        p: [
          "The picker only offers a wallet whose provider is actually injected in this browser. Phantom, Solflare, Backpack, and the other listed Solana injectors can connect. Signing of a PreStock swap follows the last Solana wallet you connected. A wallet that is not installed is not offered as if it were.",
        ],
      },
    ],
  },
  {
    id: "book",
    title: "PreStocks",
    blocks: [
      {
        h: "The book",
        p: [
          "Each row is a tokenized name: last print, premium versus its mark, and the mint. Prices come from the issuer’s public market data. Senda does not set them and does not take the other side.",
          "Buy one name, or buy three in one ticket. Each leg is its own signed swap. Cover, a one-time shop number, and a stand on the print sit on the same name.",
        ],
      },
      {
        h: "Portfolio",
        p: [
          "Portfolio is the names this wallet holds. Tokens from the chain, times the last print. If the wallet is not connected, or it holds none, the book is empty. There are no paper shares.",
          "Under the book, the cash sleeve wraps USDC you already hold and can send that wrap back to the same wallet. The tokens do not move into a Senda account.",
        ],
      },
    ],
  },
  {
    id: "use",
    title: "Using a name",
    blocks: [
      {
        h: "Convert",
        p: [
          "Convert is the swap, shown as what you pay and what you receive. SOL can route to USDC and on into a name. A slice you hold can be sold back the same way. You sign the route. There is no limit order.",
        ],
      },
      {
        h: "Play",
        p: [
          "Ten games take their result from the live print: wheel, slots, up or down, furthest from the mark, closest to the mark, a ride you cash out of, higher or lower, a two-name parlay, dice from the cents, and three safe tiles.",
          "Practice is a separate balance on this browser. Load $500 to learn the felt. Practice never touches the wallet and never touches Senda cash. Real stakes leave Senda cash and wins come back to it. The two do not mix.",
        ],
      },
      {
        h: "Shop",
        p: [
          "Shop mints a number for a store: a virtual card, or a one-time number with a cap. The full number is shown once and is not stored. A charge debits Senda cash and shows up under expenses.",
          "These numbers are minted here. They are not a bank BIN. A merchant can decline them. Apple Pay and a licensed network are not built.",
        ],
      },
      {
        h: "Cover",
        p: [
          "Cover is a 10% drop on a name. You pay a premium. If the print falls through the strike, the cover pays the size back into cash. The token stays in the wallet. It is not an insurance policy and not a regulated contract.",
        ],
      },
      {
        h: "Send",
        p: [
          "Send moves Senda cash to a person you name, or requests it, or passes it to a browser nearby. Presets fill the amount. Pay again fills the last person you actually paid. It does not wire a bank.",
        ],
      },
    ],
  },
  {
    id: "agents",
    title: "Agents",
    blocks: [
      {
        h: "The bound",
        p: [
          "An agent is an envelope: a name, a mandate, the symbols it may watch, a max size, a side, and a job. Jobs are scout, discount, rich, daily, cover, and clerk. You can make one, arm one of the four ready desks, or paste one in as JSON.",
          "On a shift it reads the book and writes a line, or queues one order. A buy or sell is passed through the spend cap and a drawdown gate before it is queued. If this tape matches a send you already made, the size is cut. The agent does not sign. You do.",
        ],
      },
      {
        h: "The computer",
        p: [
          "The computer on the agent page only runs commands the desk already knows: the book, a quote, memory of past sends, the vault wrap, and a note. It cannot invent a tool and it cannot broadcast.",
        ],
      },
    ],
  },
  {
    id: "desk",
    title: "The rest of the desk",
    blocks: [
      {
        h: "Work",
        p: ["A sheet next to the book. The clerk job can write a line onto it. You can edit it. It stays in this browser."],
      },
      {
        h: "Trade",
        p: ["A ticket: size, side, and a signature. There is no central limit book."],
      },
      {
        h: "Solana",
        p: ["The mints behind the names, copied from the book the desk already loaded. This is how a name is an address, not a ticker in a database."],
      },
      {
        h: "Books",
        p: ["The ledger of this browser: sends, play, charges, and the other lines the cash ledger actually wrote. No sample rows."],
      },
      {
        h: "Account",
        p: ["The wallets you linked, the cash in this browser, and the privacy note. Signing in is optional and is not the wallet."],
      },
    ],
  },
  {
    id: "limits",
    title: "Limits",
    blocks: [
      {
        h: "Live",
        p: [
          "Live prints. A Jupiter quote. A signature in your wallet. Portfolio from chain balances. Practice and real play. A number you can charge against Senda cash. An agent that queues and waits. A cover you open on a name. A sheet, a ticket, the mints, and the ledger.",
        ],
      },
      {
        h: "Not built",
        p: [
          "A brokerage account. Margin. A bank wire. A card network that a merchant must accept. An agent that signs while this tab is closed. A second computer that inherits this browser’s cash. Limit orders. A shared play table between two wallets.",
        ],
      },
      {
        h: "Submission note",
        p: [
          "The long note for the bounty is the PDF linked on this page. It is the same product, written out for a reader who is not in the app. The app is the demo.",
        ],
      },
    ],
  },
];

export function DocsDesk() {
  return (
    <div className="grid gap-4 px-3 py-3 lg:grid-cols-[220px_1fr] lg:px-4">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <a href="/senda-submission.pdf" className="flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
          Submission PDF
        </a>
        <nav className="mt-3 rounded-[22px] border border-white/10 bg-[#10131c] p-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="block rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-fg">
              {s.title}
            </a>
          ))}
        </nav>
      </aside>
      <div className="space-y-3">
        <header className="rounded-[22px] border border-white/10 bg-[#10131c] px-5 py-5">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Senda</p>
          <h1 className="mt-2 max-w-3xl text-4xl tracking-tight lg:text-5xl">The desk for pre-IPO names that already trade.</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">Your wallet signs. Jupiter routes. The print is the price. This page is the map of what that means, and of what it does not mean.</p>
        </header>
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24 rounded-[22px] border border-white/10 bg-[#10131c] px-5 py-5">
            <h2 className="text-xl">{s.title}</h2>
            <div className="mt-4 space-y-4">
              {s.blocks.map((b) => (
                <div key={b.h}>
                  <h3 className="text-sm font-semibold text-accent">{b.h}</h3>
                  {b.p.map((para) => (
                    <p key={para.slice(0, 24)} className="mt-2 text-sm leading-relaxed text-muted">
                      {para}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
