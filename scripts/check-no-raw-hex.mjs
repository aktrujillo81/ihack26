#!/usr/bin/env node
/**
 * Fails if a raw hex color (#fff, #ffffff, #ffffffff) appears in app/, components/
 * or lib/ outside app/tokens.css. Components use --ww-* tokens only
 * (docs/style-guide.md, AGENTS.md "UI work").
 *
 *   npm run check:hex
 *
 * LEGACY lists files that already had raw hex before the style guide. They are
 * exempt so the guard can block NEW raw hex now; remove each file from the list
 * when its screen is moved to tokens. Never add a file to it to make the guard pass.
 *
 * Node, not bash, so it runs the same on Windows, macOS and CI.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["app", "components", "lib"];
const EXTENSIONS = new Set([".css", ".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const ALLOWED = new Set(["app/tokens.css"]);
const LEGACY = new Set(["app/globals.css"]);

// A '#' not part of a word, then 3, 4, 6 or 8 hex digits, then not more word characters
// (so "#main", "#content" and "&#39;" are not hex colors).
const HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (EXTENSIONS.has(path.extname(name))) out.push(full);
  }
  return out;
}

const offenders = [];
for (const root of ROOTS) {
  for (const file of files(root)) {
    const rel = file.split(path.sep).join("/");
    if (ALLOWED.has(rel) || LEGACY.has(rel)) continue;
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        for (const match of line.matchAll(HEX)) offenders.push(`${rel}:${i + 1}  ${match[0]}`);
      });
  }
}

if (offenders.length > 0) {
  console.error("Raw hex colors found. Use a --ww-* token from app/tokens.css instead:\n");
  for (const o of offenders) console.error("  " + o);
  process.exit(1);
}
console.log(`No raw hex colors outside app/tokens.css (${LEGACY.size} legacy files exempt).`);
