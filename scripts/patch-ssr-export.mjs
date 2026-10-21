/**
 * Nitro's Vercel chunk split breaks the server two ways, and every request
 * then returns {"error":true,"status":500,"unhandled":true}:
 * 1. `_ssr/ssr.mjs` exports `ssr_exports`, which was never defined.
 *    The renderer loads that export (`n.s`) as the server. Point it at
 *    `server_default`, which is the real fetch handler.
 * 2. `ssr2.mjs` imports `__exportAll` from `ssr.mjs` while `ssr.mjs` imports
 *    `ssr2.mjs`, so the helper is still unset. Inline it.
 * Also copy the PGLite wasm next to the bundle. The server looks for it there.
 */
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = ".vercel/output/functions/__server.func/_ssr";
const ssrPath = join(dir, "ssr.mjs");
const ssr2Path = join(dir, "ssr2.mjs");

const helper = `function __exportAll$1(all, no_symbols) {
	let target = {};
	for (var name in all) Object.defineProperty(target, name, { get: all[name], enumerable: true });
	if (!no_symbols) Object.defineProperty(target, Symbol.toStringTag, { value: "Module" });
	return target;
}
`;

let ssr = await readFile(ssrPath, "utf8");
if (ssr.includes("ssr_exports as s")) {
  ssr = ssr.replace("ssr_exports as s", "server_default as s");
  await writeFile(ssrPath, ssr);
  console.log("[patch-ssr] pointed export s at server_default");
} else if (!ssr.includes("server_default as s")) {
  ssr = ssr.replace("server_exports as t };", "server_default as s, server_exports as t };");
  await writeFile(ssrPath, ssr);
  console.log("[patch-ssr] added server_default as s");
} else {
  console.log("[patch-ssr] export s already points at server_default");
}

let ssr2 = await readFile(ssr2Path, "utf8");
const cycle = 'import { c as __exportAll$1 } from "./ssr.mjs";\n';
if (ssr2.includes(cycle)) {
  ssr2 = ssr2.replace(cycle, helper);
  await writeFile(ssr2Path, ssr2);
  console.log("[patch-ssr] inlined __exportAll so ssr2 no longer imports ssr");
} else if (ssr2.includes("function __exportAll$1")) {
  console.log("[patch-ssr] cycle already broken");
} else {
  console.error("[patch-ssr] ssr2.mjs did not have the expected import");
  process.exit(1);
}

const dataSrc = "node_modules/@electric-sql/pglite/dist";
const dataDest = ".vercel/output/functions/__server.func/_libs";
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  await copyFile(join(dataSrc, name), join(dataDest, name));
}
console.log("[patch-ssr] copied pglite wasm next to the server bundle");
