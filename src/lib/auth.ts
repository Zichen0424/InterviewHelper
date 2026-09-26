import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dataPath } from "./paths";

export const SESSION_COOKIE = "interview_admin";
export const SESSION_SECONDS = 12 * 60 * 60;

export class AuthError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}

function configuration() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!username || !password || password.length < 12 || !secret || Buffer.byteLength(secret) < 32) {
    throw new AuthError("管理员认证尚未正确配置，请检查服务器环境变量。", "AUTH_CONFIG", 503);
  }
  return { username, password, secret };
}

export function appOrigin(): URL {
  let origin: URL;
  try { origin = new URL(process.env.APP_ORIGIN || "http://localhost:3000"); }
  catch { throw new AuthError("APP_ORIGIN 配置无效。", "AUTH_CONFIG", 503); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      (origin.protocol !== "https:" && !(local && origin.protocol === "http:"))) {
    throw new AuthError("APP_ORIGIN 必须为 HTTPS 来源或本机 HTTP 来源。", "AUTH_CONFIG", 503);
  }
  return origin;
}

// Explicit origin avoids trusting Next's internal container URL or forwarded headers.
export function checkSameOrigin(request: Request): void {
  const expected = appOrigin();
  const host = request.headers.get("host") || new URL(request.url).host;
  const site = request.headers.get("sec-fetch-site");
  if (request.headers.get("origin") !== expected.origin || host.toLowerCase() !== expected.host.toLowerCase() ||
      (site && site !== "same-origin" && site !== "none")) {
    throw new AuthError("请从本站页面操作。", "INVALID_ORIGIN", 403);
  }
}

function equal(left: string, right: string): boolean {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

export function verifyCredentials(username: string, password: string): boolean {
  const config = configuration();
  const validUser = equal(username, config.username);
  const validPassword = equal(password, config.password);
  return validUser && validPassword;
}

function credentialVersion(): string {
  const { username, password, secret } = configuration();
  return createHmac("sha256", secret).update(JSON.stringify([username, password])).digest("hex");
}

function sessionFile(token: string): string {
  const { secret } = configuration();
  const id = createHmac("sha256", secret).update(token).digest("hex");
  return dataPath("auth", "sessions", `${id}.json`);
}

type Session = { expires: number; version: string };
export async function createSession(): Promise<string> {
  const version = credentialVersion();
  const directory = dataPath("auth", "sessions");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  // Prune expired sessions only; active sessions survive container restarts.
  for (const name of await readdir(directory)) {
    if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
    const file = dataPath("auth", "sessions", name);
    try {
      const session = JSON.parse(await readFile(file, "utf8")) as Session;
      if (session.expires <= Date.now() || session.version !== version) await unlink(file);
    } catch { /* A concurrent logout may have removed this file. */ }
  }
  const token = randomBytes(32).toString("base64url");
  await writeFile(sessionFile(token), JSON.stringify({ expires: Date.now() + SESSION_SECONDS * 1000, version }), { flag: "wx", mode: 0o600 });
  return token;
}

export async function validSession(token: string | undefined): Promise<boolean> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  try {
    const session = JSON.parse(await readFile(sessionFile(token), "utf8")) as Session;
    return Number.isFinite(session.expires) && session.expires > Date.now() &&
      session.expires <= Date.now() + SESSION_SECONDS * 1000 && session.version === credentialVersion();
  } catch { return false; }
}

export function requestToken(request: Request): string | undefined {
  return request.headers.get("cookie")?.split(";").map(item => item.trim()).find(item => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  try { await unlink(sessionFile(token)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}

export async function requireAdminWrite(request: Request): Promise<void> {
  if (!await validSession(requestToken(request))) throw new AuthError("请先登录管理员账号。", "UNAUTHORIZED", 401);
  checkSameOrigin(request);
}

export function sessionCookie(token: string, clear = false): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${appOrigin().protocol === "https:" ? "; Secure" : ""}`;
}

export function authFailure(error: unknown): Response {
  const known = error instanceof AuthError;
  return Response.json({ error: known ? error.message : "认证服务暂时不可用。", code: known ? error.code : "AUTH_FAILED" },
    { status: known ? error.status : 500, headers: { "Cache-Control": "no-store" } });
}
