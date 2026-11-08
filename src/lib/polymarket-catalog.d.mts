export type PolymarketCatalogRow={venueId:string;marketId:string;title:string;slug:string;category:string;outcomes:string[];indicativePrices:(number|null)[];tokenIds:string[];volumeUsd:number|null;liquidityUsd:number|null;closesAt:string|null;status:string;dataQuality:string;readAt:number;source:string;notExecutable:boolean};
export declare function normalizePolymarketCatalog(raw:unknown,asOf?:number):PolymarketCatalogRow[];
export declare function polymarketMarketUrl(row:PolymarketCatalogRow):string|null;
