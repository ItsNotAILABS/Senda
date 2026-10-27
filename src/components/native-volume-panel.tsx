import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, BarChart3, Database, RefreshCw, ShieldAlert } from "lucide-react";
import { getNativeVolume } from "@/lib/solscan-volume";
import type { NativeVolume, VolumeBar } from "@/lib/solscan-volume-core.mjs";

const cash=(n:number)=>"$"+(n>=1e6?(n/1e6).toFixed(2)+"m":n>=1000?(n/1000).toFixed(1)+"k":n.toLocaleString("en-US",{maximumFractionDigits:2}));
const time=(t:number)=>new Date(t).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
const fmt=(n:number)=>Number.isFinite(n)?n.toLocaleString("en-US"):"—";
type VolumeResult={state:"ready"|"unconfigured"|"unavailable";snapshot:NativeVolume|null;reason:string;pages:number};
const timeframes=["15m","1H","4H","1D"] as const;

function VolumeBars({bars,complete}:{bars:VolumeBar[];complete:boolean}){
 const width=1000,height=240,top=22,bottom=210,baseY=187;
 const max=Math.max(1,...bars.map(b=>b.totalUsd??0));
 const step=(width-56)/Math.max(1,bars.length),barWidth=Math.max(3,step*.66);
 const last=bars.length?bars.at(-1)?.t??0:0;
 const useLabelStep=Math.max(1,Math.ceil(bars.length/7));
 return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="On-chain USDC-paired swap buy and sell notional grouped by time. Gray cells are unavailable when indexing is incomplete." className="w-full overflow-visible">
  {[0,.25,.5,.75,1].map(y=><g key={y}><line x1="30" y1={baseY-(baseY-top)*y} x2="990" y2={baseY-(baseY-top)*y} stroke="#294057" strokeDasharray="3 7" opacity=".6"/><text x="26" y={baseY-(baseY-top)*y+4} fill="#738aa3" fontSize="11" textAnchor="end">{y===0?"0":cash(max*y)}</text></g>)}
  {bars.map((row,i)=>{
    const x=40+i*step+step/2,rx=x-barWidth/2,barHeight=(row.totalUsd??0)/max*(baseY-top);
    const buyHeight=(row.buyUsd??0)/max*(baseY-top),sellHeight=(row.sellUsd??0)/max*(baseY-top);
    const empty=row.totalUsd===null;
    return <g key={row.t}>
      {empty?<rect x={rx} y={top} width={barWidth} height={baseY-top} fill="#71849a" opacity=".09" stroke="#64748b" strokeDasharray="3 3"/>:
       row.totalUsd===0?<rect x={rx} y={baseY-2} width={barWidth} height="2" fill="#758699" opacity=".6"/>:<>
         <rect x={rx} y={baseY-buyHeight} width={barWidth} height={Math.max(0,buyHeight)} rx="1" fill="#24d7b0"/>
         <rect x={rx} y={baseY-barHeight} width={barWidth} height={Math.max(0,sellHeight)} rx="1" fill="#f17a90"/>
       </>}
      {i%useLabelStep===0||i===bars.length-1?<text x={x} y="209" textAnchor="middle" fill="#91a4bc" fontSize="12">{time(row.t)}</text>:null}
      <title>{new Date(row.t).toISOString()} | {empty?"No verified coverage":`Buy ${cash(row.buyUsd??0)} · Sell ${cash(row.sellUsd??0)} · ${row.trades??0} indexed swaps`}</title>
    </g>;
  })}
  <text x="984" y="232" textAnchor="end" fontSize="10" fill="#7890a7">DIRECT USDC PAIRS • {complete?"INDEXED WINDOW":"PARTIAL INDEX"} • NOT ORDER FLOW</text>
 </svg>;
}
export function NativeVolumePanel({mint,symbol,initialTf="1H"}:{mint:string;symbol:string;initialTf?:"15m"|"1H"|"4H"|"1D"}){
 const [tf,setTf]=useState<typeof timeframes[number]>(initialTf);
 const [tick,setTick]=useState(0),[busy,setBusy]=useState(false);
 const [result,setResult]=useState<VolumeResult|null>(null);
 const valid=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint);
 useEffect(()=>{
  if(!valid){setResult(null);return;}
  let live=true;setBusy(true);setResult(null);
  void getNativeVolume({data:{mint,tf}}).then(v=>{if(live)setResult(v);})
   .catch(e=>{if(live)setResult({state:"unavailable",snapshot:null,pages:0,reason:e instanceof Error?e.message:"Indexer unavailable"});})
   .finally(()=>{if(live)setBusy(false);});
  return()=>{live=false;};
 },[mint,tf,tick,valid]);
 const volume=result?.snapshot;
 const observed=useMemo(()=>volume?.bars.filter(x=>x.observed).length??0,[volume]);
 return <section className="rounded-[20px] border border-cyan-300/15 bg-[#091422] p-3 sm:p-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="font-mono text-[10px] tracking-[.19em] text-cyan-300">SENDA NATIVE VOLUME / SOLSCAN INDEXER</p>
    <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold"><BarChart3 className="size-5 text-cyan-300"/>{symbol} On-chain flow</h3>
    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/45">Actual indexed swaps paired directly against USDC. Buy/sell volume bars are observed USDC notional, not fabricated liquidity or resting bids/asks.</p>
   </div>
   <div className="flex flex-wrap items-center gap-1">
    {timeframes.map(x=><button key={x} type="button" onClick={()=>setTf(x)} className={`min-h-9 rounded-lg px-3 font-mono text-xs ${tf===x?"bg-cyan-300 text-[#071524]":"border border-white/10 text-white/60"}`}>{x}</button>)}
    <button type="button" onClick={()=>setTick(n=>n+1)} disabled={busy} aria-label="Refresh native Solscan volume" className="grid size-9 place-items-center rounded-lg border border-white/10 text-white/60 disabled:opacity-40"><RefreshCw className={`size-4 ${busy?"animate-spin":""}`}/></button>
   </div>
  </div>
  {busy?<p className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-5 font-mono text-xs text-white/55">Querying indexed on-chain swap receipts…</p>:volume?<div className="mt-4">
   <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
    {[
      ["Observed notional",cash(volume.observedUsd)],
      ["Buy USDC",cash(volume.buyUsd)],
      ["Sell USDC",cash(volume.sellUsd)],
      ["Priced swaps",fmt(volume.pricedSwaps)],
      ["Unpriced/gaps",fmt(volume.unpricedSwaps)],
    ].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-[10px] text-white/40">{label}</p><p className="mt-1 font-mono text-base font-semibold">{value}</p></div>)}
   </div>
   <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px]">
    <span className="flex items-center gap-3 text-white/55"><span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[#24d7b0]"/>USDC → token</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[#f17a90]"/>token → USDC</span></span>
    <span className={volume.complete?"text-cyan-300":"text-amber-300"}>{volume.complete?"API pages exhausted":"Sampled / page limit"} · {observed}/{volume.bars.length} observed bars</span>
   </div>
   <div className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-[#060d19] p-2"><VolumeBars bars={volume.bars} complete={volume.complete}/></div>
   <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-white/55"><Database className="mt-0.5 size-4 shrink-0 text-cyan-300"/>{volume.note} Source snapshot {new Date(volume.observedAt).toLocaleString()}. Direct USDC pairs only: Jupiter token-wide turnover and GeckoTerminal pool OHLCV have different coverage and must not be added to this series.</p>
   <p className="mt-2 text-[11px] text-amber-200/70">{result?.reason}</p>
  </div>:<div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
   <p className="flex items-center gap-2 text-xs font-semibold text-amber-200"><ShieldAlert className="size-4"/>{result?.state==="unconfigured"?"Solscan Pro connection not configured":"On-chain volume unavailable"}</p>
   <p className="mt-2 text-xs leading-relaxed text-white/55">{result?.reason??"No market or source selected."} Volume bars are unavailable, not zero.</p>
  </div>}
  <div className="mt-3 flex justify-between gap-3"><a href={`https://solscan.io/token/${mint}#defiactivities`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-300">Inspect token activity <ArrowUpRight className="size-3"/></a><p className="text-[10px] text-white/35">No automated wallet execution</p></div>
 </section>;
}
