import { AuthError, authFailure, checkSameOrigin, createSession, revokeSession, requestToken, sessionCookie, verifyCredentials } from "@/lib/auth";

export const runtime = "nodejs";
let attempts = 0;
let resetAt = 0;

export async function POST(request: Request): Promise<Response> {
  try {
    checkSameOrigin(request);
    if (Date.now() >= resetAt) { attempts = 0; resetAt = Date.now() + 15 * 60_000; }
    if (attempts >= 10) throw new AuthError("尝试次数过多，请 15 分钟后重试。", "RATE_LIMITED", 429);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AuthError("请以 JSON 格式登录。", "INVALID_REQUEST", 415);
    const reader = request.body?.getReader();
    if (!reader) throw new AuthError("请填写账号和密码。", "INVALID_REQUEST", 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new AuthError("登录请求过长。", "INVALID_REQUEST", 400); }
      chunks.push(value);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new AuthError("登录请求格式不正确。", "INVALID_REQUEST", 400); }
    if (typeof body?.username !== "string" || typeof body?.password !== "string") throw new AuthError("请填写账号和密码。", "INVALID_REQUEST", 400);
    attempts += 1;
    if (!verifyCredentials(body.username, body.password)) throw new AuthError("账号或密码不正确。", "INVALID_CREDENTIALS", 401);
    await revokeSession(requestToken(request));
    const token = await createSession();
    attempts = 0;
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(token), "Cache-Control": "no-store" } });
  } catch (error) { return authFailure(error); }
}
