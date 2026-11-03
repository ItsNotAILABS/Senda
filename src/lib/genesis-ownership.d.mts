export declare function isSolanaAddress(value:unknown):boolean;
export declare function verifiedGenesisOwnership(input:{asset:any;owner:string;collection:string;expectedMint:string}):boolean;
export declare function resolveOwnedGenesisAssets(owner:string,collection:string,registry:Record<string,string>,assetResponses:Record<string,unknown>):string[];
export declare function parseRegistry(input:unknown):Record<string,string>;
