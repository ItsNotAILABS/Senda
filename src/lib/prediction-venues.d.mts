export type PredictionVenue={id:string;name:string;family:string;region:string;funding:string;settlement:string;discovery:string;order:string;status:string;color:string;description:string};
export declare const PREDICTION_VENUES:ReadonlyArray<PredictionVenue>;
export declare function venueById(id:string):PredictionVenue|null;
export declare function normalizePredictionListing(input:{venueId:string;marketId:string;title:string;eventId?:string;category?:string;outcomes?:string[];sourceAt?:number;status?:string;marketKey?:string|null}):Readonly<Record<string,unknown>>;
export declare function equivalenceGate(a:any,b:any,proof:any,now?:number):{comparable:boolean;reason:string};
export declare function evaluatePredictionRoute(input:any):{ready:boolean;state:string;reason:string;phase:string};
export declare function predictionFundingPaths():Array<{source:string;target:string;mode:string;available:string;note:string}>;
