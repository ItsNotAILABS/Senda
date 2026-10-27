#!/usr/bin/env node
/** Builds a versioned, immutable-ready NFT metadata bundle; NEVER mints assets. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DIGITAL_ASSETS, blueprintMetadata } from "../src/lib/genesis-catalog.mjs";
const root=path.resolve(fileURLToPath(new URL("..",import.meta.url)));
const sha=(text)=>createHash("sha256").update(text).digest("hex");
export function releaseRecord(item,baseUrl){
 const metadata=blueprintMetadata(item.id,baseUrl);
 const json=JSON.stringify(metadata,null,2)+"\n";
 return {id:item.id,slot:item.slot,metadata,json,sha256:sha(json),mint:null,status:"unminted-blueprint"};
}
export async function buildGenesisMetadata({baseUrl="https://senda.pocketnova.app",directory=path.join(root,"public/genesis/metadata")}={}){
 await mkdir(directory,{recursive:true});
 const entries=[];
 for(const item of DIGITAL_ASSETS){
  const {json,...rec}=releaseRecord(item,baseUrl);
  await writeFile(path.join(directory,item.id+".json"),json);
  entries.push(rec);
 }
 const manifest={schema:"senda.genesis.release.v1",collection:null,chain:"solana-mainnet",status:"NOT_MINTED",assets:entries,
  instructions:"Upload images/JSON to immutable storage, verify content hashes, deploy and verify a collection with its mint authority, then configure the server mint registry. This script never mints NFTs or charges wallets."};
 await writeFile(path.join(directory,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
 return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const baseUrl=process.argv.find(x=>x.startsWith("--base-url="))?.slice(11)||"https://senda.pocketnova.app";
 buildGenesisMetadata({baseUrl}).then(m=>process.stdout.write("Generated "+m.assets.length+" unminted Genesis metadata records\n"))
 .catch(e=>{process.stderr.write(String(e)+"\n");process.exitCode=1;});
}
