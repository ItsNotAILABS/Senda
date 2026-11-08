export declare function createMoneyIntent(input:{id:string;source:string;recipient:string;amountCents:number;sourceCurrency?:string;destinationCurrency?:string;createdAt?:number}):any;
export declare function recordProviderTransition(intent:any,event:{id:string;transferId:string;next:string;occurredAt:number;provider?:string;reference?:string},attested?:boolean):any;
export declare function canDisplayDelivered(intent:any):boolean;
export declare function publicMoneyState(intent:any):{state:string;delivered:boolean;notification:string};
