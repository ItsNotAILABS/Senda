import { useState } from "react";
import { toast } from "sonner";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

/** Chains that share one Ethereum account. No address is invented for a chain the wallet did not return. */
const EVM = ["Ethereum", "Linea", "Arbitrum", "Arc", "BNB Chain", "Base", "Monad", "OP", "Polygon", "HyperEVM"];

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function short(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-5)}`;
}

function ethereum(): Eth | null {
  const w = window as unknown as { phantom?: { ethereum?: Eth }; ethereum?: Eth };
  return w.phantom?.ethereum ?? w.ethereum ?? null;
}

export function AddressBook() {
  const { w } = useWallet();
  const sol = w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [evm, setEvm] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadEvm() {
    const eth = ethereum();
    if (!eth) {
      toast.error("Open this in Phantom or MetaMask. That is the Ethereum account.");
      return;
    }
    setBusy(true);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0] ?? "";
      if (!address) throw new Error("The wallet did not return an address.");
      setEvm(address);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not return an address.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      toast.success("Address copied.");
    } catch {
      toast.error("Could not copy.");
    }
  }

  async function showQr(addr: string) {
    const QR = await import("qrcode");
    const url = await QR.default.toDataURL(addr, { margin: 1, width: 240, color: { dark: "#000000", light: "#ffffff" } });
    setQr(url);
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-black">
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="text-base font-semibold">Addresses</h2>
        {!evm ? (
          <button type="button" disabled={busy} onClick={() => void loadEvm()} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black">
            {busy ? "…" : "Ethereum account"}
          </button>
        ) : null}
      </div>
      <ul className="divide-y divide-white/10">
        <Row name="Solana" addr={sol} onCopy={copy} onQr={showQr} />
        {evm ? EVM.map((name) => <Row key={name} name={name} addr={evm} onCopy={copy} onQr={showQr} />) : null}
      </ul>
      <p className="px-4 py-3 text-xs text-white/40">
        One Ethereum account is the same address on every EVM network, including Monad. Tron and Stellar are not returned by this wallet, so they are not listed. Bitcoin receive stays inside Phantom.
      </p>
      {qr ? (
        <button type="button" onClick={() => setQr("")} className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6">
          <img src={qr} alt="Address QR" className="w-60 rounded-2xl bg-white p-3" />
        </button>
      ) : null}
    </section>
  );
}

function Row({ name, addr, onCopy, onQr }: { name: string; addr: string; onCopy: (a: string) => void; onQr: (a: string) => void }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{name}</p>
        <p className="font-mono text-xs text-white/45">{addr ? short(addr) : "Not connected"}</p>
      </div>
      {addr ? (
        <>
          <button type="button" aria-label={`Copy ${name}`} onClick={() => onCopy(addr)} className="grid size-10 place-items-center rounded-xl text-lg">⧉</button>
          <button type="button" aria-label={`QR ${name}`} onClick={() => void onQr(addr)} className="grid size-10 place-items-center rounded-xl text-lg">▦</button>
        </>
      ) : null}
    </li>
  );
}
