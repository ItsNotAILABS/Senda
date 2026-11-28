/** Isolated actor runtimes. A definition is not an instance. An instance is not a session. */

export const ACTOR_RUNTIMES = [
  { id: "cloudflare-do", name: "Cloudflare DO", line: "One durable object. The loop stays inside it." },
  { id: "pi-durable", name: "Pi-Durable", line: "Extensions sit next to the loop and survive the turn." },
  { id: "vercel-eve", name: "Vercel Eve", line: "A fresh instance for each session." },
  { id: "rivet", name: "Rivet", line: "Different loops, one backend, one tenant." },
  { id: "deepseek", name: "DeepSeek Agent", line: "Shell and a file editor. Nothing else loaded." },
] as const;

export const COMPUTER_KINDS = [
  { id: "claude-remote", name: "Claude Remote", kind: "sandbox" as const },
  { id: "cursor", name: "Cursor Agent", kind: "sandbox" as const },
  { id: "cua", name: "Cua", kind: "sandbox" as const },
  { id: "local", name: "This computer", kind: "local" as const },
] as const;

export const FILESYSTEMS = [
  { id: "archil", name: "Archil" },
  { id: "s3", name: "S3 Filesystems" },
  { id: "juicefs", name: "JuiceFS" },
] as const;

export type RuntimeId = (typeof ACTOR_RUNTIMES)[number]["id"];
export type ComputerKind = (typeof COMPUTER_KINDS)[number]["id"];
export type FsId = (typeof FILESYSTEMS)[number]["id"];
export type Tool = "shell" | "editor" | "search" | "mail" | "drive";
export type AclVia = "agent" | "initiator" | "both";

export type Definition = {
  id: string;
  name: string;
  runtime: RuntimeId;
  tools: Tool[];
  mega: boolean;
};

export type Computer = {
  id: string;
  name: string;
  provider: ComputerKind;
  checkpoint: string;
};

export type Instance = {
  id: string;
  definitionId: string;
  computerId: string;
  memory: string[];
};

export type Turn = { role: "you" | "actor"; text: string; at: number };

export type Session = {
  id: string;
  instanceId: string;
  turns: Turn[];
};

export type Ace = { id: string; via: AclVia };

export type FsFile = {
  path: string;
  body: string;
  acl: Ace[];
};

export type Hook = { match: string; line: string };

export type ActorWorld = {
  fs: FsId;
  definitions: Definition[];
  computers: Computer[];
  instances: Instance[];
  sessions: Session[];
  files: FsFile[];
};

const KEY = "senda.actors.v1";

function nid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyWorld(): ActorWorld {
  return {
    fs: "juicefs",
    definitions: [
      { id: "def-grokbot", name: "Grokbot", runtime: "deepseek", tools: ["shell", "editor"], mega: false },
      { id: "def-desk", name: "Desk", runtime: "cloudflare-do", tools: ["shell", "editor", "search"], mega: true },
      { id: "def-swarm", name: "Swarm hand", runtime: "rivet", tools: ["shell", "editor"], mega: false },
      { id: "def-mexico", name: "Mexico", runtime: "rivet", tools: ["shell", "editor"], mega: false },
      { id: "def-brazil", name: "Brazil", runtime: "rivet", tools: ["shell", "editor"], mega: false },
    ],
    computers: [
      { id: "cpu-local", name: "This computer", provider: "local", checkpoint: "live" },
      { id: "cpu-cursor", name: "Cursor sandbox", provider: "cursor", checkpoint: "base" },
      { id: "cpu-cua", name: "Cua sandbox", provider: "cua", checkpoint: "base" },
      { id: "cpu-claude", name: "Claude remote", provider: "claude-remote", checkpoint: "base" },
    ],
    instances: [],
    sessions: [],
    files: [
      { path: "/agents/def-grokbot/HOOKS", body: "", acl: [{ id: "def-grokbot", via: "agent" }, { id: "you", via: "both" }] },
      { path: "/shared/env", body: "DESK=senda\n", acl: [{ id: "you", via: "initiator" }] },
      { path: "/desk/notes", body: "", acl: [{ id: "def-desk", via: "agent" }, { id: "you", via: "both" }] },
      { path: "/agents/def-mexico/HOOKS", body: "when spei say Mexico stays on SPEI. This actor does not run Pix.\n", acl: [{ id: "def-mexico", via: "agent" }, { id: "you", via: "both" }] },
      { path: "/agents/def-brazil/HOOKS", body: "when pix say Brazil stays on Pix. This actor does not run SPEI.\n", acl: [{ id: "def-brazil", via: "agent" }, { id: "you", via: "both" }] },
    ],
  };
}

