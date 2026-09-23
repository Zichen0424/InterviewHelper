import { z } from "zod";

export const questionSchema = z.object({ text: z.string().min(1), evidence: z.string().min(1) }).strict();
export const interviewSchema = z.object({
  id: z.string(), title: z.string().min(1), company: z.string().nullable(), role: z.string().nullable(),
  interview_date: z.string().nullable(), summary: z.string(), tags: z.array(z.string()),
  questions: z.array(questionSchema), source: z.string(), content_hash: z.string(), raw: z.string(), updated_at: z.string(),
}).strict();
export const chunkSchema = z.object({
  id: z.string(), interview_id: z.string(), start: z.number().int().nonnegative(), end: z.number().int().nonnegative(),
  text: z.string(), vector: z.array(z.number().finite()),
}).strict();
export const snapshotSchema = z.object({
  schema_version: z.literal(2), build_id: z.string(), built_at: z.string(), demo: z.boolean(),
  llm_provider: z.string(), embedding_provider: z.string(),
  embedding_fingerprint: z.string(), dimensions: z.number().int().nonnegative(),
  interviews: z.array(interviewSchema), chunks: z.array(chunkSchema),
}).strict();
export type Interview = z.infer<typeof interviewSchema>;
export type Chunk = z.infer<typeof chunkSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type InterviewCard = Omit<Interview, "raw" | "content_hash" | "source" | "questions"> & { question_count: number };
export type Filters = { company?: string; tag?: string; ids?: string[] };
export type SearchItem = InterviewCard & { score: number; snippet: string; chunk_id?: string };

export function toCard(i: Interview): InterviewCard {
  const { raw: _raw, source: _source, content_hash: _hash, questions, ...card } = i;
  return { ...card, question_count: questions.length };
}

export const searchRequestSchema = z.object({
  query: z.string().trim().min(1, "请输入搜索内容").max(500, "搜索内容最多 500 字"),
  mode: z.enum(["keyword", "semantic"]),
  filters: z.object({ company: z.string().max(200).optional(), tag: z.string().max(100).optional(), ids: z.array(z.string().max(100)).max(1000).optional() }).strict().optional(),
  build_id: z.string().optional(),
}).strict();
