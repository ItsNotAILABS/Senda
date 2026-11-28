/** Programs and markets this desk already calls. Nothing here was deployed by Senda. */

import { AAVE } from "@/lib/aave-lend";
import { MESSENGER, TRANSMITTER } from "@/lib/cctp";
import { XSTOCKS_MARKET } from "@/lib/equities";
import { USDC } from "@/lib/jup-exec";
import { KAMINO_MAIN } from "@/lib/kamino-lend";

export type ProgramKind = "Program" | "Market" | "Mint" | "Pool" | "API";

export type ProgramRow = {
  id: string;
  name: string;
  chain: string;
  kind: ProgramKind;
  address: string;
  does: string;
  href: string;
};

const SOLANA = "Solana";

export const PROGRAM_BOOK: ProgramRow[] = [
  {
    id: "system",
    name: "System program",
    chain: SOLANA,
    kind: "Program",
    address: "11111111111111111111111111111111",
    does: "Creates the accounts a hold or a send needs. The wallet signs. Senda does not own this program.",
    href: "/payments",
  },
  {
    id: "token",
    name: "SPL Token",
    chain: SOLANA,
    kind: "Program",
    address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    does: "Moves USDC and other SPL tokens. A payment, a gift, and a cover premium all go through it.",
    href: "/payments",
  },
  {
    id: "token22",
    name: "Token-2022",
    chain: SOLANA,
    kind: "Program",
    address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    does: "The newer token program. A share lock can read it. This desk does not mint a Token-2022 of its own.",
    href: "/vault",
  },
  {
    id: "ata",
    name: "Associated token account",
    chain: SOLANA,
    kind: "Program",
    address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    does: "Finds or opens the token account a payment lands in.",
    href: "/payments",
  },
  {
    id: "memo",
    name: "Memo",
    chain: SOLANA,
    kind: "Program",
    address: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    does: "Writes the short note onto a USDC send. The note is not a contract by itself.",
    href: "/payments",
  },
  {
    id: "usdc",
    name: "USDC",
    chain: SOLANA,
    kind: "Mint",
    address: USDC,
    does: "Circle’s dollar on Solana. Payments on this desk are this mint.",
    href: "/payments/usdc",
  },
  {
    id: "kamino",
    name: "Kamino main market",
    chain: SOLANA,
    kind: "Market",
    address: KAMINO_MAIN,
    does: "Lending market. A deposit or a borrow is their instruction. Phantom signs it.",
    href: "/vault/loans",
  },
  {
    id: "xstocks-market",
    name: "Kamino xStocks market",
    chain: SOLANA,
    kind: "Market",
    address: XSTOCKS_MARKET,
    does: "The market those listed tokens borrow against. This desk reads it. It does not invent a stock.",
    href: "/equities/borrow",
  },
  {
    id: "sol-usdc",
    name: "Meteora SOL/USDC",
    chain: SOLANA,
    kind: "Pool",
    address: "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",
    does: "A liquidity position. Both sides have to be in this wallet. Phantom signs the add.",
    href: "/invest?desk=prog",
  },
  {
    id: "jito-sol",
    name: "Meteora JitoSOL/SOL",
    chain: SOLANA,
    kind: "Pool",
    address: "BoeMUkCLHchTD31HdXsbDExuZZfcUppSLpYtV3LZTH6U",
    does: "Same Meteora path. JitoSOL is bought with a Jupiter swap first. This pool does not stake for you.",
    href: "/invest?desk=prog",
  },
  {
    id: "jitosol",
    name: "JitoSOL",
    chain: SOLANA,
    kind: "Mint",
    address: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    does: "Liquid stake. This desk swaps SOL for the token. It does not call Jito’s stake pool as its own program.",
    href: "/invest?desk=prog",
  },
  {
    id: "inf",
    name: "Sanctum INF",
    chain: SOLANA,
    kind: "Mint",
    address: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
    does: "Jupiter swaps SOL for INF. INF stays in the wallet. This desk cannot unstake it.",
    href: "/invest?desk=prog",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    chain: SOLANA,
    kind: "API",
    address: "",
    does: "Quotes and swaps. The route is Jupiter’s. This desk does not pin their program id, so none is shown.",
    href: "/invest/routes",
  },
  {
    id: "jup-perps",
    name: "Jupiter perps",
    chain: SOLANA,
    kind: "API",
    address: "",
    does: "SOL, ETH, and BTC perps. Their API builds the transaction. The wallet signs. At least $10.",
    href: "/invest/perps",
  },
  {
    id: "dflow",
    name: "DFlow",
    chain: SOLANA,
    kind: "API",
    address: "",
    does: "A second quote next to Jupiter. You sign it only when it pays more. It is not a second market Senda runs.",
    href: "/invest/routes",
  },
  {
    id: "marginfi",
    name: "Marginfi",
    chain: SOLANA,
    kind: "API",
    address: "",
    does: "Rates only, from their public banks feed. There is no deposit button.",
    href: "/vault/loans",
  },
  {
    id: "messenger",
    name: "Circle TokenMessenger",
    chain: "CCTP",
    kind: "Program",
    address: MESSENGER,
    does: "Burns USDC on one chain so another chain can mint it. Phantom signs. Arbitrum is an export, not a mint button.",
    href: "/wallet",
  },
  {
    id: "transmitter",
    name: "Circle MessageTransmitter",
    chain: "CCTP",
    kind: "Program",
    address: TRANSMITTER,
    does: "The message a CCTP mint waits on. This desk does not invent an attestation.",
    href: "/wallet",
  },
  ...AAVE.map((net) => ({
    id: `aave-${net.id}`,
    name: `Aave pool · ${net.name}`,
    chain: net.name,
    kind: "Market" as const,
    address: net.pool,
    does: "Supply or borrow USDC. The wallet signs on that chain. Senda does not hold the tokens.",
    href: "/vault/loans",
  })),
  ...AAVE.map((net) => ({
    id: `usdc-${net.id}`,
    name: `USDC · ${net.name}`,
    chain: net.name,
    kind: "Mint" as const,
    address: net.usdc,
    does: "Circle’s dollar on that chain. An EVM payment is a transfer of this token.",
    href: "/contracts",
  })),
];
