import { useEffect, useState } from "react";
import { toast } from "sonner";
import { launchTrade } from "@/lib/launch";
import { loadLaunchBoard, type LaunchCoin } from "@/lib/launch-board";
import { connectPhantom } from "@/lib/phantom";
import { buyCmeshCovered } from "@/lib/cmesh-fund";
import { CMESH, robinhoodEth } from "@/lib/pons";
import { cleanTag, openRevolutPay, revolutPayUrl, saveRevolut } from "@/lib/revolut-link";
import { connectWallet } from "@/lib/wallets";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { holdTrade } from "@/lib/offline-rail";
import { createOnSolana, dropDraft, holdDraft, listDrafts, type LaunchDraft } from "@/lib/launch-create";

type Evm = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; isMetaMask?: boolean; isBraveWallet?: boolean; providers?: Evm[] };

const CHAIN = "0x1237";

function metamask(): Evm {
  const eth = (window as unknown as { ethereum?: Evm }).ethereum;
  const list = eth?.providers?.length ? eth.providers : eth ? [eth] : [];
  const mm = list.find((p) => p.isMetaMask && !p.isBraveWallet) || list[0];
  if (!mm) throw new Error("MetaMask is not in this browser.");
  return mm;
}

function weiHex(amount: string): string {
  const [whole, frac = ""] = amount.split(".");
  const padded = (frac + "000000000000000000").slice(0, 18);
  const wei = BigInt(whole || "0") * 10n ** 18n + BigInt(padded || "0");
  if (wei <= 0n) throw new Error("Set an amount of ETH.");
  return `0x${wei.toString(16)}`;
}

