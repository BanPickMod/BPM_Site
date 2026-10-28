#!/usr/bin/env node
/**
 * Bulk-upload colosseum replays.
 *
 *   node scripts/colosseum/upload.mjs <dir> --url https://site --token $ADMIN_TOKEN [--dry-run]
 *
 * For every <name>.SC2Replay in <dir> (recursive) a sibling <name>.json manifest must exist
 * (format: docs/Colosseum_Ingest.md). Re-running is safe: the server is idempotent per game.
 * URL and token may also come from BPM_URL / ADMIN_TOKEN. With operator two-factor on, also set ADMIN_TOTP_SECRET (the operator's
 * authenticator secret); the script signs in once with the current code.
 */
import fs from "node:fs";
import path from "node:path";
import { adminBearer } from "../ops/admin-session.mjs";

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const dir = args[0]?.startsWith("--") ? undefined : args[0];
const url = (flag("url") ?? process.env.BPM_URL ?? "").replace(/\/$/, "");
const token = flag("token") ?? process.env.ADMIN_TOKEN ?? "";
const dry = args.includes("--dry-run");

if (!dir || !url || (!token && !dry)) {
  console.error("usage: upload.mjs <dir> --url <site> --token <ADMIN_TOKEN> [--dry-run]");
  process.exit(2);
}

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

const bearer = dry ? token : await adminBearer(url, token);
const replays = walk(dir).filter((f) => f.toLowerCase().endsWith(".sc2replay")).sort();
let ok = 0;
let failed = 0;

for (const file of replays) {
  const manifestPath = file.replace(/\.sc2replay$/i, ".json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`SKIP  ${file}: no manifest ${path.basename(manifestPath)}`);
    failed++;
    continue;
  }
  if (dry) {
    console.log(`DRY   ${file}`);
    ok++;
    continue;
  }
  const form = new FormData();
  form.set("replay", new Blob([fs.readFileSync(file)]), path.basename(file));
  form.set("manifest", fs.readFileSync(manifestPath, "utf8"));
  try {
    const res = await fetch(`${url}/api/admin/games`, { method: "POST", headers: { authorization: `Bearer ${bearer}` }, body: form });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`${res.status === 201 ? "NEW  " : "UPD  "} ${file} -> game ${body.id}`);
      ok++;
    } else {
      console.error(`FAIL  ${file}: ${res.status} ${body.error ?? ""} ${(body.details ?? []).join("; ")}`);
      failed++;
    }
  } catch (e) {
    console.error(`FAIL  ${file}: ${e.message}`);
    failed++;
  }
}

console.log(`done: ${ok} ok, ${failed} failed, ${replays.length} replays`);
// exitCode (not process.exit) lets pending fetch handles close; exit() can trip a libuv assertion on Windows.
process.exitCode = failed ? 1 : 0;
