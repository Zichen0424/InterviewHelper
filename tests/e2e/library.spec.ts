import { test, expect } from "@playwright/test";

test("browse by technology and read original evidence", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("下一场，更有准备");
  const initial = await page.locator("article").count();
  expect(initial).toBeGreaterThan(0);
  const tag = await page.locator("article .card-tags button").first().innerText();
  await page.locator("article .card-tags button").first().click();
  await expect(page).toHaveURL(new RegExp(`tag=${encodeURIComponent(tag)}`));
  expect(await page.locator("article").count()).toBeGreaterThan(0);
  expect(await page.locator("article").count()).toBeLessThanOrEqual(initial);
  await page.locator("article h2 a").first().click();
  await expect(page.getByRole("heading", { name: "完整原文" })).toBeVisible();
  await page.getByText("查看原文依据", { exact: true }).first().click();
  await expect(page.locator("blockquote").first()).not.toBeEmpty();
});

test("AI development stacks are easy to discover and filter", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("combobox", { name: "按技术栈筛选" }).selectOption("RAG");
  } else {
    await expect(page.getByRole("button", { name: "筛选技术栈 RAG" })).toBeVisible();
    await expect(page.getByRole("button", { name: "筛选技术栈 Agent" })).toBeVisible();
    await page.getByRole("button", { name: "筛选技术栈 RAG" }).click();
  }
  await expect(page).toHaveURL(/tag=RAG/);
  await expect(page.locator("article").first()).toContainText("RAG");
});

test("keyword and semantic search return linked results", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "搜索面经" }).fill("Redis MySQL");
  await page.getByRole("button", { name: "搜索面经", exact: true }).click();
  await expect(page.locator("article").first()).toContainText("Redis");
  await expect(page.getByText("命中原文", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "语义搜索", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索面经" }).fill("消息队列如何削峰");
  await page.getByRole("button", { name: "搜索面经", exact: true }).click();
  const matchedInterview = page.locator("article").filter({ hasText: "消息队列与高峰流量" });
  await expect(matchedInterview).toHaveCount(1);
  await matchedInterview.getByRole("link", { name: /^阅读 / }).click();
  await expect(page).toHaveURL(/\/interviews\/.*#/);
  const id = new URL(page.url()).hash.slice(1);
  await expect(page.locator(`[id="${id}"]`)).toBeVisible();
});

test("one heart can be saved, restored, and cancelled", async ({ page }) => {
  await page.goto("/");
  const first = page.locator("article").first();
  const id = await first.getAttribute("data-interview-id");
  const title = await first.locator("h2").innerText();
  const tag = await first.locator(".card-tags button").first().innerText();
  expect(id).toBeTruthy();
  await first.getByRole("button", { name: `点亮爱心：${title}` }).click();
  await expect(first.getByRole("button", { name: `取消爱心：${title}` })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  const saved = page.locator(`article[data-interview-id="${id}"]`);
  await expect(saved.getByRole("button", { name: `取消爱心：${title}` })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^爱心清单/ }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("textbox", { name: "搜索面经" }).fill(tag);
  await page.getByRole("button", { name: "搜索面经", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("button", { name: "清空搜索" }).click();
  await saved.getByRole("button", { name: `取消爱心：${title}` }).click();
  await expect(page.getByRole("heading", { name: "把值得再读的面经，留在这里" })).toBeVisible();
  await page.reload();
  await expect(page.locator("article")).toHaveCount(0);
});

test("sort by time in both directions and put liked interviews first", async ({ page }) => {
  await page.goto("/");
  const dates = async () => page.locator("article").evaluateAll(nodes => nodes.map(node => Date.parse(node.getAttribute("data-date") || "")));
  const newest = await dates();
  expect(newest.every((value, index) => !index || newest[index - 1] >= value)).toBe(true);
  await page.getByRole("combobox", { name: "排序方式" }).selectOption("oldest");
  await expect(page).toHaveURL(/sort=oldest/);
  const oldest = await dates();
  expect(oldest.every((value, index) => !index || oldest[index - 1] <= value)).toBe(true);
  const firstId = await page.locator("article").first().getAttribute("data-interview-id");
  await page.locator("article").first().getByRole("button", { name: /^点亮爱心：/ }).click();
  await page.getByRole("combobox", { name: "排序方式" }).selectOption("popular");
  await expect(page).toHaveURL(/sort=popular/);
  await expect(page.locator("article").first()).toHaveAttribute("data-interview-id", firstId!);
  await page.getByRole("combobox", { name: "排序方式" }).selectOption("newest");
  await expect(page.locator("article").first()).not.toHaveAttribute("data-interview-id", firstId!);
});

test("empty results, liked search scope, and API validation", async ({ page, request }) => {
  await page.goto("/?q=不存在的资料关键词");
  await expect(page.getByRole("heading", { name: "暂时没有找到相关面经" })).toBeVisible();
  expect((await request.post("/api/search", { data: { query: " ", mode: "semantic" } })).status()).toBe(400);
  expect((await request.post("/api/search", { data: { query: "Redis", mode: "keyword", build_id: "outdated" } })).status()).toBe(409);
  const empty = await request.post("/api/search", { data: { query: "Redis", mode: "keyword", filters: { ids: [] } } });
  expect(empty.status()).toBe(200);
  expect((await empty.json()).items).toEqual([]);
  const missing = await page.goto("/interviews/does-not-exist");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "这篇面经暂时找不到了" })).toBeVisible();
});

test("library and detail pages fit the viewport", async ({ page }) => {
  await page.goto("/");
  const checkWidth = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await checkWidth();
  await page.locator("article h2 a").first().click();
  await checkWidth();
});
