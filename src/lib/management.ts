import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { lstat, mkdir, open, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { snapshotSchema, type Interview, type Snapshot } from "./schema";
import { dataPath } from "./paths";

const privateSource = /^private\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.md$/;

export class ManagementError extends Error {
  constructor(message: string, public code: string, public status: number, public saved = false, public source?: string) {
    super(message);
  }
}

export function isPrivateInterview(interview: Interview): boolean {
  return privateSource.test(interview.source) && createHash("sha256").update(interview.source).digest("hex").slice(0, 16) === interview.id;
}

export function freshSnapshot(): Snapshot {
  return snapshotSchema.parse(JSON.parse(readFileSync(dataPath("generated", "snapshot.json"), "utf8")));
}

async function privateDirectory(): Promise<string> {
  const rawRoot = dataPath("raw");
  const directory = path.join(rawRoot, "private");
  await mkdir(directory, { recursive: true });
  if (!(await lstat(directory)).isDirectory()) throw new ManagementError("私人资料目录无效。", "STORAGE_FAILED", 500);
  const base = await realpath(rawRoot);
  const resolved = await realpath(directory);
  const relative = path.relative(base, resolved);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new ManagementError("私人资料目录不在原文目录内。", "STORAGE_FAILED", 500);
  }
  return resolved;
}

async function withBuildLock<T>(work: () => Promise<T>): Promise<T> {
  const lock = dataPath("generated", ".management.lock");
  await mkdir(path.dirname(lock), { recursive: true });
  let handle;
  try {
    handle = await open(lock, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new ManagementError("正在整理另一篇面经，请稍后重试。若处理进程已退出，请检查 DATA_DIR/generated/.management.lock。", "BUILD_BUSY", 409);
    }
    throw error;
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }));
    return await work();
  } finally {
    await handle.close();
    await unlink(lock).catch(() => undefined);
  }
}

