import {createFileRoute} from "@tanstack/react-router";
import {MoneyBar} from "@/components/money-bar";
export const Route=createFileRoute("/payments/activity")({component:Page});
function Page(){
 return <section className="space-y-4">
  <div className="rounded-[20px] border border-cyan-300/15 bg-[#111a29] p-5"><p className="font-mono text-[11px] tracking-widest text-cyan-300">SENDA / TRANSACTION HISTORY</p><h1 className="mt-2 text-2xl font-semibold">Verified on-chain activity</h1><p className="mt-2 text-sm text-white/55">Only signed wallet activity and recoverable Solana submission receipts appear here. Local paper balances, simulated card charges and draft payment requests are not bank or blockchain settlement receipts.</p></div>
  <MoneyBar/>
 </section>;
}
