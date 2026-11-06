/**
 * Browser-native Ed25519 verification and canonical base58 codec.
 * No undeclared tweetnacl / bs58 dependencies or signing keys in app memory.
 */
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const lookup=new Map([...alphabet].map((c,i)=>[c,i]));
export function fromBase58(value){
 if(typeof value!=="string"||value.length<1||value.length>128)throw Error("Invalid base58 value");
 let sum=0n;
 for(const char of value){const n=lookup.get(char);if(n===undefined)throw Error("Invalid base58 character");sum=sum*58n+BigInt(n);}
 const reversed=[];
 while(sum>0n){reversed.push(Number(sum&255n));sum>>=8n;}
 const prefix=value.match(/^1*/)?.[0].length||0;
 return new Uint8Array([...Array(prefix).fill(0),...reversed.reverse()]);
}
export function toBase58(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>256)throw Error("Invalid binary value");
 let n=0n;for(const b of bytes)n=n*256n+BigInt(b);
 let s="";while(n>0n){s=alphabet[Number(n%58n)]+s;n/=58n;}
 for(let i=0;i<bytes.length&&bytes[i]===0;i++)s="1"+s;
 return s;
}
export async function verifyWalletEd25519(wallet,message,signature){
 if(!(message instanceof Uint8Array)||!(signature instanceof Uint8Array)||signature.length!==64)
  throw Error("Invalid wallet-signature payload");
 const pubkey=fromBase58(wallet);
 if(pubkey.length!==32)throw Error("Solana wallet public key must have 32 bytes");
 if(!globalThis.crypto?.subtle?.importKey||!globalThis.crypto?.subtle?.verify)
  throw Error("Secure browser Ed25519 verification is not supported");
 const imported=await globalThis.crypto.subtle.importKey("raw",pubkey,{name:"Ed25519"},false,["verify"]);
 return globalThis.crypto.subtle.verify("Ed25519",imported,signature,message);
}
export function decodeBase64(value){
 if(typeof value!=="string"||!value.length||value.length>2200||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
  throw Error("Invalid transaction base64");
 const decoded=globalThis.atob(value);
 const result=Uint8Array.from(decoded,ch=>ch.charCodeAt(0));
 if(result.length>1232||result.length<64)throw Error("Unexpected transaction packet size");
 return result;
}
