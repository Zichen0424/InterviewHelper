import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { snapshotSchema, type Snapshot } from "./schema";

let cached: { stamp: string; data: Snapshot } | undefined;
export function getSnapshot(): Snapshot {
  const file = path.join(process.cwd(), "data/generated/snapshot.json");
  let stat;
  try { stat = statSync(file); } catch { throw new Error("尚未生成资料，请先运行 python -m pipeline build"); }
  const stamp = `${stat.mtimeMs}:${stat.size}`;
  if (cached?.stamp === stamp) return cached.data;
  const data = snapshotSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const ids = new Set(data.interviews.map(i => i.id));
  if (ids.size !== data.interviews.length || data.chunks.some(c => !ids.has(c.interview_id) || c.vector.length !== data.dimensions)) {
    throw new Error("数据索引不完整，请重新构建资料");
  }
  cached = { stamp, data };
  return data;
}
