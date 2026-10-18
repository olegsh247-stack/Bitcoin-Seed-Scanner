// Builds the single-file index.html from src/template.html + src/app.js.
// All dependencies are bundled in; the result makes no CDN requests.
// Also refreshes the SHA-256 shown in every README.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLACEHOLDER = "<!--APP_SCRIPT-->";

const result = await build({
  entryPoints: [join(root, "src/app.js")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  platform: "browser",
  legalComments: "none",
  charset: "utf8",
  write: false,
  logLevel: "warning",
});
const code = result.outputFiles[0].text;

const template = readFileSync(join(root, "src/template.html"), "utf8");
if (template.split(PLACEHOLDER).length !== 2)
  throw new Error("template must contain exactly one placeholder");

// An inline script must never contain a literal closing tag.
if (/<\/script/i.test(code)) throw new Error("bundle contains </script — cannot inline safely");

// The CSP allows exactly this one inline script, identified by its hash, so any
// injected or modified script is refused by the browser.
const scriptBody = `\n${code}`;
const cspHash = createHash("sha256").update(scriptBody).digest("base64");
if (!template.includes("__CSP_HASH__")) throw new Error("template is missing __CSP_HASH__");
const html = template
  .replace("__CSP_HASH__", cspHash)
  .replace(PLACEHOLDER, () => `<script>${scriptBody}</script>`);

// Guard: no remote code may be loaded. Data fetches are limited by the CSP to the three listed servers.
const remoteCode = html.match(
  /<script[^>]+src=|<link[^>]+rel=["']?(stylesheet|modulepreload)|from\s*["']https?:|import\s*\(\s*["']https?:/gi,
);
if (remoteCode) throw new Error("remote code reference found: " + remoteCode[0]);
if (/esm\.sh|unpkg|jsdelivr|cdnjs/i.test(html)) throw new Error("CDN reference found in output");

writeFileSync(join(root, "index.html"), html);
const sha = createHash("sha256")
  .update(readFileSync(join(root, "index.html")))
  .digest("hex");

for (const f of readdirSync(root).filter((n) => /^README(\.[a-z]{2})?\.md$/.test(n))) {
  const p = join(root, f);
  const md = readFileSync(p, "utf8");
  if (!/[0-9a-f]{64}/.test(md)) throw new Error(`${f}: no SHA-256 line to update`);
  writeFileSync(p, md.replace(/[0-9a-f]{64}/, sha));
}

console.log(`index.html  ${(html.length / 1024).toFixed(0)} KiB`);
console.log(`sha256      ${sha}`);
