import type { ProductPage } from "@/components/product-shell";

export const TRADE_PAGES: ProductPage[] = [
  { href: "/invest", label: "Quotes", hint: "A name, a last price, and a ticket" },
  { href: "/invest/world", label: "FX & metals", hint: "Metals, FX, indexes" },
  { href: "/invest/world?lane=energy", label: "Commodities", hint: "Energy and softs" },
  { href: "/invest/options", label: "Options", hint: "Calls and puts on a print" },
  { href: "/invest/perps", label: "Perps", hint: "Jupiter SOL, ETH, BTC. You sign." },
  { href: "/pre", label: "PreStocks", hint: "The names, in your wallet" },
  { href: "/wallet", label: "Bridge", hint: "Move SOL and USDC" },
  { href: "/invest/positions", label: "Positions", hint: "What this wallet holds" },
  { href: "/invest/borrow", label: "Borrow", hint: "Sell a slice. No pool." },
  { href: "/invest/basket", label: "Index", hint: "Live weights, then you sign" },
  { href: "/invest/protect", label: "Protect", hint: "Last against the mark" },
  { href: "/invest/launch", label: "Launch", hint: "Jupiter. No Senda program." },
  { href: "/invest/curve", label: "Curve", hint: "A bonding curve" },
  { href: "/invest/radar", label: "Radar", hint: "Names off their mark" },
  { href: "/invest/rails", label: "Rails", hint: "Jupiter, Meteora, Raydium" },
  { href: "/invest/routes", label: "Routes", hint: "A Jupiter quote" },
  { href: "/equities", label: "xStocks", hint: "Quote-checked listed tokens" },
  { href: "/solana", label: "Spot", hint: "Jupiter coins" },
];

export const PRE_PAGES: ProductPage[] = [
  { href: "/pre", label: "Book", hint: "The names, priced" },
  { href: "/pre/ticket", label: "Buy", hint: "One name, one signature" },
  { href: "/pre/cover", label: "Cover", hint: "A 10% drop on this name" },
  { href: "/pre/spend", label: "Spend", hint: "A number, not the token" },
  { href: "/pre/stand", label: "Stand", hint: "Where this print sits" },
  { href: "/pre/basket", label: "Three", hint: "One size, three names" },
  { href: "/pre/hold", label: "You hold", hint: "What this wallet already has" },
];

export const PLAY_PAGES: ProductPage[] = [
  { href: "/social", label: "Lobby", hint: "Pick a game" },
  { href: "/social/wheel", label: "Wheel", hint: "The print stops it" },
  { href: "/social/slots", label: "Slots", hint: "Three faces from the book" },
  { href: "/social/updown", label: "Up / Down", hint: "Call the next move" },
  { href: "/social/race", label: "Furthest", hint: "Off the mark" },
  { href: "/social/closest", label: "Closest", hint: "Tight to the mark" },
  { href: "/social/crash", label: "Ride", hint: "Get off before the print" },
  { href: "/social/hilo", label: "Higher", hint: "The next name" },
  { href: "/social/parlay", label: "Parlay", hint: "Two names, one stake" },
  { href: "/social/dice", label: "Dice", hint: "Over, under, or seven" },
  { href: "/social/mines", label: "Mines", hint: "Three safe tiles" },
];

export const SEND_PAGES: ProductPage[] = [
  { href: "/payments", label: "Send", hint: "To a person" },
  { href: "/payments/usdc", label: "USDC", hint: "To a Solana address" },
  { href: "/payments/gift", label: "Gift", hint: "A link. The vault pays the fee." },
  { href: "/payments/accept", label: "Accept", hint: "Pay a solana: link" },
  { href: "/payments/request", label: "Request", hint: "Ask them for it" },
  { href: "/payments/nearby", label: "Nearby", hint: "The phone beside you" },
  { href: "/payments/exchange", label: "Exchange", hint: "One pocket to another" },
  { href: "/payments/add", label: "Add", hint: "Cash into a pocket" },
  { href: "/payments/space", label: "Space", hint: "A room for two wallets" },
  { href: "/payments/pockets", label: "Pockets", hint: "What each currency holds" },
  { href: "/payments/activity", label: "Activity", hint: "What already moved" },
];

