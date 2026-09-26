import { test, expect } from "@playwright/test";

test("public reading and search, protected management, admin login and logout", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("article").first()).toBeVisible();
  const search = await page.request.post("/api/search", { data: { query: "RAG", mode: "keyword" } });
  expect(search.status()).toBe(200);
  const { items } = await search.json();
  expect(items.length).toBeGreaterThan(0);
  await page.goto(`/interviews/${items[0].id}`);
  await expect(page.getByRole("heading", { name: "完整原文" })).toBeVisible();
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const target = method === "DELETE" ? `/api/interviews/${items[0].id}` : "/api/interviews";
    const result = await page.request.fetch(target, { method, headers: { Origin: "http://127.0.0.1:3000" }, data: { raw: "must not save" } });
    expect(result.status()).toBe(401);
  }
  await page.goto("/manage");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("textbox", { name: "面经原文" })).toHaveCount(0);
  await page.getByLabel("管理员账号").fill("e2e-owner");
  await page.getByLabel("密码", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/manage$/);
  await expect(page.getByRole("textbox", { name: "面经原文" })).toBeVisible();
  const cookie = (await page.context().cookies()).find(item => item.name === "interview_admin")!;
  expect(cookie.httpOnly).toBe(true);
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
  const replay = await page.request.patch("/api/interviews", { headers: { Origin: "http://127.0.0.1:3000", Cookie: `${cookie.name}=${cookie.value}` } });
  expect(replay.status()).toBe(401);
});
