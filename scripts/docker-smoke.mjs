// Run with: node --env-file=.env scripts/docker-smoke.mjs prepare|verify
// Uses one uniquely named temporary article, then removes only that article.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { chromium } from "@playwright/test";

const origin = process.env.APP_ORIGIN || "http://localhost:3000";
const statePath = ".runtime/docker-smoke.json";
const mode = process.argv[2];
assert(["prepare", "verify"].includes(mode), "Specify prepare or verify");
assert(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD, "Load the administrator environment");
const request = (url, options = {}) => fetch(new URL(url, origin), options);
const login = async () => {
  const response = await request("/api/auth/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }) });
  assert.equal(response.status, 200, "Administrator login");
  const header = response.headers.get("set-cookie");
  assert(header.includes("HttpOnly") && header.includes("SameSite=Strict"));
  return header.split(";")[0];
};
const search = async (title, mode = "keyword") => {
  const response = await request("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: title, mode }) });
  assert.equal(response.status, 200, "Anonymous search");
  return (await response.json()).items;
};

assert.equal((await request("/api/health")).status, 200, "Production health");
assert.equal((await request("/")).status, 200, "Anonymous homepage");
const denied = await request("/manage", { redirect: "manual" });
assert.equal(denied.status, 307);
assert.equal(new URL(denied.headers.get("location"), origin).pathname, "/login");
for (const method of ["POST", "PATCH", "DELETE"]) {
  const url = method === "DELETE" ? "/api/interviews/0123456789abcdef" : "/api/interviews";
  const result = await request(url, { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ raw: "unauthorized" }) });
  assert.equal(result.status, 401, `Anonymous ${method}`);
}
const cookie = await login();
const headers = { Origin: origin, Cookie: cookie, "Content-Type": "application/json" };
assert.equal((await request("/manage", { headers: { Cookie: cookie } })).status, 200);
assert.equal((await request("/api/interviews", { method: "PATCH", headers: { ...headers, Origin: "http://evil.invalid" } })).status, 403);

if (mode === "prepare") {
  let existing = false;
  try { await readFile(statePath); existing = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
  assert(!existing, "Verify the previous smoke article before preparing another");
  const title = `Docker验收 ${randomUUID()}`;
  const raw = `# ${title}\n公司：容器验证\n岗位：AI 开发\n标签：RAG、Embedding\n- 如何验证向量检索？\n这是容器持久化验收专用的临时面经。`;
  const response = await request("/api/interviews", { method: "POST", headers, body: JSON.stringify({ raw }) });
  assert.equal(response.status, 201, "Container Python pipeline publication");
  const { id } = await response.json();
  await mkdir(".runtime", { recursive: true });
  await writeFile(statePath, JSON.stringify({ id, title, raw }), { flag: "wx" });
  assert((await search(title)).some(item => item.id === id));
  assert((await search("RAG 向量检索", "semantic")).some(item => item.id === id));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(origin);
    await page.locator("article").filter({ hasText: title }).waitFor();
    await page.screenshot({ path: ".runtime/docker-home.png", fullPage: true, animations: "disabled" });
    await page.goto(`${origin}/manage`);
    await page.getByLabel("管理员账号").fill(process.env.ADMIN_USERNAME);
    await page.getByLabel("密码", { exact: true }).fill(process.env.ADMIN_PASSWORD);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.getByRole("textbox", { name: "面经原文" }).waitFor();
    await page.getByRole("button", { name: "退出登录" }).click();
    await page.waitForURL(`${origin}/login`);
  } finally { await browser.close(); }
  console.log("PASS: production browser, anonymous read/search, protected writes, admin login, Python publication. Restart Compose, then run verify.");
} else {
  const { id, title, raw } = JSON.parse(await readFile(statePath, "utf8"));
  assert((await search(title)).some(item => item.id === id), "Article index survived container recreation");
  const detail = await request(`/interviews/${id}`);
  assert.equal(detail.status, 200);
  assert((await detail.text()).includes("这是容器持久化验收专用的临时面经。"), "Original text survived");
  assert(raw.includes(title));
  const response = await request(`/api/interviews/${id}`, { method: "DELETE", headers });
  assert.equal(response.status, 200, "Delete only this test article");
  assert.equal((await request(`/interviews/${id}`)).status, 404);
  assert(!(await search(title)).some(item => item.id === id));
  await unlink(statePath);
  console.log("PASS: down/up retained the original and index; test article deleted and search updated.");
}
const logout = await request("/api/auth/logout", { method: "POST", headers });
assert.equal(logout.status, 200);
assert.equal((await request("/api/interviews", { method: "PATCH", headers })).status, 401, "Logged-out cookie cannot be replayed");
