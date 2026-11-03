export declare function authorizeWorkerTrade(worker:{
 status:"active"|"paused"; autonomy:"observe"|"draft"|"queue"; tools:readonly string[];
 side:"buy"|"sell";symbols:readonly string[];maxUsd:number;
 queue:{symbol:string;side:"buy"|"sell";usd:number}|null;
},cap:number,symbol:string):{side:"buy"|"sell";symbol:string;usd:number};
