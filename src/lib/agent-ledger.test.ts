import assert from "node:assert/strict";
import test from "node:test";
import { HOUSE_TO_AGENT, AGENT_TO_DESK, accountPositions, ntryPair } from "./agent-ledger.ts";

test("a house-to-agent send is a debit and a credit with both identities", () => {
  const [debit, credit] = ntryPair(HOUSE_TO_AGENT);
  assert.equal(debit.CdtDbtInd, "DBIT");
  assert.equal(credit.CdtDbtInd, "CRDT");
  assert.equal(debit.Sts.Cd, "BOOK");
  assert.equal(debit.Acct.Nm, "House");
  assert.equal(credit.Acct.Nm, "Senda agent");
  assert.equal(debit.Acct.Id.Othr.Id, HOUSE_TO_AGENT.dbtr.AcctId);
  assert.equal(credit.NtryDtls.TxDtls.RltdPties.CdtrAcct.Id.Othr.Id, HOUSE_TO_AGENT.cdtr.AcctId);
  assert.equal(debit.NtryDtls.TxDtls.RltdPties.Dbtr.Nm, "House");
  assert.equal(debit.Amt.Ccy, "SOL");
  assert.equal(debit.Amt.value, "50000000");
});

test("book balances net the two booked payments", () => {
  const rows = [...ntryPair(HOUSE_TO_AGENT), ...ntryPair(AGENT_TO_DESK)];
  const book = accountPositions(rows);
  const house = book.find((row) => row.nm === "House");
  const agent = book.find((row) => row.nm === "Senda agent");
  const desk = book.find((row) => row.nm === "Senda desk");
  assert.equal(house?.sol, -0.05);
  assert.equal(agent?.sol, 0.04);
  assert.equal(desk?.sol, 0.01);
});
