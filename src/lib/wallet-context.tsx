import { createContext, useContext, type ReactNode } from "react";
import { useWallet } from "@/lib/use-wallet";

type WalletApi = ReturnType<typeof useWallet>;

const Ctx = createContext<WalletApi | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const api = useWallet();
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWalletCtx(): WalletApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("WalletProvider missing");
  return v;
}
