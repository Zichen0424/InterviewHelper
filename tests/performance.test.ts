import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { snapshotSchema, type Chunk } from "../src/lib/schema";
import { keywordSearch, semanticSearch } from "../src/lib/search";

it("measures a 1000-document / 1536-dimension capacity scenario", () => {
  const fixture = snapshotSchema.parse(JSON.parse(readFileSync("tests/fixtures/snapshot.json", "utf8")));
  const baseline = process.memoryUsage().heapUsed;
  const interviews = Array.from({ length: 1000 }, (_, i) => ({ ...fixture.interviews[i % fixture.interviews.length], id: `capacity-${i}` }));
  const chunks: Chunk[] = interviews.flatMap((interview, i) => fixture.chunks.filter(c => c.interview_id === fixture.interviews[i % fixture.interviews.length].id).map((c, index) => ({
    ...c, id: `${interview.id}-${index}`, interview_id: interview.id,
    vector: Array.from({ length: 1536 }, (_, j) => c.vector[j % 96] / 4),
  })));
  const data = { ...fixture, interviews, chunks, dimensions: 1536 };
  const heapDelta = process.memoryUsage().heapUsed - baseline;
  const keywordStart = performance.now();
  const keyword = keywordSearch(data, "Redis");
  const keywordMs = performance.now() - keywordStart;
  const semanticStart = performance.now();
  const semantic = semanticSearch(data, chunks[0].vector);
  const semanticMs = performance.now() - semanticStart;
  console.info(JSON.stringify({ scenario: "synthetic-1000", documents: interviews.length, chunks: chunks.length, dimensions: 1536, json_mb: +(Buffer.byteLength(JSON.stringify(data)) / 1048576).toFixed(2), heap_delta_mb: +(heapDelta / 1048576).toFixed(2), keyword_ms: +keywordMs.toFixed(2), semantic_compute_ms: +semanticMs.toFixed(2), cloud_latency: "excluded" }));
  expect(keyword.length).toBeGreaterThan(0);
  expect(semantic).toHaveLength(20);
  expect(keywordMs).toBeLessThan(200);
});
