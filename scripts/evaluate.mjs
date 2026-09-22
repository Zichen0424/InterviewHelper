import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const file = process.argv[2];
if (!file) { console.error("用法：pnpm evaluate <评测JSON文件> [http://127.0.0.1:3000]"); process.exit(1); }
const cases = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(cases) || !cases.length) throw new Error("评测文件必须是非空数组");
const base = process.argv[3] || "http://127.0.0.1:3000";
let hits = 0;
for (const c of cases) {
  if (!c.query || !Array.isArray(c.relevant_sources) || !c.relevant_sources.length) throw new Error("每条需要 query 和非空 relevant_sources");
  const ids = c.relevant_sources.map(s => createHash("sha256").update(s.replaceAll("\\", "/")).digest("hex").slice(0, 16));
  const start = performance.now();
  const response = await fetch(`${base}/api/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: c.query, mode: "semantic" }), signal: AbortSignal.timeout(30_000) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  const hit = body.items.slice(0, 5).some(item => ids.includes(item.id));
  if (hit) hits++;
  console.log(JSON.stringify({ query: c.query, hit_at_5: hit, elapsed_ms: Math.round(performance.now() - start), top_5: body.items.slice(0, 5).map(i => i.title) }));
}
const ratio = hits / cases.length;
console.log(`Hit@5: ${hits}/${cases.length} (${(ratio * 100).toFixed(1)}%)`);
console.log("真实效果验收需至少 30 篇真实资料、20 条人工标注查询，以及真实 Embedding Provider；演示结果不能替代。");
process.exitCode = ratio >= 0.8 ? 0 : 1;
