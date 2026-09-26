import { authFailure, checkSameOrigin, requestToken, revokeSession, sessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    checkSameOrigin(request);
    await revokeSession(requestToken(request));
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie("", true), "Cache-Control": "no-store" } });
  } catch (error) { return authFailure(error); }
}
