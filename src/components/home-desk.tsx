import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronRight, CircleDollarSign, Plus, Send, TrendingUp, Wallet } from "lucide-react";
import { readChain } from "@/lib/phantom";
import type { HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function HomeDesk({ names }: { names: HouseListing[] }) {
  const pre = names.filter((n) => n.venue === "prestocks" && n.last > 0);
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [usdc, setUsdc] = useState(0);
  const [held, setHeld] = useState(0);

  useEffect(() => {
    if (!owner) return;
    let live = true;
    readChain(owner)
      .then((s) => {
        if (!live) return;
        setUsdc(s.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
        setHeld(
          s.tokens.reduce((sum, t) => {
            const name = pre.find((n) => n.mint === t.mint);
            return name ? sum + t.ui * name.last : sum;
          }, 0),
        );
      })
      .catch(() => {
        if (live) setUsdc(0);
      });
    return () => {
      live = false;
    };
  }, [owner, names]);

  const cash = usdc + (wallet.w.balances.USD || 0);

  return (
    <main className="mx-auto w-full max-w-[680px] px-5 pt-4 pb-16">
      <h1 className="font-display text-[40px] leading-[1.02] font-medium tracking-[-0.035em] text-white sm:text-[52px]">
        Your money shouldn’t stop working after you invest it.
      </h1>
      <p className="mt-4 max-w-[420px] text-[15px] leading-relaxed text-white/55">
        Hold a pre-IPO name on Solana. Pay anyone in USDC. The position stays in your wallet.
      </p>

      <section className="relative mt-7 overflow-hidden rounded-[28px]">
        <img src="/images/orbit.jpg" alt="" className="h-[420px] w-full object-cover sm:h-[500px]" />
        <div className="absolute inset-x-3 bottom-3 grid grid-cols-4 gap-2">
          <Act to="/payments" search={{ act: "add" }} icon={Plus} label="Add" />
          <Act to="/payments" icon={Send} label="Send" />
          <Act to="/wallet" icon={ArrowLeftRight} label="Exchange" />
          <Act to="/vault" icon={Wallet} label="Details" />
        </div>
      </section>

      <section className="mt-3 overflow-hidden rounded-[28px] bg-[#14141c]">
        <Row to="/payments" kind="cash" k="Cash" sub="Available to spend" v={money(cash)} />
        <Row to="/vault" kind="invest" k="Investments" sub={owner ? "PreStocks in the wallet" : "Your portfolio"} v={money(held)} />
      </section>
    </main>
  );
}

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function Act({
  to,
  search,
  icon: Icon,
  label,
}: {
  to: "/payments" | "/wallet" | "/vault";
  search?: { act: string };
  icon: typeof Plus;
  label: string;
}) {
  return (
    <Link
      to={to}
      search={search}
      className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-black/55 px-2 text-sm font-medium text-white backdrop-blur-md sm:justify-start sm:px-3"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10">
        <Icon className="size-3.5" />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function Row({
  to,
  kind,
  k,
  sub,
  v,
}: {
  to: "/payments" | "/vault";
  kind: "cash" | "invest";
  k: string;
  sub: string;
  v: string;
}) {
  const Icon = kind === "cash" ? CircleDollarSign : TrendingUp;
  return (
    <Link to={to} className="flex items-center gap-3 border-t border-white/8 px-4 py-4 first:border-t-0">
      <span
        className={cn(
          "grid size-11 place-items-center rounded-full",
          kind === "cash" ? "bg-[#163226] text-[#3ddc84]" : "bg-[#2a2a14] text-[#d6ff4a]",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{k}</span>
        <span className="block text-sm text-white/45">{sub}</span>
      </span>
      <span className="font-mono text-sm tabular-nums">{v}</span>
      <ChevronRight className="size-4 text-white/35" />
    </Link>
  );
}
