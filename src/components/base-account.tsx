import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { connectWallet } from "@/lib/wallets";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE = "0x2105";

type Eth = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function ethereum(): Eth | null {
  const w = window as unknown as { ethereum?: Eth };
  return w.ethereum ?? null;
}

async function baseCall(method: string, params: unknown[]) {
  const r = await fetch("https://mainnet.base.org", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = (await r.json()) as { result?: string; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message || "Base did not answer.");
  return j.result ?? "0x0";
}

export function BaseAccount() {
  const { w, linkChain } = useWallet();
  const saved = w.links.find((l) => l.kind === "evm")?.address ?? "";
  const [owner, setOwner] = useState(saved);
  const [usdc, setUsdc] = useState<number | null>(null);
  const [eth, setEth] = useState<number | null>(null);
  const [asset, setAsset] = useState<"USDC" | "ETH">("USDC");
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");

  useEffect(() => {
    if (!owner) return;
    let live = true;
    const pull = async () => {
      try {
        const bal = await baseCall("eth_getBalance", [owner, "latest"]);
        const data = `0x70a08231${owner.slice(2).padStart(64, "0")}`;
        const raw = await baseCall("eth_call", [{ to: USDC, data }, "latest"]);
        if (!live) return;
        setEth(Number(BigInt(bal)) / 1e18);
        setUsdc(Number(BigInt(raw)) / 1e6);
      } catch {
        /* keep last */
      }
    };
    void pull();
    const id = window.setInterval(() => void pull(), 15_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  async function connect() {
    setBusy(true);
    try {
      const got = await connectWallet("metamask");
      const kept = linkChain(got.address, "MetaMask", "evm");
      if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "Could not keep MetaMask.");
      const provider = ethereum();
      if (provider) {
        try {
          await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE }] });
        } catch {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: BASE, chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"], blockExplorerUrls: ["https://basescan.org"] }],
          });
        }
      }
      setOwner(got.address);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MetaMask did not connect.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const provider = ethereum();
    const n = Number(amount);
    if (!owner || !provider) return toast.error("Connect MetaMask first.");
    if (!/^0x[a-fA-F0-9]{40}$/.test(to.trim())) return toast.error("That is not an Ethereum address.");
    if (!(n > 0)) return toast.error("Enter an amount.");
    setBusy(true);
    try {
      const hash =
        asset === "ETH"
          ? await provider.request({ method: "eth_sendTransaction", params: [{ from: owner, to: to.trim(), value: `0x${BigInt(Math.round(n * 1e18)).toString(16)}` }] })
          : await provider.request({
              method: "eth_sendTransaction",
              params: [{ from: owner, to: USDC, data: transferData(to.trim(), BigInt(Math.round(n * 1e6))) }],
            });
      setSig(String(hash));
      toast.success(String(hash).slice(0, 10));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MetaMask did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">MetaMask</p>
        <h1 className="mt-1 text-3xl tracking-tight">The Base account.</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">USDC and ETH on Base. Nothing leaves until you approve it in MetaMask.</p>
      </header>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-sm text-muted">USDC on Base</p>
        <p className="font-mono text-4xl tabular-nums">{usdc == null ? "—" : `$${usdc.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
        <p className="mt-2 text-sm text-muted">ETH on Base · {eth == null ? "—" : eth.toLocaleString("en-US", { maximumFractionDigits: 6 })}</p>
        <p className="mt-1 font-mono text-sm text-muted">{owner || "Not connected"}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void connect()} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
            {owner ? "MetaMask" : "Connect MetaMask"}
          </button>
          {owner ? (
            <button type="button" onClick={() => void navigator.clipboard.writeText(owner)} className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold">
              Copy
            </button>
          ) : null}
          <Link to="/invest" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
            Trade
          </Link>
        </div>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="text-lg font-semibold">Send on Base</h2>
        <div className="mt-3 flex gap-1">
          {(["USDC", "ETH"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setAsset(id)} className={id === asset ? "min-h-9 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-9 rounded-full px-3 text-sm text-white/60"}>
              {id}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{asset === "ETH" ? "This is native ETH on Base. MetaMask asks you to confirm." : "This is USDC on Base. MetaMask asks you to confirm."}</p>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={asset} className="mt-3 min-h-11 w-full rounded-full bg-black/40 px-4 font-mono outline-none" />
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x address" className="mt-2 min-h-11 w-full rounded-full bg-black/40 px-4 font-mono text-sm outline-none" />
        <button type="button" disabled={busy || !owner} onClick={() => void send()} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
          {owner ? `Send ${asset}` : "Connect MetaMask first"}
        </button>
        {sig ? (
          <a href={`https://basescan.org/tx/${sig}`} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-xs text-accent">
            {sig.slice(0, 12)}…
          </a>
        ) : null}
      </section>
    </div>
  );
}

function transferData(to: string, raw: bigint) {
  const addr = to.slice(2).padStart(64, "0");
  const amt = raw.toString(16).padStart(64, "0");
  return `0xa9059cbb${addr}${amt}`;
}
