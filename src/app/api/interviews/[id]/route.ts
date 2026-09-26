import { deleteInterview, ManagementError } from "@/lib/management";
import { AuthError, authFailure, requireAdminWrite } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireAdminWrite(request);
    const { id } = await context.params;
    if (!/^[0-9a-f]{16}$/.test(id)) throw new ManagementError("面经编号无效。", "INVALID_REQUEST", 400);
    return Response.json(await deleteInterview(id));
  } catch (error) {
    if (error instanceof AuthError) return authFailure(error);
    if (error instanceof ManagementError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("Interview deletion failed:", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "删除失败，原文仍保留；请检查本机目录权限后重试。", code: "MANAGEMENT_FAILED" }, { status: 500 });
  }
}
