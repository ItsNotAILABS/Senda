import { useState } from "react";
import { toast } from "sonner";
import {
  ACTOR_RUNTIMES,
  COMPUTER_KINDS,
  FILESYSTEMS,
  addComputer,
  cloneCheckpoint,
  loadWorld,
  noteTurn,
  runTurn,
  saveWorld,
  spawn,
  writeFile,
  type ActorWorld,
  type ComputerKind,
  type FsId,
} from "@/lib/actor-runtime";
import { cn } from "@/lib/utils";

export function ActorDesk() {
  const [world, setWorld] = useState<ActorWorld>(() => loadWorld());
  const [instanceId, setInstanceId] = useState("");
  const [line, setLine] = useState("");
  const [defId, setDefId] = useState(world.definitions[0]?.id ?? "");
  const [cpuId, setCpuId] = useState(world.computers[0]?.id ?? "");
  const [cpuName, setCpuName] = useState("");
  const [provider, setProvider] = useState<ComputerKind>("cursor");
  const [path, setPath] = useState("/shared/env");
  const [body, setBody] = useState("DESK=senda\n");

  function commit(next: ActorWorld | { error: string }) {
    if ("error" in next) {
      toast.error(next.error);
      return;
    }
    saveWorld(next);
    setWorld(next);
  }

  const selected = world.instances.find((row) => row.id === instanceId) ?? world.instances[0] ?? null;
  const session = world.sessions.find((row) => row.instanceId === selected?.id);
  const def = world.definitions.find((row) => row.id === selected?.definitionId);
  const cpu = world.computers.find((row) => row.id === selected?.computerId);
  const onThisCpu = selected ? world.instances.filter((row) => row.computerId === selected.computerId).length : 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-white">
      <p className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">Actors</p>
      <h2 className="mt-1 text-xl font-semibold">One harness, its own runtime</h2>
      <p className="mt-1 max-w-xl text-sm text-white/50">A definition is not an instance. An instance is not a session. Hooks one actor writes stay on that actor.</p>

      <div className="mt-4 flex gap-2 overflow-x-auto">
        {ACTOR_RUNTIMES.map((row) => (
          <div key={row.id} className="w-44 shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-semibold">{row.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">{row.line}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 p-3">
          <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Spawn</p>
          <div className="mt-2 flex flex-col gap-2">
            <select value={defId} onChange={(e) => setDefId(e.target.value)} className="min-h-11 rounded-xl bg-[#1c1c1e] px-3 text-sm">
              {world.definitions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {ACTOR_RUNTIMES.find((runtime) => runtime.id === row.runtime)?.name} · {row.tools.join(", ")}
                </option>
              ))}
            </select>
            <select value={cpuId} onChange={(e) => setCpuId(e.target.value)} className="min-h-11 rounded-xl bg-[#1c1c1e] px-3 text-sm">
              {world.computers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {COMPUTER_KINDS.find((kind) => kind.id === row.provider)?.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const next = spawn(world, defId, cpuId);
                if ("error" in next) return toast.error(next.error);
                commit(next);
                setInstanceId(next.instances[0]?.id ?? "");
              }}
              className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
            >
              Start actor
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {world.instances.map((row) => {
              const named = world.definitions.find((item) => item.id === row.definitionId);
              return (
                <button key={row.id} type="button" onClick={() => setInstanceId(row.id)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-sm", selected?.id === row.id ? "bg-white text-black" : "bg-white/8 text-white/70")}>
                  {named?.name} {row.id.slice(-4)}
                </button>
              );
            })}
            {world.instances.length === 0 ? <p className="text-sm text-white/40">No actor running.</p> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 p-3">
          <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Computers</p>
          <p className="mt-1 text-xs text-white/45">{world.instances.length} actors · {world.computers.length} computers{onThisCpu ? ` · ${onThisCpu} on this one` : ""}</p>
          <div className="mt-2 flex flex-col gap-2">
            {world.computers.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                <div>
                  <p className="text-sm">{row.name}</p>
                  <p className="text-[11px] text-white/40">{row.provider} · {row.checkpoint} · {world.instances.filter((item) => item.computerId === row.id).length} actors</p>
                </div>
                <button type="button" onClick={() => commit(cloneCheckpoint(world, row.id))} className="min-h-9 rounded-full border border-white/15 px-3 text-xs">
                  Clone
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <select value={provider} onChange={(e) => setProvider(e.target.value as ComputerKind)} className="min-h-11 flex-1 rounded-xl bg-[#1c1c1e] px-3 text-sm">
              {COMPUTER_KINDS.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
            <input value={cpuName} onChange={(e) => setCpuName(e.target.value)} placeholder="Name" className="min-h-11 w-28 rounded-xl bg-[#1c1c1e] px-3 text-sm" />
            <button type="button" onClick={() => { commit(addComputer(world, provider, cpuName)); setCpuName(""); }} className="min-h-11 rounded-full bg-white/10 px-3 text-sm">
              Add
            </button>
          </div>
        </section>
      </div>

      <section className="mt-3 rounded-3xl border border-white/10 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Session</p>
          <p className="text-[11px] text-white/40">{def ? `${def.name} · ${cpu?.name ?? "no computer"}` : "Start an actor"}</p>
        </div>
        <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
          {(session?.turns ?? []).map((turn, index) => (
            <p key={`${turn.at}-${index}`} className={cn("whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm", turn.role === "you" ? "bg-white/8" : "bg-accent/15")}>{turn.text}</p>
          ))}
          {!session?.turns.length ? <p className="text-sm text-white/40">No turns. A hook is written as: hook when price say check the book</p> : null}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selected || !def) return toast.error("Start an actor first.");
            const rail = def.id === "def-mexico" ? "mexico" : def.id === "def-brazil" ? "brazil" : "";
            if (!rail) {
              const next = runTurn(world, selected.id, line);
              if ("error" in next) return toast.error(next.error);
              commit(next);
              setLine("");
              return;
            }
            void fetch("/api/rails", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ op: "actor", actor: rail, text: line }),
            })
              .then((res) => res.json())
              .then((body: { error?: string; from?: string; quote?: { local: number; ccy: string; feeUsd: number; spei?: { protocol?: string; bankName?: string; concept?: string } | null; pix?: { protocol?: string; shown?: string; concept?: string } | null } }) => {
                const detail = body.quote?.spei
                  ? `${body.quote.spei.protocol || "SPEI"} ${body.quote.spei.bankName || ""} concept ${body.quote.spei.concept || ""}.`.replace(/\s+/g, " ")
                  : body.quote?.pix
                    ? `${body.quote.pix.protocol || "Pix"} ${body.quote.pix.shown || ""} concept ${body.quote.pix.concept || ""}.`.replace(/\s+/g, " ")
                    : "";
                const reply = body.error || !body.quote
                  ? body.error || "No quote."
                  : `${body.from === "grok" ? "Grok read the sentence." : "The actor read the sentence."} ${body.quote.local} ${body.quote.ccy} after a ${body.quote.feeUsd} USD fee. ${detail} Nothing was signed.`;
                const next = noteTurn(world, selected.id, line, reply);
                if ("error" in next) throw new Error(next.error);
                commit(next);
                setLine("");
                if (body.error || !body.quote) throw new Error(reply);
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "The actor did not quote."));
          }}
        >
          <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Tell this actor" className="min-h-11 flex-1 rounded-full bg-[#1c1c1e] px-4 text-sm" />
          <button type="submit" className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">Run</button>
        </form>
      </section>

      <section className="mt-3 rounded-3xl border border-white/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Filesystem</p>
          <div className="flex gap-1">
            {FILESYSTEMS.map((row) => (
              <button key={row.id} type="button" onClick={() => commit({ ...world, fs: row.id as FsId })} className={cn("rounded-full px-2 py-1 text-[11px]", world.fs === row.id ? "bg-white text-black" : "text-white/45")}>
                {row.name}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-xs text-white/40">Access sits on the file, not on the computer. Agents and the person who started the turn are different principals.</p>
        <ul className="mt-2 space-y-1">
          {world.files.map((file) => (
            <li key={file.path}>
              <button type="button" onClick={() => { setPath(file.path); setBody(file.body); }} className="flex w-full items-baseline justify-between gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-white/5">
                <span className="font-mono text-xs">{file.path}</span>
                <span className="text-[10px] text-white/35">{file.acl.map((ace) => `${ace.id === "you" ? "you" : ace.id.replace("def-", "")}:${ace.via}`).join(" ")}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-col gap-2">
          <input value={path} onChange={(e) => setPath(e.target.value)} className="min-h-11 rounded-xl bg-[#1c1c1e] px-3 font-mono text-xs" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="rounded-xl bg-[#1c1c1e] px-3 py-2 font-mono text-xs" />
          <button
            type="button"
            onClick={() => {
              const next = writeFile(world, path.trim(), body, "you", "initiator");
              if ("error" in next) return toast.error(next.error);
              commit(next);
            }}
            className="min-h-11 rounded-full border border-white/15 text-sm"
          >
            Write as you
          </button>
        </div>
      </section>
    </div>
  );
}