type BuildReport = { published?: boolean; failures?: { source: string; error: string }[] };
async function runBuild(): Promise<{ ok: boolean; reason: string }> {
  const python = process.env.PYTHON || (() => {
    const local = path.join(process.cwd(), ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    return existsSync(local) ? local : process.platform === "win32" ? "python" : "python3";
  })();
  return await new Promise(resolve => {
    const child = spawn(python, ["-m", "pipeline", "build"], {
      cwd: process.cwd(), env: { ...process.env, PYTHONUTF8: "1" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let stderr = "";
    let ended = false;
    let timedOut = false;
    const finish = (ok: boolean, reason: string) => {
      if (!ended) { ended = true; resolve({ ok, reason }); }
    };
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 5 * 60 * 1000);
    child.stdout.on("data", chunk => { output = (output + String(chunk)).slice(-50000); });
    child.stderr.on("data", chunk => { stderr = (stderr + String(chunk)).slice(-2000); });
    child.on("error", error => { clearTimeout(timer); finish(false, `无法启动 Python：${error.message}`); });
    child.on("close", code => {
      clearTimeout(timer);
      if (timedOut) { finish(false, "整理超时，请检查模型服务后重试。"); return; }
      let report: BuildReport | undefined;
      try { report = JSON.parse(output) as BuildReport; } catch { /* Python may fail before returning a report. */ }
      const failure = report?.failures?.slice(0, 2).map(item => `${item.source}：${item.error}`).join("；");
      finish(code === 0 && report?.published === true, failure || stderr.trim() || "整理未完成，请检查 Python 环境或模型配置后重试。");
    });
  });
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function removeTargetCache(record: Interview, before: Snapshot, after: Snapshot): Promise<void> {
  const cacheRoot = dataPath("cache");
  const removeKnownFile = async (directoryName: string, name: string) => {
    const directory = path.join(cacheRoot, directoryName);
    try {
      if (!(await lstat(cacheRoot)).isDirectory()) return;
      if (!(await lstat(directory)).isDirectory()) return;
      await unlink(path.join(directory, name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };
  if (!after.interviews.some(item => item.content_hash === record.content_hash)) {
    try {
      const configFile = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.INTERVIEW_CONFIG || "config.json");
      const llm = (JSON.parse(readFileSync(configFile, "utf8")) as { llm: unknown }).llm;
      const key = createHash("sha256").update(canonical({ content: record.content_hash, llm, prompt: "2-tech-stacks" })).digest("hex");
      await removeKnownFile("analysis", `${key}.json`);
    } catch (error) {
      console.warn("Analysis cache cleanup skipped:", error instanceof Error ? error.name : "UnknownError");
    }
  }
  const shared = new Set(after.chunks.map(chunk => chunk.text));
  const keys = new Set(before.chunks.filter(chunk => chunk.interview_id === record.id && !shared.has(chunk.text)).map(chunk => {
    return createHash("sha256").update(before.embedding_fingerprint + chunk.text).digest("hex");
  }));
  for (const key of keys) {
    try { await removeKnownFile("vectors", `${key}.json`); }
    catch (error) { console.warn("Vector cache cleanup skipped:", error instanceof Error ? error.name : "UnknownError"); }
  }
}

export async function addInterview(raw: string): Promise<{ id: string; title: string; build_id: string }> {
  return withBuildLock(async () => {
    const directory = await privateDirectory();
    const uuid = randomUUID();
    const source = `private/${uuid}.md`;
    const id = createHash("sha256").update(source).digest("hex").slice(0, 16);
    await writeFile(path.join(directory, `${uuid}.md`), raw, { encoding: "utf8", flag: "wx" });
    const result = await runBuild();
    let snapshot: Snapshot | undefined;
    try { snapshot = freshSnapshot(); } catch { /* The new raw is still preserved. */ }
    const record = snapshot?.interviews.find(item => item.id === id && item.source === source);
    if (record && snapshot) return { id, title: record.title, build_id: snapshot.build_id };
    throw new ManagementError(
      `原文已保存，但整理结果尚未发布。${result.reason}请检查后点击“重新整理”。`,
      "BUILD_FAILED", 502, true, source,
    );
  });
}

export async function rebuildInterviews(): Promise<{ build_id: string }> {
  return withBuildLock(async () => {
    const result = await runBuild();
    if (!result.ok) throw new ManagementError(`整理未完成：${result.reason}`, "BUILD_FAILED", 502);
    return { build_id: freshSnapshot().build_id };
  });
}

export async function deleteInterview(id: string): Promise<{ id: string; build_id: string }> {
  return withBuildLock(async () => {
    const snapshot = freshSnapshot();
    const record = snapshot.interviews.find(item => item.id === id);
    if (!record) throw new ManagementError("未找到这篇面经。", "NOT_FOUND", 404);
    if (!isPrivateInterview(record)) throw new ManagementError("内置示例受保护，只能删除你粘贴的面经。", "PROTECTED", 403);
    const match = privateSource.exec(record.source);
    if (!match) throw new ManagementError("私人资料路径无效。", "STORAGE_FAILED", 500);
    const directory = await privateDirectory();
    const original = path.join(directory, `${match[1]}.md`);
    if (!(await lstat(original)).isFile()) throw new ManagementError("原文文件无效，未执行删除。", "STORAGE_FAILED", 500);
    const quarantine = dataPath("generated", "quarantine");
    await mkdir(quarantine, { recursive: true });
    const parked = path.join(quarantine, `${id}-${randomUUID()}.pending`);
    await rename(original, parked);
    try {
      const result = await runBuild();
      const next = freshSnapshot();
      if (next.interviews.some(item => item.id === id)) {
        throw new ManagementError(`删除后索引未更新：${result.reason}`, "BUILD_FAILED", 502);
      }
      try { await unlink(parked); }
      catch (error) { console.warn("Published deletion left a quarantined file:", error instanceof Error ? error.name : "UnknownError"); }
      await removeTargetCache(record, snapshot, next);
      return { id, build_id: next.build_id };
    } catch (error) {
      // The published snapshot is authoritative if Python finished publication
      // but failed while writing a secondary report.
      let stillPublished = true;
      try { stillPublished = freshSnapshot().interviews.some(item => item.id === id); } catch { /* Keep the original error. */ }
      if (stillPublished) {
        try { await rename(parked, original); }
        catch {
          throw new ManagementError("索引未更新，原文仍保存在隔离目录；请检查本机目录权限后恢复文件。", "RESTORE_FAILED", 500);
        }
      }
      throw error;
    }
  });
}