export function loadWorld(): ActorWorld {
  if (typeof localStorage === "undefined") return emptyWorld();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyWorld();
    const parsed = JSON.parse(raw) as ActorWorld;
    if (!parsed?.definitions || !parsed.computers || !parsed.files) return emptyWorld();
    const base = emptyWorld();
    for (const def of base.definitions) {
      if (!parsed.definitions.some((row) => row.id === def.id)) parsed.definitions.push(def);
    }
    for (const file of base.files) {
      const have = parsed.files.find((row) => row.path === file.path);
      if (!have) parsed.files.push(file);
      else if (!have.body.trim() && file.body.trim()) have.body = file.body;
    }
    return parsed;
  } catch {
    return emptyWorld();
  }
}

export function saveWorld(world: ActorWorld) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(world));
}

export function canTouch(file: FsFile, who: string, as: "agent" | "initiator"): boolean {
  return file.acl.some((ace) => {
    if (ace.via === "both") return ace.id === who || ace.id === "you";
    if (as === "agent") return ace.via === "agent" && ace.id === who;
    return ace.via === "initiator" && (ace.id === who || ace.id === "you");
  });
}

export function readFile(world: ActorWorld, path: string, who: string, as: "agent" | "initiator"): string | { error: string } {
  const file = world.files.find((row) => row.path === path);
  if (!file) return { error: "No such path." };
  if (!canTouch(file, who, as)) return { error: "This principal cannot read that path." };
  return file.body;
}

export function writeFile(world: ActorWorld, path: string, body: string, who: string, as: "agent" | "initiator"): ActorWorld | { error: string } {
  const file = world.files.find((row) => row.path === path);
  if (!file) {
    const next: FsFile = { path, body, acl: [{ id: who, via: as === "agent" ? "agent" : "initiator" }, { id: "you", via: "both" }] };
    return { ...world, files: [...world.files, next] };
  }
  if (!canTouch(file, who, as)) return { error: "This principal cannot write that path." };
  return { ...world, files: world.files.map((row) => (row.path === path ? { ...row, body } : row)) };
}

export function spawn(world: ActorWorld, definitionId: string, computerId: string): ActorWorld | { error: string } {
  const def = world.definitions.find((row) => row.id === definitionId);
  const cpu = world.computers.find((row) => row.id === computerId);
  if (!def || !cpu) return { error: "Pick a definition and a computer." };
  const instance: Instance = { id: nid("act"), definitionId, computerId, memory: [] };
  const session: Session = { id: nid("ses"), instanceId: instance.id, turns: [] };
  return { ...world, instances: [instance, ...world.instances], sessions: [session, ...world.sessions] };
}

export function addComputer(world: ActorWorld, provider: ComputerKind, name: string): ActorWorld {
  const cpu: Computer = { id: nid("cpu"), name: name.trim() || provider, provider, checkpoint: "base" };
  return { ...world, computers: [...world.computers, cpu] };
}

export function cloneCheckpoint(world: ActorWorld, computerId: string): ActorWorld | { error: string } {
  const cpu = world.computers.find((row) => row.id === computerId);
  if (!cpu) return { error: "That computer is gone." };
  const copy: Computer = { ...cpu, id: nid("cpu"), name: `${cpu.name} clone`, checkpoint: cpu.checkpoint };
  return { ...world, computers: [...world.computers, copy] };
}

function hookPath(def: Definition): string {
  return def.id === "def-desk" ? "/desk/notes" : `/agents/${def.id}/HOOKS`;
}