/** A coin on Pump or Bonk, CMesh on the Pons curve, ETH on Robinhood Chain, and a Revolut pay link. */
export function LaunchDesk() {
  const wallet = useWallet();
  const phantom = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const mask = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
  const [mint, setMint] = useState("");
  const [sol, setSol] = useState("0.02");
  const [pool, setPool] = useState<"pump" | "bonk" | "auto">("auto");
  const [to, setTo] = useState("");
  const [eth, setEth] = useState("0.001");
  const [cmeshEth, setCmeshEth] = useState("0.001");
  const [onChain, setOnChain] = useState<string | null>(null);
  const [tag, setTag] = useState("");
  const [usd, setUsd] = useState("20");
  const [busy, setBusy] = useState("");
  const [board, setBoard] = useState<LaunchCoin[]>([]);
  const [boardPage, setBoardPage] = useState(0);
  const [drafts, setDrafts] = useState<LaunchDraft[]>(() => (typeof window === "undefined" ? [] : listDrafts()));
  const [coinName, setCoinName] = useState("");
  const [ticker, setTicker] = useState("");
  const [blurb, setBlurb] = useState("");
  const [meta, setMeta] = useState("");
  const [devSol, setDevSol] = useState("0.02");
  const [createPool, setCreatePool] = useState<"pump" | "bonk">("pump");
  const [rhName, setRhName] = useState("");
  const [rhTicker, setRhTicker] = useState("");
  const [rhSupply, setRhSupply] = useState("1000000");

  useEffect(() => {
    if (!mask) {
      setOnChain(null);
      return;
    }
    let live = true;
    void robinhoodEth(mask)
      .then((wei) => live && setOnChain((Number(wei) / 1e18).toFixed(4)))
      .catch(() => live && setOnChain(null));
    return () => {
      live = false;
    };
  }, [mask, busy]);

  useEffect(() => {
    let live = true;
    loadLaunchBoard()
      .then((rows) => live && setBoard(rows))
      .catch(() => live && setBoard([]));
    return () => {
      live = false;
    };
  }, []);

  async function buy(side: "buy" | "sell", mintOverride?: string) {
    const using = (mintOverride ?? mint).trim();
    const n = Number(sol);
    if (side === "buy" && !(n > 0)) {
      toast.error("Set a SOL amount.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const held = holdTrade({
        kind: "curve",
        mint: using,
        symbol: using.slice(0, 4),
        side,
        usd: 0,
        sol: n,
        pool,
        price: 0,
        decimals: 6,
      });
      toast.success("error" in held ? held.error : "Held on this phone. It signs when the network is back.");
      return;
    }
    setBusy(side);
    try {
      const owner = phantom || (await connectPhantom());
      if (!phantom) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep Phantom.");
      }
      const bytes = await launchTrade({ owner, mint: using, sol: n, side, pool });
      const { VersionedTransaction } = await import("@solana/web3.js");
      const { sendVersioned } = await import("@/lib/phantom");
      const signature = await sendVersioned(VersionedTransaction.deserialize(bytes));
      toast.success(`${side === "buy" ? "Bought" : "Sold"}. ${signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The coin did not sign.");
    } finally {
      setBusy("");
    }
  }

  async function buyMesh() {
    setBusy("cmesh");
    try {
      const owner = phantom || (await connectPhantom());
      if (!phantom) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep Phantom.");
      }
      const done = await buyCmeshCovered(cmeshEth, owner);
      if (!mask) {
        const linked = wallet.linkChain(done.from, done.wallet, "evm");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the account.");
      }
      toast.success(`${done.converted ? "SOL converted. " : ""}${done.wallet} bought CMESH. ${done.hash.slice(0, 10)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not buy CMESH.");
    } finally {
      setBusy("");
    }
  }

  async function openChain() {
    setBusy("chain");
    try {
      const provider = metamask();
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN,
          chainName: "Robinhood Chain",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
          blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
        }],
      }).catch(() => undefined);
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN }] });
      toast.success("MetaMask is on Robinhood Chain. No coin was deployed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MetaMask did not switch.");
    } finally {
      setBusy("");
    }
  }

  async function sendEth() {
    if (!/^0x[a-fA-F0-9]{40}$/.test(to.trim())) {
      toast.error("That is not an address on Robinhood Chain.");
      return;
    }
    setBusy("eth");
    try {
      const from = mask || (await connectWallet("metamask")).address;
      if (!mask) {
        const linked = wallet.linkChain(from, "MetaMask", "evm");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep MetaMask.");
      }
      const provider = metamask();
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN,
          chainName: "Robinhood Chain",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
          blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
        }],
      }).catch(() => undefined);
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN }] });
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from, to: to.trim(), value: weiHex(eth) }],
      });
      if (typeof hash !== "string") throw new Error("MetaMask did not return a transaction.");
      toast.success(`ETH sent on Robinhood Chain. ${hash.slice(0, 10)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MetaMask did not send it.");
    } finally {
      setBusy("");
    }
  }

  function payRevolut() {
    const clean = cleanTag(tag);
    const n = Number(usd);
    if (!clean || !(n > 0)) {
      toast.error("A Revtag and an amount.");
      return;
    }
    saveRevolut(clean, phantom);
    openRevolutPay(revolutPayUrl(clean, "USD", n, "Senda"));
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Launch</p>
        <h1 className="mt-1 text-3xl tracking-tight">The board, then the buy.</h1>
        <p className="mt-1 text-sm text-muted">Create on Solana when the wallet signs. A Robinhood Chain draft stays on this phone until you deploy a contract yourself. Buys of new coins hold offline and sign later.</p>
      </header>
      <CreateMint
        drafts={drafts}
        name={coinName}
        ticker={ticker}
        blurb={blurb}
        meta={meta}
        sol={devSol}
        pool={createPool}
        busy={busy !== ""}
        setName={setCoinName}
        setTicker={setTicker}
        setBlurb={setBlurb}
        setMeta={setMeta}
        setSol={setDevSol}
        setPool={setCreatePool}
        onChange={() => setDrafts(listDrafts())}
        onLaunch={async (row) => {
          setBusy("create");
          try {
            const owner = phantom || (await connectPhantom());
            const done = await createOnSolana(owner, row);
            setDrafts(listDrafts());
            setMint(done.mint);
            toast.success(`Created ${row.symbol}. ${done.mint.slice(0, 4)}… ${done.signature.slice(0, 8)}…`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "The create did not sign.");
          } finally {
            setBusy("");
          }
        }}
      />
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="text-lg">Robinhood Chain</h2>
        <p className="mt-1 text-sm text-muted">Chain 4663. Gas is ETH. This desk does not ship a token contract, and it will not send bytecode it did not compile. The draft is the name, the ticker, and the supply. MetaMask can open the chain. The coin is not created by that.</p>
        <div className="mt-3 grid gap-2">
          <input value={rhName} onChange={(e) => setRhName(e.target.value)} placeholder="Name" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
          <div className="flex gap-2">
            <input value={rhTicker} onChange={(e) => setRhTicker(e.target.value.toUpperCase())} placeholder="TICKER" className="min-h-11 w-28 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
            <input value={rhSupply} onChange={(e) => setRhSupply(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" aria-label="Supply" placeholder="Supply" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const saved = holdDraft({ chain: "robinhood", name: rhName, symbol: rhTicker, description: "", uri: "", sol: 0, supply: rhSupply || "0", pool: "pump" });
              if ("error" in saved) toast.error(saved.error);
              else {
                setDrafts(listDrafts());
                toast.success("Draft held. Robinhood Chain was not asked.");
              }
            }}
            className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black"
          >
            Hold the draft
          </button>
          <button type="button" disabled={busy !== ""} onClick={() => void openChain()} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40">
            {busy === "chain" ? "Waiting" : "Open Robinhood Chain"}
          </button>
        </div>
        <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x address, only if you are sending ETH" spellCheck={false} className="mt-3 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
        <div className="mt-2 flex items-center gap-3">
          <input value={eth} onChange={(e) => setEth(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="ETH" className="w-32 bg-transparent font-mono text-3xl outline-none" />
          <button type="button" disabled={busy !== ""} onClick={() => void sendEth()} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">{busy === "eth" ? "Waiting" : "Send ETH"}</button>
        </div>
      </section>
      <LaunchBoard
        rows={board}
        page={boardPage}
        busy={busy !== ""}
        onPage={setBoardPage}
        onBuy={(next) => {
          setMint(next);
          void buy("buy", next);
        }}
      />
      <section className="rounded-[24px] border border-white/10 bg-[#0c0e14] p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">CMesh · Pons</p>
        <h2 className="mt-1 text-xl">CipherMesh</h2>
        <p className="mt-1 break-all font-mono text-xs text-muted">{CMESH}</p>
        <p className="mt-2 text-sm text-muted">If this account has no ETH, Phantom first signs a SOL conversion through Relay. ETH lands on Robinhood Chain, then the buy signs. SOL itself is not what the curve takes.</p>
        {mask ? <p className="mt-2 font-mono text-xs text-muted">{mask.slice(0, 6)}…{mask.slice(-4)} · {onChain == null ? "…" : `${onChain} ETH on Robinhood Chain`}</p> : null}
        <div className="mt-3 flex items-center gap-3">
          <input value={cmeshEth} onChange={(e) => setCmeshEth(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="ETH for CMESH" className="w-32 bg-transparent font-mono text-3xl outline-none" />
          <button type="button" disabled={busy !== ""} onClick={() => void buyMesh()} className="min-h-12 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-40">
            {busy === "cmesh" ? "Waiting" : "Buy CMESH"}
          </button>
        </div>
        <a href={`https://ponsfamily.com/launchpad/${CMESH}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-muted">The curve on Pons</a>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="text-lg">Pump or Bonk</h2>
        <p className="mt-1 text-sm text-muted">Paste the mint. Phantom signs the trade. Auto uses whichever pool has it. A sell sends the whole balance of that mint.</p>
        <input value={mint} onChange={(e) => setMint(e.target.value.trim())} placeholder="Mint" spellCheck={false} className="mt-3 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={sol} onChange={(e) => setSol(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="SOL" className="w-28 bg-transparent font-mono text-3xl outline-none" />
          {(["auto", "pump", "bonk"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setPool(id)} className={`rounded-full px-3 py-2 text-xs font-semibold capitalize ${pool === id ? "bg-white text-black" : "bg-white/10"}`}>{id}</button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy !== ""} onClick={() => void buy("buy")} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">{busy === "buy" ? "Waiting" : "Buy"}</button>
          <button type="button" disabled={busy !== ""} onClick={() => void buy("sell")} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">{busy === "sell" ? "Waiting" : "Sell all"}</button>
        </div>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="text-lg">Revolut</h2>
        <p className="mt-1 text-sm text-muted">A virtual card spends money that is already inside Revolut. This app cannot load that card. A Revtag opens their pay link. They decide where it lands.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="@revtag" className="min-h-11 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
          <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="USD" className="w-24 bg-transparent font-mono text-3xl outline-none" />
          <button type="button" onClick={payRevolut} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black">Open Revolut</button>
        </div>
      </section>
    </div>
  );
}

