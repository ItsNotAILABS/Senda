import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { VersionedTransaction, Transaction } from "@solana/web3.js";
import { broadcastSigned, connectPhantom } from "@/lib/phantom";
import { submitSignedPerp } from "@/lib/jup-perps";
import { returnPath, takeHint, takeMobileReturn } from "@/lib/mobile-wallet";
import { unlockSeal } from "@/lib/seal";
import { linkChain, loadWallet, saveWallet } from "@/lib/wallet";

export const Route = createFileRoute("/wallets/app")({
  component: Page,
});

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function linkAddress(address: string, label: string) {
  void unlockSeal(address);
  const kind = label === "Phantom" ? "phantom" : "solana";
  const next = linkChain(loadWallet(), address, label, kind);
  if ("error" in next) {
    if (next.error !== "Already linked.") toast.error(next.error);
    return;
  }
  saveWallet(next);
  window.dispatchEvent(new Event("senda-seal"));
}

function Page() {
  const navigate = useNavigate();
  const [line, setLine] = useState("Looking for the wallet in this app…");
  const [canConnect, setCanConnect] = useState(false);

  useEffect(() => {
    let live = true;
    const back = returnPath();
    const result = takeMobileReturn(window.location.search);
    const hint = takeHint();
    window.history.replaceState({}, "", "/wallets/app");

    const goBack = (label: string) => {
      toast.success(`${label} is linked. Go back and tap buy. It signs in this window.`);
      void navigate({ href: back });
    };

    if (result.type === "signed") {
      setLine("Sending the signed transaction…");
      void (async () => {
        try {
          let sig = "";
          if (result.job.kind === "perp") {
            sig = await submitSignedPerp(bytesToBase64(result.bytes), result.job.action);
          } else {
            let tx: { serialize: () => Uint8Array };
            try {
              tx = VersionedTransaction.deserialize(result.bytes);
            } catch {
              tx = Transaction.from(result.bytes);
            }
            sig = await broadcastSigned(tx);
          }
          if (!live) return;
          toast.success(`Signed. ${sig.slice(0, 8)}…`);
          void navigate({ href: back });
        } catch (e) {
          if (!live) return;
          const message = e instanceof Error ? e.message : "The signature did not land.";
          setLine(message);
          setCanConnect(true);
          toast.error(message);
        }
      })();
      return () => {
        live = false;
      };
    }

    if (result.type === "connect") {
      linkAddress(result.publicKey, result.label);
      goBack(result.label);
      return () => {
        live = false;
      };
    }

    if (result.type === "error") setLine(result.message);
    else if (hint) setLine(hint);

    void (async () => {
      try {
        const addr = await connectPhantom();
        if (!live) return;
        linkAddress(addr, "Phantom");
        goBack("Phantom");
      } catch (e) {
        if (!live) return;
        setLine(e instanceof Error ? e.message : "Tap Connect Phantom. This page signs here.");
        setCanConnect(true);
      }
    })();

    return () => {
      live = false;
    };
    // The wallet reply is only in the URL on the first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectHere() {
    setLine("Asking Phantom in this window…");
    setCanConnect(false);
    try {
      const addr = await connectPhantom();
      linkAddress(addr, "Phantom");
      toast.success("Phantom is linked. Go back and tap buy. It signs in this window.");
      void navigate({ href: returnPath() });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not see the wallet.";
      setLine(message);
      setCanConnect(true);
      toast.error(message);
    }
  }

  return (
    <div className="px-4 py-8">
      <h1 className="text-2xl tracking-tight">Wallet app</h1>
      <p className="mt-2 max-w-md text-sm text-muted">{line}</p>
      {canConnect ? (
        <button
          type="button"
          onClick={() => void connectHere()}
          className="mt-4 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
        >
          Connect Phantom
        </button>
      ) : null}
    </div>
  );
}
