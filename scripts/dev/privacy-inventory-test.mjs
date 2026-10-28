#!/usr/bin/env node
/**
 * Privacy data inventory check (docs/Privacy_Compliance_Additional_Plan.md, A2).
 *
 *   npm run test:privacy
 *
 * Applies every migration to a throwaway in-memory Postgres (PGlite), reads the resulting columns, and compares them with
 * docs/Privacy_Data_Inventory.md. A column missing from the inventory, an inventory row for a column that does not exist,
 * an unknown classification or an empty cell fails the run. It also checks that every object-storage key prefix used in
 * lib/server appears in the inventory. A change that adds personal data therefore cannot pass without being classified.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../../lib/server/migrations.ts";
import { EXPORT_COLUMNS, NOT_EXPORTED, USER_TABLES } from "../../lib/exportSpec.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const doc = fs.readFileSync(path.join(root, "docs/Privacy_Data_Inventory.md"), "utf8").replace(/\r\n/g, "\n");
const CLASSES = new Set(["ID", "PSEUDO", "CONTENT", "LOG", "CONSENT", "SECRET", "OPS", "NONPERSONAL"]);
// Classes that can identify or describe a person: they must say how they are removed and how long they are kept.
const PERSONAL = new Set(["ID", "PSEUDO", "CONTENT", "LOG", "CONSENT"]);

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${String(detail).slice(0, 400)}`}`);
  if (!ok) failed++;
};

const pg = new PGlite();
await migrate((sql) => pg.exec(sql));
const { rows } = await pg.query(
  "select table_name t, column_name c from information_schema.columns where table_schema = 'public' and table_name <> 'schema_migration'",
);
const actual = new Set(rows.map((r) => `${r.t}.${r.c}`));

const listed = new Map();
const problems = [];
for (const line of doc.split("\n")) {
  const m = line.match(/^\|\s*`([a-z_]+\.[a-z_0-9]+)`\s*\|(.*)\|\s*$/);
  if (!m) continue;
  const cells = m[2].split("|").map((c) => c.trim());
  if (cells.length !== 4) { problems.push(`${m[1]}: expected 5 columns`); continue; }
  const [cls, why, keep, del] = cells;
  if (listed.has(m[1])) problems.push(`${m[1]}: listed twice`);
  listed.set(m[1], { cls, why, keep, del });
  if (!CLASSES.has(cls)) problems.push(`${m[1]}: unknown class "${cls}"`);
  if (!why) problems.push(`${m[1]}: purpose is empty`);
  if (!keep || !del) problems.push(`${m[1]}: retention or deletion path is empty`);
}

const missing = [...actual].filter((k) => !listed.has(k)).sort();
const extra = [...listed.keys()].filter((k) => !actual.has(k)).sort();
check("every column the migrations create is in the inventory", missing.length === 0, `missing: ${missing.join(", ")}`);
check("the inventory lists no column that does not exist", extra.length === 0, `extra: ${extra.join(", ")}`);
check("every row has a known class, a purpose, a retention and a deletion path", problems.length === 0, problems.join("; "));
check("the schema was read (sanity)", actual.size > 100, String(actual.size));

// personal data may not claim it is kept forever without an owner decision
const forever = [...listed].filter(([, v]) => PERSONAL.has(v.cls) && /^(영구|무기한)$/.test(v.keep)).map(([k]) => k);
check("no personal column is kept 'forever' without a rule", forever.length === 0, forever.join(", "));

// "download my data" must cover every personal column of the tables an account owns, or say why not (A10)
const exported = new Set(Object.entries(EXPORT_COLUMNS).flatMap(([t, cols]) => cols.map((c) => `${t}.${c}`)));
const personalOfUser = [...listed].filter(([k, v]) => PERSONAL.has(v.cls) && USER_TABLES.includes(k.split(".")[0])).map(([k]) => k);
const uncovered = personalOfUser.filter((k) => !exported.has(k) && !(k in NOT_EXPORTED));
check("every personal column of the user's tables is in the export or named in NOT_EXPORTED", uncovered.length === 0, `uncovered: ${uncovered.join(", ")}`);
check("the export lists only columns that exist", [...exported].every((k) => actual.has(k)), [...exported].filter((k) => !actual.has(k)).join(", "));
check("NOT_EXPORTED names real columns, each with a reason, and none is also exported", Object.entries(NOT_EXPORTED).every(([k, why]) => actual.has(k) && why.length > 10 && !exported.has(k)), "");
const secretsExported = [...exported].filter((k) => listed.get(k)?.cls === "SECRET");
check("no secret (token or code hash) is exported", secretsExported.length === 0, secretsExported.join(", "));

// object-storage prefixes used by the server must be inventoried
const used = new Set();
for (const f of fs.readdirSync(path.join(root, "lib/server")).filter((n) => n.endsWith(".ts"))) {
  const src = fs.readFileSync(path.join(root, "lib/server", f), "utf8");
  for (const m of src.matchAll(/const key = `([a-z]+)\//g)) used.add(m[1]);
}
const unlisted = [...used].filter((p) => !doc.includes(`\`${p}/`));
check("every object-storage key prefix in the code is in the inventory", used.size >= 4 && unlisted.length === 0, `used: ${[...used]} unlisted: ${unlisted}`);

// the A3 promise: the inventory must not claim a raw handle is stored
check("the inventory says raw handles are not stored", /핸들 원문[^\n]*저장하지 않는다/.test(doc));

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
