import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

function fail(message) { console.error(message); process.exit(1); }
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12 || Buffer.byteLength(process.env.SESSION_SECRET || "") < 32) {
  fail("Set ADMIN_USERNAME, ADMIN_PASSWORD (at least 12 characters), and SESSION_SECRET (at least 32 bytes) in .env.");
}
let origin;
try { origin = new URL(process.env.APP_ORIGIN); } catch { fail("Set a valid APP_ORIGIN."); }
if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
    (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))) {
  fail("APP_ORIGIN must be an HTTPS origin or a local HTTP origin.");
}
const directory = path.resolve(process.env.DATA_DIR || "data");
for (const name of ["raw/private", "cache", "generated", "reports", "auth/sessions"]) mkdirSync(path.join(directory, name), { recursive: true, mode: 0o700 });
// Never copy host data or overwrite an existing published snapshot on restart.
if (!existsSync(path.join(directory, "generated/snapshot.json"))) {
  const result = spawnSync(process.env.PYTHON || "python3", ["-m", "pipeline", "build"], { stdio: "inherit", env: process.env });
  if (result.error || result.status !== 0) fail("Initial data build failed. Check model configuration and DATA_DIR permissions.");
}
