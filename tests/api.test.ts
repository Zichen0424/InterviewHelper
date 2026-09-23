import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/search/route";
import { getSnapshot } from "../src/lib/data";
import { readEmbeddingConfig, embeddingProvider, SearchError, mockVector } from "../src/lib/providers";

vi.mock("../src/lib/data", () => ({ getSnapshot: vi.fn() }));
vi.mock("../src/lib/providers", async importOriginal => ({ ...await importOriginal<typeof import("../src/lib/providers")>(), readEmbeddingConfig: vi.fn(), embeddingProvider: vi.fn() }));
const data = JSON.parse(readFileSync("tests/fixtures/snapshot.json", "utf8"));
const config = JSON.parse(readFileSync("tests/fixtures/provider.json", "utf8")).config;
const embed = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSnapshot).mockReturnValue(data);
  vi.mocked(readEmbeddingConfig).mockReturnValue(config);
  vi.mocked(embeddingProvider).mockReturnValue({ embed });
  embed.mockResolvedValue([mockVector("消息队列")]);
});
const request = (body: unknown) => new Request("http://localhost/api/search", { method: "POST", body: JSON.stringify(body) });
it("blocks model mismatch before making a paid call", async () => {
  vi.mocked(readEmbeddingConfig).mockReturnValue({ ...config, model: "different" });
  const response = await POST(request({ query: "Redis", mode: "semantic" }));
  expect(response.status).toBe(409);
  expect((await response.json()).code).toBe("INDEX_MISMATCH");
  expect(embed).not.toHaveBeenCalled();
});
it("keeps keywords usable when the embedding provider is unavailable", async () => {
  embed.mockRejectedValue(new SearchError("服务暂时不可用", "PROVIDER_UNAVAILABLE"));
  expect((await POST(request({ query: "Redis", mode: "semantic" }))).status).toBe(503);
  const keyword = await POST(request({ query: "Redis", mode: "keyword" }));
  expect(keyword.status).toBe(200);
  expect((await keyword.json()).items.length).toBeGreaterThan(0);
  expect(embed).toHaveBeenCalledTimes(1);
});
it("does not expose vectors or raw full documents in search results", async () => {
  const response = await POST(request({ query: "消息", mode: "semantic" }));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.items.length).toBeGreaterThan(0);
  expect(body.items[0]).not.toHaveProperty("vector");
  expect(body.items[0]).not.toHaveProperty("raw");
  expect(body.items[0]).not.toHaveProperty("source");
});
it("applies the browser heart list to both search modes", async () => {
  const id = data.interviews[0].id;
  const keyword = await POST(request({ query: "Redis", mode: "keyword", filters: { ids: [id] } }));
  expect(keyword.status).toBe(200);
  expect((await keyword.json()).items.map((item: { id: string }) => item.id)).toEqual([id]);
  const empty = await POST(request({ query: "Redis", mode: "keyword", filters: { ids: [] } }));
  expect((await empty.json()).items).toEqual([]);
  const semantic = await POST(request({ query: "消息", mode: "semantic", filters: { ids: [id] } }));
  expect(semantic.status).toBe(200);
  const semanticBody = await semantic.json();
  expect(semanticBody.items).toHaveLength(1);
  expect(semanticBody.items[0].id).toBe(id);
});
