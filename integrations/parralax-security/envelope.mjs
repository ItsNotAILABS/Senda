/**
 * Server-only authenticated encryption for agent evidence/receipts.
 * Caller supplies a 32-byte key from a KMS/HSM; never bundle it into the browser.
 * Not suitable for wallet signing keys or mnemonic storage.
 */
import {randomBytes,hkdfSync,createCipheriv,createDecipheriv} from "node:crypto";
const identifier=x=>typeof x==="string"&&/^[a-zA-Z0-9._:-]{1,128}$/.test(x);
const MAX_SIZE=131072;
export const ENVELOPE_SCHEMA="senda.sealed-evidence.v1";
const fields=(tenantId,recordId,kind,revision,keyId)=>
 JSON.stringify([ENVELOPE_SCHEMA,tenantId,recordId,kind,revision,keyId]);
const checked=(input,key)=>{
 if(!input||![input.tenantId,input.recordId,input.kind,input.keyId].every(identifier)||
 !Number.isSafeInteger(input.revision)||input.revision<1||
 !(key instanceof Uint8Array)||key.byteLength!==32)
 throw Error("INVALID_ENVELOPE_CONTEXT_OR_KEY");
};
function derived(key,input){
 return Buffer.from(hkdfSync("sha256",key,Buffer.from("senda/evidence/v1", "utf8"),
 Buffer.from(fields(input.tenantId,input.recordId,input.kind,input.revision,input.keyId)),32));
}
function valid64(value,max){
 return typeof value==="string"&&value.length<=max&&/^[A-Za-z0-9+/]*={0,2}$/.test(value);
}
export function sealEvidence(input,secretKey){
 checked(input,secretKey);
 if(typeof input.plaintext!=="string")throw Error("PLAINTEXT_MUST_BE_STRING");
 const plain=Buffer.from(input.plaintext,"utf8");
 if(plain.length>MAX_SIZE)throw Error("EVIDENCE_TOO_LARGE");
 const iv=randomBytes(12),key=derived(secretKey,input);
 try{
  const cipher=createCipheriv("aes-256-gcm",key,iv);
  cipher.setAAD(Buffer.from(fields(input.tenantId,input.recordId,input.kind,input.revision,input.keyId)));
  const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
  return Object.freeze({schema:ENVELOPE_SCHEMA,tenantId:input.tenantId,recordId:input.recordId,
   kind:input.kind,revision:input.revision,keyId:input.keyId,
   nonce:iv.toString("base64"),ciphertext:ciphertext.toString("base64"),tag:cipher.getAuthTag().toString("base64")});
 }finally{plain.fill(0);key.fill(0);}
}
export function openEvidence(envelope,expected,keyring){
 if(!envelope||envelope.schema!==ENVELOPE_SCHEMA||
 !expected||!identifier(expected.tenantId)||!identifier(expected.recordId)||
 !identifier(expected.kind)||!Number.isSafeInteger(expected.revision)||
 envelope.tenantId!==expected.tenantId||envelope.recordId!==expected.recordId||
 envelope.kind!==expected.kind||envelope.revision!==expected.revision||
 !identifier(envelope.keyId)||!keyring||!Object.hasOwn(keyring,envelope.keyId)||
 !valid64(envelope.nonce,16)||!valid64(envelope.tag,24)||
 !valid64(envelope.ciphertext,200000))throw Error("ENVELOPE_CONTEXT_MISMATCH");
 const secretKey=keyring[envelope.keyId];
 checked(envelope,secretKey);
 const iv=Buffer.from(envelope.nonce,"base64");
 const tag=Buffer.from(envelope.tag,"base64");
 const ciphertext=Buffer.from(envelope.ciphertext,"base64");
 if(iv.length!==12||tag.length!==16||ciphertext.length>MAX_SIZE+16)throw Error("INVALID_ENVELOPE_BYTES");
 const key=derived(secretKey,envelope);
 try{
  const decipher=createDecipheriv("aes-256-gcm",key,iv);
  decipher.setAAD(Buffer.from(fields(envelope.tenantId,envelope.recordId,envelope.kind,envelope.revision,envelope.keyId)));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString("utf8");
 }catch{throw Error("ENVELOPE_AUTHENTICATION_FAILED");}
 finally{key.fill(0);}
}
