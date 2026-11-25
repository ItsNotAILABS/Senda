/**
 * Event cash flows are NOT insurance, indemnification, coverage or a hedge.
 * Actual loss and event resolution are independent in the model.
 * Input quote must be a current public-book estimate from planEventSide.
 */
const validAmount=(x)=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=10_000_000;
const round=(x)=>Math.round(x*100)/100;
export const CONTINGENCY_USE_CASES=Object.freeze([
 {id:"weather",name:"Weather interruption",detail:"Explore severe weather and schedule risk",keywords:"rain storm weather",caution:"A weather market's resolution can differ from a property damage claim"},
 {id:"shipping",name:"Supply chain",detail:"Compare delays, shipment exposure and event outcomes",keywords:"freight port hurricane shipping",caution:"Shipping contracts do not reimburse delivery losses"},
 {id:"energy",name:"Energy expense",detail:"Model price changes alongside budget needs",keywords:"oil electricity natural gas",caution:"A commodity event may not move like your fuel or utility bill"},
 {id:"macro",name:"Macro spending",detail:"Stress-test economic event costs",keywords:"inflation fed rate",caution:"Inflation events are not a guarantee of purchasing-power protection"},
 {id:"tech",name:"Technology timing",detail:"Research launch and procurement milestones",keywords:"ai chip launch",caution:"Market settlement need not match a vendor or product deadline"}
]);
export function contingencyScenario({quote,possibleLossUsd,budgetUsd,marketTicker,asOf,now=Date.now()}={}){
 const fail=reason=>({ready:false,reason,execution:"disabled",insurance:false});
 if(!quote?.available||quote.notExecutable!==true||!Number.isFinite(quote.quotedAt))
  return fail("A live sourced public-book estimate is required.");
 if(!Number.isFinite(now)||quote.quotedAt>now||now-quote.quotedAt>30_000)
  return fail("Market research depth expired. Refresh for an updated estimate.");
 if(!validAmount(possibleLossUsd)||!validAmount(budgetUsd)||budgetUsd<=0)
  return fail("Enter a valid possible expense and a positive research budget.");
 if(!Number.isInteger(quote.contracts)||quote.contracts<1||quote.contracts>1000||
  typeof quote.grossCostUsd!=="number"||!Number.isFinite(quote.grossCostUsd)||quote.grossCostUsd<=0||
  typeof quote.maximumPayoutUsd!=="number"||quote.maximumPayoutUsd!==quote.contracts)
  return fail("The public-book estimate is malformed.");
 if(quote.grossCostUsd>budgetUsd)
  return fail("The estimated gross contract cost exceeds the scenario budget, before fees.");
 if(typeof marketTicker!=="string"||!/^([A-Z0-9][A-Z0-9._-]{2,119})$/.test(marketTicker))
  return fail("A valid market ticker is required.");
 const cost=round(quote.grossCostUsd),payout=round(quote.maximumPayoutUsd),loss=round(possibleLossUsd);
 const side=quote.side==="no"?"no":"yes";
 const opposite=side==="yes"?"no":"yes";
 const win=round(payout-cost),lose=round(-cost);
 const rows=[
  {id:"win-loss",marketResolves:side,realWorldLoss:true,contractNetBeforeFees:win,overallNetBeforeFees:round(win-loss)},
  {id:"win-no-loss",marketResolves:side,realWorldLoss:false,contractNetBeforeFees:win,overallNetBeforeFees:win},
  {id:"lose-loss",marketResolves:opposite,realWorldLoss:true,contractNetBeforeFees:lose,overallNetBeforeFees:round(lose-loss)},
  {id:"lose-no-loss",marketResolves:opposite,realWorldLoss:false,contractNetBeforeFees:lose,overallNetBeforeFees:lose}
 ];
 return {ready:true,source:"Kalshi public opposing bids",marketTicker,observedAt:asOf||new Date(quote.quotedAt).toISOString(),
  execution:"disabled",insurance:false,quoteExecutable:false,feesKnown:false,probabilityEstimate:null,
  chosenSide:side,contractCount:quote.contracts,grossCostBeforeFees:cost,maximumEventPayoutBeforeFees:payout,
  possibleIndependentRealWorldLoss:loss,researchBudget:round(budgetUsd),
  events:rows,
  risks:[
   "Not an insurance policy or contractual indemnity. No claims processing, coverage, protection promise or licensed underwriter.",
   "Event settlement and your real-world expense can move independently; a winning event contract is not proof your loss occurred.",
   "Gross public-book estimates exclude venue fees, trading access, timing and liquidity changes. No wallet execution is connected here.",
   "If the event loses, contracts may settle to zero. The full contract purchase price can be lost."
  ],
  advisory:"Research only. Confirm contract rules, venue permissions, liquidity, quote, settlement terms and legal eligibility before trading."
 };
}

/** An independent cash reserve planning tool: no betting, borrowing or insurance. */
export function contingencyReservePlan({potentialExpenseUsd,availableCashUsd=0,targetCoveragePct=100}={}){
 if(!validAmount(potentialExpenseUsd)||!validAmount(availableCashUsd)||typeof targetCoveragePct!=="number"||
  !Number.isFinite(targetCoveragePct)||targetCoveragePct<0||targetCoveragePct>100)
  return {ready:false,reason:"Enter non-negative cash amounts and a target between 0 and 100 percent."};
 const target=round(potentialExpenseUsd*targetCoveragePct/100),available=round(availableCashUsd);
 return {ready:true,potentialExpenseUsd:round(potentialExpenseUsd),targetCoveragePct,
  targetCashReserveUsd:target,availableCashUsd:available,
  additionalCashRequiredUsd:round(Math.max(0,target-available)),
  excessCashAgainstTargetUsd:round(Math.max(0,available-target)),
  source:"User-supplied planning assumptions",execution:"disabled",insurance:false,
  note:"A cash buffer is independent of an event contract. This calculation does not recommend investing cash or purchasing a contract."};
}
