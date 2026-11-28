import { explainPayment } from "./payment-error.ts";

const KEY = "senda.agent-ledger.v1";

export type Acct = { Id: { Othr: { Id: string; SchmeNm: { Prtry: "SOLA" | "COFF" } } } };

export type Party = { Nm: string; Acct: Acct; Id: { OrgId: { Othr: { Id: string; SchmeNm: { Prtry: "COFF" } } } } };

export type Ntry = {
  NtryRef: string;
  AcctSvcrRef: string;
  EndToEndId: string;
  TxId: string;
  BookgDt: { Dt: string };
  ValDt: { Dt: string };
  Amt: { value: string; Ccy: "SOL" | "USDC" };
  CdtDbtInd: "DBIT" | "CRDT";
  Sts: { Cd: "BOOK" | "PDNG" };
  Acct: { Nm: string; Ccy: "SOL" | "USDC"; Id: Acct["Id"] };
  NtryDtls: {
    TxDtls: {
      Refs: { EndToEndId: string; TxId: string };
      RltdPties: { Dbtr: { Nm: string }; Cdtr: { Nm: string }; DbtrAcct: Acct; CdtrAcct: Acct };
      Purp: { Prtry: "AGNT" | "SECU" };
      RmtInf: { Ustrd: string };
    };
  };
};

export type Movement = {
  signature: string;
  amountRaw: string;
  ccy: "SOL" | "USDC";
  kind: "send" | "swap";
  bookgDt: string;
  dbtr: { Nm: string; AcctId: string; walletId: string };
  cdtr: { Nm: string; AcctId: string; walletId: string };
  purp: "AGNT" | "SECU";
  ustrd: string;
  sts: "BOOK" | "PDNG";
};

function acct(id: string): Acct {
  return { Id: { Othr: { Id: id, SchmeNm: { Prtry: "SOLA" } } } };
}

function party(name: string, address: string, walletId: string): Party {
  return {
    Nm: name,
    Acct: acct(address),
    Id: { OrgId: { Othr: { Id: walletId || name, SchmeNm: { Prtry: "COFF" } } } },
  };
}

export function ntryPair(row: Movement): [Ntry, Ntry] {
  const day = row.bookgDt;
  const dbtr = party(row.dbtr.Nm, row.dbtr.AcctId, row.dbtr.walletId);
  const cdtr = party(row.cdtr.Nm, row.cdtr.AcctId, row.cdtr.walletId);
  const base = {
    NtryRef: row.signature,
    AcctSvcrRef: row.signature,
    EndToEndId: row.signature.slice(0, 35),
    TxId: row.signature.slice(0, 35),
    BookgDt: { Dt: day },
    ValDt: { Dt: day },
    Amt: { value: row.amountRaw, Ccy: row.ccy },
    Sts: { Cd: row.sts },
    NtryDtls: {
      TxDtls: {
        Refs: { EndToEndId: row.signature.slice(0, 35), TxId: row.signature.slice(0, 35) },
        RltdPties: { Dbtr: { Nm: dbtr.Nm }, Cdtr: { Nm: cdtr.Nm }, DbtrAcct: dbtr.Acct, CdtrAcct: cdtr.Acct },
        Purp: { Prtry: row.purp },
        RmtInf: { Ustrd: row.ustrd },
      },
    },
  };
  const debit: Ntry = { ...base, CdtDbtInd: "DBIT", Acct: { Nm: dbtr.Nm, Ccy: row.ccy, Id: dbtr.Acct.Id } };
  const credit: Ntry = { ...base, CdtDbtInd: "CRDT", Acct: { Nm: cdtr.Nm, Ccy: row.ccy, Id: cdtr.Acct.Id } };
  return [debit, credit];
}

