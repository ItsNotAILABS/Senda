import {createFileRoute} from "@tanstack/react-router";
import {MoneyBar} from "@/components/money-bar";
import {WalletActivityTimeline} from "@/components/wallet-activity-timeline";
import {AgentTreasuryStatus} from "@/components/agent-treasury-status";
export const Route=createFileRoute("/payments/activity")({component:Page});
function Page(){
 return <section className="space-y-4">
  <MoneyBar/>
  <WalletActivityTimeline/>
  <AgentTreasuryStatus/>
 </section>;
}
