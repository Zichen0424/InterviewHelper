import { getSnapshot } from "@/lib/data";
import { embeddingProvider, fingerprint, readEmbeddingConfig, SearchError } from "@/lib/providers";
import { searchRequestSchema } from "@/lib/schema";
import { keywordSearch, semanticSearch } from "@/lib/search";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 128000) return Response.json({ error: "请求内容过长", code: "INVALID_REQUEST" }, { status: 400 });
    let json;
    try { json = JSON.parse(text); } catch { return Response.json({ error: "请求格式不正确", code: "INVALID_REQUEST" }, { status: 400 }); }
    const parsed = searchRequestSchema.safeParse(json);
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message, code: "INVALID_REQUEST" }, { status: 400 });
    const { query, mode, filters, build_id } = parsed.data;
    const data = getSnapshot();
    if (build_id && build_id !== data.build_id) throw new SearchError("资料已更新，请刷新页面后重试搜索。", "BUILD_MISMATCH", 409);
    if (filters?.ids && filters.ids.length === 0) return Response.json({ mode, items: [], build_id: data.build_id });
    if (mode === "keyword") return Response.json({ mode, items: keywordSearch(data, query, filters), build_id: data.build_id });
    const config = readEmbeddingConfig();
    if (fingerprint(config) !== data.embedding_fingerprint) throw new SearchError("向量模型配置已变化，请重新生成资料索引。", "INDEX_MISMATCH", 409);
    if (!data.chunks.length) return Response.json({ mode, items: [], build_id: data.build_id });
    const [vector] = await embeddingProvider(config).embed([query], "query");
    return Response.json({ mode, items: semanticSearch(data, vector, filters), build_id: data.build_id });
  } catch (error) {
    if (error instanceof SearchError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    console.error("Search failed:", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "资料读取或搜索失败，请检查配置与生成数据。", code: "SEARCH_FAILED" }, { status: 500 });
  }
}
