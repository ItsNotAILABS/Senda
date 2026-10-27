/**
 * Nitro's Vercel chunk split breaks the server entry two ways:
 * 1. `_ssr/ssr.mjs` exports `ssr_exports`, which is never defined.
 * 2. `ssr2.mjs` imports `__exportAll` from `ssr.mjs` while `ssr.mjs` imports
 *    `ssr2.mjs`, so the helper is still in TDZ and every request 500s.
 * Nothing else needs that cycle. Inline the helper and drop the bad export.
 */
import { copyFile, readFile, writeFile, access } from "node:fs/promises";
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

let ssr2 = "";
try {
  await access(ssr2Path);
  ssr2 = await readFile(ssr2Path, "utf8");
} catch {
  ssr2 = "";
}
const cycle = 'import { c as __exportAll$1 } from "./ssr.mjs";\n';
if (!ssr2) {
  console.log("[patch-ssr] no ssr2.mjs in this build; cycle patch skipped");
} else if (ssr2.includes(cycle)) {
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

// @coral-xyz/anchor pulls in js-sha256, which calls eval("require('crypto')")
// while the server chunk is ESM. That throws on every page, so the publish
// screenshots come back blank. The pure JS hash is enough. Skip the Node branch.
const anchorPath = ".vercel/output/functions/__server.func/_libs/@coral-xyz/anchor.mjs";
try {
  let anchor = await readFile(anchorPath, "utf8");
  const nodeBranch = "if (NODE_JS) method = nodeWrap(method, is224);";
  const exportsCrash = `if (!isBrowser) {
	exports.workspace = (init_workspace(), __toCommonJS(workspace_exports)).default;
	exports.Wallet = (init_nodewallet(), __toCommonJS(nodewallet_exports)).default;
}`;
  let changed = false;
  if (anchor.includes(nodeBranch)) {
    anchor = anchor.replace(nodeBranch, "if (false) method = nodeWrap(method, is224);");
    changed = true;
    console.log("[patch-ssr] skipped js-sha256 require() so pages can render");
  }
  if (anchor.includes(exportsCrash)) {
    anchor = anchor.replace(exportsCrash, "if (false) { /* node wallet exports crash ESM */ }");
    changed = true;
    console.log("[patch-ssr] skipped anchor node exports that reference exports");
  }
  if (changed) await writeFile(anchorPath, anchor);
  else console.log("[patch-ssr] anchor chunk already safe");
} catch (err) {
  console.error("[patch-ssr] no anchor chunk to patch", err);
  process.exit(1);
}
