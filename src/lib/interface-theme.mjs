/** Guarded, browser-local design preview. Never writes to server or modifies traded asset state. */
export const THEME_KEY="senda.interface-theme.v1";
export const THEME_EVENT="senda-interface-theme";
export const PRESETS=Object.freeze([
 {id:"senda-original",name:"Original Lime",accent:"#d6ff4a",background:"#07080d",surface:"#10131c",elevated:"#171b27",border:"#232838",muted:"#a7adbe",description:"Current production-inspired Senda tone"},
 {id:"genesis-cyan",name:"Genesis Cyan",accent:"#51dbf8",background:"#060b15",surface:"#0b1626",elevated:"#122338",border:"#24445c",muted:"#a8c8dc",description:"Raven and Genesis intelligence language"},
 {id:"solana-violet",name:"Solana Violet",accent:"#c78bff",background:"#080712",surface:"#141023",elevated:"#241b39",border:"#3e3152",muted:"#c7bbd8",description:"Strategy studio and collectibles"},
 {id:"guardian-gold",name:"Guardian Gold",accent:"#ffd080",background:"#0e0c0a",surface:"#1b1714",elevated:"#2b241d",border:"#493a2b",muted:"#ddc4a8",description:"Risk and portfolio surfaces"},
]);
const lookup=new Map(PRESETS.map(p=>[p.id,p]));
const hex=/^#[a-fA-F0-9]{6}$/;
export function themeDraft(input){
 if(!input||typeof input!=="object")throw Error("Invalid interface theme.");
 const preset=lookup.get(input.preset);
 if(!preset)throw Error("Choose a known Senda theme preset.");
 const accent=typeof input.accent==="string"&&hex.test(input.accent)?input.accent.toLowerCase():preset.accent;
 const density=input.density==="compact"?"compact":"comfortable";
 const fontSize=input.fontSize==="large"?"large":"standard";
 return {version:1,preset:preset.id,accent,density,fontSize,enabled:input.enabled===true};
}
export function defaultTheme(){return themeDraft({preset:"senda-original",enabled:false});}
export function readTheme(storage){
 const raw=storage?.getItem(THEME_KEY);
 if(!raw)return defaultTheme();
 try{return themeDraft(JSON.parse(raw));}catch{return defaultTheme();}
}
export function writeTheme(storage,theme) {
 const next=themeDraft(theme);
 storage.setItem(THEME_KEY,JSON.stringify(next));
 return next;
}
export function cssVars(theme) {
 const v=themeDraft(theme),preset=lookup.get(v.preset);
 return v.enabled?{
  "--color-bg":preset.background,
  "--color-surface":preset.surface,
  "--color-elevated":preset.elevated,
  "--color-border":preset.border,
  "--color-muted":preset.muted,
  "--color-accent":v.accent,
  "--color-accent-fg":"#071018",
 }:{}; 
}
const OVERRIDABLE=["--color-bg","--color-surface","--color-elevated","--color-border","--color-muted","--color-accent","--color-accent-fg"];
export function applyTheme(doc,theme) {
 if(!doc?.documentElement?.style)return;
 const state=themeDraft(theme);
 for(const key of OVERRIDABLE)doc.documentElement.style.removeProperty(key);
 const vars=cssVars(state);
 for(const [key,value] of Object.entries(vars))doc.documentElement.style.setProperty(key,value);
 doc.documentElement.dataset.sendaDensity=state.enabled?state.density:"";
 doc.documentElement.dataset.sendaFont=state.enabled?state.fontSize:"";
}
