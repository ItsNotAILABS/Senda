export type FriendRecipient={kind:string;address:string|null;verified:boolean;reason:string};
export type FriendQuote={ready:boolean;reason?:string;recipient:FriendRecipient;from?:string;to?:string;cents?:number;usd?:number;asset?:string;network?:string;displayCurrency?:string;senderAction?:string;fee?:string;settlement?:string;note?:string;limitCents?:number;disclosure?:string};
export declare const FRIEND_RAILS:ReadonlyArray<{id:string;label:string;status:string;asset:string|null;currency:string;finality:string;custody:string}>;
export declare function usdToCents(input:string):number;
export declare function validateFriendDestination(input:unknown):FriendRecipient;
export declare function quoteFriendPayment(input:{recipient:string;amount:string;wallet:string;verified?:boolean;note?:string;limitUsd:number}):FriendQuote;export declare const PUBLIC_MEMO_NOTICE:string;
export declare const DEFAULT_FRIEND_MEMO:string;
export declare function buildFriendPayment(quote:FriendQuote):{owner:string;to:string;cents:number;memo:string};
