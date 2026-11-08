export declare function fromBase58(value:string):Uint8Array;
export declare function toBase58(bytes:Uint8Array):string;
export declare function verifyWalletEd25519(wallet:string,message:Uint8Array,signature:Uint8Array):Promise<boolean>;
export declare function decodeBase64(value:string):Uint8Array;