import { MarketsFloor } from "@/components/markets-floor";
import { MoveWidget } from "@/components/move-widget";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export function PerpDesk() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  return (
    <div className="space-y-4">
      <MoveWidget owner={owner} />
      <MarketsFloor />
    </div>
  );
}

