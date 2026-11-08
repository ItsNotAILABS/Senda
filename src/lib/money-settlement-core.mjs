/**
 * Senda money settlement state machine.
 * This is a server-side provider integration contract, never permission to debit a card.
 * It intentionally cannot generate a settled status from a UI click or quote.
 */
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/;
const CURRENCIES=new Set(["USD","USDC","MXN","EUR","GBP"]);
const STEPS={
 created:new Set(["funding-pending","cancelled"]),
 "funding-pending":new Set(["authorized","failed","cancelled"]),
 authorized:new Set(["settled","failed","reversed"]),
 settled:new Set(["conversion-pending","payout-pending","reversed"]),
 "conversion-pending":new Set(["converted","failed"]),
 converted:new Set(["payout-pending","reversed"]),
 "payout-pending":new Set(["delivered","failed","reversed"]),
 delivered:new Set(["reversed"]),
 failed:new Set([]),cancelled:new Set([]),reversed:new Set([])
};
const FINAL=new Set(["delivered","failed","cancelled","reversed"]);
export function createMoneyIntent({id,source,recipient,amountCents,sourceCurrency="USD",destinationCurrency="USD",createdAt=Date.now()}){
 if(!ID.test(id)||!ID.test(source)||!ID.test(recipient)||!CURRENCIES.has(sourceCurrency)||!CURRENCIES.has(destinationCurrency)||
 !Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>10000000||!Number.isSafeInteger(createdAt)||createdAt<=0)
 throw Error("Invalid authenticated money transfer intent");
 return {id,source,recipient,amountCents,sourceCurrency,destinationCurrency,status:"created",history:[],evidence:[],createdAt,version:0};
}
export function recordProviderTransition(intent,event,attested=false){
 if(!intent||!STEPS[intent.status]||!event||!ID.test(event.id)||!Number.isSafeInteger(event.occurredAt))
  throw Error("Invalid settlement event");
 if(!attested)throw Error("Only independently verified provider webhooks may advance monetary state");
 if(event.transferId!==intent.id)throw Error("Provider receipt and money intent mismatch");
 if(intent.evidence.some(e=>e.id===event.id))return intent; // idempotent exact receipt only
 if(!STEPS[intent.status].has(event.next))throw Error("Illegal money-state transition: "+intent.status+" → "+String(event.next));
 if(event.occurredAt<intent.createdAt||event.occurredAt>Date.now()+300000)throw Error("Invalid provider receipt timestamp");
 if(["settled","converted","delivered"].includes(event.next)&&
  (!ID.test(String(event.provider||""))||!ID.test(String(event.reference||""))))
  throw Error("Cleared money movements need real provider identity and transfer reference");
 if(event.next==="delivered"&&intent.status!=="payout-pending")throw Error("Cannot deliver without payout confirmation");
 const evidence={id:event.id,provider:String(event.provider||""),reference:String(event.reference||""),next:event.next,occurredAt:event.occurredAt};
 return {...intent,status:event.next,version:intent.version+1,evidence:[...intent.evidence,evidence],history:[...intent.history,{from:intent.status,to:event.next,at:event.occurredAt}],final:FINAL.has(event.next)};
}
export function canDisplayDelivered(intent){
 return Boolean(intent&&intent.status==="delivered"&&intent.evidence.some(e=>e.next==="delivered"&&ID.test(e.reference)&&ID.test(e.provider)));
}
export function publicMoneyState(intent){
 const delivered=canDisplayDelivered(intent);
 return {state:intent?.status||"unknown",delivered,notification:delivered?"Payment delivered by verified provider.":intent?.status==="failed"?"Payment failed; check provider receipt.":"Not delivered. Await verified funding and settlement evidence."};
}
