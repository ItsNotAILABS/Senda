/** ISO 20022 MX for Senda cash. Same semantics banks use, mapped onto crypto accounts. */

export const BIC = "SENDAUS4F";
export const LEI = "SENDA0FORTWORTHTX01";
export const SCHEME = "SENDA";

export type Pain001 = {
  MsgDefIdr: "pain.001.001.09";
  GrpHdr: {
    MsgId: string;
    CreDtTm: string;
    NbOfTxs: "1";
    CtrlSum: string;
    InitgPty: { Nm: string; Id: { OrgId?: { AnyBIC: string } } };
  };
  PmtInf: {
    PmtInfId: string;
    PmtMtd: "TRF";
    ReqExctnDt: string;
    Dbtr: { Nm: string };
    DbtrAcct: AccountId;
    DbtrAgt: { FinInstnId: { BICFI: string } };
    CdtTrfTxInf: {
      PmtId: { EndToEndId: string; UETR: string };
      Amt: { InstdAmt: { Ccy: string; Value: string } };
      CdtrAgt: { FinInstnId: { BICFI: string } };
      Cdtr: { Nm: string };
      CdtrAcct: AccountId;
      RmtInf?: { Ustrd: string };
      Purp?: { Prtry: string };
    };
  };
};

export type Pacs008 = {
  MsgDefIdr: "pacs.008.001.08";
  GrpHdr: { MsgId: string; CreDtTm: string; NbOfTxs: "1"; SttlmInf: { SttlmMtd: "CLRG" } };
  CdtTrfTxInf: Pain001["PmtInf"]["CdtTrfTxInf"] & { ChrgBr: "SLEV" };
};

export type Pain002 = {
  MsgDefIdr: "pain.002.001.10";
  OrgnlMsgId: string;
  TxSts: "ACCP" | "ACSC" | "RJCT" | "PDNG";
  StsRsn?: string;
};

export type Camt053 = {
  MsgDefIdr: "camt.053.001.08";
  Stmt: { Id: string; CreDtTm: string; Acct: AccountId; Ntry: CamtEntry[] };
};

export type CamtEntry = {
  Amt: { Ccy: string; Value: string };
  CdtDbtInd: "CRDT" | "DBIT";
  Sts: "BOOK";
  BookgDt: string;
  AcctSvcrRef: string;
  NtryDtls: { UETR?: string; EndToEndId?: string; AddtlTxInf: string };
};

export type AccountId = {
  Id:
    | { IBAN: string }
    | { Othr: { Id: string; SchmeNm: { Prtry: string } } };
  Ccy?: string;
};

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function uetr(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** ISO 7064 mod-97 check digits for a virtual BBAN. Not a licensed IBAN country. */
export function sendaIban(tag: string, ccy: string): string {
  const bban = `SENDA${ccy}${(tag.replace(/\W/g, "").toUpperCase() + "YOU").slice(0, 12).padEnd(12, "0")}`;
  const rearranged = `${bban}SD00`;
  let exp = "";
  for (const ch of rearranged) {
    const c = ch.charCodeAt(0);
    exp += c >= 65 ? String(c - 55) : ch;
  }
  let rem = 0;
  for (const d of exp) rem = (rem * 10 + Number(d)) % 97;
  const check = String(98 - rem).padStart(2, "0");
  return `SD${check}${bban}`;
}

export function sendaAcct(tag: string, ccy: string, pubkey?: string | null): AccountId {
  if (ccy === "EUR" || ccy === "GBP") return { Id: { IBAN: sendaIban(tag, ccy) }, Ccy: ccy };
  const id = pubkey || `${SCHEME}:${tag}:${ccy}`;
  return { Id: { Othr: { Id: id, SchmeNm: { Prtry: SCHEME } } }, Ccy: ccy };
}

export function pain001(input: {
  fromTag: string;
  fromName?: string;
  toTag: string;
  toName: string;
  amount: number;
  ccy: string;
  note?: string;
  pubkey?: string | null;
  purpose?: string;
}): Pain001 {
  const id = `SND${Date.now().toString(36).toUpperCase()}`;
  const amt = input.amount.toFixed(2);
  return {
    MsgDefIdr: "pain.001.001.09",
    GrpHdr: {
      MsgId: id,
      CreDtTm: isoNow(),
      NbOfTxs: "1",
      CtrlSum: amt,
      InitgPty: { Nm: input.fromName || input.fromTag, Id: { OrgId: { AnyBIC: BIC } } },
    },
    PmtInf: {
      PmtInfId: `${id}-1`,
      PmtMtd: "TRF",
      ReqExctnDt: isoDate(),
      Dbtr: { Nm: input.fromName || input.fromTag },
      DbtrAcct: sendaAcct(input.fromTag, input.ccy, input.pubkey),
      DbtrAgt: { FinInstnId: { BICFI: BIC } },
      CdtTrfTxInf: {
        PmtId: { EndToEndId: id, UETR: uetr() },
        Amt: { InstdAmt: { Ccy: input.ccy, Value: amt } },
        CdtrAgt: { FinInstnId: { BICFI: BIC } },
        Cdtr: { Nm: input.toName },
        CdtrAcct: sendaAcct(input.toTag, input.ccy),
        RmtInf: input.note ? { Ustrd: input.note.slice(0, 140) } : undefined,
        Purp: { Prtry: input.purpose || "Senda credit transfer" },
      },
    },
  };
}

export function pacs008From(p: Pain001): Pacs008 {
  return {
    MsgDefIdr: "pacs.008.001.08",
    GrpHdr: {
      MsgId: `PACS${p.GrpHdr.MsgId}`,
      CreDtTm: isoNow(),
      NbOfTxs: "1",
      SttlmInf: { SttlmMtd: "CLRG" },
    },
    CdtTrfTxInf: { ...p.PmtInf.CdtTrfTxInf, ChrgBr: "SLEV" },
  };
}

export function pain002(msgId: string, ok: boolean, reason?: string): Pain002 {
  return {
    MsgDefIdr: "pain.002.001.10",
    OrgnlMsgId: msgId,
    TxSts: ok ? "ACSC" : "RJCT",
    StsRsn: reason,
  };
}

export function uetrOf(p: Pain001): string {
  return p.PmtInf.CdtTrfTxInf.PmtId.UETR;
}

export function endToEndOf(p: Pain001): string {
  return p.PmtInf.CdtTrfTxInf.PmtId.EndToEndId;
}
