/**
 * Recipient-first dollars UX built only on real wallet-signed USDC settlement.
 * Card/bank/handle routes require actual partner-backed settlement and are never
 * interchangeable with a user's local (paper) USD balance.
 */
const SOLANA=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TAG=/^@[a-z0-9_.-]{2,40}$/i;
const CENTS=/^(?:0|[1-9][0-9]{0,5})(?:\.[0-9]{1,2})?$/;
export const FRIEND_RAILS=Object.freeze([
 {id:"wallet-usdc",label:"Senda to wallet",status:"available",asset:"USDC",currency:"USD",finality:"Solana confirmed transfer",custody:"user wallet"},
 {id:"bank",label:"To bank",status:"partner-required",asset:null,currency:"USD",finality:"Bank payout via approved processor",custody:"provider"},
 {id:"card",label:"From debit card",status:"partner-required",asset:null,currency:"USD",finality:"Card acquiring then treasury settlement",custody:"provider"},
 {id:"handle",label:"To a friend by @tag",status:"directory-required",asset:null,currency:"USD",finality:"Resolved registered wallet and verified recipient",custody:"user wallet"},
]);
export function usdToCents(input){
 if(typeof input!=="string"||!CENTS.test(input))throw Error("Enter a dollar amount with no more than two decimals.");
 const [whole,decimal=""]=input.split(".");
 const cents=Number(whole)*100+Number(decimal.padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents<1||cents>1_000_000)throw Error("Send between $0.01 and $10,000 per transfer.");
 return cents;
}
export function validateFriendDestination(input){
 const recipient=String(input??"").trim();
 if(SOLANA.test(recipient))return {kind:"wallet",address:recipient,verified:false,reason:"Verify the full wallet address with your recipient before signing."};
 if(TAG.test(recipient))return {kind:"unresolved-handle",address:null,verified:false,reason:"Senda handles are not globally registered or verified. Ask for the recipient's real Solana wallet address."};
 if(/^\S+@\S+\.[a-z]{2,}$/i.test(recipient)||/^\+?[\d\s()-]{7,25}$/.test(recipient))
  return {kind:"unresolved-contact",address:null,verified:false,reason:"Phone and email recipients require a verified directory and identity service; no payment was created."};
 return {kind:"invalid",address:null,verified:false,reason:"Enter a full Solana address. Phone, card and bank payouts are not connected."};
}
export function quoteFriendPayment({recipient,amount,wallet,verified=false,note="",limitUsd=1000}){
 const dest=validateFriendDestination(recipient);
 if(dest.kind!=="wallet")return {ready:false,reason:dest.reason,recipient:dest};
 if(!verified)return {ready:false,reason:"Confirm the recipient address before signing; pasted addresses can be replaced by malware.",recipient:dest};
 if(typeof wallet!=="string"||!SOLANA.test(wallet)||wallet===dest.address)
  return {ready:false,reason:"Connect the sending wallet and choose a different recipient.",recipient:dest};
 let cents;
 try{cents=usdToCents(amount)}catch(e){return {ready:false,reason:e instanceof Error?e.message:"Invalid amount",recipient:dest};}
 if(!Number.isFinite(limitUsd)||limitUsd<=0||cents>Math.round(limitUsd*100))
  return {ready:false,reason:"Amount exceeds your configured spending limit.",recipient:dest};
 if(typeof note!=="string"||note.length>80||/[\r\n\x00-\x1f]/.test(note))
  return {ready:false,reason:"Note cannot contain control characters or exceed 80 characters.",recipient:dest};
 return {ready:true,recipient:dest,from:wallet,to:dest.address,cents,usd:cents/100,asset:"USDC",network:"Solana Mainnet",displayCurrency:"USD",
  senderAction:"Phantom signs transfer",fee:"Wallet network fee; check Phantom preview",settlement:"Wait for Solana confirmation",note:note.trim(),
  disclosure:"$ amount is paid as an equal quantity of native Solana USDC. This is not a debit-card payment, fiat balance, bank transfer or off-ramp."};
}
