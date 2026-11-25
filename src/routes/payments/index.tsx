import { createFileRoute } from "@tanstack/react-router";
import { FriendsMoneyDesk } from "@/components/friends-money-desk";
export const Route = createFileRoute("/payments/")({
 component: Page,
});
function Page(){
 return <FriendsMoneyDesk />;
}
