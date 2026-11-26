export type EventEvidence={
 schema:"senda.events.intelligence.v1";ticker:string;source:string;marketStatus:string|null|undefined;
 closeTime:string|null;researchReady:boolean;quality:"complete"|"limited"|"blocked";
 flags:string[];observedAt:string;
 evidence:{bookObservedAt:string|null;bookAgeMs:number|null;historyWindow:string|null;
  reportedVolume24hContracts:number|null;rulesPresent:boolean;historyBars:number};
 market:{yesBestBidUsd:number|null;yesImpliedAskUsd:number|null;noBestBidUsd:number|null;
  spreadUsd:number|null;yesBidDepthContracts:number;noBidDepthContracts:number;
  lastReportedPriceUsd:number|null;previousReportedPriceUsd:number|null;
  lastReportedPriceAt:string|null};
 execution:"disabled";insurance:false;probabilityForecast:null;tradeRecommendation:null;warning:string;
};
export declare function analyzeEventEvidence(input:{
 detail:{ticker:string;status:string;closeTime?:string|null;rulesPrimary?:string|null;
  volume24hContracts?:number|null};
 book:{ticker:string;asOf:number;yesBids:Array<{bid:number;size:number}>;
  noBids:Array<{bid:number;size:number}>};
 history:{ticker:string;window?:string;bars:Array<{time:number;priceUsd:number|null}>};
 now?:number;
}):EventEvidence;
