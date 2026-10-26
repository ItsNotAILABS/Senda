/** Senda Genesis: public character identities and pre-mint module blueprints. */
export const CHARACTERS = Object.freeze([
  { id:"sen", name:"SEN", title:"The Market Raven", runtime:"signals", accent:"#45d4ff", rarity:"legendary", summary:"Sees structure beneath the tape.", mission:"Monitor confirmed pool volume, trend and market anomalies.", tools:["book","memory"], gear:"raven-wing", pack:"signal-matrix" },
  { id:"nex", name:"NEX", title:"The Strategy Fox", runtime:"strategies", accent:"#bc70ff", rarity:"epic", summary:"Tests ideas before they become decisions.", mission:"Compare entry rules, state assumptions and risk-reward.", tools:["planner","book"], gear:"fox-mask", pack:"strategy-lab" },
  { id:"kai", name:"KAI", title:"The Guardian Owl", runtime:"risk", accent:"#ffcb76", rarity:"epic", summary:"Protects the boundary, not a fake portfolio.", mission:"Observe volatility, exposure, caps and unsafe signals.", tools:["book","memory"], gear:"owl-eye", pack:"risk-sentinel" },
  { id:"zeno", name:"ZENO", title:"The Market Dragon", runtime:"macro", accent:"#3af2d1", rarity:"legendary", summary:"Maps the wider market picture.", mission:"Research market regimes and cross-instrument questions.", tools:["book","planner"], gear:"dragon-core", pack:"macro-atlas" },
  { id:"orbi", name:"ORBI", title:"The AI Companion", runtime:"orchestrator", accent:"#60baff", rarity:"rare", summary:"Turns research into bounded task plans.", mission:"Break down research missions and recommend the next safe tool.", tools:["planner","notes","book"], gear:"orbi-core", pack:"agent-workflows" },
  { id:"lyra", name:"LYRA", title:"The Creative Spirit", runtime:"creator", accent:"#f481ff", rarity:"epic", summary:"Creates stories grounded in verifiable market context.", mission:"Generate structured creative briefs and explain market concepts.", tools:["notes","planner"], gear:"lyra-crystal", pack:"creator-studio" },
]);
export const GEAR = Object.freeze([
 {id:"raven-wing",name:"Raven Wing",character:"sen",slot:"gear",rarity:"legendary",capability:"volume-profile",description:"Adds a measured relative-volume lens. Never changes trade authorization."},
 {id:"fox-mask",name:"Fox Mask",character:"nex",slot:"gear",rarity:"epic",capability:"strategy-comparison",description:"Adds a second rule comparison to the strategy brief."},
 {id:"owl-eye",name:"Owl Eye",character:"kai",slot:"gear",rarity:"epic",capability:"risk-overlay",description:"Adds volatility and data-completeness warnings."},
 {id:"dragon-core",name:"Dragon Core",character:"zeno",slot:"gear",rarity:"legendary",capability:"regime-lens",description:"Adds an explicit trend and regime interpretation."},
 {id:"orbi-core",name:"Orbi Core",character:"orbi",slot:"gear",rarity:"rare",capability:"task-breakdown",description:"Adds review checkpoints to orchestration notes."},
 {id:"lyra-crystal",name:"Lyra Crystal",character:"lyra",slot:"gear",rarity:"epic",capability:"narrative-layout",description:"Adds a collectible-linked writing format."},
]);
export const CODE_PACKS = Object.freeze([
 {id:"signal-matrix",name:"Signal Matrix",character:"sen",slot:"code",rarity:"epic",capability:"signal-audit",description:"Records transparent indicator assumptions and missing inputs."},
 {id:"strategy-lab",name:"Strategy Lab",character:"nex",slot:"code",rarity:"epic",capability:"strategy-review",description:"Prepares tested rules for human review, never auto-signs."},
 {id:"risk-sentinel",name:"Risk Sentinel",character:"kai",slot:"code",rarity:"legendary",capability:"risk-policy",description:"Produces risk-policy checklists; no wallet authority."},
 {id:"macro-atlas",name:"Macro Atlas",character:"zeno",slot:"code",rarity:"epic",capability:"macro-review",description:"Separates single-asset indicators from unmeasured macro claims."},
 {id:"agent-workflows",name:"Agent Workflows",character:"orbi",slot:"code",rarity:"rare",capability:"mission-receipt",description:"Adds a bounded mission receipt and review gates."},
 {id:"creator-studio",name:"Creator Studio",character:"lyra",slot:"code",rarity:"epic",capability:"content-checks",description:"Adds factuality checks to market storytelling."},
]);
export const DIGITAL_ASSETS = Object.freeze([
 ...CHARACTERS.map(row=>({id:row.id,name:row.name+" — "+row.title,character:row.id,slot:"character",rarity:row.rarity,capability:null,description:row.summary})),
 ...GEAR,...CODE_PACKS,
]);
export function findCharacter(id){return CHARACTERS.find(x=>x.id===id)??null;}
export function findAsset(id){return DIGITAL_ASSETS.find(x=>x.id===id)??null;}
export function blueprintMetadata(id,baseUrl) {
 const item=findAsset(id);if(!item)throw new Error("Unknown Genesis asset.");
 const base=new URL(baseUrl);
 if(base.protocol!=="https:"&&base.hostname!=="localhost")throw new Error("Metadata must use HTTPS.");
 return {
   name:"Senda Genesis · "+item.name,symbol:"SENDAGEN",description:item.description,
   image:new URL(item.slot==="character"?"/genesis/cards/"+item.character+".svg":item.slot==="gear"?"/genesis/gear/"+item.id+".svg":"/genesis/code/"+item.id+".svg",base).toString(),
   external_url:new URL("/agents/genesis",base).toString(),
   attributes:[{trait_type:"Character",value:item.character.toUpperCase()},{trait_type:"Type",value:item.slot},
     {trait_type:"Rarity",value:item.rarity},{trait_type:"Runtime",value:findCharacter(item.character)?.runtime??"unknown"}],
   properties:{category:"image",files:[{uri:new URL(item.slot==="character"?"/genesis/cards/"+item.character+".svg":item.slot==="gear"?"/genesis/gear/"+item.id+".svg":"/genesis/code/"+item.id+".svg",base).toString(),type:"image/svg+xml"}]},
 };
}
