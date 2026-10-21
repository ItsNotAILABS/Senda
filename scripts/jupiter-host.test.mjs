import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const repo = resolve(import.meta.dirname, "..");
function* sources(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(path);
    else if (/\.(mjs|ts|tsx)$/.test(entry.name)) yield path;
  }
}
test("runtime sources do not depend on the Jupiter Lite hostname", () => {
  let inspected = 0;
  for (const dir of ["src", "mcp"]) {
    for (const path of sources(join(repo, dir))) {
      inspected += 1;
      assert.equal(readFileSync(path, "utf8").includes("lite-api.jup.ag"), false, relative(repo, path));
    }
  }
  assert.ok(inspected > 50, "Expected Senda runtime sources");
});
