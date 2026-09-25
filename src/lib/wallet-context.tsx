import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useWallet } from "@/lib/use-wallet";

type WalletApi = ReturnType<typeof useWallet>;

const Ctx = createContext<WalletApi | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const api = useWallet();
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const open = () => setEpoch((n) => n + 1);
    window.addEventListener("senda-seal", open);
    return () => window.removeEventListener("senda-seal", open);
  }, []);
  return (
    <Ctx.Provider value={api}>
      <div key={epoch}>{children}</div>
    </Ctx.Provider>
  );
}

export function useWalletCtx(): WalletApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("WalletProvider missing");
  return v;
}
