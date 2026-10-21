import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { connectPhantom, readChain } from "@/lib/phantom";
import { paySol, payUsdc } from "@/lib/solana-pay";
import { robinhoodBuyingPowerUrl } from "@/lib/robinhood";
import { connectWallet, rememberWallet } from "@/lib/wallets";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { isWeekend, revolutFee } from "@/lib/wallet";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_RPC = "https://mainnet.base.org";

function solLink(links: { kind: string; address: string; label: string }[]) {
  return links.find((l) => l.kind === "phantom" || l.kind === "solana");
}

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: string; error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message || "Base did not answer.");
  return body.result || "0x0";
}

export function RevolutLane() {
  const wallet = useWallet();
  const sol = solLink(wallet.w.links);
  const [to, setTo] = useState("");
  const [raw, setRaw] = useState("25");
  const [asset, setAsset] = useState<"USDC" | "SOL">("USDC");
  const [busy, setBusy] = useState(false);
  const amount = Number(raw) || 0;
  const weekend = isWeekend();
  const fx = revolutFee("fx", amount, weekend);
  const wire = revolutFee("send", amount, weekend);

  async function send() {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(to.trim())) {
      toast.error("Paste the Solana address Revolut is showing.");
      return;
    }
    setBusy(true);
    try {
      const owner = sol?.address || (await connectPhantom());
      if (!sol) {
        const kept = wallet.linkChain(owner, "Phantom", "phantom");
        if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "Could not keep the address.");
      }
      const done = asset === "USDC" ? await payUsdc({ owner, to: to.trim(), usd: amount, memo: "Senda to Revolut" }) : await paySol({ owner, to: to.trim(), sol: amount, memo: "Senda to Revolut" });
      toast.success(`Signed to Revolut. ${done.signature.slice(0, 8)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revolut did not get the transfer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 px-4 py-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-[#c6f56a] uppercase">Revolut</p>
      <h1 className="text-2xl font-semibold tracking-tight">Their app. This wallet.</h1>
      <p className="text-sm text-white/60">Revolut does not sign here. You copy this address into Revolut to receive, or paste the address Revolut shows and this wallet signs the send.</p>
      <article className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-sm font-semibold">Receive from Revolut</p>
        <p className="mt-1 text-xs text-white/45">Crypto, Send, Solana. USDC or SOL lands on this address.</p>
        <p className="mt-3 break-all font-mono text-xs">{sol?.address ?? "Connect Phantom, Backpack, Solflare, or Coinbase first."}</p>
        <button
          type="button"
          disabled={!sol}
          onClick={() => {
            if (!sol) return;
            void navigator.clipboard.writeText(sol.address).then(
              () => toast.success("Copied. Paste it in Revolut."),
              () => toast.error("Could not copy."),
            );
          }}
          className="mt-3 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40"
        >
          Copy address
        </button>
      </article>
      <article className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-sm font-semibold">Send to a Revolut Solana address</p>
        <div className="mt-3 flex gap-2">
          {(["USDC", "SOL"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setAsset(id)} className={`min-h-10 flex-1 rounded-full text-sm font-semibold ${asset === id ? "bg-white text-black" : "border border-white/10"}`}>
              {id}
            </button>
          ))}
        </div>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Address from Revolut" className="mt-3 min-h-11 w-full rounded-2xl border border-white/10 bg-black/40 px-3 text-sm outline-none" />
        <input inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} className="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-black/40 px-3 font-mono text-sm outline-none" />
        <button type="button" disabled={busy || !(amount > 0)} onClick={() => void send()} className="mt-3 min-h-11 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
          {busy ? "Waiting for the wallet…" : `Sign ${amount || 0} ${asset}`}
        </button>
      </article>
      <article className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-sm font-semibold">What Revolut charges on ${amount || 0}</p>
        <p className="mt-1 text-xs text-white/45">Their published schedule. Senda does not add it, and does not collect it.</p>
        <p className="mt-3 font-mono text-sm">Person to person · $0</p>
        <p className="mt-1 font-mono text-sm">FX · ${fx.toFixed(2)}{weekend ? " · weekend" : ""}</p>
        <p className="mt-1 font-mono text-sm">Bank wire · ${wire.toFixed(2)}</p>
        <Link to="/invest" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-[#d7e36a]">
          Hold the euro here instead
        </Link>
      </article>
    </section>
  );
}

export function RobinhoodLane() {
  const wallet = useWallet();
  const sol = solLink(wallet.w.links);
  const [usd, setUsd] = useState(25);
  const [asset, setAsset] = useState<"USDC" | "SOL">("USDC");

  function open() {
    if (!sol) {
      toast.error("Connect a Solana wallet first. Robinhood sends to that address.");
      return;
    }
    const url = robinhoodBuyingPowerUrl({ wallet: sol.address, usd, origin: window.location.origin, asset });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="space-y-3 px-4 py-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-[#c6f56a] uppercase">Robinhood</p>
      <h1 className="text-2xl font-semibold tracking-tight">Buying power onto this wallet.</h1>
      <p className="text-sm text-white/60">Robinhood opens. You confirm there. {asset} is aimed at the Solana address below. It does not sit in a Senda balance.</p>
      <div className="flex gap-2">
        {(["USDC", "SOL"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setAsset(id)} className={`min-h-10 flex-1 rounded-full text-sm font-semibold ${asset === id ? "bg-white text-black" : "border border-white/10"}`}>
            {id}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {[1, 5, 25, 100].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={`min-h-10 flex-1 rounded-full font-mono text-sm ${usd === n ? "bg-[#d7e36a] text-black" : "border border-white/10"}`}>
            ${n}
          </button>
        ))}
      </div>
      <p className="break-all font-mono text-xs text-white/50">{sol?.address ?? "No Solana wallet connected."}</p>
      <button type="button" onClick={open} className="min-h-12 w-full rounded-full bg-white text-sm font-semibold text-black">
        Open Robinhood · ${usd} {asset}
      </button>
      <p className="text-xs text-white/40">A second use: sell in Robinhood first, then this same button moves the dollars here as {asset}. Senda never sees the Robinhood login.</p>
    </section>
  );
}

export function PhantomLane() {
  const wallet = useWallet();
  const sol = solLink(wallet.w.links);
  const [solBal, setSolBal] = useState<number | null>(null);
  const [rows, setRows] = useState<{ symbol: string; ui: number }[]>([]);

  const address = sol?.address ?? "";

  useEffect(() => {
    if (!address) return;
    let live = true;
    readChain(address)
      .then((snap) => {
        if (!live) return;
        setSolBal(snap.sol);
        setRows(snap.tokens.filter((t) => t.ui > 0).slice(0, 8).map((t) => ({ symbol: t.symbol, ui: t.ui })));
      })
      .catch(() => live && setSolBal(null));
    return () => {
      live = false;
    };
  }, [address]);

  return (
    <section className="space-y-3 px-4 pt-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-[#c6f56a] uppercase">Phantom</p>
      <h1 className="text-2xl font-semibold tracking-tight">The account that signs Solana.</h1>
      <p className="text-sm text-white/60">Buys, sends, loans, and work pay ask this wallet. Backpack, Solflare, and Coinbase can sign the same book if you choose them on Wallets.</p>
      <p className="font-mono text-sm">{sol ? (solBal == null ? "Reading…" : `${solBal.toFixed(4)} SOL`) : "Not connected"}</p>
      <div className="flex gap-2 overflow-x-auto">
        {rows.map((row) => (
          <span key={row.symbol} className="shrink-0 rounded-full border border-white/10 px-3 py-1 font-mono text-xs">
            {row.symbol} {row.ui >= 1 ? row.ui.toFixed(2) : row.ui.toPrecision(3)}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            void connectPhantom()
              .then((addr) => {
                rememberWallet("phantom");
                wallet.linkChain(addr, "Phantom", "phantom");
                toast.success("Phantom signs next.");
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Phantom did not connect."));
          }}
          className="min-h-11 flex-1 rounded-full bg-white text-sm font-semibold text-black"
        >
          Use Phantom
        </button>
        <Link to="/invest" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/15 text-sm font-semibold">
          Trade
        </Link>
      </div>
    </section>
  );
}

export function MetaMaskLane() {
  const wallet = useWallet();
  const evm = wallet.w.links.find((l) => l.kind === "evm");
  const [eth, setEth] = useState<number | null>(null);
  const [usdc, setUsdc] = useState<number | null>(null);

  const address = evm?.address ?? "";

  useEffect(() => {
    if (!address) return;
    let live = true;
    Promise.all([
      rpc("eth_getBalance", [address, "latest"]),
      rpc("eth_call", [{ to: BASE_USDC, data: `0x70a08231${address.slice(2).toLowerCase().padStart(64, "0")}` }, "latest"]),
    ])
      .then(([bal, coin]) => {
        if (!live) return;
        setEth(Number(BigInt(bal)) / 1e18);
        setUsdc(Number(BigInt(coin)) / 1e6);
      })
      .catch(() => {
        if (!live) return;
        setEth(null);
        setUsdc(null);
      });
    return () => {
      live = false;
    };
  }, [address]);

  return (
    <section className="space-y-3 px-4 py-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-[#c6f56a] uppercase">MetaMask</p>
      <h1 className="text-2xl font-semibold tracking-tight">Base. Not the PreStock book.</h1>
      <p className="text-sm text-white/60">Gold, oil, FX, and a USDC bridge on Base sign here. A Solana buy still uses Phantom, Backpack, Solflare, or Coinbase.</p>
      <p className="break-all font-mono text-xs text-white/50">{evm?.address ?? "MetaMask is not connected."}</p>
      <p className="font-mono text-sm">{evm ? (eth == null ? "Reading Base…" : `${eth.toFixed(5)} ETH · ${usdc == null ? "—" : `$${usdc.toFixed(2)} USDC`}`) : "Connect to read Base."}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            void connectWallet("metamask")
              .then((got) => {
                wallet.linkChain(got.address, got.label, "evm");
                toast.success("MetaMask is on for Base.");
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "MetaMask is not in this browser."));
          }}
          className="min-h-11 flex-1 rounded-full bg-white text-sm font-semibold text-black"
        >
          Use MetaMask
        </button>
        <Link to="/invest" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/15 text-sm font-semibold">
          FX and metals
        </Link>
      </div>
    </section>
  );
}
