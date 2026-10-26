import { findAsset } from "./genesis-catalog.mjs";
const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export function isSolanaAddress(value){return typeof value==="string"&&BASE58.test(value);}
export function verifiedGenesisOwnership({asset,owner,collection,expectedMint}) {
 if(!asset||!isSolanaAddress(owner)||!isSolanaAddress(collection)||!isSolanaAddress(expectedMint))return false;
 if(asset.id!==expectedMint||asset.burnt===true||asset.ownership?.owner!==owner)return false;
 const grouping=Array.isArray(asset.grouping)?asset.grouping:[];
 return grouping.some(g=>(g.group_key==="collection"||g.groupKey==="collection")&&
   (g.group_value===collection||g.groupValue===collection)&&g.verified!==false);
}
export function resolveOwnedGenesisAssets(owner,collection,registry,assetResponses){
 if(!isSolanaAddress(owner)||!isSolanaAddress(collection))throw Error("A valid wallet and collection are required.");
 const owned=[];
 for(const [id,mint] of Object.entries(registry??{})){
  if(!findAsset(id)||!isSolanaAddress(mint))continue;
  if(verifiedGenesisOwnership({asset:assetResponses?.[id],owner,collection,expectedMint:mint}))owned.push(id);
 }
 return owned.sort();
}
export function parseRegistry(input) {
 const value=typeof input==="string"?JSON.parse(input):input;
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid Genesis mint registry.");
 const result={};
 for(const [id,mint] of Object.entries(value)) {
  if(!findAsset(id)||!isSolanaAddress(mint))throw Error("Unknown asset or invalid mint in Genesis registry.");
  result[id]=mint;
 }
 if(Object.keys(result).length>18)throw Error("Genesis registry exceeds the launched catalog.");
 return result;
}