function hooksOf(world: ActorWorld, def: Definition): Hook[] {
  const file = world.files.find((row) => row.path === hookPath(def));
  if (!file || !canTouch(file, def.id, "agent")) return [];
  return file.body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("when "))
    .map((line) => {
      const cut = line.indexOf(" say ");
      if (cut < 0) return null;
      return { match: line.slice(5, cut).trim().toLowerCase(), line: line.slice(cut + 5).trim() };
    })
    .filter((row): row is Hook => Boolean(row?.match && row.line));
}

function refusedTool(def: Definition, text: string): string | null {
  const lower = text.toLowerCase();
  if (def.id === "def-mexico" && /\bpix\b|\bbrazil\b|\bbrasil\b/.test(lower)) return "This actor only runs Mexico SPEI.";
  if (def.id === "def-brazil" && /\bclabe\b|\bmexico\b|\bspei\b/.test(lower)) return "This actor only runs Brazil Pix.";
  if (!def.tools.includes("search") && /\bsearch\b|\binternet\b/.test(lower)) return "Search is not on this definition.";
  if (!def.tools.includes("mail") && /\bgmail\b|\bmail\b/.test(lower)) return "Mail is not on this definition.";
  if (!def.tools.includes("drive") && /\bdrive\b/.test(lower)) return "Drive is not on this definition.";
  return null;
}

/** One turn inside one instance. Hooks this actor wrote are the only extra code that runs. */
export function runTurn(world: ActorWorld, instanceId: string, text: string): ActorWorld | { error: string } {
  const said = text.trim();
  if (!said) return { error: "Say something." };
  const instance = world.instances.find((row) => row.id === instanceId);
  if (!instance) return { error: "That actor is not running." };
  const def = world.definitions.find((row) => row.id === instance.definitionId);
  const cpu = world.computers.find((row) => row.id === instance.computerId);
  if (!def || !cpu) return { error: "This actor lost its definition or its computer." };
  const session = world.sessions.find((row) => row.instanceId === instanceId);
  if (!session) return { error: "This actor has no session." };

  let next = world;
  const hookWrite = said.match(/^hook\s+when\s+(.+?)\s+say\s+(.+)$/i);
  if (hookWrite) {
    const path = hookPath(def);
    const file = next.files.find((row) => row.path === path);
    const body = `${file?.body || ""}${file?.body ? "\n" : ""}when ${hookWrite[1].trim()} say ${hookWrite[2].trim()}`;
    const wrote = writeFile(next, path, body, def.id, "agent");
    if ("error" in wrote) return wrote;
    next = wrote;
  }

  const blocked = refusedTool(def, said);
  const hooks = hooksOf(next, def).filter((hook) => said.toLowerCase().includes(hook.match));
  const reply = blocked
    ? blocked
    : [
        `${def.name} · ${ACTOR_RUNTIMES.find((row) => row.id === def.runtime)?.name} · ${cpu.name}`,
        `Tools ${def.tools.join(", ")}. ${def.mega ? "Mega definition." : "Bespoke definition."}`,
        hooks.length ? `Hooks ${hooks.map((hook) => hook.line).join(" ")}` : "No hook fired.",
        hookWrite ? "Wrote the hook onto the filesystem. The next turn on this actor can use it. Other actors cannot." : said,
      ].join("\n");

  const at = Date.now();
  const turns = [...session.turns, { role: "you" as const, text: said, at }, { role: "actor" as const, text: reply, at: at + 1 }];
  return {
    ...next,
    instances: next.instances.map((row) => (row.id === instance.id ? { ...row, memory: [...row.memory, said].slice(-12) } : row)),
    sessions: next.sessions.map((row) => (row.id === session.id ? { ...row, turns: turns.slice(-24) } : row)),
  };
}

export function noteTurn(world: ActorWorld, instanceId: string, said: string, reply: string): ActorWorld | { error: string } {
  const instance = world.instances.find((row) => row.id === instanceId);
  const session = world.sessions.find((row) => row.instanceId === instanceId);
  if (!instance || !session) return { error: "That actor is not running." };
  const at = Date.now();
  const turns = [...session.turns, { role: "you" as const, text: said, at }, { role: "actor" as const, text: reply, at: at + 1 }];
  return {
    ...world,
    sessions: world.sessions.map((row) => (row.id === session.id ? { ...row, turns: turns.slice(-24) } : row)),
  };
}