function CreateMint({
  drafts,
  name,
  ticker,
  blurb,
  meta,
  sol,
  pool,
  busy,
  setName,
  setTicker,
  setBlurb,
  setMeta,
  setSol,
  setPool,
  onChange,
  onLaunch,
}: {
  drafts: LaunchDraft[];
  name: string;
  ticker: string;
  blurb: string;
  meta: string;
  sol: string;
  pool: "pump" | "bonk";
  busy: boolean;
  setName: (v: string) => void;
  setTicker: (v: string) => void;
  setBlurb: (v: string) => void;
  setMeta: (v: string) => void;
  setSol: (v: string) => void;
  setPool: (v: "pump" | "bonk") => void;
  onChange: () => void;
  onLaunch: (row: LaunchDraft) => void;
}) {
  const held = drafts.filter((row) => row.status === "held");
  return (
    <section className="rounded-[24px] border border-white/10 bg-[#0c0e14] p-4">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Create</p>
      <h2 className="mt-1 text-xl">Launch on Solana</h2>
      <p className="mt-1 text-sm text-muted">Pump or Bonk builds the transaction. The mint key signs it once, in memory, and is not saved. Phantom pays the SOL. Offline, this is only a draft.</p>
      <div className="mt-3 grid gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
        <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="TICKER" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
        <input value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="One line about it" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
        <input value={meta} onChange={(e) => setMeta(e.target.value.trim())} placeholder="Metadata link, if you already have one" spellCheck={false} className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={sol} onChange={(e) => setSol(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="First buy in SOL" className="w-24 bg-transparent font-mono text-3xl outline-none" />
        <span className="text-xs text-muted">SOL first buy</span>
        {(["pump", "bonk"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setPool(id)} className={`rounded-full px-3 py-2 text-xs font-semibold capitalize ${pool === id ? "bg-white text-black" : "bg-white/10"}`}>{id}</button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          const saved = holdDraft({
            chain: "solana",
            name,
            symbol: ticker,
            description: blurb,
            uri: meta,
            sol: Number(sol),
            supply: "",
            pool,
          });
          if ("error" in saved) toast.error(saved.error);
          else {
            onChange();
            toast.success(typeof navigator !== "undefined" && !navigator.onLine ? "Draft held offline." : "Draft held. Launch when you want it signed.");
          }
        }}
        className="mt-3 min-h-11 w-full rounded-full bg-white text-sm font-semibold text-black"
      >
        Hold the draft
      </button>
      {held.length ? (
        <ul className="mt-3 space-y-2">
          {held.map((row) => (
            <li key={row.id} className="rounded-2xl bg-white/[0.04] p-3">
              <p className="text-sm font-semibold">{row.symbol} · {row.chain === "solana" ? "Solana" : "Robinhood Chain"}</p>
              <p className="mt-1 text-xs text-muted">{row.name}{row.chain === "solana" ? ` · ${row.sol} SOL on ${row.pool}` : ` · supply ${row.supply}. Not deployed.`}</p>
              <div className="mt-2 flex gap-2">
                {row.chain === "solana" ? (
                  <button type="button" disabled={busy} onClick={() => onLaunch(row)} className="min-h-10 flex-1 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
                    {busy ? "Waiting" : "Sign the create"}
                  </button>
                ) : (
                  <p className="text-xs text-white/45">Held. Opening the chain does not deploy it.</p>
                )}
                <button type="button" onClick={() => { dropDraft(row.id); onChange(); }} className="min-h-10 rounded-full px-3 text-xs text-white/40">Drop</button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function LaunchBoard({
  rows,
  page,
  busy,
  onPage,
  onBuy,
}: {
  rows: LaunchCoin[];
  page: number;
  busy: boolean;
  onPage: (n: number) => void;
  onBuy: (mint: string) => void;
}) {
  const pages = Math.max(1, Math.ceil(rows.length / 12));
  const safe = Math.min(page, pages - 1);
  const shown = rows.slice(safe * 12, safe * 12 + 12);
  return (
    <section className="rounded-[24px] border border-white/10 bg-[#0c0e14] p-4">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Live board</p>
      <h2 className="mt-1 text-xl">New coins</h2>
      <p className="mt-1 text-sm text-muted">{rows.length ? `${rows.length} just created. The SOL amount below is what the buy signs.` : "The board has not answered yet."}</p>
      <ul className="mt-3 space-y-2">
        {shown.map((row) => (
          <li key={row.mint} className="flex items-center gap-2 rounded-2xl border border-white/10 px-2 py-2">
            {row.icon ? <img src={row.icon} alt="" className="size-8 rounded-full bg-white/10" /> : <span className="grid size-8 place-items-center rounded-full bg-white text-[10px] font-bold text-black">{row.symbol.slice(0, 2)}</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{row.symbol}</span>
              <span className="block truncate text-[11px] text-muted">{row.pad}{row.mcap > 0 ? ` · $${Math.round(row.mcap).toLocaleString("en-US")}` : ""}</span>
            </span>
            <button type="button" disabled={busy} onClick={() => onBuy(row.mint)} className="min-h-9 shrink-0 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40">
              Buy
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <button type="button" disabled={safe <= 0} onClick={() => onPage(Math.max(0, safe - 1))} className="min-h-9 rounded-full bg-white/10 px-3 disabled:opacity-40">Back</button>
        <span className="font-mono">{rows.length ? `${safe + 1} / ${pages}` : "…"}</span>
        <button type="button" disabled={safe + 1 >= pages} onClick={() => onPage(safe + 1)} className="min-h-9 rounded-full bg-white/10 px-3 disabled:opacity-40">Next</button>
      </div>
    </section>
  );
}
