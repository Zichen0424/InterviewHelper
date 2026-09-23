import { readFileSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import { snapshotSchema, searchRequestSchema, toCard } from "../src/lib/schema";
import { CompatibleEmbedding, fingerprint, mockVector, normalize } from "../src/lib/providers";
import { keywordSearch, semanticSearch } from "../src/lib/search";
import { aiFirstStacks, hasTag, interviewTime, parseSort, popularStacks, sortInterviews } from "../src/lib/library";
import { HEARTS_KEY, parseHearts, toggleHeart } from "../src/lib/hearts";

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
    expect(keywordSearch(data, "Redis", { tag: "React" })).toHaveLength(0);
    expect(keywordSearch(data, " ")).toHaveLength(0);
  });
  it("limits both retrieval modes to liked interview IDs when requested", () => {
    const first = keywordSearch(data, "Redis")[0];
    expect(first).toBeDefined();
    expect(keywordSearch(data, "Redis", { ids: [first.id] }).map(i => i.id)).toEqual([first.id]);
    expect(keywordSearch(data, "Redis", { ids: [] })).toHaveLength(0);
    expect(semanticSearch(data, mockVector("消息队列如何削峰"), { ids: [] })).toHaveLength(0);
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
describe("library navigation", () => {
  const cards = data.interviews.map(toCard);
  it("orders popular stacks by document frequency and counts a tag once per interview", () => {
    const stacks = popularStacks([{ tags: ["RAG", "rag", " Agent "] }, { tags: ["RAG", "Redis"] }, { tags: ["Agent"] }]);
    expect(Object.fromEntries(stacks.map(s => [s.name, s.count]))).toEqual({ Agent: 2, RAG: 2, Redis: 1 });
    expect(stacks.map(s => s.count)).toEqual([2, 2, 1]);
    expect(hasTag(["ＲＡＧ"], "rag")).toBe(true);
  });
  it("features AI development stacks before generic tags while preserving counts", () => {
    const byFrequency = popularStacks([
      { tags: ["Redis", "RAG"] }, { tags: ["Redis", "Agent"] }, { tags: ["Redis"] },
    ]);
    expect(byFrequency[0]).toEqual({ name: "Redis", count: 3 });
    expect(aiFirstStacks(byFrequency)).toEqual([
      { name: "RAG", count: 1 }, { name: "Agent", count: 1 }, { name: "Redis", count: 3 },
    ]);
  });
  it("supports time ascending, descending, and personal hearts first", () => {
    const newest = sortInterviews(cards, "newest", new Set());
    const oldest = sortInterviews(cards, "oldest", new Set());
    expect(newest.every((card, i) => !i || interviewTime(newest[i - 1]) >= interviewTime(card))).toBe(true);
    expect(oldest.every((card, i) => !i || interviewTime(oldest[i - 1]) <= interviewTime(card))).toBe(true);
    const favorite = newest.at(-1)!;
    expect(sortInterviews(cards, "popular", new Set([favorite.id]))[0].id).toBe(favorite.id);
    expect(parseSort("unexpected")).toBe("newest");
  });
});
it("stores at most one reversible heart per interview in the browser", () => {
  const storage = new Map<string, string>();
  const fakeWindow = new EventTarget() as EventTarget & { localStorage: Pick<Storage, "getItem" | "setItem"> };
  fakeWindow.localStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => { storage.set(key, value); },
  };
  vi.stubGlobal("window", fakeWindow);
  expect(parseHearts("not json").size).toBe(0);
  expect(toggleHeart("one")).toBe(true);
  expect(parseHearts(storage.get(HEARTS_KEY)!)).toEqual(new Set(["one"]));
  expect(toggleHeart("one")).toBe(true);
  expect(parseHearts(storage.get(HEARTS_KEY)!)).toEqual(new Set());
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
