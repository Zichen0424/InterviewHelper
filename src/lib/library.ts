import type { InterviewCard } from "./schema";

export type SortOrder = "newest" | "oldest" | "popular";
export const sortLabels: Record<SortOrder, string> = {
  newest: "时间降序 · 最新优先", oldest: "时间升序 · 最早优先", popular: "热门 · 爱心优先",
};
export function parseSort(value: string | null): SortOrder {
  return value === "oldest" || value === "popular" ? value : "newest";
}
export function interviewTime(card: Pick<InterviewCard, "interview_date" | "updated_at">): number {
  const date = card.interview_date ? Date.parse(card.interview_date) : NaN;
  return Number.isFinite(date) ? date : Date.parse(card.updated_at) || 0;
}
export function sortInterviews<T extends InterviewCard>(cards: readonly T[], order: SortOrder, liked: ReadonlySet<string>): T[] {
  return [...cards].sort((a, b) => {
    if (order === "popular") {
      const hearts = Number(liked.has(b.id)) - Number(liked.has(a.id));
      if (hearts) return hearts;
    }
    const time = interviewTime(a) - interviewTime(b);
    return (order === "oldest" ? time : -time) || a.id.localeCompare(b.id);
  });
}
export function popularStacks(cards: readonly Pick<InterviewCard, "tags">[]): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const card of cards) {
    const seen = new Set<string>();
    for (const raw of card.tags) {
      const name = raw.normalize("NFKC").trim();
      const key = name.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key);
      if (entry) entry.count++; else counts.set(key, { name, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
}
const aiStackPriority = [
  "RAG", "Agent", "MCP", "vLLM", "Embedding", "向量检索", "LangGraph", "Milvus",
  "Function Calling", "模型部署", "推理服务", "LoRA", "量化", "重排", "评测",
];
export function aiFirstStacks<T extends { name: string }>(stacks: readonly T[]): T[] {
  const priority = new Map(aiStackPriority.map((name, index) => [name.toLowerCase(), index]));
  return [...stacks].sort((a, b) => {
    const aRank = priority.get(a.name.toLowerCase()) ?? Infinity;
    const bRank = priority.get(b.name.toLowerCase()) ?? Infinity;
    return aRank - bRank;
  });
}
export function hasTag(tags: readonly string[], tag: string): boolean {
  const key = tag.normalize("NFKC").trim().toLowerCase();
  return tags.some(t => t.normalize("NFKC").trim().toLowerCase() === key);
}
