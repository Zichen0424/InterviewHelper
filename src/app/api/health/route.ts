import { getSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try {
    getSnapshot();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
