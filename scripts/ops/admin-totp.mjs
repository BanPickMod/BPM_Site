#!/usr/bin/env node
/**
 * Operator two-factor helper (lib/totp.ts).
 *
 *   node scripts/ops/admin-totp.mjs new <operator-name>     a new secret and the link for the authenticator app
 *   ADMIN_TOTP_SECRET=<secret> node scripts/ops/admin-totp.mjs code     the code that is valid right now (to check a setup)
 *
 * `new` prints the line to add to ADMIN_TOTP on the server ("name:SECRET", comma separated for several operators). Enter the
 * secret into the authenticator app (Google Authenticator, Authy, 1Password, ...) on the operator's phone; delete the terminal
 * output afterwards. The secret is shown only here: it is not stored anywhere else.
 */
import { currentCode, newSecret, otpauthUrl } from "../../lib/totp.ts";

const [cmd, name] = process.argv.slice(2);
if (cmd === "new") {
  if (!/^[a-z0-9][a-z0-9_-]{0,23}$/.test(name ?? "")) {
    console.error("usage: admin-totp.mjs new <operator-name>   (lower case letters, digits, _ and -, as in ADMIN_TOKENS)");
    process.exit(2);
  }
  const secret = newSecret();
  console.log(`Secret for the app (type it in as a time-based key):\n  ${secret.match(/.{1,4}/g).join(" ")}\n`);
  console.log(`Or open this link on the phone:\n  ${otpauthUrl(name, secret)}\n`);
  console.log(`Add to ADMIN_TOTP on the server (keep the other operators, comma separated):\n  ${name}:${secret}\n`);
  console.log("Then sign in at /ko/admin/feedback with the operator token and the 6-digit code.");
} else if (cmd === "code") {
  const secret = process.env.ADMIN_TOTP_SECRET ?? "";
  if (!secret) {
    console.error("ADMIN_TOTP_SECRET is required");
    process.exit(2);
  }
  console.log(currentCode(secret));
} else {
  console.error("usage: admin-totp.mjs new <operator-name> | code");
  process.exit(2);
}