function read(): Ntry[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Ntry[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function listNtry(): Ntry[] {
  return read();
}

export type BookPos = { nm: string; acct: string; sol: number; usdc: number };

export function accountPositions(rows: Ntry[]): BookPos[] {
  const by = new Map<string, BookPos>();
  for (const row of rows) {
    const acct = row.Acct.Id.Othr.Id;
    const have = by.get(acct) ?? { nm: row.Acct.Nm, acct, sol: 0, usdc: 0 };
    have.nm = row.Acct.Nm || have.nm;
    const units = Number(row.Amt.value);
    const signed = row.CdtDbtInd === "CRDT" ? units : -units;
    if (row.Amt.Ccy === "SOL") have.sol += signed / 1_000_000_000;
    else have.usdc += signed / 1_000_000;
    by.set(acct, have);
  }
  return [...by.values()];
}

export const HOUSE_TO_AGENT: Movement = {
  signature: "3QqAtFdJGft6XkQKrvj14Y6p4QxCcUKNRXAUA3JFkvWaAxbj9QvHy13FzEajAn55mJXeyRipUYZqCtzFjLJrMyRa",
  amountRaw: "50000000",
  ccy: "SOL",
  kind: "send",
  bookgDt: "2026-11-28",
  dbtr: { Nm: "House", AcctId: "FMn74h5jZMPXoKYYWSTxHiD5j6PeAVsAc6ftkxg6apvA", walletId: "wal_b0791dd8c1d32753c9" },
  cdtr: { Nm: "Senda agent", AcctId: "5MCbNsLHuGR1aghnEwWNLDnbRMVvQg1ThekF6mDNKtXs", walletId: "wal_3867d2bff3f7887d87" },
  purp: "AGNT",
  ustrd: "Agent-to-agent funding. Devnet CLI. Treasury draw closed.",
  sts: "BOOK",
};

export async function bookMovement(row: Movement, now = Date.now()): Promise<Ntry[]> {
  const pair = ntryPair(row);
  const have = read();
  const next = have.some((item) => item.NtryRef === row.signature)
    ? have
    : [...pair, ...have].slice(0, 80);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("senda-ntry"));
  if (row.sts === "BOOK") {
    try {
      const { observeTransaction, recordSubmission } = await import("@/lib/tx-journal.mjs");
      recordSubmission(window.localStorage, {
        signature: row.signature,
        owner: row.dbtr.AcctId,
        kind: row.kind,
        asset: row.ccy,
        destination: row.cdtr.AcctId,
        amountRaw: row.amountRaw,
      }, now);
      observeTransaction(window.localStorage, row.dbtr.AcctId, row.signature, { err: null, confirmationStatus: "confirmed" }, now);
    } catch {
      /* the agent ledger still holds the entry if the main journal rejected a duplicate */
    }
  }
  return next;
}

export const AGENT_TO_DESK: Movement = {
  signature: "vXYDgNjpexjQRGE6sdEm2YqXwHwKic5qbc445LnAbjpEb8raLataKcmxvUz7zPf5ZUAmWybnt6AS4RUMEezHQ76",
  amountRaw: "10000000",
  ccy: "SOL",
  kind: "send",
  bookgDt: "2026-11-28",
  dbtr: { Nm: "Senda agent", AcctId: "5MCbNsLHuGR1aghnEwWNLDnbRMVvQg1ThekF6mDNKtXs", walletId: "wal_3867d2bff3f7887d87" },
  cdtr: { Nm: "Senda desk", AcctId: "H2yvX2Arf5n5mBDz8Yk5h8aVf5xrPHgY67H286q1dTK9", walletId: "wal_ad28f111a3ca5f6722" },
  purp: "AGNT",
  ustrd: "Agent to agent. The agent wallet spent. Phantom did not.",
  sts: "BOOK",
};

export async function bookOrWarn(row: Movement, now = Date.now()): Promise<string | null> {
  try {
    await bookMovement(row, now);
    return null;
  } catch (error) {
    return explainPayment(error);
  }
}

export async function seedBooked(): Promise<Ntry[]> {
  await bookMovement(HOUSE_TO_AGENT, Date.parse("2026-11-28T00:40:00Z"));
  return bookMovement(AGENT_TO_DESK, Date.parse("2026-11-28T00:55:00Z"));
}
