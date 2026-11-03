import test from "node:test";import assert from "node:assert/strict";
import {verifiedGenesisOwnership,resolveOwnedGenesisAssets,parseRegistry} from "../src/lib/genesis-ownership.mjs";
const owner="6".repeat(44),other="7".repeat(44),coll="8".repeat(44),mint="9".repeat(44);
const asset={id:mint,burnt:false,ownership:{owner},grouping:[{group_key:"collection",group_value:coll,verified:true}]};
test("ownership demands exact owner mint and verified collection",()=>{
 assert.equal(verifiedGenesisOwnership({asset,owner,collection:coll,expectedMint:mint}),true);
 for(const a of [{...asset,ownership:{owner:other}},{...asset,burnt:true},{...asset,id:other},
 {...asset,grouping:[{group_key:"collection",group_value:other,verified:true}]},
 {...asset,grouping:[{group_key:"collection",group_value:coll,verified:false}]},
 {...asset,grouping:[{group_key:"collection",group_value:coll}]}])assert.equal(verifiedGenesisOwnership({asset:a,owner,collection:coll,expectedMint:mint}),false);
});
test("registry rejects imaginary mints and returns only known verified assets",()=>{
 const reg=parseRegistry({sen:mint,"raven-wing":other});
 assert.deepEqual(resolveOwnedGenesisAssets(owner,coll,reg,{sen:asset,"raven-wing":{...asset,id:other,ownership:{owner:other}}}),["sen"]);
 assert.throws(()=>parseRegistry({sen:"notamint"}));
 assert.throws(()=>parseRegistry({"unsafe-contract":mint}));
});
