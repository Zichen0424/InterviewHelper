import { addInterview, checkLocalWrite, ManagementError, rebuildInterviews } from "@/lib/management";

export const runtime = "nodejs";

async function readLimitedBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Buffer[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 450_000) {
      await reader.cancel();
      throw new ManagementError("原文最多 10 万字。", "INVALID_REQUEST", 400);
    }
    chunks.push(Buffer.from(value));
  }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); }
  catch { throw new ManagementError("原文必须使用 UTF-8 编码。", "INVALID_REQUEST", 400); }
}

function failure(error: unknown): Response {
  if (error instanceof ManagementError) {
    return Response.json({ error: error.message, code: error.code, saved: error.saved, source: error.source }, { status: error.status });
  }
  console.error("Interview management failed:", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "资料处理失败，请检查本机目录权限与 Python 环境。", code: "MANAGEMENT_FAILED" }, { status: 500 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    checkLocalWrite(request);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      throw new ManagementError("请以 JSON 格式提交原文。", "INVALID_REQUEST", 415);
    }
    const body = await readLimitedBody(request);
    let input: unknown;
    try { input = JSON.parse(body); } catch { throw new ManagementError("请求格式不正确。", "INVALID_REQUEST", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => key !== "raw") || typeof (input as { raw?: unknown }).raw !== "string") {
      throw new ManagementError("请提供面经原文。", "INVALID_REQUEST", 400);
    }
    const raw = (input as { raw: string }).raw;
    if (!raw.trim()) throw new ManagementError("请粘贴面经原文。", "INVALID_REQUEST", 400);
    if (raw.length > 100_000) throw new ManagementError("原文最多 10 万字。", "INVALID_REQUEST", 400);
    return Response.json(await addInterview(raw), { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    checkLocalWrite(request);
    return Response.json(await rebuildInterviews());
  } catch (error) { return failure(error); }
}
