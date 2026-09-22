import { test, expect } from "@playwright/test";

test("browse, filter and read original evidence", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("让每一份面经");
  await expect(page.locator("article")).toHaveCount(6);
  await page.getByRole("button", { name: "前端", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("link", { name: "前端二面：把页面性能问题讲清楚", exact: true }).click();
  await expect(page.getByRole("heading", { name: "完整原文" })).toBeVisible();
  await page.getByText("查看原文依据", { exact: true }).first().click();
  await expect(page.locator("blockquote").first()).toContainText("React");
});

test("keyword and semantic search return linked results", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "搜索面经" }).fill("Redis MySQL");
  await page.getByRole("button", { name: "搜索面经", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.getByText("命中原文", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "语义搜索", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索面经" }).fill("消息队列如何削峰");
  await expect(page.getByRole("button", { name: "搜索面经", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "搜索面经", exact: true }).click();
  await expect(page.locator("article").first()).toContainText("消息队列与高峰流量");
  await page.locator("article").first().getByRole("link", { name: /^阅读 / }).click();
  await expect(page).toHaveURL(/\/interviews\/.*#/);
  const id = new URL(page.url()).hash.slice(1);
  await expect(page.locator(`[id="${id}"]`)).toBeVisible();
});

test("empty results and API validation", async ({ page, request }) => {
  await page.goto("/?q=不存在的资料关键词");
  await expect(page.getByRole("heading", { name: "暂时没有找到相关面经" })).toBeVisible();
  expect((await request.post("/api/search", { data: { query: " ", mode: "semantic" } })).status()).toBe(400);
  expect((await request.post("/api/search", { data: { query: "Redis", mode: "keyword", build_id: "outdated" } })).status()).toBe(409);
  const missing = await page.goto("/interviews/does-not-exist");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "这篇面经暂时找不到了" })).toBeVisible();
});

test("no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
