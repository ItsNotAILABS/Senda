export type PredictionResearchRecord={kind:string;domain:string;origin:string;nonce:string;issuedAt:string;expiresAt:string;wallet:string;market:string;outcome:string;contracts:number;grossResearchUsd:number;approvedAction:string;tradingAuthority:string;venue:string;execution:string;fundsMoved:boolean};
export declare const PREDICTION_ACK_DOMAIN:string;
export declare function makePredictionAcknowledgement(input:{wallet:string;ticker:string;side:"yes"|"no";contracts:number;grossUsd:number;quotedAt:number;origin:string;nonce:string;createdAt?:number}):{record:PredictionResearchRecord;message:string};
export declare function validatePredictionAcknowledgement(record:PredictionResearchRecord,now?:number):boolean;
