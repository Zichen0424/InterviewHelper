import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export type EmbeddingConfig = {
  provider: "mock" | "openai-compatible"; model: string; base_url: string; api_key_env: string;
  dimensions?: number; document_prefix?: string; query_prefix?: string;
};
export interface EmbeddingProvider { embed(texts: string[], purpose: "document" | "query"): Promise<number[][]> }
export class SearchError extends Error {
  constructor(message: string, public code: string, public status = 503) { super(message); }
}
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, sorted(v)]));
  return value;
}
export function fingerprint(config: EmbeddingConfig): string {
  const { api_key_env: _key, ...profile } = config;
  return createHash("sha256").update(JSON.stringify(sorted(profile))).digest("hex");
}
export function readEmbeddingConfig(): EmbeddingConfig {
  // Config is local runtime input, not an instruction to bundle the workspace.
  const file = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.INTERVIEW_CONFIG || "config.json");
  return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")).embedding;
}
export function normalize(vector: number[]): number[] {
  if (!vector.length || vector.some(v => typeof v !== "number" || !Number.isFinite(v))) throw new SearchError("向量数据无效，请检查模型配置。", "INVALID_VECTOR");
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (!norm) throw new SearchError("模型返回了空向量。", "INVALID_VECTOR");
  return vector.map(v => v / norm);
}
const concepts = [
  ["redis", "缓存", "热点", "穿透", "击穿", "雪崩"], ["mysql", "数据库", "索引", "事务", "慢查询", "sql", "mvcc"],
  ["并发", "锁", "线程", "同步", "synchronized", "死锁"], ["消息", "队列", "kafka", "mq", "异步", "削峰"],
  ["react", "vue", "前端", "组件", "浏览器", "页面"], ["性能", "优化", "延迟", "吞吐", "卡顿"],
  ["网络", "tcp", "http", "连接", "协议"], ["算法", "二叉树", "链表", "排序", "复杂度", "动态规划"],
  ["java", "jvm", "垃圾回收", "gc", "内存"], ["分布式", "一致性", "幂等", "重试", "微服务"],
  ["项目", "设计", "架构", "系统", "业务"], ["测试", "质量", "覆盖", "用例", "自动化"],
];
export function mockVector(input: string): number[] {
  const text = input.normalize("NFKC").toLowerCase();
  const vector = Array<number>(96).fill(0);
  concepts.forEach((terms, i) => { vector[i] = 4 * terms.filter(t => text.includes(t)).length; });
  for (const token of text.match(/[a-z0-9+#]+|[\u4e00-\u9fff]{2}/g) || [text]) {
    vector[12 + createHash("sha256").update(token).digest().readUInt32BE(0) % 84] += 0.2;
  }
  return normalize(vector);
}
class MockEmbedding implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> { return texts.map(mockVector); }
}
export class CompatibleEmbedding implements EmbeddingProvider {
  constructor(private config: EmbeddingConfig) {}
  async embed(texts: string[], purpose: "document" | "query"): Promise<number[][]> {
    const key = process.env[this.config.api_key_env];
    if (!key) throw new SearchError("尚未配置向量服务密钥，仍可使用关键词搜索。", "MISSING_KEY");
    const body = {
      model: this.config.model, input: texts.map(t => (this.config[`${purpose}_prefix`] || "") + t), encoding_format: "float",
      ...(this.config.dimensions ? { dimensions: this.config.dimensions } : {}),
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response;
      try {
        response = await fetch(`${this.config.base_url.replace(/\/$/, "")}/embeddings`, {
          method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(body), signal: AbortSignal.timeout(12_000), cache: "no-store",
        });
      } catch {
        if (!attempt) continue;
        throw new SearchError("向量服务超时或网络不可用，请稍后重试或切换关键词搜索。", "PROVIDER_UNAVAILABLE");
      }
      if ((response.status === 429 || response.status >= 500) && !attempt) {
        await new Promise(resolve => setTimeout(resolve, 500)); continue;
      }
      if (!response.ok) throw new SearchError(`向量服务请求失败（${response.status}），请检查配置或稍后重试。`, "PROVIDER_ERROR");
      try {
        const data = await response.json();
        const entries = [...data.data].sort((a, b) => a.index - b.index);
        if (entries.length !== texts.length || entries.some((e, i) => e.index !== i)) throw new Error("index");
        const vectors = entries.map(e => normalize(e.embedding));
        if (this.config.dimensions && vectors.some(v => v.length !== this.config.dimensions)) throw new Error("dimensions");
        return vectors;
      } catch { throw new SearchError("向量服务返回了不兼容的数据。", "INVALID_VECTOR"); }
    }
    throw new SearchError("向量服务暂时不可用。", "PROVIDER_UNAVAILABLE");
  }
}
export function embeddingProvider(config: EmbeddingConfig): EmbeddingProvider {
  if (config.provider === "mock") {
    if (config.dimensions !== 96) throw new SearchError("演示向量配置应为 96 维。", "INVALID_CONFIG");
    return new MockEmbedding();
  }
  if (config.provider === "openai-compatible") {
    const url = new URL(config.base_url);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new SearchError("向量服务需要 HTTPS 或本机地址。", "INVALID_CONFIG");
    return new CompatibleEmbedding(config);
  }
  throw new SearchError("未注册该 Embedding Provider。", "INVALID_CONFIG");
}
