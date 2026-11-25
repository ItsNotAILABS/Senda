/** Development-only internal paper ledger. Never authorizes money movement. */
export function paperLedgerEnabled(mode="production",flag=""){
 return mode==="development"&&flag==="true";
}
export const UNSETTLED_PAYMENT_MESSAGE="This was a local paper-ledger action, not a real settled payment. Connect a wallet to transfer USDC or configure an approved payment processor.";
