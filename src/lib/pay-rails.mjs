/**
 * SENDA PAY / LIQUIFY: capability registry, not a claimed integration.
 * A discovered corridor is NOT a live payout. This module cannot move funds.
 */
export const FIAT_MARKETS = Object.freeze([
 {id:"MX",country:"Mexico",currency:"MXN",payment:"SPEI",priority:"P0",partner:"Bitso",stage:"partner-required",
  proof:"https://support.bitso.com/hc/en-us/articles/53395992551060-Withdraw-Mexican-pesos-to-a-bank-account-on-Bitso"},
 {id:"BR",country:"Brazil",currency:"BRL",payment:"PIX",priority:"P1",partner:"Bitso Business",stage:"partner-required",
  proof:"https://docs.bitso.com/bitso-api/docs/currency-dictionary"},
 {id:"AR",country:"Argentina",currency:"ARS",payment:"Local bank",priority:"P1",partner:"Bitso Business",stage:"partner-required",
  proof:"https://docs.bitso.com/bitso-api/docs/currency-dictionary"},
 {id:"CO",country:"Colombia",currency:"COP",payment:"Local bank",priority:"P1",partner:"Bitso Business",stage:"partner-required",
  proof:"https://docs.bitso.com/bitso-api/docs/currency-dictionary"},
 {id:"US",country:"United States",currency:"USD",payment:"Bank / ACH",priority:"P1",partner:"Bridge / regulated provider",stage:"research",
  proof:"https://www.bridge.xyz/"},
 {id:"EU",country:"Europe",currency:"EUR",payment:"SEPA",priority:"P2",partner:"Regulated regional provider",stage:"research",
  proof:"https://www.circle.com/"},
]);
export const CRYPTO_ASSETS = Object.freeze([
 {id:"USDC",name:"USD Coin",issuer:"Circle",kind:"stablecoin"},
 {id:"USDT",name:"Tether USD",issuer:"Tether",kind:"stablecoin"},
 {id:"PYUSD",name:"PayPal USD",issuer:"Paxos / PayPal",kind:"stablecoin"},
 {id:"USDG",name:"Global Dollar",issuer:"Paxos",kind:"stablecoin"},
 {id:"SOL",name:"Solana",issuer:"Solana",kind:"native"},
]);
export const NETWORKS = Object.freeze([
 {id:"solana",name:"Solana",ecosystem:"SVM"},
 {id:"ethereum",name:"Ethereum",ecosystem:"EVM"},
 {id:"base",name:"Base",ecosystem:"EVM"},
 {id:"arbitrum",name:"Arbitrum",ecosystem:"EVM"},
 {id:"polygon",name:"Polygon",ecosystem:"EVM"},
 {id:"optimism",name:"Optimism",ecosystem:"EVM"},
 {id:"avalanche",name:"Avalanche",ecosystem:"EVM"},
 {id:"bnb",name:"BNB Chain",ecosystem:"EVM"},
]);
export const RAILS = Object.freeze([
 {id:"solana-wallet",name:"Direct Solana USDC",kind:"wallet-transfer",provider:"Senda Solana Pay",
  status:"wallet-live",networks:["solana"],assets:["USDC"],fiat:[],
  proof:"src/lib/solana-pay.ts",details:"Existing recipient-address transfer; wallet signs and chain confirmation is required."},
 {id:"jupiter-v2",name:"Jupiter Swap V2",kind:"swap",provider:"Jupiter",
  status:"integration",networks:["solana"],assets:["USDC","USDT","PYUSD","USDG","SOL"],fiat:[],
  proof:"https://dev.jup.ag/docs/swap",details:"Indicative quotes / routing; full taker-bound execution must be verified separately."},
 {id:"bitso-mxn",name:"Bitso MXN",kind:"fiat-offramp",provider:"Bitso",
  status:"partner-required",networks:["solana"],assets:["USDC","USDT"],fiat:["MXN"],
  proof:"https://docs.bitso.com/bitso-api/docs/understanding-conversions",details:"Public ticker is reference-only. Requires account, correct deposit network, a signed conversion quote and a payout instruction."},
 {id:"bitso-latam",name:"Bitso LATAM",kind:"fiat-offramp",provider:"Bitso Business",
  status:"partner-required",networks:[],assets:["USDC","USDT"],fiat:["BRL","ARS","COP"],
  proof:"https://docs.bitso.com/bitso-api/docs/currency-dictionary",details:"Provider currencies documented; exact live payout route, funding network and eligibility not established."},
 {id:"circle-cctp",name:"Circle CCTP",kind:"crosschain",provider:"Circle",
  status:"integration",networks:["solana","ethereum","base","arbitrum","polygon","optimism","avalanche"],
  assets:["USDC"],fiat:[],proof:"https://developers.circle.com/cctp",
  details:"Native USDC cross-chain burn/mint; support depends on chain-specific deployment, fees and attestation."},
 {id:"lifi",name:"LI.FI cross-chain",kind:"crosschain",provider:"LI.FI",
  status:"integration",networks:["solana","ethereum","base","arbitrum","polygon","optimism","avalanche","bnb"],
  assets:["USDC","USDT"],fiat:[],proof:"https://docs.li.fi/",details:"Connections are possibilities, not executable quotes. Request a fresh route and review wallet transactions."},
 {id:"bridge",name:"Bridge fiat rails",kind:"fiat-offramp",provider:"Bridge",
  status:"research",networks:[],assets:["USDC"],fiat:["USD","EUR","MXN"],
  proof:"https://www.bridge.xyz/",details:"Partner underwriting, permitted region, wallet identity and live customer-account binding required."},
]);
const ASSET_IDS=new Set(CRYPTO_ASSETS.map(x=>x.id));
const NET_IDS=new Set(NETWORKS.map(x=>x.id));
const MARKET_IDS=new Set(FIAT_MARKETS.map(x=>x.id));
export function validAmount(value){
 const amount=typeof value==="number"?String(value):typeof value==="string"?value.trim():"";
 if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(amount))return null;
 const n=Number(amount);
 return Number.isFinite(n)&&n>0&&n<=1_000_000_000?n:null;
}
export function corridor(input){
 const country=FIAT_MARKETS.find(x=>x.id===input?.country);
 const asset=CRYPTO_ASSETS.find(x=>x.id===input?.asset);
 const network=NETWORKS.find(x=>x.id===input?.network);
 const amount=validAmount(input?.amount);
 if(!country||!asset||!network||amount==null)throw Error("Select a supported market, chain, asset and positive amount.");
 const choices=RAILS.filter(x=>x.kind==="fiat-offramp"&&x.fiat.includes(country.currency)&&x.assets.includes(asset.id));
 return {market:country,asset,network,amount,choices:choices.map(route=>({
  ...route,ready:false,quoteStatus:"unavailable",fxRate:null,recipientAmount:null,
  missing:[
   "Provider account, KYC and country eligibility",
   "Verified chain and token deposit support for this receiving account",
   "Fresh amount-specific conversion quote, provider fees and expiry",
   "Verified beneficiary/bank payout and settlement receipt",
  ],
 }))};
}
export function classifyRail(id,asset,network){
 if(!ASSET_IDS.has(asset)||!NET_IDS.has(network))return {status:"unsupported",reason:"Unknown asset or network."};
 const rail=RAILS.find(x=>x.id===id);
 if(!rail||!rail.assets.includes(asset)||!rail.networks.includes(network))
  return {status:"unsupported",reason:"This rail is not configured for the selected asset and network."};
 if(rail.id==="solana-wallet")return {status:"wallet-live",reason:"Direct USDC transfer is available only after wallet, recipient and network checks."};
 return {status:"not-connected",reason:"Listed protocol is a candidate or partial integration, not a verified payable route."};
}
export function marketReference(raw,book,now=Date.now()){
 const supported=/^usdc_(mxn|brl|ars|cop)$/.test(book);
 if(!supported||!raw||typeof raw!=="object")return null;
 const record=raw.payload&&typeof raw.payload==="object"?raw.payload:raw;
 if(record.book!==book)return null;
 const parse=(v)=>typeof v==="string"&&/^\d{1,12}(?:\.\d{1,12})?$/.test(v)?Number(v):NaN;
 const bid=parse(record.bid),ask=parse(record.ask);
 const created=Date.parse(record.created_at);
 if(!Number.isFinite(bid)||!Number.isFinite(ask)||bid<=0||ask<bid||!Number.isFinite(created)
   ||created>now+15_000||now-created>120_000)return null;
 return {book,bid,ask,createdAt:new Date(created).toISOString(),observedAt:new Date(now).toISOString(),
  unit:"fiat per USDC",source:"Bitso public ticker",status:"reference-only",feesIncluded:false,payoutAvailable:false};
}
export function referenceProceeds(reference,amount){
 const n=validAmount(amount);
 if(!reference||n==null||reference.status!=="reference-only")return null;
 return {grossReference:n*reference.bid,netPayable:null,fee:null,
  note:"Top-of-book bid × requested USDC, before fees, spread at size, deposits and withdrawal processing. NOT a conversion quote."};
}
