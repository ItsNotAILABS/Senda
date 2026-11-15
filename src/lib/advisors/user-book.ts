/** Strategies and apps this browser saved. A catalog update never writes this store. */

import { parseAdvisor } from "@/lib/advisors/parse";
import { openText, sealText, type PrivateBox } from "@/lib/private-box";
import type { AdvisorApp, AdvisorSpec, CatalogUpdate } from "@/lib/advisors/types";

const KEY = "senda.advisors.v1";

type FileRow = { id: string; source: string; forkedFrom?: string; at: string; seal?: PrivateBox };

type Box = {
  files: FileRow[];
  apps: AdvisorApp[];
  seen: { ready: boolean; versions: Record<string, number> };
};

/** Cleartext for this tab only. A reload locks the file again. The passphrase is not written. */
const session = new Map<string, { source: string; pass: string }>();

function empty(): Box {
  return { files: [], apps: [], seen: { ready: false, versions: {} } };
}

function read(): Box {
  if (typeof window === "undefined") return empty();
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "") as Partial<Box>;
    const files = Array.isArray(raw.files)
      ? raw.files.flatMap((row) => {
          if (!row || typeof row.id !== "string") return [];
          const seal = row.seal && typeof row.seal.salt === "string" && typeof row.seal.iv === "string" && typeof row.seal.box === "string" ? row.seal : undefined;
          if (typeof row.source !== "string" && !seal) return [];
          return [{ id: row.id, source: typeof row.source === "string" ? row.source : "", forkedFrom: row.forkedFrom, at: row.at, seal }];
        })
      : [];
    const apps = Array.isArray(raw.apps) ? raw.apps.filter((row) => row && typeof row.id === "string" && typeof row.advisorId === "string") : [];
    const versions = raw.seen && raw.seen.versions && typeof raw.seen.versions === "object" ? raw.seen.versions : {};
    return { files, apps, seen: { ready: Boolean(raw.seen?.ready), versions } };
  } catch {
    return empty();
  }
}

function write(box: Box) {
  window.localStorage.setItem(KEY, JSON.stringify({ ...box, files: box.files.slice(0, 40), apps: box.apps.slice(0, 40) }));
}

function slug(title: string): string {
  const text = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
  return text || "trader";
}

function clearOf(row: FileRow): string {
  return session.get(row.id)?.source ?? (row.seal ? "" : row.source);
}

export function listUserFiles(): FileRow[] {
  return read().files;
}

export function userFileLock(id: string): "clear" | "sealed" | "open" {
  const row = read().files.find((file) => file.id === id);
  if (!row?.seal) return "clear";
  return session.has(id) ? "open" : "sealed";
}

export function userSpecs(): Array<{ ok: true; spec: AdvisorSpec } | { ok: false; id: string; error: string }> {
  return read().files.map((row) => {
    if (row.seal && !session.has(row.id)) return { ok: false, id: row.id, error: "Sealed. Unlock it with the passphrase." };
    const parsed = parseAdvisor(clearOf(row), row.id, "you");
    return parsed.ok ? parsed : { ok: false, id: row.id, error: parsed.error };
  });
}

export function createUserSource(source: string, forkedFrom?: string): { ok: true; spec: AdvisorSpec } | { ok: false; error: string } {
  const peek = parseAdvisor(source, "you:draft", "you");
  if (!peek.ok) return peek;
  const id = `you:${slug(peek.spec.title)}-${Math.random().toString(36).slice(2, 6)}`;
  const parsed = parseAdvisor(source, id, "you");
  if (!parsed.ok) return parsed;
  const box = read();
  box.files.unshift({ id, source: parsed.spec.source, forkedFrom, at: new Date().toISOString() });
  write(box);
  return parsed;
}

export function writeUserSource(id: string, source: string): { ok: true; spec: AdvisorSpec } | { ok: false; error: string } {
  if (!id.startsWith("you:")) return { ok: false, error: "A shipped file is replaced by an update, not by an edit." };
  const parsed = parseAdvisor(source, id, "you");
  if (!parsed.ok) return parsed;
  const box = read();
  const row = box.files.find((file) => file.id === id);
  if (!row) return { ok: false, error: "That file is not on this browser." };
  if (row.seal) return { ok: false, error: "This file is sealed. Unlock it, then save." };
  row.source = parsed.spec.source;
  row.at = new Date().toISOString();
  write(box);
  return parsed;
}

