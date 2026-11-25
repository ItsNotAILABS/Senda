import {useEffect,useState} from "react";
const LEGACY_KEYS=["senda.agent.live.kp.v1","senda.table.v1"];
export function AgentSecurityNotice(){
 const [legacyDetected,setLegacyDetected]=useState(false);
 useEffect(()=>{
  // Presence only: never parse, render, upload, or log wallet secrets.
  try{setLegacyDetected(LEGACY_KEYS.some(k=>Boolean(window.localStorage.getItem(k))));}
  catch{setLegacyDetected(false);}
 },[]);
 return <section aria-label="Agent trading security" className="mx-auto mb-4 max-w-[1400px] rounded-2xl border border-amber-400/20 bg-[#141b22] px-4 py-3 text-sm text-white">
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div><p className="text-xs font-mono uppercase tracking-widest text-amber-200">Agent authority / security</p>
    <h3 className="mt-1 font-semibold">Research, assess, propose — do not hand a model your signing key.</h3></div>
   <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70">Risk controls before trading</span>
  </div>
  <p className="mt-2 text-xs leading-relaxed text-white/65">
   PARRALAX pretrade risk, encrypted evidence and governed research workers are separate services under review.
   They do not replace wallet approval, execution simulation, program spending limits, or confirmed settlement.
  </p>
  {legacyDetected?<p role="alert" className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-100">
   A legacy locally stored signing wallet may be present. Do not add funds for unattended trading.
   Preserve recovery access and migrate only with explicit owner approval and verified on-chain balances.
  </p>:<p className="mt-2 text-[11px] text-white/45">
   No key material is read or transmitted by this notice. A locked encrypted vault can conceal legacy records; absence of a warning is not a security certification.
  </p>}
 </section>;
}
