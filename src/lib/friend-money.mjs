/**
 * SENDA Consumer Payments: dollar-denominated intent, real settlement boundaries.
 * Users don't need to see crypto vocabulary. However wallet destination verification is
 * mandatory and a fiat/card/ACH disbursement must never be represented as a completed send.
 */
const SOLANA=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HANDLE=/^@[a-zA-Z0-9_.-]{2,31}$/;
const CENTS=/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/;
export function usdToCents(input){
 const value=String(input).trim();
 if(!CENTS.test(value))throw Error("Enter dollars and cents, up to $999,999.99.");
 const [whole,decimal=""]=value.split(".");
 const cents=Number(whole)*100+Number(decimal.padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents<1)throw Error("Enter an amount of at least $0.01.");
 return cents;
}
export function normalizeFriend(input){
 const name=String(input?.name||"").trim(),address=String(input?.address||"").trim();
 if(!name||name.length>64||!/^[\p{L}\p{N} .,'-]+$/u.test(name))throw Error("Enter a friend's name (1–64 characters).");
 if(!SOLANA.test(address))throw Error("A confirmed recipient wallet address is required.");
 const tag=String(input?.tag||"").trim();
 if(tag&&!HANDLE.test(tag))throw Error("A Senda handle must start with @ and contain 2–31 characters.");
 return {name,address,tag,source:"user-supplied-wallet",verified:false};
}
export function planFriendPayment({friend,amount,owner,capUsd,method="wallet",payout="wallet"}){
 const cents=usdToCents(amount);
 const max=usdToCents(String(capUsd));
 if(cents>max)return {ready:false,kind:"over-limit",message:"Amount exceeds your current per-transfer limit."};
 if(!["wallet","debit-card","bank"].includes(method)||!["wallet","bank","debit-card"].includes(payout))
  return {ready:false,kind:"unsupported",message:"Unsupported funding or delivery method."};
 if(method!=="wallet"||payout!=="wallet")
  return {ready:false,kind:"provider-required",message:"Card and bank transfers need an approved payment processor, verified recipient and settlement authorization. No money has moved."};
 if(!friend||!SOLANA.test(friend.address)||!SOLANA.test(owner)||friend.address===owner)
  return {ready:false,kind:"recipient-required",message:"Confirm a different recipient's wallet address before sending."};
 return {ready:true,kind:"wallet-usdc",amountCents:cents,amountUsd:cents/100,recipient:friend.address,
  message:"Confirm the recipient and amount. Your wallet will ask you to approve a real payment."};
}
export function payoutStage(record){
 if(!record||typeof record!=="object")return {status:"unavailable",paid:false};
 if(record.rail==="solana-usdc"&&record.chainConfirmation==="confirmed"&&typeof record.signature==="string"&&/^[1-9A-HJ-NP-Za-km-z]{80,100}$/.test(record.signature))
  return {status:"onchain-confirmed",paid:true};
 if(record.bankSettlement==="completed"&&record.processorVerified===true&&typeof record.processorReceipt==="string"&&record.processorReceipt.length>10)
  return {status:"fiat-settled",paid:true};
 return {status:"not-paid",paid:false};
}
export function friendInviteLink({address,name}){
 if(!SOLANA.test(address))throw Error("Cannot create a payment request without a wallet.");
 const url=new URL("https://senda.pocketnova.app/payments/friends");
 url.searchParams.set("to",address);
 if(name&&String(name).trim())url.searchParams.set("name",String(name).trim().slice(0,50));
 return url.toString();
}
export function sanitizePaymentNote(value){
 const text=String(value??"").trim().replace(/[\r\n\x00-\x1f]/g," ");
 return text.slice(0,70);
}
