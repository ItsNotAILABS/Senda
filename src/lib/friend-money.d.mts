export type SendaFriend={name:string;address:string;tag:string;source:string;verified:boolean};
export type FriendPaymentPlan={ready:boolean;kind:string;message:string;amountCents?:number;amountUsd?:number;recipient?:string};
export declare function usdToCents(value:string|number):number;
export declare function normalizeFriend(input:{name:string;address:string;tag?:string}):SendaFriend;
export declare function planFriendPayment(input:{friend:SendaFriend|null;amount:string|number;owner:string;capUsd:number;method?:"wallet"|"debit-card"|"bank";payout?:"wallet"|"bank"|"debit-card"}):FriendPaymentPlan;
export declare function payoutStage(record:unknown):{status:string;paid:boolean};
export declare function friendInviteLink(input:{address:string;name?:string}):string;
export declare function sanitizePaymentNote(value:string):string;
