import type {Connection} from "@solana/web3.js";
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
 connection:Pick<Connection,"getGenesisHash"|"getMultipleAccountsInfoAndContext">;
 network:"localnet"|"devnet"|"mainnet-beta";
 programId:string;verifiedProgramId:string;expectedGenesisHash:string;
 owner:string;mint:string;seedId?:bigint;commitment?:"confirmed"|"finalized";
}):Promise<AgentTreasuryChainView>;
