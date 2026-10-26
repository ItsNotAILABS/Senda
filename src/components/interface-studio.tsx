import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDownToLine, ArrowUpRight, Check, CheckCircle2, ChevronDown, CircleDot, Clipboard,
  Columns3, Copy, ExternalLink, FileJson2, LayoutDashboard, Monitor, Palette, Plus,
  RotateCcw, Search, ShieldAlert, Smartphone, SlidersHorizontal, Sparkles, Trash2, X
} from "lucide-react";
import { toast } from "sonner";
import {
  BOARD_KEY, QA_KEYS, QA_LABELS, SCREENS, STATUSES, canMarkReady, createSeedBoard,
  makeAgentBrief, moveBoardItem, parseBoard, readBoard, removeBoardItem, upsertBoardItem,
  writeBoard, type BoardItem, type BoardPriority, type BoardStatus, type SendaBoard
} from "@/lib/interface-board.mjs";
import { PRESETS, THEME_EVENT, defaultTheme, readTheme, themeDraft, writeTheme, type InterfaceTheme } from "@/lib/interface-theme.mjs";

const PRIORITIES: BoardPriority[] = ["critical", "high", "medium", "low"];
const statusColor:Record<BoardStatus,string>={
 backlog:"text-white/60 bg-white/[0.05]", "in-progress":"text-cyan-300 bg-cyan-400/10",
 review:"text-amber-300 bg-amber-400/10",ready:"text-emerald-300 bg-emerald-400/10"
};
const priorityColor:Record<BoardPriority,string>={
 critical:"text-rose-300 border-rose-500/30",high:"text-amber-300 border-amber-400/20",
 medium:"text-cyan-300 border-cyan-400/20",low:"text-white/50 border-white/10"
};
const ctrl="min-h-10 w-full rounded-xl border border-white/15 bg-[#121b29] px-3 text-sm text-white outline-none focus:border-cyan-300/60";
const blank=(screen:string):BoardItem=>({
 id:"ui-"+(typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID().replaceAll("-","").slice(0,14):Math.floor(Math.random()*1e12).toString(36)),
 title:"",screen,priority:"medium",status:"backlog",owner:"Unassigned",description:"",
 acceptance:"",note:"",evidenceUrl:"",
 qa:{desktop:false,mobile:false,accessibility:false,"finance-safety":false,build:false},updatedAt:null
});
function download(name:string,body:string) {
 const blob=new Blob([body],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function screenFor(id:string){return SCREENS.find(s=>s.id===id)??SCREENS[0];}
function compactColor(color:string){return /^#[a-fA-F0-9]{6}$/.test(color)?color:"#51dbf8";}
function DemoTerminal({ theme, device }:{theme:InterfaceTheme;device:"desktop"|"mobile"}) {
 const base=PRESETS.find(x=>x.id===theme.preset)??PRESETS[0];
 const color=compactColor(theme.accent);
 const narrow=device==="mobile";
 const surface:CSSProperties={backgroundColor:base.surface,borderColor:base.border,color:"#f4f7ff"};
 return <div className={`mx-auto overflow-hidden rounded-[20px] border border-white/15 shadow-[0_20px_75px_#0008] transition-[width] duration-300 ${narrow?"max-w-[340px]":"w-full"}`} style={{...surface,zoom:theme.fontSize==="large"?1.04:1}}>
  <div className="flex items-center justify-between border-b px-3 py-2" style={{borderColor:base.border}}>
   <div className="flex items-center gap-2 font-semibold"><span className="grid size-6 place-items-center rounded-lg" style={{background:color,color:base.background}}>S</span><span>Senda</span></div>
   <span className="font-mono text-[10px]" style={{color}}>LAYOUT SANDBOX</span>
  </div>
  <div className={`grid gap-2 p-3 ${narrow?"":"grid-cols-[1fr_170px]"}`} style={{background:base.background}}>
   <div className="min-w-0 rounded-xl border p-3" style={surface}>
    <div className="flex items-center justify-between gap-2">
     <div><p className="font-mono text-[9px] uppercase tracking-widest opacity-50">Trading layout / Placeholder</p><p className="mt-1 text-sm font-semibold">Market chart</p></div>
     <span className="rounded-full px-2 py-1 text-[10px]" style={{background:color+"20",color}}>Data: —</span>
    </div>
    <div className="relative mt-3 h-32 overflow-hidden rounded-lg border" style={{borderColor:base.border,background:"repeating-linear-gradient(0deg, transparent 0px, transparent 27px, "+base.border+"70 28px),repeating-linear-gradient(90deg,transparent 0px,transparent 45px,"+base.border+"55 46px)"}}>
     <svg aria-hidden="true" viewBox="0 0 360 125" className="absolute inset-0 h-full w-full">
      <path d="M0 103 L35 91 L65 99 L100 69 L135 82 L165 52 L190 61 L219 42 L247 57 L285 25 L309 40 L358 19" stroke={color} strokeWidth="2.5" fill="none" strokeDasharray="7 6" opacity=".7"/>
      <path d="M0 124 L0 103 L35 91 L65 99 L100 69 L135 82 L165 52 L190 61 L219 42 L247 57 L285 25 L309 40 L358 19 L358 125Z" fill={color} opacity=".07"/>
     </svg>
     <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 font-mono text-[9px] text-white/65">DESIGN SHAPE · NOT PRICE DATA</span>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-1">
     {["Volume", "Liquidity", "Open interest"].map(a=><div key={a} className="rounded-lg border p-2" style={{borderColor:base.border}}>
      <p className="truncate text-[9px] opacity-55">{a}</p><p className="mt-1 font-mono text-xs">—</p></div>)}
    </div>
   </div>
   <div className="rounded-xl border p-3" style={surface}>
    <p className="text-[10px] opacity-50">ORDER TICKET / VISUAL ONLY</p>
    <p className="mt-1 text-sm font-semibold">Trade controls</p>
    <div className="mt-3 space-y-2">
     {["Asset", "Size", "Expected output"].map(x=><div key={x} className="rounded-lg border p-2" style={{borderColor:base.border}}><p className="text-[10px] opacity-55">{x}</p><p className="font-mono text-xs">—</p></div>)}
    </div>
    <div className="mt-3 rounded-lg py-2 text-center text-[11px] font-bold" style={{background:color,color:base.background}}>Wallet signs · concept</div>
   </div>
  </div>
  <div className="flex justify-between px-3 py-2 font-mono text-[9px] opacity-60"><span>{narrow?"340px MOBILE":"DESKTOP ADAPTIVE"}</span><span>{theme.density.toUpperCase()} DENSITY</span></div>
 </div>;
}
export function InterfaceStudio() {
 const [board,setBoard]=useState<SendaBoard>(createSeedBoard);
 const [loaded,setLoaded]=useState(false);
 const [loadError,setLoadError]=useState("");
 const [selection,setSelection]=useState<string|null>(null);
 const [editing,setEditing]=useState<BoardItem|null>(null);
 const [query,setQuery]=useState("");
 const [screenFilter,setScreenFilter]=useState("all");
 const [showDone,setShowDone]=useState(true);
 const [tab,setTab]=useState<"board"|"screens"|"appearance">("board");
 const [theme,setTheme]=useState<InterfaceTheme>(defaultTheme);
 const [device,setDevice]=useState<"desktop"|"mobile">("desktop");
 const [themeDirty,setThemeDirty]=useState(false);
 const fileRef=useRef<HTMLInputElement|null>(null);
 const navigate=useNavigate();
 useEffect(()=>{
   try{setBoard(readBoard(window.localStorage));setTheme(readTheme(window.localStorage));}
   catch(e){setLoadError(e instanceof Error?e.message:"Could not read saved interface tasks.");}
   setLoaded(true);
 },[]);
 const filtered=useMemo(()=>board.items.filter(x=>
  (screenFilter==="all"||x.screen===screenFilter)&&
  (showDone||x.status!=="ready")&&
  (!query||[x.title,x.description,x.screen,x.owner].join(" ").toLowerCase().includes(query.toLowerCase()))
 ),[board,screenFilter,showDone,query]);
 const selected=board.items.find(x=>x.id===selection)??null;
 const counts=Object.fromEntries(STATUSES.map(s=>[s.id,board.items.filter(x=>x.status===s.id).length]));
 const audited=board.items.filter(x=>x.status==="ready").length;
 function commit(next:SendaBoard) {
   try{const saved=writeBoard(window.localStorage,next);setBoard(saved);setLoadError("");}
   catch(e){toast.error(e instanceof Error?e.message:"Could not save to this browser.");}
 }
 function saveEditor() {
   if(!editing)return;
   try {
     const next=upsertBoardItem(board,{...editing,updatedAt:new Date().toISOString()});
     commit(next);setSelection(editing.id);setEditing(null);toast.success("Design task saved locally.");
   }catch(e){toast.error(e instanceof Error?e.message:"Task is invalid.");}
 }
 function move(item:BoardItem,to:BoardStatus) {
   try{commit(moveBoardItem(board,item.id,to));}
   catch(e){toast.error(e instanceof Error?e.message:"Review checks are missing.");}
 }
 function check(item:BoardItem,key:string,checked:boolean) {
   commit(upsertBoardItem(board,{...item,status:item.status==="ready"?"review":item.status,qa:{...item.qa,[key]:checked}}));
 }
 async function copyBrief(item:BoardItem) {
   try{await navigator.clipboard.writeText(makeAgentBrief(item));toast.success("Agent-ready mission copied.");}
   catch{toast.error("Copy permission unavailable. Export the board instead.");}
 }
 function exportBoard(){
   download("senda-interface-board-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(board,null,2)+"\n");
   toast.success("Local board exported.");
 }
 async function importBoard(file:File|undefined) {
   if(!file)return;
   if(file.size>350_000){toast.error("Board JSON is too large.");return;}
   try {const next=parseBoard(await file.text());commit(next);setSelection(null);toast.success("Validated board imported. No website changes were deployed.");}
   catch(e){toast.error(e instanceof Error?e.message:"Import rejected.");}
   if(fileRef.current)fileRef.current.value="";
 }
 function saveTheme(next:InterfaceTheme){
   try{
     const saved=writeTheme(window.localStorage,next);
     setTheme(saved);setThemeDirty(false);
     window.dispatchEvent(new Event(THEME_EVENT));
     toast.success(saved.enabled?"Appearance enabled for this browser only.":"Appearance draft saved; live preview disabled.");
   }catch(e){toast.error(e instanceof Error?e.message:"Could not save appearance.");}
 }
 function updateTheme(patch:Partial<InterfaceTheme>){setTheme(v=>themeDraft({...v,...patch}));setThemeDirty(true);}
 return (
 <main className="min-h-screen bg-[#060913] text-white">
  <div className="mx-auto max-w-[1640px] p-4 sm:p-5 xl:p-7">
   <section className="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-[radial-gradient(ellipse_at_77%_-20%,#204465_0%,#0b1726_40%,#080d17_80%)] p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
     <div><p className="font-mono text-[10px] uppercase tracking-[.28em] text-cyan-300">SENDA / PRODUCT OPERATIONS</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Interface Studio</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">A permanent design-review board for the Senda trading ecosystem. Work through each screen, test responsive layouts and record what can actually ship.</p>
     </div>
     <div className="flex flex-wrap gap-2">
      <button onClick={exportBoard} type="button" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold"><ArrowDownToLine className="size-4"/>Export JSON</button>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e=>void importBoard(e.currentTarget.files?.[0])}/>
      <button type="button" onClick={()=>fileRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold"><FileJson2 className="size-4"/>Import</button>
      <button type="button" onClick={()=>{setEditing(blank(screenFilter==="all"?"home":screenFilter));setTab("board");}} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-[#071320]"><Plus className="size-4"/>New task</button>
     </div>
    </div>
    <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
     {[["PRODUCT SCREENS",SCREENS.length,"Indexed from current route map"],["REVIEW TASKS",board.items.length,"Browser-local, exportable"],["READY FOR MERGE",audited,"Requires five QA gates + PR"],["OPEN BACKLOG",board.items.length-audited,"Not deployed"]].map(([head,n,detail])=>
      <div key={head} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="font-mono text-[10px] tracking-[.12em] text-white/45">{head}</p><p className="mt-1 text-2xl font-semibold">{n}</p><p className="mt-1 text-[11px] text-white/45">{detail}</p></div>)}
    </div>
   </section>
   {loadError?<div role="alert" className="mt-3 rounded-xl border border-rose-300/30 bg-rose-900/15 p-3 text-xs text-rose-200">{loadError} Import a verified board backup or reset local state after exporting any salvageable data.</div>:null}
   <div className="mt-4 flex flex-wrap gap-2 border-b border-white/10 pb-3">
    {([["board","Review board",Columns3],["screens","Screen inventory",LayoutDashboard],["appearance","Appearance lab",Palette]] as const).map(([id,label,Icon])=>
     <button key={id} type="button" onClick={()=>setTab(id)} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${tab===id?"bg-white/12 text-white":"text-white/50 hover:bg-white/5"}`}><Icon className="size-4"/>{label}</button>)}
    <span className="ml-auto self-center font-mono text-[10px] text-white/35">{loaded?"Saved in this browser · not deployed":"Loading local board..."}</span>
   </div>

   {tab==="board"&&<>
    <div className="mt-4 flex flex-wrap items-center gap-2">
     <div className="relative min-w-[220px] flex-1"><Search className="absolute top-3 left-3 size-4 text-white/40"/><input className={ctrl+" pl-9"} placeholder="Search screen, task, owner…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
     <select aria-label="Filter by screen" className="min-h-10 rounded-xl border border-white/15 bg-[#121b29] px-3 text-xs" value={screenFilter} onChange={e=>setScreenFilter(e.target.value)}><option value="all">All screens</option>{SCREENS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select>
     <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-white/65"><input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)}/>Include reviewed</label>
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
     {STATUSES.map(s=><section key={s.id} className="min-w-0 rounded-2xl border border-white/10 bg-[#0b111e] p-3">
      <header className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold">{s.title}</h2><p className="mt-1 text-[11px] text-white/40">{s.detail}</p></div><span className={"rounded-lg px-2 py-1 font-mono text-xs "+statusColor[s.id]}>{counts[s.id]}</span></header>
      <div className="space-y-2">{filtered.filter(x=>x.status===s.id).map(item=>{
       const screen=screenFor(item.screen),checked=QA_KEYS.filter(k=>item.qa[k]).length;
       return <article key={item.id} className={`rounded-xl border p-3 transition ${selection===item.id?"border-cyan-300/50 bg-[#152333]":"border-white/[0.08] bg-[#101927] hover:border-white/20"}`}>
        <button onClick={()=>setSelection(item.id)} type="button" className="w-full text-left">
         <div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[10px] text-cyan-300">{screen.label} / {item.id}</span><span className={"rounded-full border px-2 py-0.5 text-[9px] uppercase "+priorityColor[item.priority]}>{item.priority}</span></div>
         <h3 className="mt-2 text-[13px] font-semibold leading-snug">{item.title}</h3>
         <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/45">{item.description}</p>
        </button>
        <div className="mt-3 flex items-center gap-2"><div className="h-1 flex-1 rounded-full bg-white/10"><div className="h-1 rounded-full bg-cyan-300" style={{width:`${checked/QA_KEYS.length*100}%`}}/></div><span className="font-mono text-[10px] text-white/45">{checked}/5</span></div>
        <div className="mt-3 flex items-center gap-2">
         <select aria-label={`Move ${item.title}`} className="min-h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#172030] px-2 text-[11px]" value={item.status} onChange={e=>move(item,e.target.value as BoardStatus)}>{STATUSES.map(opt=><option key={opt.id} value={opt.id}>{opt.title}</option>)}</select>
         <button type="button" title="Edit task" onClick={()=>{setEditing({...item,qa:{...item.qa}});setSelection(item.id);}} className="grid size-9 place-items-center rounded-lg border border-white/10 text-white/60 hover:text-white"><SlidersHorizontal className="size-4"/></button>
        </div>
       </article>;
      })}{filtered.filter(x=>x.status===s.id).length===0?<p className="rounded-xl border border-dashed border-white/10 px-3 py-7 text-center text-xs text-white/30">Nothing in this stage</p>:null}</div>
     </section>)}
    </div>
    {selected&&<section className="mt-4 grid gap-4 rounded-2xl border border-cyan-300/20 bg-[#0b1623] p-4 lg:grid-cols-[1fr_320px]">
     <div><div className="flex items-center justify-between gap-2"><p className="font-mono text-[10px] tracking-widest text-cyan-300">TASK REVIEW / {selected.id}</p><button title="Close details" onClick={()=>setSelection(null)} className="p-1 text-white/40"><X className="size-4"/></button></div>
      <h3 className="mt-2 text-xl font-semibold">{selected.title}</h3><p className="mt-2 text-sm leading-relaxed text-white/55">{selected.description}</p>
      <p className="mt-3 text-xs font-semibold text-white/70">Acceptance criteria</p><p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-white/50">{selected.acceptance||"No acceptance criteria supplied."}</p>
      <div className="mt-4 flex flex-wrap gap-2">
       <button onClick={()=>setEditing({...selected,qa:{...selected.qa}})} className="min-h-10 rounded-xl border border-white/15 px-3 text-xs">Edit task</button>
       <button onClick={()=>void copyBrief(selected)} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-white/15 px-3 text-xs"><Copy className="size-3.5"/>Copy agent mission</button>
       <a href={screenFor(selected.screen).path} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-white/15 px-3 py-3 text-xs"><ExternalLink className="size-3.5"/>Open app screen</a>
      </div>
      {selected.evidenceUrl?<a href={selected.evidenceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-300 underline">Linked GitHub PR <ArrowUpRight className="size-3.5"/></a>:<p className="mt-3 text-[11px] text-amber-200/65">No reviewed GitHub PR linked yet.</p>}
     </div>
     <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="mb-3 font-mono text-[10px] text-white/50">RELEASE EVIDENCE GATES</p>
      {QA_KEYS.map(k=><label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg py-2 text-xs text-white/70"><input type="checkbox" checked={selected.qa[k]} onChange={e=>check(selected,k,e.target.checked)} className="accent-cyan-300"/>{QA_LABELS[k]}</label>)}
      <div className={`mt-3 rounded-xl p-3 text-xs ${canMarkReady(selected)?"bg-emerald-300/10 text-emerald-200":"bg-amber-300/10 text-amber-200"}`}>{canMarkReady(selected)?"All five self-reported checks complete with PR link. Human review is still required.":"Merge-ready is locked until all five checks and a valid Senda PR URL are provided."}</div>
     </div>
    </section>}
   </>}

   {tab==="screens"&&<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {SCREENS.map(screen=>{
      const items=board.items.filter(t=>t.screen===screen.id);
      const done=items.filter(t=>t.status==="ready").length;
      return <article key={screen.id} className="rounded-2xl border border-white/10 bg-[#0d1421] p-4">
       <div className="flex items-start justify-between gap-2"><div><span className="font-mono text-[10px] text-cyan-300">{screen.group}</span><h3 className="mt-1 text-lg font-semibold">{screen.label}</h3></div><span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[10px] text-white/45">{screen.priority}</span></div>
       <p className="mt-1 font-mono text-[11px] text-white/40">{screen.path}</p>{screen.note?<p className="mt-2 text-xs text-amber-200/70">{screen.note}</p>:null}
       <div className="mt-4 flex items-center justify-between text-xs text-white/50"><span>{items.length} tasks</span><span>{done} reviewed</span></div>
       <div className="mt-2 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300" style={{width:`${items.length?done/items.length*100:0}%`}}/></div>
       <div className="mt-4 flex gap-2">
        <button onClick={()=>{setScreenFilter(screen.id);setTab("board");}} className="min-h-9 flex-1 rounded-lg border border-white/15 px-3 text-xs">Review tasks</button>
        <a href={screen.path} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-lg border border-white/15 text-white/70" aria-label={`Open ${screen.label}`}><ArrowUpRight className="size-4"/></a>
       </div>
      </article>;
    })}
   </div>}

   {tab==="appearance"&&<div className="mt-4 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#101826] p-4">
     <div><p className="font-mono text-[10px] tracking-widest text-cyan-300">DESIGN TOKENS</p><h2 className="mt-1 text-xl font-semibold">Appearance lab</h2><p className="mt-2 text-xs leading-relaxed text-white/50">Edit a preset, inspect it in the sandbox, then optionally enable its token overrides only in your current browser.</p></div>
     <div><label className="mb-1 block text-xs text-white/65">Theme preset</label><select className={ctrl} value={theme.preset} onChange={e=>{const p=PRESETS.find(p=>p.id===e.target.value);if(p)updateTheme({preset:p.id,accent:p.accent});}}>{PRESETS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
     <div className="flex items-center justify-between gap-3"><label className="text-xs text-white/65">Brand accent</label><div className="flex items-center gap-2"><span className="font-mono text-xs text-white/45">{theme.accent}</span><input type="color" aria-label="Brand accent color" value={theme.accent} onChange={e=>updateTheme({accent:e.target.value})} className="size-10 cursor-pointer rounded-lg border border-white/10 bg-transparent"/></div></div>
     <div><label className="mb-1 block text-xs text-white/65">Spacing density</label><select className={ctrl} value={theme.density} onChange={e=>updateTheme({density:e.target.value as InterfaceTheme["density"]})}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div>
     <div><label className="mb-1 block text-xs text-white/65">Text scale</label><select className={ctrl} value={theme.fontSize} onChange={e=>updateTheme({fontSize:e.target.value as InterfaceTheme["fontSize"]})}><option value="standard">Standard</option><option value="large">Large</option></select></div>
     <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>saveTheme({...theme,enabled:true})} className="min-h-10 flex-1 rounded-xl bg-cyan-300 px-3 text-xs font-bold text-[#07111d]">Preview in my browser</button>
      <button type="button" onClick={()=>saveTheme({...theme,enabled:false})} className="min-h-10 flex-1 rounded-xl border border-white/15 px-3 text-xs">Save draft only</button>
     </div>
     <button type="button" onClick={()=>saveTheme(defaultTheme())} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-white/55"><RotateCcw className="size-4"/>Reset local overrides</button>
     <p className="text-[11px] text-white/40">{themeDirty?"Unsaved theme edits. The sandbox reflects your draft.":"Theme draft saved."} {theme.enabled?"Local site appearance enabled, not deployed.":"No global site preview applied."}</p>
    </section>
    <section className="min-w-0 rounded-2xl border border-white/10 bg-[#0d1421] p-4">
     <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="font-mono text-[10px] text-cyan-300">RESPONSIVE VISUAL CHECK</p><h2 className="mt-1 text-lg font-semibold">Trading terminal layout study</h2></div><div className="flex rounded-xl border border-white/15 p-1"><button onClick={()=>setDevice("desktop")} className={`inline-flex min-h-8 items-center gap-1 rounded-lg px-3 text-xs ${device==="desktop"?"bg-cyan-300 text-[#07111d]":"text-white/60"}`}><Monitor className="size-4"/>Desktop</button><button onClick={()=>setDevice("mobile")} className={`inline-flex min-h-8 items-center gap-1 rounded-lg px-3 text-xs ${device==="mobile"?"bg-cyan-300 text-[#07111d]":"text-white/60"}`}><Smartphone className="size-4"/>Mobile</button></div></div>
     <div className="rounded-2xl border border-dashed border-white/10 bg-[#060a12] p-3 sm:p-5"><DemoTerminal theme={theme} device={device}/></div>
     <p className="mt-3 text-[11px] text-white/40">This is a static design sandbox, not a snapshot of the live app. Chart shapes and labels are placeholders, not market quotes, simulated portfolio balances, or execution receipts.</p>
     <div className="mt-3 flex flex-wrap gap-2">{PRESETS.map(p=><button type="button" key={p.id} onClick={()=>updateTheme({preset:p.id,accent:p.accent})} className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs ${p.id===theme.preset?"border-cyan-300/60":"border-white/10"}`}><span className="size-3 rounded-full" style={{background:p.accent}}/>{p.name}</button>)}</div>
    </section>
   </div>}

   <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-4 text-[11px] text-white/40"><span>Interface Studio v1 · Browser-only planning · Senda repository is source of truth</span><span>No auto-merge, no auto-deploy, no financial actions</span></footer>
  </div>
  {editing?<div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-3" role="dialog" aria-modal="true" aria-label="Edit interface task">
   <form onSubmit={e=>{e.preventDefault();saveEditor();}} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-[22px] border border-white/20 bg-[#101927] p-5 shadow-2xl">
    <div className="flex items-center justify-between"><div><p className="font-mono text-[10px] text-cyan-300">DESIGN WORK ITEM</p><h2 className="mt-1 text-xl font-semibold">{board.items.some(x=>x.id===editing.id)?"Edit task":"New task"}</h2></div><button type="button" onClick={()=>setEditing(null)} className="p-2 text-white/50"><X className="size-5"/></button></div>
    <label className="block text-xs text-white/60">Task title<input required maxLength={150} className={ctrl+" mt-1"} value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/></label>
    <div className="grid gap-3 sm:grid-cols-3">
     <label className="block text-xs text-white/60">Screen<select className={ctrl+" mt-1"} value={editing.screen} onChange={e=>setEditing({...editing,screen:e.target.value})}>{SCREENS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
     <label className="block text-xs text-white/60">Priority<select className={ctrl+" mt-1"} value={editing.priority} onChange={e=>setEditing({...editing,priority:e.target.value as BoardPriority})}>{PRIORITIES.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
     <label className="block text-xs text-white/60">Owner<input className={ctrl+" mt-1"} value={editing.owner} maxLength={80} onChange={e=>setEditing({...editing,owner:e.target.value})}/></label>
    </div>
    <label className="block text-xs text-white/60">Design brief<textarea className={ctrl+" mt-1 min-h-[90px] py-3"} maxLength={1200} value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})}/></label>
    <label className="block text-xs text-white/60">Acceptance criteria<textarea className={ctrl+" mt-1 min-h-[85px] py-3"} maxLength={1200} value={editing.acceptance} onChange={e=>setEditing({...editing,acceptance:e.target.value})}/></label>
    <label className="block text-xs text-white/60">Review notes<textarea className={ctrl+" mt-1 min-h-[70px] py-3"} maxLength={2000} value={editing.note} onChange={e=>setEditing({...editing,note:e.target.value})}/></label>
    <label className="block text-xs text-white/60">Senda GitHub PR evidence link<input type="url" className={ctrl+" mt-1"} placeholder="https://github.com/ItsNotAILABS/Senda/pull/..." value={editing.evidenceUrl} onChange={e=>setEditing({...editing,evidenceUrl:e.target.value})}/></label>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
     <button type="button" disabled={!board.items.some(x=>x.id===editing.id)} onClick={()=>{if(!window.confirm("Delete this local design task?"))return;commit(removeBoardItem(board,editing.id));setEditing(null);setSelection(null);}} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-rose-400/20 px-3 text-xs text-rose-300 disabled:opacity-30"><Trash2 className="size-4"/>Delete</button>
     <div className="flex gap-2"><button type="button" onClick={()=>setEditing(null)} className="min-h-10 rounded-xl border border-white/10 px-4 text-xs">Cancel</button><button type="submit" className="min-h-10 rounded-xl bg-cyan-300 px-5 text-xs font-semibold text-[#07111d]">Save design task</button></div>
    </div>
   </form>
  </div>:null}
 </main>
 );
}
