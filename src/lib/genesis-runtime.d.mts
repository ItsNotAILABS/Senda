import type {GenesisCharacter} from "./genesis-catalog.mjs";
export type GenesisBar={t:number;o:number;h:number;l:number;c:number;v:number};
export declare function validateCandles(input:unknown):GenesisBar[];
export declare function analyzeMarket(input:{bars:GenesisBar[];source:string}):{source:string;sourceVerified:boolean;barCount:number;close:number|null;changePct:number|null;relativeVolume:number|null;volumeUsd:number|null;maFast:number|null;maSlow:number|null;rangePct:number|null;trend:"up"|"down"|"flat"|"unknown";sourceNote:string};
export declare function resolveEntitlements(ownedIds:unknown,characterId:string):string[];
export declare function runGenesisResearch(input:{characterId:string;symbol:string;bars:GenesisBar[];source:string;verifiedAssetIds:readonly string[]}):{schema:string;characterId:string;runtime:string;symbol:string;mode:string;data:ReturnType<typeof analyzeMarket>;lines:string[];checks:string[];entitlements:string[];enabled:{gear:boolean;code:boolean};receipt:{source:string;barCount:number;confirmedVolume:boolean;walletSignatureRequiredForTrade:boolean;orderSubmitted:boolean;noSimulatedFill:boolean}};
