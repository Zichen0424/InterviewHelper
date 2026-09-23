import { randomUUID } from "node:crypto";
import { readFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";

const origin = "http://127.0.0.1:3000";
const privateName = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.md$/;

test("paste, publish, search, and delete a private interview", async ({ page, request, isMobile }) => {
  test.skip(isMobile, "Run the state-changing pipeline once; the mobile management layout has a separate check.");
  test.setTimeout(120_000);
  const config = JSON.parse(await readFile(path.join(process.cwd(), "config.json"), "utf8"));
  expect(config.llm.provider).toBe("mock");
  expect(config.embedding.provider).toBe("mock");

  const title = `E2E 面经 ${randomUUID().slice(0, 8)}`;
  const raw = `# ${title}\n\n公司：自动化验证\n岗位：AI 开发工程师\n日期：2026-09-23\n标签：RAG、Embedding\n\n- RAG 检索召回率低时如何排查？\n\n这是一篇仅供自动化测试使用的私人面经。`;
  let id: string | undefined;
  let deleted = false;
  try {
    await page.goto("/manage");
    await page.getByRole("textbox", { name: "面经原文" }).fill(raw);
    const savedResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/interviews") && response.request().method() === "POST");
    await page.getByRole("button", { name: "保存并整理" }).click();
    const savedResponse = await savedResponsePromise;
    expect(savedResponse.status(), await savedResponse.text()).toBe(201);
    await expect(page.getByRole("status")).toContainText("原文已保存");
    const link = page.getByRole("link", { name: "查看完整面经" });
    id = (await link.getAttribute("href"))?.split("/").at(-1);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    await expect(page.getByRole("button", { name: `删除 ${title}` })).toBeVisible();

    await page.goto("/");
    await page.getByRole("textbox", { name: "搜索面经" }).fill(title);
    await page.getByRole("button", { name: "搜索面经", exact: true }).click();
    await expect(page.locator("article").filter({ hasText: title })).toHaveCount(1);
    await page.goto(`/interviews/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("heading", { name: "完整原文" }).locator("..")).toContainText("RAG 检索召回率低时如何排查？");

    await page.goto("/manage");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: `删除 ${title}` }).click();
    await expect(page.getByRole("status")).toContainText("已删除");
    await expect(page.getByRole("button", { name: `删除 ${title}` })).toHaveCount(0);
    deleted = true;
    const missing = await page.goto(`/interviews/${id}`);
    expect(missing?.status()).toBe(404);
    await page.goto(`/?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole("heading", { name: "暂时没有找到相关面经" })).toBeVisible();
  } finally {
    if (id && !deleted) {
      try { deleted = (await request.delete(`/api/interviews/${id}`, { headers: { Origin: origin }, timeout: 20_000 })).ok(); } catch { /* Fall back to exact-content cleanup. */ }
    }
    if (!deleted) {
      const directory = path.join(process.cwd(), "data", "raw", "private");
      const names = await readdir(directory).catch(() => []);
      let removed = false;
      for (const name of names) {
        if (!privateName.test(name)) continue;
        const file = path.join(directory, name);
        if ((await readFile(file, "utf8").catch(() => null)) !== raw) continue;
        await unlink(file);
        removed = true;
      }
      if (removed) {
        const retry = await request.patch("/api/interviews", { headers: { Origin: origin }, timeout: 20_000 });
        expect(retry.ok(), "Test cleanup must restore the published index").toBe(true);
      }
    }
  }
});

test("management page fits a phone viewport", async ({ page, isMobile }) => {
  test.skip(!isMobile, "This layout check only applies to mobile.");
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/manage");
  await expect(page.getByRole("textbox", { name: "面经原文" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const labels = [
    page.getByRole("link", { name: "面经札记首页" }),
    page.getByRole("link", { name: "爱心清单" }),
    page.getByRole("link", { name: "整理指南" }),
  ];
  const boxes = await Promise.all(labels.map(label => label.boundingBox()));
  expect(boxes.every(Boolean)).toBe(true);
  const centers = boxes.map(box => box!.y + box!.height / 2);
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(8);
  expect(boxes[0]!.x + boxes[0]!.width).toBeLessThanOrEqual(boxes[1]!.x);
  expect(boxes[1]!.x + boxes[1]!.width).toBeLessThanOrEqual(boxes[2]!.x);
});
