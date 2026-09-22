import { toCard, type Filters, type Interview, type SearchItem, type Snapshot } from "./schema";
import { normalize, SearchError } from "./providers";

export const normalized = (s: string) => s.normalize("NFKC").toLowerCase();
export function matches(i: Pick<Interview, "company" | "category" | "tags">, filters: Filters = {}): boolean {
  return (!filters.company || i.company === filters.company) && (!filters.category || i.category === filters.category) && (!filters.tag || i.tags.includes(filters.tag));
}
export function keywordSearch(data: Snapshot, query: string, filters: Filters = {}): SearchItem[] {
  const tokens = normalized(query).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return data.interviews.filter(i => matches(i, filters)).flatMap(i => {
    const fields: [string, number][] = [
      [i.title, 8], [i.company || "", 8], [i.role || "", 8], [i.tags.join(" "), 4],
      [i.questions.map(q => q.text).join(" "), 4], [i.summary, 1], [i.raw, 1],
    ];
    const normalizedFields = fields.map(([s, weight]) => [normalized(s), weight] as const);
    if (!tokens.every(token => normalizedFields.some(([s]) => s.includes(token)))) return [];
    const score = tokens.reduce((total, token) => total + normalizedFields.reduce((s, [field, weight]) => s + (field.includes(token) ? weight : 0), 0), 0);
    const chunk = data.chunks.find(c => c.interview_id === i.id && tokens.some(t => normalized(c.text).includes(t)));
    const location = tokens.map(t => normalized(i.raw).indexOf(t)).filter(n => n >= 0).sort((a, b) => a - b)[0] ?? 0;
    return [{ ...toCard(i), score, snippet: i.raw.slice(Math.max(0, location - 35), location + 145), chunk_id: chunk?.id }];
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function semanticSearch(data: Snapshot, vector: number[], filters: Filters = {}): SearchItem[] {
  if (vector.length !== data.dimensions) throw new SearchError("查询向量与索引维度不同，请重建索引。", "INDEX_MISMATCH", 409);
  const query = normalize(vector);
  const allowed = new Map(data.interviews.filter(i => matches(i, filters)).map(i => [i.id, i]));
  const best = new Map<string, SearchItem>();
  for (const chunk of data.chunks) {
    const interview = allowed.get(chunk.interview_id);
    if (!interview) continue;
    if (chunk.vector.length !== query.length) throw new SearchError("索引维度不一致，请重建。", "INDEX_MISMATCH", 409);
    const score = chunk.vector.reduce((sum, v, index) => sum + v * query[index], 0);
    if (!best.has(interview.id) || score > best.get(interview.id)!.score) best.set(interview.id, { ...toCard(interview), score, snippet: chunk.text.slice(0, 240), chunk_id: chunk.id });
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 20);
}
