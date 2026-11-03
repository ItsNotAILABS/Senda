/**
 * Global Liquify research registry.
 * "candidate" never implies a connected provider, available fiat payout, or permitted market access.
 * Network and token mint validation must be done at execution time, not inferred from this catalog.
 */
export const LIQUIFY_MARKETS = [
 {id:"us",name:"United States",region:"North America",currency:"USD",focus:"Wallet-native trading, USDC merchant payments, market depth",assets:["USDC","USDT","SOL","xStocks"],rails:["solana-pay","jupiter-v2","cctp"],note:"Card issuance and cash-out require separate licensed partners."},
 {id:"mx",name:"Mexico / Spanish LATAM",region:"Latin America",currency:"MXN",focus:"USDC remittance, peso conversion, merchant payments",assets:["USDC","USDT","SOL"],rails:["solana-pay","bitso","cctp"],note:"Bitso conversion/cash-out is a partner candidate, not an in-app MXN payout."},
 {id:"br",name:"Brazil",region:"Latin America",currency:"BRL",focus:"Stablecoin liquidity, tokenized equities, crypto-to-local payment discovery",assets:["USDC","USDT","SOL","xStocks"],rails:["jupiter-v2","solana-pay","regional-fiat"],note:"Pix and local fiat payouts need a qualified provider."},
 {id:"kr",name:"South Korea",region:"Asia-Pacific",currency:"KRW",focus:"Crypto and AI markets, risk-aware strategy research",assets:["SOL","USDC","USDT"],rails:["jupiter-v2","regional-fiat"],note:"Exchange, leverage and stablecoin eligibility vary by product and jurisdiction."},
 {id:"ng",name:"Nigeria",region:"Africa",currency:"NGN",focus:"Stablecoin transfers, merchant acceptance, cross-border value movement",assets:["USDC","USDT"],rails:["solana-pay","regional-fiat"],note:"NGN payout and bank transfer require verified local compliance and providers."},
 {id:"vn",name:"Vietnam",region:"Asia-Pacific",currency:"VND",focus:"Wallet onboarding, token discovery and consumer payments research",assets:["SOL","USDC","USDT"],rails:["solana-pay","regional-fiat"],note:"Fiat connections are not available just because a wallet can hold stablecoins."},
 {id:"ph",name:"Philippines",region:"Asia-Pacific",currency:"PHP",focus:"Cross-border stablecoins, payment links, small-business spending",assets:["USDC","USDT","SOL"],rails:["solana-pay","regional-fiat"],note:"Domestic e-wallet or bank payouts need separate partnerships."},
 {id:"hk",name:"Hong Kong / Chinese-speaking markets",region:"Greater China",currency:"HKD",focus:"Tokenized equities, multilingual discovery and eligible global trading",assets:["xStocks","USDC","SOL"],rails:["jupiter-v2","regional-fiat"],note:"Accessibility of tokenized instruments depends on jurisdiction and issuer restrictions."},
 {id:"ae",name:"United Arab Emirates",region:"Middle East",currency:"AED",focus:"International settlement, professional treasury and multichain API rails",assets:["USDC","USDT","SOL"],rails:["cctp","jupiter-v2","regional-fiat"],note:"Corporate payments and cash-out require regulated counterparties."},
 {id:"sg",name:"Singapore",region:"Asia-Pacific",currency:"SGD",focus:"Treasury APIs, agent-controlled budgets and multichain routing",assets:["USDC","USDT","SOL"],rails:["cctp","jupiter-v2","regional-fiat"],note:"Issuer, payment-services and token access checks required."},
 {id:"tr",name:"Türkiye",region:"Europe / Middle East",currency:"TRY",focus:"Stablecoin movement and precious-metal-linked market research",assets:["USDC","USDT","SOL"],rails:["jupiter-v2","regional-fiat"],note:"TRY settlement and gold-token availability need product-specific verification."}
];
export const LIQUIFY_RAILS = [
 {id:"jupiter-v2",name:"Jupiter Swap V2",kind:"swap",status:"code-present",description:"Solana route discovery; each execution still requires fresh quotes and wallet signing",networks:["Solana"],input:["SOL","USDC","USDT","eligible tokens"],output:"Solana tokens",url:"https://dev.jup.ag/docs/swap"},
 {id:"solana-pay",name:"Solana stablecoin transfer / QR",kind:"wallet-payment",status:"code-present",description:"Wallet-signed token transfer where the merchant accepts an on-chain asset",networks:["Solana"],input:["USDC","supported SPL tokens"],output:"Recipient wallet",url:"https://solana.com/docs/payments"},
 {id:"cctp",name:"Circle CCTP",kind:"cross-chain",status:"candidate",description:"Native USDC transfer across supported chains after official support and attestation checks",networks:["Supported CCTP chains only"],input:["native USDC"],output:"native USDC on destination",url:"https://developers.circle.com/cctp"},
 {id:"bitso",name:"Bitso",kind:"fiat-offramp",status:"candidate",description:"Mexico conversion and payout partner subject to approved account, API and compliance",networks:["Mexico"],input:["supported crypto"],output:"MXN via partner",url:"https://bitso.com"},
 {id:"regional-fiat",name:"Regional fiat payout partners",kind:"fiat-offramp",status:"not-connected",description:"Country-specific bank/mobile-money/card payout integrations are not available until contracted and verified",networks:["Varies by region"],input:["qualified stablecoins"],output:"local fiat, if approved",url:null},
 {id:"lifi",name:"LI.FI",kind:"cross-chain",status:"code-present",description:"Cross-chain quote route already present in Senda code; endpoint readiness must be checked per chain",networks:["EVM / Solana where supported"],input:["supported tokens"],output:"cross-chain assets",url:"https://docs.li.fi"},
 {id:"raydium",name:"Raydium",kind:"liquidity",status:"candidate",description:"Independent AMM depth and pool verification; do not count Jupiter-routed liquidity twice",networks:["Solana"],input:["pool assets"],output:"pool routes",url:"https://docs.raydium.io"},
 {id:"orca",name:"Orca",kind:"liquidity",status:"candidate",description:"Whirlpool route research, slippage and executable-size comparison",networks:["Solana"],input:["pool assets"],output:"pool routes",url:"https://docs.orca.so"},
 {id:"meteora",name:"Meteora",kind:"liquidity",status:"candidate",description:"Dynamic liquidity pool evaluation; not a committed market maker",networks:["Solana"],input:["pool assets"],output:"pool routes",url:"https://docs.meteora.ag"}
];
export const LIQUIFY_PRODUCTS=[
 {id:"trade",name:"Trade",path:"/invest",promise:"Discover, price, review, sign"},
 {id:"pay",name:"Pay & Send",path:"/payments",promise:"Wallet-native payment and transfers"},
 {id:"agents",name:"Agents",path:"/agents",promise:"Governed research, budgets, approvals"},
 {id:"liquify",name:"Liquify",path:"/liquify",promise:"Liquidity, routes, international money movement"}
];
export function listMarkets({query="",region="all"}={}){
 const needle=String(query).trim().toLowerCase();
 return LIQUIFY_MARKETS.filter(m=>(region==="all"||m.region===region)&&(!needle||[m.name,m.currency,m.focus,...m.assets].some(x=>x.toLowerCase().includes(needle))));
}
export function railsForMarket(id){
 const m=LIQUIFY_MARKETS.find(v=>v.id===id);
 return m?m.rails.map(id=>LIQUIFY_RAILS.find(r=>r.id===id)).filter(Boolean):[];
}
export function classifyPath({marketId,railId,asset}){
 const market=LIQUIFY_MARKETS.find(x=>x.id===marketId),rail=LIQUIFY_RAILS.find(x=>x.id===railId);
 if(!market||!rail||!market.rails.includes(railId))return {eligible:false,reason:"Unsupported market/rail combination."};
 if(!market.assets.includes(asset))return {eligible:false,reason:"Asset is not in this market's research coverage."};
 return {eligible:rail.status==="code-present",reason:rail.status==="code-present"?"Code integration exists, but executable routes, network support and local eligibility must be verified per transaction.":"Research candidate only; no live payout, bank rail or order is connected."};
}
