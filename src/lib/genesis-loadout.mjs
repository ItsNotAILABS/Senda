import { findCharacter } from "./genesis-catalog.mjs";
const KEY="senda.genesis.loadout.v1";
const ADDRESS=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const has=(owned,id)=>Array.isArray(owned)&&owned.includes(id);
export function loadGenesisLoadout(storage,owner,characterId,verifiedIds) {
 const character=findCharacter(characterId);
 if(!character)return {gear:null,code:null};
 if(!ADDRESS.test(owner)||!has(verifiedIds,character.id))return {gear:null,code:null};
 let record;
 try {record=JSON.parse(storage?.getItem?.(KEY+":"+owner)||"{}");} catch{return {gear:null,code:null};}
 const item=record?.[characterId];
 return {gear:item?.gear===character.gear&&has(verifiedIds,character.gear)?character.gear:null,
  code:item?.code===character.pack&&has(verifiedIds,character.pack)?character.pack:null};
}
export function equipGenesisLoadout(storage,{owner,characterId,gear,code,verifiedIds}) {
 const character=findCharacter(characterId);
 if(!character||!ADDRESS.test(owner)||!has(verifiedIds,character.id))throw Error("Character ownership is not verified.");
 if(gear!=null&&(gear!==character.gear||!has(verifiedIds,gear)))throw Error("Gear ownership is not verified.");
 if(code!=null&&(code!==character.pack||!has(verifiedIds,code)))throw Error("Code ownership is not verified.");
 let record;
 try {record=JSON.parse(storage.getItem(KEY+":"+owner)||"{}");} catch{record={};}
 if(!record||typeof record!=="object"||Array.isArray(record))throw Error("Invalid saved Genesis loadouts.");
 record[characterId]={gear:gear??null,code:code??null};
 storage.setItem(KEY+":"+owner,JSON.stringify(record));
 return record[characterId];
}