/** Re-encrypts with the passphrase already used to unlock this visit. */
export async function saveSealedSource(id: string, source: string): Promise<{ ok: true; spec: AdvisorSpec } | { ok: false; error: string }> {
  const mem = session.get(id);
  if (!mem) return { ok: false, error: "Unlock the file before saving." };
  const parsed = parseAdvisor(source, id, "you");
  if (!parsed.ok) return parsed;
  const box = read();
  const row = box.files.find((file) => file.id === id);
  if (!row?.seal) return { ok: false, error: "That file is not sealed." };
  try {
    row.seal = await sealText(parsed.spec.source, mem.pass);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The file stayed sealed." };
  }
  row.source = "";
  row.at = new Date().toISOString();
  session.set(id, { source: parsed.spec.source, pass: mem.pass });
  write(box);
  return parsed;
}

export async function sealUserFile(id: string, passphrase: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id.startsWith("you:")) return { ok: false, error: "Save the file on this browser before sealing it." };
  const box = read();
  const row = box.files.find((file) => file.id === id);
  if (!row) return { ok: false, error: "That file is not on this browser." };
  const source = session.get(id)?.source || row.source;
  if (!source.trim()) return { ok: false, error: "There is nothing to seal." };
  try {
    row.seal = await sealText(source, passphrase);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The file was not sealed." };
  }
  row.source = "";
  row.at = new Date().toISOString();
  session.set(id, { source, pass: passphrase });
  write(box);
  return { ok: true };
}

export async function unlockUserFile(id: string, passphrase: string): Promise<{ ok: true; source: string } | { ok: false; error: string }> {
  const row = read().files.find((file) => file.id === id);
  if (!row?.seal) return { ok: false, error: "That file is not sealed." };
  try {
    const source = await openText(row.seal, passphrase);
    session.set(id, { source, pass: passphrase });
    return { ok: true, source };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The passphrase did not open this file." };
  }
}

export function dropUserFile(id: string) {
  if (!id.startsWith("you:")) return;
  session.delete(id);
  const box = read();
  box.files = box.files.filter((row) => row.id !== id);
  box.apps = box.apps.filter((row) => row.advisorId !== id);
  write(box);
}

export function listApps(): AdvisorApp[] {
  return read().apps;
}

export function saveApp(input: { name: string; blurb: string; advisorId: string }): { ok: true; app: AdvisorApp } | { ok: false; error: string } {
  const name = input.name.trim().slice(0, 32);
  if (name.length < 2) return { ok: false, error: "Name the app." };
  if (!input.advisorId.startsWith("ship:") && !input.advisorId.startsWith("you:")) return { ok: false, error: "Pick a strategy first." };
  const app: AdvisorApp = {
    id: `app:${Math.random().toString(36).slice(2, 10)}`,
    name,
    blurb: input.blurb.trim().slice(0, 140),
    advisorId: input.advisorId,
    at: new Date().toISOString(),
  };
  const box = read();
  box.apps.unshift(app);
  write(box);
  return { ok: true, app };
}

export function dropApp(id: string) {
  const box = read();
  box.apps = box.apps.filter((row) => row.id !== id);
  write(box);
}

/** First open records the catalog. Later, only a bumped version is an update. */
export function pullCatalog(rows: { id: string; title: string; version: number }[]): CatalogUpdate[] {
  const box = read();
  if (!box.seen.ready) {
    box.seen.ready = true;
    for (const row of rows) box.seen.versions[row.id] = row.version;
    write(box);
    return [];
  }
  const updates: CatalogUpdate[] = [];
  for (const row of rows) {
    const previous = box.seen.versions[row.id];
    if (previous !== row.version) updates.push({ id: row.id, title: row.title, version: row.version, previous: previous ?? 0 });
  }
  return updates;
}

export function ackCatalog(rows: { id: string; version: number }[]) {
  const box = read();
  box.seen.ready = true;
  for (const row of rows) box.seen.versions[row.id] = row.version;
  write(box);
}