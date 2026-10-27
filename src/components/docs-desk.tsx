import { useState } from "react";
import { cn } from "@/lib/utils";
import { JumpStrip } from "@/components/jump-strip";
import { DeskAudit } from "@/components/money-flow";

import { paper } from "@/content/docs/paper";
import { pay } from "@/content/docs/pay";
import { research } from "@/content/docs/research";
import { useBook } from "@/content/docs/use";
import { infra } from "@/content/docs/infra";
import { security } from "@/content/docs/security";
import { build } from "@/content/docs/build";
import { moreBooks } from "@/content/docs/more";
import { outside } from "@/content/docs/outside";

type Page = { id: string; title: string; body: { h: string; p: string[] }[] };

const CORE: { id: string; label: string; lede: string; pages: Page[] }[] = [
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
              "You lock a print and pay a premium. If that name falls ten percent from the print, the cover pays the size back into cash. The token stays in the wallet. It is not a licensed insurance policy.",
              "On chain, the premium is a USDC transfer into a cover account whose key stays in this browser, with the terms in a memo. You sign it.",
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
              "A brokerage account. A bank wire. A Visa or Mastercard BIN. Apple Pay. An agent key. A shift after the tab closes. Limit orders. A login that carries this browser’s cash to another computer. A Senda program. There is no program id. Margin on a book this desk matches is not built. A Base perp uses Avantis margin, and the wallet signs their contract. The liquidation on that ticket is a preview.",
            ],
          },
        ],
      },
    ],
  },
];

const BOOKS = [...CORE, paper, pay, research, outside, useBook, infra, security, build, ...moreBooks];

export function DocsDesk() {
  const [bookId, setBookId] = useState(BOOKS[0].id);
  const book = BOOKS.find((b) => b.id === bookId) ?? BOOKS[0];
  const [pageId, setPageId] = useState(book.pages[0].id);
  const page = book.pages.find((p) => p.id === pageId) ?? book.pages[0];

  return (
    <main className="grid min-h-[calc(100dvh-88px)] lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="max-h-[40dvh] overflow-y-auto border-b border-white/10 bg-[#050508] lg:sticky lg:top-0 lg:max-h-[calc(100dvh-88px)] lg:border-r lg:border-b-0">
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] tracking-[0.16em] text-white/35 uppercase">Docs</p>
          <div className="mt-3"><DeskAudit live="These pages describe the rails." hold="A sentence here does not move USDC." /></div>
          <div className="mt-3 flex flex-col gap-2">
            <a href="/senda-submission.pdf" className="inline-flex min-h-9 items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-fg">
              Submission PDF
            </a>
            <a href="/senda-submission.md" className="inline-flex min-h-9 items-center rounded-full border border-white/15 px-4 text-[13px]">
              Submission note
            </a>
          </div>
        </div>
        <nav className="px-2 pb-6">
          {BOOKS.map((b) => (
            <div key={b.id} className="mt-4">
              <p className="px-3 text-[11px] tracking-[0.14em] text-white/35 uppercase">{b.label}</p>
              {b.pages.map((p) => {
                const on = b.id === book.id && p.id === page.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setBookId(b.id);
                      setPageId(p.id);
                    }}
                    className={cn(
                      "mt-0.5 block w-full rounded-xl px-3 py-2 text-left text-[13px]",
                      on ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {p.title}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <article className="min-w-0 px-6 py-8 lg:px-14 lg:py-12">
        <JumpStrip />
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">{book.label}</p>
        <h1 className="mt-2 max-w-3xl font-display text-4xl tracking-tight lg:text-5xl">{page.title}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/50">{book.lede}</p>
        <div className="mt-10 max-w-3xl space-y-10">
          {page.body.map((block) => (
            <section key={block.h}>
              <h2 className="text-xl font-medium tracking-tight">{block.h}</h2>
              {block.p.map((para) => (
                <p key={para.slice(0, 48)} className="mt-3 text-[15.5px] leading-[1.7] text-white/75">
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
