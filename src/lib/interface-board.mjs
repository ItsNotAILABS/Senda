/** Senda Interface Studio: versioned, browser-local review planning, not a production deployer. */
export const BOARD_KEY = "senda.interface-board.v1";
export const BOARD_VERSION = 1;
export const STATUSES = Object.freeze([
  { id: "backlog", title: "To design", detail: "Scoped, not implemented" },
  { id: "in-progress", title: "In progress", detail: "Work or prototypes underway" },
  { id: "review", title: "In review", detail: "Check against acceptance criteria" },
  { id: "ready", title: "Ready for merge", detail: "Manually verified; not deployed" },
]);
export const QA_KEYS = Object.freeze(["desktop", "mobile", "accessibility", "finance-safety", "build"]);
export const QA_LABELS = Object.freeze({
  desktop: "Desktop layout reviewed",
  mobile: "Mobile layout reviewed",
  accessibility: "Keyboard / contrast checked",
  "finance-safety": "Wallet and financial truth checked",
  build: "TypeScript / build evidence attached",
});
export const SCREENS = Object.freeze([
  { id: "home", label: "Home", path: "/", group: "Experience", priority: "critical" },
  { id: "trade", label: "Trade", path: "/invest", group: "Markets", priority: "critical" },
  { id: "markets", label: "Markets", path: "/wire", group: "Markets", priority: "high" },
  { id: "prestocks", label: "PreStocks", path: "/pre", group: "Markets", priority: "high" },
  { id: "portfolio", label: "Portfolio", path: "/vault", group: "Finance", priority: "critical" },
  { id: "wallet", label: "Wallet / Swap", path: "/wallet", group: "Finance", priority: "critical" },
  { id: "agents", label: "AI Agents", path: "/agents", group: "Intelligence", priority: "high" },
  { id: "genesis", label: "Genesis characters", path: "/agents/genesis", group: "Intelligence", priority: "high", note: "Proposed in PR #7; not yet on main" },
  { id: "predict", label: "Predict", path: "/social", group: "Experience", priority: "medium" },
  { id: "pay", label: "Pay / Cards", path: "/cards", group: "Finance", priority: "high" },
  { id: "send", label: "Payments", path: "/payments", group: "Finance", priority: "high" },
  { id: "work", label: "Work", path: "/work", group: "Experience", priority: "medium" },
  { id: "responsive", label: "Global navigation", path: "/", group: "Foundation", priority: "critical" },
]);
const seed = [
  ["ui-01", "Home: tighten the first 30 seconds", "home", "critical", "Clarify wallet connection, the first tradable action, and real market loading states.", "Visible primary action, obvious loading/empty states, no implied funded balances."],
  ["ui-02", "Trading terminal: chart, order ticket and risk", "trade", "critical", "Move chart, trade size, quote and wallet authorization into a consistent laptop-first terminal.", "Quote provenance, slippage, risk, and signature boundaries visible at every breakpoint."],
  ["ui-03", "Markets: sortable and honest live tape", "markets", "high", "Prioritize search, market filters, volume-source indicators and reliable empty states.", "No synthetic turnover, no unspecified freshness; keyboard-accessible table."],
  ["ui-04", "Portfolio: holdings without seeded figures", "portfolio", "critical", "Create a readable wallet-native account composition with pending/finalized transaction states.", "Zero wallet means zero holdings; never suggest unsourced performance."],
  ["ui-05", "Swap: visible execution and recovery steps", "wallet", "critical", "Show route, minimum received, fees, wallet signer and after-send confirmation clearly.", "No success receipt on broadcast alone; timeout recovery is explicit."],
  ["ui-06", "Agents: runtime control center", "agents", "high", "Visualize bounded missions, tools, logs, permissions and agent approval gates.", "Paused workers never sign; every queue has current scope and budget."],
  ["ui-07", "Genesis: character and gear interface", "genesis", "high", "Unify six character cards, verified ownership, loadouts and executable research briefs.", "Unminted art remains labeled blueprint; NFT equipment cannot authorize a trade."],
  ["ui-08", "Predict: distinguish practice from staking", "predict", "high", "Present market game state, chain-backed pots, practice balances and settlement truth separately.", "No manufactured wins or payouts; legal/eligibility disclosures remain visible."],
  ["ui-09", "Wallet: transaction explorer and empty state", "send", "high", "Make payment composition, wallet choice, destination and confirmed receipt legible.", "No fictional debit/card settlement; recipient and amount reviewed before signature."],
  ["ui-10", "Navigation: desktop and mobile parity", "responsive", "critical", "Consolidate the large product menu with clear categories and a real mobile navigation hierarchy.", "All key routes accessible by keyboard and phone; no links to unsupported live claims."],
  ["ui-11", "PreStocks: data provenance and market status", "prestocks", "high", "Separate a company valuation mark from an on-chain executable quote.", "Unpriced assets never display a fabricated buy price; instrument eligibility visible."],
  ["ui-12", "Pay: card capability disclosure", "pay", "high", "Make real wallet USDC payments distinct from unsupported payment-card checkout.", "UI clearly states whether a real merchant can charge the method."],
];
const priority = new Set(["critical", "high", "medium", "low"]);
const status = new Set(STATUSES.map(s=>s.id));
const screens = new Set(SCREENS.map(s=>s.id));
const textField=(v,max)=>typeof v==="string" ? v.trim().slice(0,max) : "";
const safeUrl=(url)=>typeof url==="string" && /^https:\/\/github\.com\/ItsNotAILABS\/Senda\/pull\/\d+(?:[/?#].*)?$/i.test(url.trim())?url.trim():"";
export function createSeedBoard(){
  return { version:BOARD_VERSION, updatedAt:null,
    items:seed.map(([id,title,screen,level,description,acceptance])=>({
      id,title,screen,priority:level,description,acceptance,status:"backlog",owner:"Unassigned",
      qa:Object.fromEntries(QA_KEYS.map(k=>[k,false])),evidenceUrl:"",note:"",updatedAt:null
    }))
  };
}
export function sanitizeBoardItem(input){
 if(!input||typeof input!=="object")throw Error("Invalid board item.");
 const id=textField(input.id,80);
 const title=textField(input.title,150);
 if(!/^[a-zA-Z0-9_-]{3,80}$/.test(id)||!title)throw Error("Board item requires an ID and title.");
 if(!screens.has(input.screen))throw Error("Unknown Senda screen.");
 if(!priority.has(input.priority)||!status.has(input.status))throw Error("Unknown priority or stage.");
 const qa=Object.fromEntries(QA_KEYS.map(k=>[k,input.qa?.[k]===true]));
 const item={id,title,screen:input.screen,priority:input.priority,status:input.status,
  owner:textField(input.owner,80)||"Unassigned",description:textField(input.description,1200),
  acceptance:textField(input.acceptance,1200),note:textField(input.note,2000),
  evidenceUrl:safeUrl(input.evidenceUrl),qa,
  updatedAt: typeof input.updatedAt==="string" && !Number.isNaN(Date.parse(input.updatedAt)) ? input.updatedAt : null};
 if(item.status==="ready"&&!canMarkReady(item))throw Error("Ready for merge requires all review checks and a Senda pull request link.");
 return item;
}
export function canMarkReady(item){
 return QA_KEYS.every(k=>item.qa?.[k]===true)&&Boolean(safeUrl(item.evidenceUrl));
}
export function parseBoard(raw) {
 let input;
 try {input=typeof raw==="string"?JSON.parse(raw):raw;}catch{throw Error("Board JSON is unreadable.");}
 if(!input||typeof input!=="object"||Array.isArray(input)||input.version!==BOARD_VERSION||!Array.isArray(input.items)||input.items.length>300)throw Error("Unsupported Senda board format.");
 const items=input.items.map(sanitizeBoardItem);
 if(new Set(items.map(x=>x.id)).size!==items.length)throw Error("Board contains duplicate task IDs.");
 return {version:BOARD_VERSION,updatedAt:typeof input.updatedAt==="string"?input.updatedAt:null,items};
}
export function readBoard(storage){
 const raw=storage.getItem(BOARD_KEY);
 if(raw==null)return createSeedBoard();
 return parseBoard(raw);
}
export function writeBoard(storage,board){
 const clean=parseBoard(board);
 const saved={...clean,updatedAt:new Date().toISOString()};
 storage.setItem(BOARD_KEY,JSON.stringify(saved));
 return saved;
}
export function upsertBoardItem(board,input){
 const normalized=sanitizeBoardItem(input);
 const items=[...board.items];
 const found=items.findIndex(x=>x.id===normalized.id);
 if(found===-1)items.push(normalized);else items[found]=normalized;
 return parseBoard({...board,items});
}
export function moveBoardItem(board,id,to){
 const item=board.items.find(row=>row.id===id);
 if(!item)throw Error("Task does not exist.");
 if(!status.has(to))throw Error("Unknown stage.");
 return upsertBoardItem(board,{...item,status:to,updatedAt:new Date().toISOString()});
}
export function removeBoardItem(board,id){
 return parseBoard({...board,items:board.items.filter(i=>i.id!==id)});
}
export function makeAgentBrief(item){
 const c=sanitizeBoardItem(item);
 const screen=SCREENS.find(x=>x.id===c.screen);
 return [
 "# Senda Interface Mission · "+c.title,"",
 "Repository: ItsNotAILABS/Senda",
 "Target screen: "+screen.label+" ("+screen.path+")",
 "Priority: "+c.priority,
 "Objective: "+c.description,
 "Acceptance: "+c.acceptance,
 "Constraints: preserve wallet-signing authority; no fictional prices, balances, transactions, media or permissions; maintain responsive design and keyboard accessibility.",
 "Execution: inspect current main and open PRs; create a review branch; implement with regression tests; run npm run typecheck and npm run build:dev.",
 "Review evidence: "+(c.evidenceUrl||"No PR attached yet."),
 "Human release gate: never merge, deploy, or change mainnet trading behavior just because this board says ready.",
 ""
 ].join("\n");
}
