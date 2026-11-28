import {createFileRoute} from "@tanstack/react-router";
import {AppShell} from "@/components/app-shell";
import {LiquifyGlobalDesk} from "@/components/liquify-global-desk";
export const Route=createFileRoute("/liquify")({component:Page});
function Page(){return <AppShell><LiquifyGlobalDesk/></AppShell>;}
