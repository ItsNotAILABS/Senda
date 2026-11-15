import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AgentPanel } from "@/components/advisors/agent-panel";
import { AppsPanel } from "@/components/advisors/apps-panel";
import { LaunchPanel } from "@/components/advisors/launch-panel";
import {
  ackCatalog,
  CATALOG,
  createUserSource,
  dropUserFile,
  NEW_TRADER,
  parseAdvisor,
  pullCatalog,
  saveApp,
  saveSealedSource,
  sealUserFile,
  unlockUserFile,
  SHIPPED,
  userFileLock,
  userSpecs,
  writeUserSource,
  type AdvisorOrder,
  type AdvisorSpec,
  type CatalogUpdate,
} from "@/lib/advisors";
import { runAdvisor } from "@/lib/advisors/engine";
import { spendCap } from "@/lib/spend-cap";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

type Face = "code" | "agents" | "launch" | "apps";

export function ForgeDesk({
  names,
  busy,
  onSign,
}: {
  names: HouseListing[];
  busy: boolean;
  onSign: (order: AdvisorOrder) => void;
}) {
  const [face, setFace] = useState<Face>("code");
  const [yours, setYours] = useState(() => userSpecs());
  const [pick, setPick] = useState(SHIPPED[0]?.id ?? "");
  const [source, setSource] = useState(SHIPPED[0]?.source ?? NEW_TRADER);
  const [budget, setBudget] = useState(100);
  const [updates, setUpdates] = useState<CatalogUpdate[]>([]);
  const [appName, setAppName] = useState("");
  const [gate, setGate] = useState("");
  const [fileLock, setFileLock] = useState<"clear" | "sealed" | "open">("clear");
  const cap = spendCap();
  const shipped = SHIPPED.find((row) => row.id === pick);
  const owned = yours.find((row) => row.ok && row.spec.id === pick);
  const locked = Boolean(shipped);

  useEffect(() => {
    setUpdates(pullCatalog(SHIPPED));
  }, []);

  function refresh(nextId?: string) {
    const rows = userSpecs();
    setYours(rows);
    const id = nextId ?? pick;
    if (id.startsWith("you:")) setFileLock(userFileLock(id));
    if (!nextId) return;
    const file = rows.find((row) => row.ok && row.spec.id === nextId);
    if (file && file.ok) {
      setPick(file.spec.id);
      setSource(file.spec.source);
      setFileLock(userFileLock(file.spec.id));
    }
  }

  function openSpec(spec: AdvisorSpec) {
    setPick(spec.id);
    setSource(spec.source);
    setFace("code");
    setFileLock(spec.id.startsWith("you:") ? userFileLock(spec.id) : "clear");
  }

  const parsed = useMemo(() => parseAdvisor(source, pick || "you:draft", locked ? "shipped" : "you"), [source, pick, locked]);
  const spec = parsed.ok ? parsed.spec : null;
  const run = spec ? runAdvisor(locked && shipped ? shipped : spec, names, budget, cap) : null;

  async function save() {
    if (locked) {
      toast.error("Fork it first. A shipped file changes only when we publish an update.");
      return;
    }
    if (fileLock === "sealed") {
      toast.error("Unlock the file before saving.");
      return;
    }
    if (fileLock === "open") {
      const wrote = await saveSealedSource(pick, source);
      if (!wrote.ok) {
        toast.error(wrote.error);
        return;
      }
      refresh(wrote.spec.id);
      toast.success("Saved. The file stays sealed.");
      return;
    }
    const wrote = pick.startsWith("you:") ? writeUserSource(pick, source) : createUserSource(source);
    if (!wrote.ok) {
      toast.error(wrote.error);
      return;
    }
    refresh(wrote.spec.id);
    toast.success("Saved on this browser.");
  }

  async function sealFile() {
    if (!pick.startsWith("you:")) {
      toast.error("Save the file on this browser before sealing it.");
      return;
    }
    const wrote = await sealUserFile(pick, gate);
    if (!wrote.ok) {
      toast.error(wrote.error);
      return;
    }
    setGate("");
    setFileLock("open");
    toast.success("Sealed. The source is ciphertext on this browser.");
  }

  async function unlockFile() {
    const wrote = await unlockUserFile(pick, gate);
    if (!wrote.ok) {
      toast.error(wrote.error);
      return;
    }
    setSource(wrote.source);
    setGate("");
    setFileLock("open");
    refresh(pick);
    toast.success("Unlocked for this visit. The passphrase was not stored.");
  }

  function fork() {
    if (!shipped) return;
    const made = createUserSource(shipped.source, shipped.id);
    if (!made.ok) {
      toast.error(made.error);
      return;
    }
    refresh(made.spec.id);
    toast.success("Forked. Edits stay yours.");
  }

  function makeApp() {
    if (!locked && owned && owned.ok && source.replace(/\s+$/, "") !== owned.spec.source) {
      toast.error("Save the file first. The app runs the saved file.");
      return;
    }
    const id = shipped?.id ?? (owned && owned.ok ? owned.spec.id : "");
    if (!id) {
      toast.error("Save the file before making an app.");
      return;
    }
    const made = saveApp({ name: appName || (spec?.title ?? "App"), blurb: spec?.line ?? "", advisorId: id });
    if (!made.ok) {
      toast.error(made.error);
      return;
    }
    setAppName("");
    setFace("apps");
    toast.success(id.startsWith("ship:") ? "The app follows shipped updates." : "The app stays on your file.");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
        <p className="shrink-0 pr-2 font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Forge</p>
        {(
          [
            ["code", "Strategies"],
            ["agents", "Agents"],
            ["launch", "Launch"],
            ["apps", "Apps"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFace(id)} className={cn("h-8 shrink-0 rounded-full px-3 text-xs font-semibold", face === id ? "bg-white text-black" : "text-white/55")}>
            {label}
          </button>
        ))}
        <span className="ml-auto shrink-0 font-mono text-[10px] text-white/30">catalog {CATALOG}</span>
      </div>
      {face === "agents" ? <div className="min-h-0 flex-1 overflow-y-auto"><AgentPanel /></div> : null}
      {face === "launch" ? <div className="min-h-0 flex-1 overflow-y-auto"><LaunchPanel /></div> : null}
      {face === "apps" ? <div className="min-h-0 flex-1 overflow-y-auto"><AppsPanel names={names} busy={busy} onSign={onSign} /></div> : null}
      {face === "code" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {updates.length > 0 ? (
            <div className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#101114] px-3 py-3">
              <p className="text-sm text-white/70">
                Shipped {updates.map((row) => `${row.title} v${row.version}`).join(", ")}. Your files were not rewritten.
              </p>
              <button
                type="button"
                onClick={() => {
                  ackCatalog(SHIPPED);
                  setUpdates([]);
                }}
                className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black"
              >
                Keep these updates
              </button>
            </div>
          ) : null}
          <div className="grid gap-3 p-3 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)]">
            <aside>
              <p className="font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">Shipped</p>
              <div className="mt-1 space-y-1">
                {SHIPPED.map((row) => (
                  <button key={row.id} type="button" onClick={() => openSpec(row)} className={cn("block w-full rounded-xl px-2 py-1.5 text-left text-sm", pick === row.id ? "bg-white text-black" : "text-white/70")}>
                    {row.title}
                    <span className="ml-2 font-mono text-[10px] opacity-50">v{row.version}</span>
                  </button>
                ))}
              </div>
              <p className="mt-4 font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">Yours</p>
              <div className="mt-1 space-y-1">
                {yours.map((row) => (
                  <button
                    key={row.ok ? row.spec.id : row.id}
                    type="button"
                    onClick={() => {
                      if (row.ok) {
                        openSpec(row.spec);
                        return;
                      }
                      setPick(row.id);
                      setSource("");
                      setFace("code");
                      setFileLock(row.error.startsWith("Sealed") ? "sealed" : "clear");
                    }}
                    className={cn("block w-full rounded-xl px-2 py-1.5 text-left text-sm", row.ok && pick === row.spec.id ? "bg-white text-black" : "text-white/70")}
                  >
                    {row.ok ? row.spec.title : row.error.startsWith("Sealed") ? "Sealed" : "Unreadable"}
                  </button>
                ))}
                {yours.length === 0 ? <p className="px-2 text-xs text-white/40">None yet.</p> : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPick("");
                  setSource(NEW_TRADER);
                }}
                className="mt-3 min-h-9 w-full rounded-full border border-white/15 text-xs font-semibold"
              >
                New file
              </button>
            </aside>
            <section className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">{locked ? "Read only" : "Your file"}</p>
                <div className="flex gap-2">
                  {locked ? (
                    <button type="button" onClick={fork} className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black">Fork</button>
                  ) : (
                    <button type="button" onClick={() => void save()} className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black">Save</button>
                  )}
                  {pick.startsWith("you:") ? (
                    <button
                      type="button"
                      onClick={() => {
                        dropUserFile(pick);
                        const first = SHIPPED[0];
                        if (first) openSpec(first);
                        refresh();
                      }}
                      className="min-h-9 rounded-full border border-white/15 px-3 text-xs text-white/60"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
              {fileLock === "sealed" ? (
                <div className="min-h-72 rounded-2xl border border-white/10 bg-black p-4">
                  <p className="text-sm font-semibold">This file is sealed</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/45">The source is AES-GCM ciphertext on this browser. The passphrase is not stored. Unlocking lasts for this visit.</p>
                  <label className="mt-4 block text-xs text-white/45">
                    Passphrase
                    <input value={gate} onChange={(e) => setGate(e.target.value)} type="password" autoComplete="current-password" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-[#101114] px-3 text-sm text-white" />
                  </label>
                  <button type="button" onClick={() => void unlockFile()} className="mt-3 min-h-11 rounded-full bg-[#d6ff4a] px-4 text-sm font-semibold text-black">Unlock</button>
                </div>
              ) : (
                <textarea
                  value={source}
                  readOnly={locked}
                  onChange={(e) => setSource(e.target.value)}
                  spellCheck={false}
                  className="min-h-72 w-full rounded-2xl border border-white/10 bg-black p-3 font-mono text-[12px] leading-5 text-[#d7e36a] outline-none read-only:text-white/70"
                />
              )}
              {pick.startsWith("you:") && fileLock !== "sealed" ? (
                <div className="mt-2 flex gap-2">
                  <input value={gate} onChange={(e) => setGate(e.target.value)} type="password" autoComplete="new-password" placeholder="Passphrase to seal" className="min-h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 text-sm text-white" />
                  <button type="button" onClick={() => void sealFile()} className="min-h-10 shrink-0 rounded-full bg-[#d6ff4a] px-3 text-xs font-semibold text-black">Seal file</button>
                </div>
              ) : null}
              <p className={cn("mt-2 text-xs", parsed.ok ? "text-white/40" : "text-down")}>
                {fileLock === "sealed" ? "Locked. The editor does not hold the source." : fileLock === "open" ? "Ciphertext on this browser. Open for this visit. A save stays sealed." : parsed.ok ? "The file compiles. It still does not sign." : parsed.error}
              </p>
            </section>
            <section className="min-w-0 rounded-2xl border border-white/10 bg-[#101114] p-4">
              <p className="font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">Output</p>
              <label className="mt-3 block text-xs text-white/45">
                Budget
                <input value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 font-mono text-sm text-white" />
              </label>
              <p className="mt-2 text-xs text-white/45">{run?.note ?? "Fix the file to run it."} Cap ${cap}.</p>
              <ul className="mt-3 space-y-2">
                {run?.orders.map((order) => (
                  <li key={`${order.mint}-${order.side}`} className="flex items-center justify-between gap-2">
                    <span className="text-sm">
                      {order.side === "buy" ? "Buy" : "Sell"} {order.symbol}
                      <span className="ml-2 font-mono text-[11px] text-white/40">{formatUsd(order.last)} · {(order.premium * 100).toFixed(1)}% · ${order.usd.toFixed(2)}</span>
                    </span>
                    <button type="button" disabled={busy || !(order.usd > 0)} onClick={() => onSign(order)} className="min-h-9 shrink-0 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40">Sign</button>
                  </li>
                ))}
              </ul>
              <label className="mt-4 block text-xs text-white/45">
                App name
                <input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder={spec?.title || "App"} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white" />
              </label>
              <button type="button" onClick={makeApp} className="mt-3 min-h-10 w-full rounded-full border border-white/15 text-sm font-semibold">
                Make this an app
              </button>
              <p className="mt-2 text-[11px] leading-relaxed text-white/35">
                An app is this strategy with a name. One pointed at a shipped file picks up our updates. One pointed at yours does not.
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