export const SHOP_PAGES: ProductPage[] = [
  { href: "/cards", label: "Account", hint: "Where USDC can land" },
  { href: "/cards/pay", label: "Pay", hint: "A store, one charge" },
  { href: "/cards/chain", label: "On chain", hint: "USDC the merchant can take" },
  { href: "/cards/number", label: "Number", hint: "Issued once, capped" },
  { href: "/cards/expenses", label: "Expenses", hint: "What the number already did" },
  { href: "/cards/rails", label: "Rails", hint: "Who can actually clear a swipe" },
];

export const COVER_PAGES: ProductPage[] = [
  { href: "/cover", label: "Drop", hint: "Sell what you hold" },
  { href: "/cover/life", label: "Life", hint: "Phone, travel, rent, a haul" },
  { href: "/cover/open", label: "Open", hint: "Covers you already signed" },
];

export const WORK_PAGES: ProductPage[] = [
  { href: "/work/interface", label: "Interface Studio", hint: "Review screens, designs, QA gates" },
  { href: "/work", label: "Jobs", hint: "Pay someone in USDC" },
  { href: "/work/sheet", label: "Sheet", hint: "A note on every name" },
  { href: "/work/page", label: "Page", hint: "One name, written out" },
];

export const LISTED_PAGES: ProductPage[] = [
  { href: "/equities", label: "Market", hint: "Quote-checked xStocks" },
  { href: "/equities/borrow", label: "Borrow", hint: "What Kamino will lend" },
];

export const PORTFOLIO_PAGES: ProductPage[] = [
  { href: "/vault", label: "Holdings", hint: "Tokens times the last print" },
  { href: "/vault/sleeve", label: "Cash sleeve", hint: "Wrap USDC, send it back" },
];

export const CONVERT_PAGES: ProductPage[] = [
  { href: "/wallet", label: "Convert", hint: "SOL or USDC into a name" },
  { href: "/wallet/sell", label: "Sell back", hint: "A slice into USDC" },
];

export const WALLET_PAGES: ProductPage[] = [
  { href: "/wallets", label: "Connect", hint: "Phone opens Phantom or Solflare" },
  { href: "/wallets/power", label: "Buying power", hint: "Robinhood into USDC" },
];

export const SOLANA_PAGES: ProductPage[] = [
  { href: "/solana", label: "Markets", hint: "Jupiter coins and the names" },
  { href: "/solana/pre8", label: "PRE8", hint: "The book as one number" },
  { href: "/solana/signer", label: "Signer", hint: "Which wallet buys" },
];

export const MAKE_PAGES: ProductPage[] = [
  { href: "/make", label: "Board", hint: "What people will pay for" },
  { href: "/make/post", label: "Post", hint: "Put a listing up" },
];

export const BOOK_PAGES: ProductPage[] = [
  { href: "/books", label: "Journal", hint: "Lines this account wrote" },
  { href: "/books/tokens", label: "Tokens", hint: "The books, by instrument" },
];

export const DOCS_PAGES: ProductPage[] = [
  { href: "/docs", label: "Start", hint: "What this desk is" },
  { href: "/docs/wallets", label: "Wallets", hint: "Who signs" },
  { href: "/docs/prestocks", label: "PreStocks", hint: "The names" },
  { href: "/docs/pay", label: "Pay", hint: "USDC" },
  { href: "/docs/cards", label: "Cards", hint: "The number" },
  { href: "/docs/play", label: "Play", hint: "The felt" },
  { href: "/docs/cover", label: "Cover", hint: "The 10% line" },
  { href: "/docs/agents", label: "Agents", hint: "They cannot sign" },
  { href: "/docs/make", label: "Make", hint: "The board" },
  { href: "/docs/limits", label: "Limits", hint: "What is not built" },
];

export const AGENT_PAGES: ProductPage[] = [
  { href: "/agents", label: "Studio", hint: "Agents on this browser" },
  { href: "/agents/genesis", label: "Genesis", hint: "Verified characters and market runtimes" },
  { href: "/agents/build", label: "Build", hint: "Make one" },
];
