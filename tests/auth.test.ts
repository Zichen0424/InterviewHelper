import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { createSession, validSession, requireAdminWrite, SESSION_COOKIE, sessionCookie } from "../src/lib/auth";

let directory: string;
let password: string;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-01-01"));
  directory = await mkdtemp(path.join(tmpdir(), "interview-auth-"));
  password = randomBytes(24).toString("hex");
  vi.stubEnv("DATA_DIR", directory);
  vi.stubEnv("ADMIN_USERNAME", "test-owner");
  vi.stubEnv("ADMIN_PASSWORD", password);
  vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
});
afterEach(async () => { vi.useRealTimers(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
const request = (body: unknown, origin = "http://localhost:3000", cookie = "") => new Request("http://localhost:3000/api/auth/login", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body),
});

it("logs in with an opaque HttpOnly cookie and revokes replay on logout", async () => {
  const response = await login(request({ username: "test-owner", password }));
  expect(response.status).toBe(200);
  const header = response.headers.get("set-cookie")!;
  expect(header).toContain("HttpOnly"); expect(header).toContain("SameSite=Strict");
  expect(header).not.toContain(password);
  const cookie = header.split(";")[0];
  const token = cookie.split("=")[1];
  expect(await validSession(token)).toBe(true);
  const result = await logout(request({}, undefined, cookie));
  expect(result.status).toBe(200);
  expect(result.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(await validSession(token)).toBe(false);
});

it("rejects wrong credentials, CSRF, absent configuration and oversized bodies", async () => {
  expect((await login(request({ username: "test-owner", password: "incorrect" }))).status).toBe(401);
  expect((await login(request({ username: "test-owner", password }, "http://evil.test"))).status).toBe(403);
  expect((await login(request({ password: "x".repeat(5000) }))).status).toBe(400);
  vi.stubEnv("SESSION_SECRET", "");
  expect((await login(request({ username: "test-owner", password }))).status).toBe(503);
});

it("invalidates tampered, expired and credential-rotated sessions", async () => {
  const token = await createSession();
  expect(await validSession(token.slice(0, -1) + "!")).toBe(false);
  vi.stubEnv("ADMIN_PASSWORD", randomBytes(24).toString("hex"));
  expect(await validSession(token)).toBe(false);
  vi.stubEnv("ADMIN_PASSWORD", password);
  vi.setSystemTime(Date.now() + 13 * 60 * 60 * 1000);
  expect(await validSession(token)).toBe(false);
});

it("uses Secure cookies for HTTPS and rejects missing Origin on writes", async () => {
  vi.stubEnv("APP_ORIGIN", "https://notes.example.test");
  expect(sessionCookie("token")).toContain("; Secure");
  const token = await createSession();
  await expect(requireAdminWrite(new Request("https://notes.example.test/api/interviews", { method: "PATCH", headers: { Cookie: `${SESSION_COOKIE}=${token}` } }))).rejects.toMatchObject({ status: 403 });
});

it("bounds failed login attempts without trusting client IP headers", async () => {
  vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000);
  for (let i = 0; i < 10; i++) expect((await login(request({ username: "test-owner", password: "wrong" }))).status).toBe(401);
  expect((await login(request({ username: "test-owner", password }))).status).toBe(429);
  vi.setSystemTime(Date.now() + 16 * 60_000);
  expect((await login(request({ username: "test-owner", password }))).status).toBe(200);
});
