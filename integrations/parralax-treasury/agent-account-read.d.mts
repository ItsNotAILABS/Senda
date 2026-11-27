export type AgentTreasuryChainView={
 schema:"senda.agent-money.chain-account.v1";
 status:"observed"|"not-created";network:string;
 treasury:string;vault:string;owner:string;mint:string;slot:number;
 balanceMinor?:string;amountMinor?:null;decimals?:number;
 agent?:string;beneficiary?:string;perTxCapMinor?:string;dailyCapMinor?:string;
 lifetimeCapMinor?:string;dailySpentMinor?:string;lifetimeSpentMinor?:string;
 nextNonce?:string;expiresAt?:string;paused?:boolean;revoked?:boolean;
 source:string;execution:"disabled";canSpend:false;note?:string;finality?:string;
};
export declare function readAgentTreasuryAccount(input:{
 connection:{
  getGenesisHash:()=>Promise<string>;
  getMultipleAccountsInfoAndContext:(keys:unknown[],commitment:string)=>Promise<unknown>;
 };
 network:"localnet"|"devnet"|"mainnet-beta";
 programId:string;verifiedProgramId:string;expectedGenesisHash:string;
 owner:string;mint:string;seedId?:bigint;commitment?:"confirmed"|"finalized";
}):Promise<AgentTreasuryChainView>;
