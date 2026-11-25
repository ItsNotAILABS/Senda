import type {WebhookVerifier} from "./money-settlement-core.mjs";
export declare function settlementVerifierFromEnv(env:Record<string,string|undefined>):WebhookVerifier|null;
export declare function handleMoneyWebhook(request:Request,options:{env:Record<string,string|undefined>;getQuery:()=>Promise<(text:string,params:unknown[])=>Promise<unknown[]>>;log?:Pick<Console,"error"|"warn">}):Promise<Response>;
