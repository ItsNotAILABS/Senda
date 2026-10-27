import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUpRight, Bot, Check, Code2, Eye, Gauge, Layers3, LockKeyhole, Play, RefreshCw, ShieldCheck, Wallet2 } from "lucide-react";
import { CHARACTERS, findAsset, findCharacter } from "@/lib/genesis-catalog.mjs";
import { runGenesisResearch } from "@/lib/genesis-runtime.mjs";
import { equipGenesisLoadout, loadGenesisLoadout } from "@/lib/genesis-loadout.mjs";
import { readGenesisOwnership } from "@/lib/genesis-chain";
import { getPrint, type PrintTf } from "@/lib/print";
import { createWorker } from "@/lib/agent-workspace";
import { useHouse } from "@/lib/use-house";
import { useWalletCtx } from "@/lib/wallet-context";

type Ownership = Awaited<ReturnType<typeof readGenesisOwnership>>;
const timeframes: PrintTf[] = ["15m","1H","4H","1D"];
const money = (n: number | null) => n == null ? "—" : n >= 1 ? "$"+n.toLocaleString("en-US",{maximumFractionDigits:2}) : "$"+n.toPrecision(4);

function ModuleTile({ id, kind, owned, equipped, canEquip, onEquip }:{
 id:string;kind:"gear"|"code";owned:boolean;equipped:boolean;canEquip:boolean;onEquip:()=>void;
}) {
 const asset=findAsset(id);
 if(!asset)return null;
 return (
  <div className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
   <img src={`/genesis/${kind}/${id}.svg`} alt={asset.name} className="h-24 w-16 shrink-0 rounded-lg object-cover sm:h-28 sm:w-20"/>
   <div className="min-w-0 flex-1">
    <p className="text-[10px] font-semibold uppercase tracking-[.19em] text-cyan-300">{kind==="gear"?"Equipable gear":"Executable research module"}</p>
    <p className="mt-1 text-sm font-semibold">{asset.name}</p>
    <p className="mt-1 text-[11px] leading-relaxed text-white/50">{asset.description}</p>
    <button type="button" disabled={!canEquip} onClick={onEquip}
      className="mt-2 inline-flex min-h-8 items-center gap-1 rounded-full border border-cyan-300/30 px-3 text-[11px] text-cyan-200 disabled:border-white/10 disabled:text-white/35">
      {equipped?<><Check className="size-3"/> Equipped</>:owned?"Equip verified module":"Blueprint · ownership required"}
    </button>
   </div>
  </div>
 );
}
export function GenesisDesk() {
 const nav=useNavigate();
 const rows=useHouse();
 const {w}=useWalletCtx();
 const owner=w.links.find(l=>l.kind==="phantom"||l.kind==="solana")?.address??"";
 const [active,setActive]=useState("sen");
 const [tf,setTf]=useState<PrintTf>("1H");
 const [mint,setMint]=useState("");
 const [ownership,setOwnership]=useState<Ownership|null>(null);
 const [verifying,setVerifying]=useState(false);
 const [running,setRunning]=useState(false);
 const [out,setOut]=useState<ReturnType<typeof runGenesisResearch>|null>(null);
 const [loadout,setLoadout]=useState<{gear:string|null;code:string|null}>({gear:null,code:null});
 const agent=useMemo(()=>findCharacter(active)??CHARACTERS[0],[active]);
 const eligible=useMemo(()=>rows.filter(n=>n.mint&&n.mint.length>=32&&n.last>0).slice(0,35),[rows]);
 const selected=eligible.find(n=>n.mint===mint)??eligible[0];
 const ownedIds=ownership?.state==="verified"&&ownership.owner===owner?ownership.ownedIds:[];
 const owns=ownedIds.includes(agent.id);
 const ownGear=ownedIds.includes(agent.gear);
 const ownCode=ownedIds.includes(agent.pack);

 useEffect(()=>{
  if(!owner) {setOwnership(null);return;}
  let live=true;
  setOwnership(null);
  setVerifying(true);
  readGenesisOwnership({data:{owner}})
    .then(value=>{if(live)setOwnership(value);})
    .catch(()=>{if(live)setOwnership({state:"unavailable",owner,ownedIds:[],count:0,note:"Ownership verification is temporarily unavailable."});})
    .finally(()=>{if(live)setVerifying(false);});
  return ()=>{live=false;};
 },[owner]);
 useEffect(()=>{
  setOut(null);
  setLoadout(owner?loadGenesisLoadout(window.localStorage,owner,agent.id,ownedIds):{gear:null,code:null});
 },[agent.id,owner,ownership]);
 async function verifyAgain() {
  if(!owner)return toast.error("Connect your Solana wallet first.");
  setVerifying(true);
  try {setOwnership(await readGenesisOwnership({data:{owner}}));}
  catch(e){toast.error(e instanceof Error?e.message:"Ownership could not be verified.");}
  finally {setVerifying(false);}
 }
 function equip(kind:"gear"|"code") {
  if(!owner||!owns)return toast.error("Connect the wallet holding this character first.");
  const requested=kind==="gear"?agent.gear:agent.pack;
  if(!ownedIds.includes(requested))return toast.error("This module is not verified in your wallet.");
  const next={
   gear:kind==="gear"?(loadout.gear?null:requested):loadout.gear,
   code:kind==="code"?(loadout.code?null:requested):loadout.code,
  };
  try {
   const saved=equipGenesisLoadout(window.localStorage,{
    owner,characterId:agent.id,gear:next.gear,code:next.code,verifiedIds:ownedIds,
   });
   setLoadout(saved);
   setOut(null);
   toast.success("Equipped modules are linked to this wallet on this device.");
  } catch(e){toast.error(e instanceof Error?e.message:"Equipment was refused.");}
 }
 async function run() {
  if(!selected)return toast.error("No live Solana market is available.");
  setRunning(true);setOut(null);
  try {
   const print=await getPrint({data:{mint:selected.mint,tf}});
   const source=print.note.startsWith("Pool OHLCV")?"gecko-pool":"price-only";
   const verifiedAssetIds=owns?([agent.id,loadout.gear,loadout.code].filter((x):x is string=>!!x&&ownedIds.includes(x))):[];
   const result=runGenesisResearch({
    characterId:agent.id,symbol:selected.symbol,bars:print.bars,source,verifiedAssetIds,
   });
   setOut(result);
  } catch(e) {toast.error(e instanceof Error?e.message:"Research runtime did not complete.");}
  finally{setRunning(false);}
 }
 function installWorker() {
  try {
   const worker=createWorker({
    name:agent.name+" · "+agent.title,purpose:agent.mission,
    instructions:`Senda Genesis ${agent.runtime} runtime. Observe live evidence, disclose gaps, never sign or auto-execute. Any NFT gear must be reverified against its current wallet owner before providing premium functions.`,
    category:agent.id==="lyra"?"content":agent.id==="orbi"?"operations":"markets",
    tools:agent.tools as ("planner"|"notes"|"book"|"memory"|"trade")[],
    trigger:"manual",autonomy:"draft",symbols:[],maxUsd:25,side:"buy",
    genesis:{characterId:agent.id,owner:owns?owner:"",
      gear:owns&&ownGear?loadout.gear:null,code:owns&&ownCode?loadout.code:null},
   });
   toast.success(worker.name+" created in your agent studio.");
   void nav({to:"/agents"});
  }catch(e){toast.error(e instanceof Error?e.message:"Agent could not be created.");}
 }
 return (
  <main className="min-h-screen bg-[#030711] p-4 text-white md:p-6 xl:p-8">
   <div className="mx-auto max-w-[1480px]">
    <section className="relative overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[radial-gradient(ellipse_at_80%_0%,#12375e_0%,#080d1b_45%,#050711_100%)] px-5 py-6 md:px-8 md:py-8">
     <p className="font-mono text-[10px] tracking-[.32em] text-cyan-300">SENDA / GENESIS SYSTEM</p>
     <h1 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight md:text-5xl">Collect intelligence. Equip capability.</h1>
     <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">Six market-oriented characters. Six real read-only runtimes. Twelve gear and code modules. Own the digital collectible, verify it on-chain, then equip an agent with its scoped research capabilities.</p>
     <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
      {["6 character runtimes","18 collectible blueprints","Real market feeds","Human-signed trading only"].map(s=><span key={s} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5">{s}</span>)}
     </div>
    </section>

    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#09111f] p-3 text-xs">
     <div className="flex min-w-0 items-center gap-2"><Wallet2 className="size-4 text-cyan-300"/><span className="text-white/70">{owner?`Wallet ${owner.slice(0,6)}…${owner.slice(-4)}`:"Connect a Solana wallet in the Senda header to check NFT ownership."}</span></div>
     <div className="flex items-center gap-2"><span className="text-white/40">{verifying?"Checking chain…":ownership?.note??"No Genesis NFT collection configured."}</span>{owner?<button onClick={()=>void verifyAgain()} disabled={verifying} className="rounded-full border border-white/20 px-3 py-2 disabled:opacity-40"><RefreshCw className="size-4"/></button>:null}</div>
    </div>

    <section className="mt-5">
     <div className="mb-3 flex items-end justify-between"><div><p className="font-mono text-[10px] tracking-[.2em] text-cyan-300">THE FOUNDING SIX</p><h2 className="mt-1 text-xl font-semibold">Character collection</h2></div><span className="text-xs text-white/40">Select a card to open its runtime</span></div>
     <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {CHARACTERS.map(c=><button type="button" key={c.id} onClick={()=>setActive(c.id)}
       className={`group relative overflow-hidden rounded-xl border text-left transition hover:-translate-y-1 ${active===c.id?"border-cyan-300 shadow-[0_0_22px_#3acbff24]":"border-white/10 hover:border-white/35"}`}>
       <img src={`/genesis/cards/${c.id}.svg`} alt={`${c.name} — ${c.title}`} className="aspect-[7/10] w-full object-cover"/>
       <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-2 pt-6">
        <div className="flex justify-between gap-1 text-[10px] font-semibold"><span>{c.name}</span><span className={ownedIds.includes(c.id)?"text-cyan-300":"text-white/55"}>{ownedIds.includes(c.id)?"OWNED":"BLUEPRINT"}</span></div>
       </div>
      </button>)}
     </div>
    </section>

    <section className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
     <div className="rounded-[22px] border border-white/10 bg-[#090e1b] p-3">
      <img src={`/genesis/cards/${agent.id}.svg`} alt={`${agent.name} collectible trading card`} className="w-full rounded-xl"/>
      <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-cyan-400/20 px-3 py-1 text-xs text-cyan-300">{agent.rarity}</span><span className="rounded-full border border-white/15 px-3 py-1 text-xs">{owns?"Verified character":"Blueprint preview"}</span></div>
     </div>
     <div className="rounded-[22px] border border-white/10 bg-[#090e1b] p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] tracking-[.2em] text-cyan-300">AGENT RUNTIME / {agent.runtime.toUpperCase()}</p><h2 className="mt-1 text-3xl font-semibold">{agent.name} <span className="text-white/45">· {agent.title}</span></h2><p className="mt-2 text-sm text-white/55">{agent.summary}</p></div><span className="flex items-center gap-1 rounded-full border border-cyan-300/25 px-3 py-2 text-xs text-cyan-200"><ShieldCheck className="size-4"/> Read-only · governed</span></div>
      <p className="mt-4 rounded-xl bg-white/[0.04] p-3 text-sm text-white/70">{agent.mission}</p>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
       <ModuleTile id={agent.gear} kind="gear" owned={ownGear&&owns} equipped={loadout.gear===agent.gear}
        canEquip={owns&&ownGear} onEquip={()=>equip("gear")}/>
       <ModuleTile id={agent.pack} kind="code" owned={ownCode&&owns} equipped={loadout.code===agent.pack}
        canEquip={owns&&ownCode} onEquip={()=>equip("code")}/>
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
       <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Gauge className="size-4 text-cyan-300"/> Run market research</p>
       <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <select value={selected?.mint??""} onChange={e=>setMint(e.target.value)} className="min-h-11 min-w-0 rounded-xl border border-white/15 bg-[#121e32] px-3 text-sm text-white">
         {eligible.length?<>{eligible.map(n=><option key={n.mint} value={n.mint}>{n.symbol} · {n.name}</option>)}</>:<option value="">Waiting for the market book</option>}
        </select>
        <div className="flex gap-1">{timeframes.map(v=><button key={v} onClick={()=>setTf(v)} className={`min-h-11 rounded-lg px-3 font-mono text-xs ${tf===v?"bg-cyan-300 text-black":"bg-white/5 text-white/60"}`}>{v}</button>)}</div>
        <button type="button" disabled={running||!selected} onClick={()=>void run()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#aef5fd] px-5 text-sm font-bold text-[#07111c] disabled:opacity-35"><Play className="size-4"/> {running?"Reading…":"Run"}</button>
       </div>
       {out?<div className="mt-4 rounded-xl border border-cyan-300/20 bg-[#051720] p-4" aria-live="polite">
        <div className="flex flex-wrap justify-between gap-2"><span className="font-mono text-xs text-cyan-300">{out.runtime.toUpperCase()} / {out.symbol}</span><span className="font-mono text-[11px] text-white/50">{out.data.barCount} candles · {out.data.sourceVerified?"Verified pool volume":"Volume not verified"}</span></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-white/5 p-2"><p className="text-[10px] text-white/45">Close</p><p className="font-mono text-sm">{money(out.data.close)}</p></div><div className="rounded-lg bg-white/5 p-2"><p className="text-[10px] text-white/45">Volume / 20</p><p className="font-mono text-sm">{out.data.relativeVolume==null?"—":out.data.relativeVolume.toFixed(2)+"×"}</p></div><div className="rounded-lg bg-white/5 p-2"><p className="text-[10px] text-white/45">Trend</p><p className="font-mono text-sm uppercase">{out.data.trend}</p></div></div>
        <ul className="mt-3 space-y-2">{out.lines.map((line,i)=><li key={i} className="text-xs leading-relaxed text-white/75">• {line}</li>)}{out.checks.map((check,i)=><li key={i} className="text-xs leading-relaxed text-amber-200/80">• {check}</li>)}</ul>
        {out.moduleOutputs.length > 0 ? <div className="mt-3 space-y-2 border-t border-cyan-300/15 pt-3">
          <p className="font-mono text-[10px] tracking-[.15em] text-cyan-300">VERIFIED EQUIPMENT OUTPUTS</p>
          {out.moduleOutputs.map(item=><div key={item.asset} className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs">
            <p className="font-semibold text-cyan-200">{findAsset(item.asset)?.name} · {item.type}</p>
            <p className="mt-1 break-words font-mono text-[11px] text-white/50">{JSON.stringify(item.value)}</p>
          </div>)}
        </div>:null}
        <p className="mt-3 border-t border-white/10 pt-2 font-mono text-[10px] text-white/40">Receipt: no order, no wallet signature, no simulated fill.</p>
       </div>:<p className="mt-3 text-xs text-white/45">Runtime executes on sourced market candles; missing data remains missing. Gear unlocks only after ownership verification.</p>}
      </div>
      <button type="button" onClick={installWorker} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/30 px-5 text-sm font-semibold text-cyan-200"><Bot className="size-4"/> Create {agent.name} in Agent Studio <ArrowUpRight className="size-4"/></button>
     </div>
    </section>
    <section className="mt-5 rounded-[24px] border border-white/10 bg-[#09101d] p-5">
     <div className="flex items-center gap-2"><Layers3 className="size-5 text-cyan-300"/><h2 className="text-xl font-semibold">More than collectible artwork</h2></div>
     <div className="mt-3 grid gap-3 text-xs leading-relaxed text-white/55 md:grid-cols-3">
      <p><Eye className="mb-2 size-5 text-cyan-300"/><strong className="text-white">Collect:</strong> six character identities plus twelve standalone gear/code NFTs, each with distinct metadata and a verified wallet owner.</p>
      <p><Code2 className="mb-2 size-5 text-cyan-300"/><strong className="text-white">Equip:</strong> verified modules activate deterministic read-only research abilities; owners can swap equipment when holding the corresponding NFTs.</p>
      <p><LockKeyhole className="mb-2 size-5 text-cyan-300"/><strong className="text-white">Govern:</strong> NFT ownership never grants payment permission or unattended signing; minting and paid utilities require an explicitly authorized release.</p>
     </div>
     <p className="mt-3 text-[11px] text-white/40">Current state: artwork, metadata blueprints, runtime code, workspace creation and optional read-only chain verification. No Genesis collection or NFTs have been minted by this change.</p>
    </section>
   </div>
  </main>
 );
}
