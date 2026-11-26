/** SendaPay integration boundary: read-only market/contingency services.
 * This adapter does not know SendaPay's user, payments, accounts or ledger schema.
 * A SendaPay backend may import it with a service URL and private credential.
 */
import {createSendaEventClient} from "../../services/event-intelligence/sdk/client.mjs";
export function createSendaPayContingencyBridge({serviceOrigin,serviceKey,fetchImpl}={}){
 const client=createSendaEventClient({baseUrl:serviceOrigin,apiKey:serviceKey,fetchImpl});
 return Object.freeze({
  assessExternalExpense:({ticker,side,contracts,possibleLossUsd,budgetUsd})=>
   client.scenario({ticker,side,contracts,possibleLossUsd,budgetUsd}),
  planIndependentCashReserve:({potentialExpenseUsd,availableCashUsd,targetCoveragePct})=>
   client.reserve({potentialExpenseUsd,availableCashUsd,targetCoveragePct}),
  findRelatedMarkets:({q,lane,limit})=>client.listMarkets({q,lane,limit}),
  marketEvidence:(ticker,window="7d")=>client.intelligence(ticker,window),
  getCapabilities:()=>client.capabilities(),
  executionAuthority:"NONE",
  transfersSupported:false,
  payoutVerification:"NOT_CONNECTED",
  ledgerAuthority:"NONE"
 });
}
