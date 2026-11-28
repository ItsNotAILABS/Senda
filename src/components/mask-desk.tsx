import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { SignCall } from "@/components/sign-call";
import { shortPk } from "@/lib/senda-keys";
import { connectWallet } from "@/lib/wallets";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const BASE = "0x2105";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const RPC = "https://mainnet.base.org";

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function metamask(): Eth | null {
  const eth = (window as unknown as { ethereum?: Eth & { isMetaMask?: boolean; providers?: Eth[] } }).ethereum;
  if (!eth) return null;
  return eth.providers?.find((p) => (p as { isMetaMask?: boolean }).isMetaMask) || (eth.isMetaMask ? eth : eth);
}

async function rpc(method: string, params: unknown[]): Promise<string> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await r.json()) as { result?: string; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || "Base did not answer.");
  return body.result || "0x0";
}

/** The MetaMask that is the Base account. ETH and USDC are read from Base. A send is MetaMask. */
export function MaskDesk() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
  const [busy, setBusy] = useState(false);
  const [eth, setEth] = useState<number | null>(null);
  const [usdc, setUsdc] = useState<number | null>(null);
  const [asset, setAsset] = useState<"ETH" | "USDC">("USDC");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("1");
  const [hash, setHash] = useState("");
  const [call, setCall] = useState(false);

  useEffect(() => {
    if (!owner) {
      setEth(null);
      setUsdc(null);
      return;
    }
    let live = true;
    const pull = () => {
      void Promise.all([
        rpc("eth_getBalance", [owner, "latest"]),
        rpc("eth_call", [{ to: BASE_USDC, data: `0x70a08231${owner.slice(2).padStart(64, "0")}` }, "latest"]),
      ]).then(([bal, token]) => {
        if (!live) return;
        setEth(Number(BigInt(bal)) / 1e18);
        setUsdc(Number(BigInt(token)) / 1e6);
      }).catch(() => {
        if (live) {
          setEth(null);
          setUsdc(null);
        }
      });
    };
    pull();
    const id = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  async function connect() {
    setBusy(true);
    try {
      const got = await connectWallet("metamask");
      const linked = wallet.linkChain(got.address, "MetaMask", "evm");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep MetaMask.");
      const provider = metamask();
      if (provider) {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE }] }).catch(async (err: { code?: number }) => {
          if (err?.code !== 4902) throw err;
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: BASE, chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [RPC], blockExplorerUrls: ["https://basescan.org"] }],
          });
        });
      }
      toast.success("MetaMask is the Base account.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MetaMask did not connect.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const provider = metamask();
    if (!provider || !owner) return toast.error("Connect MetaMask first.");
    const dest = to.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(dest)) return toast.error("That is not an Ethereum address.");
    const n = Number(amount);
    if (!(n > 0)) return toast.error("Enter an amount.");
    setBusy(true);
    setHash("");
    try {
      const sent = asset === "ETH"
        ? await provider.request({
            method: "eth_sendTransaction",
            params: [{ from: owner, to: dest, value: `0x${BigInt(Math.round(n * 1e18)).toString(16)}` }],
          })
        : await provider.request({
            method: "eth_sendTransaction",
            params: [{
              from: owner,
              to: BASE_USDC,
              data: `0xa9059cbb${dest.slice(2).toLowerCase().padStart(64, "0")}${BigInt(Math.round(n * 1e6)).toString(16).padStart(64, "0")}`,
            }],
          });
      setHash(String(sent));
      setCall(false);
      toast.success(asset === "ETH" ? "MetaMask sent the ETH." : "MetaMask sent the USDC.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MetaMask did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">MetaMask</p>
        <h1 className="mt-1 text-3xl tracking-tight">The Base account.</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">ETH and USDC below are on Base, read from the chain. A send is a MetaMask signature. Phantom does not sign these. Both wallets can stay connected. This desk does not hold the key.</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">USDC on Base</p>
          <p className="mt-2 font-mono text-4xl tabular-nums">{usdc == null ? "—" : `$${usdc.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">ETH on Base</p>
          <p className="mt-2 font-mono text-4xl tabular-nums">{eth == null ? "—" : eth.toLocaleString("en-US", { maximumFractionDigits: 6 })}</p>
        </div>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="font-mono text-sm text-muted">{owner ? shortPk(owner) : "Not connected"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void connect()} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">{busy ? "Waiting" : owner ? "Reconnect" : "Connect MetaMask"}</button>
          {owner ? <button type="button" onClick={() => void navigator.clipboard.writeText(owner)} className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold">Copy</button> : null}
          <Link to="/invest" className="inline-flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-black">Trade</Link>
          <Link to="/launch" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">Robinhood Chain</Link>
        </div>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Send on Base</p>
        <div className="mt-3 flex gap-1">
          {(["USDC", "ETH"] as const).map((id) => (
            <button key={id} type="button" onClick={() => { setAsset(id); setAmount(id === "ETH" ? "0.001" : "1"); }} className={`min-h-9 rounded-full px-3 text-xs font-semibold ${asset === id ? "bg-white text-black" : "bg-white/10"}`}>{id}</button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{asset === "USDC" ? "This is the USDC contract on Base. MetaMask asks you to confirm the token transfer." : "This is native ETH on Base. MetaMask asks you to confirm."}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={asset} className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x address" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
        </div>
        <button type="button" disabled={busy || !owner} onClick={() => setCall(true)} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
          {owner ? `Sign ${amount} ${asset}` : "Connect MetaMask first"}
        </button>
        {hash ? <a href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-xs text-accent">{hash.slice(0, 12)}… on BaseScan</a> : null}
      </section>
      <section className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] px-3 py-3">
          <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">This MetaMask holds</p>
          <p className="mt-2 font-mono text-lg tabular-nums">{eth == null ? "—" : `${eth.toLocaleString("en-US", { maximumFractionDigits: 4 })} ETH`}</p>
          <p className="font-mono text-lg tabular-nums">{usdc == null ? "—" : `${usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`}</p>
          <p className="mt-1 text-xs text-muted">Base. Nothing else is read from this wallet.</p>
        </div>
        <Link to="/backpack" className="rounded-[22px] border border-white/10 bg-[#10131c] px-3 py-3">
          <p className="text-[11px] tracking-[0.14em] text-accent uppercase">Backpack</p>
          <p className="mt-2 text-sm font-semibold">Securities wallet</p>
          <p className="mt-1 text-xs text-muted">A separate Solana account. Shares it holds open on their own cards.</p>
        </Link>
      </section>
      <SignCall
        open={call}
        wallet="MetaMask"
        title={`Send ${amount || "0"} ${asset} on Base`}
        account={owner}
        waiting={busy}
        lines={[
          `To ${to || "an 0x address you still have to enter"}.`,
          asset === "USDC" ? "MetaMask signs the USDC contract on Base." : "MetaMask signs native ETH on Base.",
          "Nothing leaves until you approve it in MetaMask.",
        ]}
        onReject={() => {
          if (!busy) setCall(false);
        }}
        onSign={() => {
          if (!/^0x[a-fA-F0-9]{40}$/.test(to.trim())) {
            toast.error("That is not an Ethereum address.");
            return;
          }
          void send();
        }}
      />
    </div>
  );
}
