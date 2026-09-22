import { readFileSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import { snapshotSchema, searchRequestSchema } from "../src/lib/schema";
import { CompatibleEmbedding, fingerprint, mockVector, normalize } from "../src/lib/providers";
import { keywordSearch, semanticSearch } from "../src/lib/search";

const data = snapshotSchema.parse(JSON.parse(readFileSync("tests/fixtures/snapshot.json", "utf8")));
const contract = JSON.parse(readFileSync("tests/fixtures/provider.json", "utf8"));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("cross-language data and provider contract", () => {
  it("matches Python fingerprints and vectors", () => {
    expect(fingerprint(contract.config)).toBe(contract.fingerprint);
    mockVector(contract.input).forEach((v, i) => expect(v).toBeCloseTo(contract.vector[i], 12));
  });
  it("does not invalidate vectors when a key environment variable changes", () => {
    expect(fingerprint({ ...contract.config, api_key_env: "ANOTHER_KEY" })).toBe(contract.fingerprint);
  });
  it("rejects malformed vectors", () => { expect(() => normalize([0, 0])).toThrow(); expect(() => normalize([NaN])).toThrow(); });
});
describe("retrieval", () => {
  it("matches Chinese substrings, case and fullwidth terms", () => {
    expect(keywordSearch(data, "缓存").length).toBeGreaterThan(0);
    expect(keywordSearch(data, "ＲＥＤＩＳ").map(i => i.id)).toEqual(keywordSearch(data, "redis").map(i => i.id));
  });
  it("requires all query terms and applies filters", () => {
    expect(keywordSearch(data, "Redis MySQL").length).toBeGreaterThan(0);
    expect(keywordSearch(data, "Redis 不存在的关键词")).toHaveLength(0);
    expect(keywordSearch(data, "Redis", { category: "前端" })).toHaveLength(0);
    expect(keywordSearch(data, " ")).toHaveLength(0);
  });
  it("returns semantic matches aggregated by interview", () => {
    const results = semanticSearch(data, mockVector("消息队列如何削峰"));
    expect(new Set(results.map(i => i.id)).size).toBe(results.length);
    expect(results[0].tags).toContain("消息队列");
    expect(results[0].chunk_id).toBeTruthy();
  });
  it("rejects incompatible dimensions", () => { expect(() => semanticSearch(data, [1, 0])).toThrow(/维度/); });
  it("validates queries and forbids client provider configuration", () => {
    expect(searchRequestSchema.safeParse({ query: " ", mode: "semantic" }).success).toBe(false);
    expect(searchRequestSchema.safeParse({ query: "x".repeat(501), mode: "keyword" }).success).toBe(false);
    expect(searchRequestSchema.safeParse({ query: "hello", mode: "semantic", base_url: "http://evil" }).success).toBe(false);
  });
  it("keeps 1000-document keyword queries within a practical local budget", () => {
    const expanded = { ...data, interviews: Array.from({ length: 1000 }, (_, i) => ({ ...data.interviews[i % data.interviews.length], id: String(i) })), chunks: [] };
    const start = performance.now();
    expect(keywordSearch(expanded, "Redis").length).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
it("cloud adapter normalizes vectors and respects purpose and response order", async () => {
  vi.stubEnv("TEST_KEY", "test-only-secret");
  const fakeFetch = vi.fn().mockResolvedValue(Response.json({ data: [{ index: 1, embedding: [0, 3] }, { index: 0, embedding: [2, 0] }] }));
  vi.stubGlobal("fetch", fakeFetch);
  const provider = new CompatibleEmbedding({ provider: "openai-compatible", base_url: "https://example.com/v1", model: "any-model", api_key_env: "TEST_KEY", query_prefix: "query: " });
  expect(await provider.embed(["one", "two"], "query")).toEqual([[1, 0], [0, 1]]);
  const payload = JSON.parse(fakeFetch.mock.calls[0][1].body);
  expect(payload.input).toEqual(["query: one", "query: two"]);
  expect(payload).not.toHaveProperty("dimensions");
});
