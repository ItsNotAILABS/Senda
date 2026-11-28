import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CashRail } from "@/components/cash-rail";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { stablePayLink, STABLES } from "@/lib/stables";
import { cn } from "@/lib/utils";

type Btc = { address?: string } | string;

function short(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function copy(address: string) {
  void navigator.clipboard.writeText(address).then(() => toast.success("Address copied."));
}

/** The connected wallet's receive addresses. One 0x is the same account on every EVM chain. */
export function ReceiveBook() {
  const w = useWallet();
  const sol = w.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const linkedEvm = w.w.links.find((l) => l.kind === "evm")?.address ?? "";
  const [eth, setEth] = useState(linkedEvm);
  const [btc, setBtc] = useState("");
  const [picked, setPicked] = useState("solana");
  const [stable, setStable] = useState("USDC");
  const [qr, setQr] = useState("");

  useEffect(() => {
    setEth(linkedEvm);
  }, [linkedEvm]);

  const taproot = btc.startsWith("bc1p") ? btc : "";
  const segwit = btc.startsWith("bc1q") ? btc : "";
  const rows = [
    { id: "cash", name: "Cash", tag: "Separate address", address: sol },
    { id: "solana", name: "Solana", tag: "", address: sol },
    { id: "ethereum", name: "Ethereum", tag: "", address: eth },
    { id: "taproot", name: "Bitcoin", tag: "Taproot", address: taproot },
    { id: "segwit", name: "Bitcoin", tag: "Native Segwit", address: segwit },
    { id: "robinhood", name: "Robinhood Chain", tag: "", address: eth },
    { id: "bnb", name: "BNB Chain", tag: "", address: eth },
    { id: "arc", name: "Arc", tag: "", address: eth },
    { id: "base", name: "Base", tag: "", address: eth },
    { id: "polygon", name: "Polygon", tag: "", address: eth },
    { id: "hyperevm", name: "HyperEVM", tag: "Lite", address: eth },
  ];
  const open = rows.find((row) => row.id === picked) ?? rows[1];

  const mint = STABLES.find((row) => row.symbol === stable)?.mint ?? STABLES[0].mint;
  const qrText = open.address && (open.id === "solana" || open.id === "cash") ? stablePayLink(open.address, mint) : open.address;

  useEffect(() => {
    if (!qrText) {
      setQr("");
      return;
    }
    let live = true;
    void import("qrcode").then((QR) =>
      QR.default.toDataURL(qrText, { margin: 1, width: 220, color: { dark: "#050508", light: "#ffffff" } }).then((url) => {
        if (live) setQr(url);
      }),
    );
    return () => {
      live = false;
    };
  }, [qrText]);

  async function read() {
    const win = window as unknown as {
      phantom?: { ethereum?: { request: (args: { method: string }) => Promise<string[]> }; bitcoin?: { requestAccounts?: () => Promise<Btc[]> } };
      ethereum?: { request: (args: { method: string }) => Promise<string[]> };
    };
    const ethProvider = win.phantom?.ethereum || win.ethereum;
    if (ethProvider) {
      try {
        const accounts = await ethProvider.request({ method: "eth_requestAccounts" });
        if (accounts[0]) setEth(accounts[0]);
      } catch {
        toast.error("The wallet did not give an Ethereum address.");
      }
    }
    const bit = win.phantom?.bitcoin;
    if (bit?.requestAccounts) {
      try {
        const accounts = await bit.requestAccounts();
        const first = accounts[0];
        const address = typeof first === "string" ? first : first?.address || "";
        if (address) setBtc(address);
      } catch {
        toast.error("Phantom did not give a Bitcoin address.");
      }
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-black p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Receive</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Addresses on this wallet</h2>
        </div>
        <button type="button" onClick={() => void read()} className="min-h-10 rounded-full border border-white/15 px-3 text-xs font-semibold">
          Read
        </button>
      </div>
      <p className="mt-1 text-sm text-white/50">Solana is the connected Phantom. Ethereum, Base, and the other EVM chains are the same 0x. Bitcoin only appears if Phantom gives it.</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" onClick={() => setPicked(row.id)} className={cn("flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left", picked === row.id ? "border-white/30 bg-white/5" : "border-white/10")}>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{row.name}</span>
                  {row.tag ? <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">{row.tag}</span> : null}
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-white/45">{row.address ? short(row.address) : "Not on this wallet yet"}</span>
              </span>
              <span
                role="presentation"
                onClick={(e) => {
                  e.stopPropagation();
                  if (row.address) copy(row.address);
                }}
                className={cn("grid size-9 place-items-center rounded-xl border border-white/10 text-xs", row.address ? "text-white" : "text-white/25")}
              >
                Copy
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open.address && (open.id === "solana" || open.id === "cash") ? (
        <div className="mt-3 flex gap-1.5 overflow-x-auto">
          {STABLES.map((row) => (
            <button key={row.symbol} type="button" onClick={() => setStable(row.symbol)} className={cn("h-8 shrink-0 rounded-full px-3 text-xs font-semibold", stable === row.symbol ? "bg-white text-black" : "bg-white/10 text-white/70")}>
              {row.symbol}
            </button>
          ))}
        </div>
      ) : null}
      {open.address && qr ? (
        <div className="mt-3 flex items-center gap-3">
          <img src={qr} alt="" className="size-28 rounded-xl" />
          <p className="break-all font-mono text-[11px] text-white/55">{open.address}</p>
        </div>
      ) : null}
      <CashRail owner={sol} />
    </section>
  );
}
