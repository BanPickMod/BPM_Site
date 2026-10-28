#!/usr/bin/env node
/**
 * Daily retention run, meant for a scheduler (for example a Railway cron service):
 *
 *   SITE_URL=https://<site> ADMIN_TOKEN=<token> node scripts/ops/run-retention.mjs            # dry run: only counts
 *   SITE_URL=https://<site> ADMIN_TOKEN=<token> node scripts/ops/run-retention.mjs --delete   # deletes what is past its date
 *
 * With operator two-factor on (always in production) also set ADMIN_TOTP_SECRET to this operator's authenticator secret; the script
 * signs in with the current code first.
 *
 * Prints the report. Exits 1 on an error, when an original file could not be deleted after repeated tries (`gaveUp`), or when
 * a delete failed this run, so the scheduler's failure alert tells the operator something needs a look.
 */
const base = (process.env.SITE_URL ?? "").replace(/\/$/, "");
const token = process.env.ADMIN_TOKEN ?? "";
if (!base || !token) {
  console.error("SITE_URL and ADMIN_TOKEN are required");
  process.exit(2);
}
import { adminBearer } from "./admin-session.mjs";
const dryRun = !process.argv.includes("--delete");
const bearer = await adminBearer(base, token);
const res = await fetch(`${base}/api/admin/maintenance/retention`, {
  method: "POST",
  headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
  body: JSON.stringify({ dryRun }),
});
const text = await res.text();
console.log(text);
if (!res.ok) process.exit(1);
const r = JSON.parse(text);
if (r.sources.gaveUp > 0 || r.sources.failed > 0 || r.storageQueue.gaveUp > 0 || r.storageQueue.failed > 0 || r.ledger.outboxPending > 0) {
  console.error(`attention: original files ${r.sources.failed} failed / ${r.sources.gaveUp} gave up; queued files ${r.storageQueue.failed} failed / ${r.storageQueue.gaveUp} gave up; ledger copies waiting ${r.ledger.outboxPending}`);
  process.exit(1);
}
