import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { POST, PATCH } from "../src/app/api/interviews/route";
import { DELETE } from "../src/app/api/interviews/[id]/route";
import { addInterview, deleteInterview, isPrivateInterview, ManagementError, rebuildInterviews } from "../src/lib/management";
import { snapshotSchema } from "../src/lib/schema";

vi.mock("../src/lib/management", async importOriginal => ({
  ...await importOriginal<typeof import("../src/lib/management")>(),
  addInterview: vi.fn(), deleteInterview: vi.fn(), rebuildInterviews: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());

const create = (body: unknown, url = "http://127.0.0.1/api/interviews", headers?: HeadersInit) =>
  new Request(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: new URL(url).origin, ...headers }, body: JSON.stringify(body) });
const remove = (id: string, url = `http://127.0.0.1/api/interviews/${id}`, headers?: HeadersInit) =>
  DELETE(new Request(url, { method: "DELETE", headers: { Origin: new URL(url).origin, ...headers } }), { params: Promise.resolve({ id }) });

it("accepts one pasted source and returns the published record", async () => {
  vi.mocked(addInterview).mockResolvedValue({ id: "0123456789abcdef", title: "RAG 面试", build_id: "next-build" });
  const response = await POST(create({ raw: "# RAG 面试\n面试官问：如何评估召回？" }));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ id: "0123456789abcdef", title: "RAG 面试", build_id: "next-build" });
  expect(addInterview).toHaveBeenCalledWith("# RAG 面试\n面试官问：如何评估召回？");
});

it("rejects invalid content and client-controlled extra fields before saving", async () => {
  for (const body of [{ raw: "   " }, { raw: "x".repeat(100001) }, { raw: "text", source: "../example.md" }]) {
    const response = await POST(create(body));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_REQUEST");
  }
  expect(addInterview).not.toHaveBeenCalled();
});

it("only accepts loopback, same-origin writes", async () => {
  const remote = await POST(create({ raw: "valid" }, "http://example.com/api/interviews"));
  expect(remote.status).toBe(403);
  const crossOrigin = await POST(create({ raw: "valid" }, undefined, { Origin: "http://example.com" }));
  expect(crossOrigin.status).toBe(403);
  expect(addInterview).not.toHaveBeenCalled();
});

it("uses the actual Host for same-origin checks when a proxy rewrites request.url", async () => {
  vi.mocked(addInterview).mockResolvedValue({ id: "0123456789abcdef", title: "RAG 面试", build_id: "next-build" });
  const valid = await POST(create({ raw: "# RAG 面试" }, "http://localhost:3000/api/interviews", {
    Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000",
  }));
  expect(valid.status).toBe(201);
  const spoofed = await POST(create({ raw: "# RAG 面试" }, "http://localhost:3000/api/interviews", {
    Host: "127.0.0.1.evil:3000", Origin: "http://127.0.0.1.evil:3000",
  }));
  expect(spoofed.status).toBe(403);
  expect(addInterview).toHaveBeenCalledTimes(1);
});

it("only recognizes signed private UUID sources as browser-managed records", () => {
  const fixture = snapshotSchema.parse(JSON.parse(readFileSync("tests/fixtures/snapshot.json", "utf8")));
  const sample = fixture.interviews[0];
  expect(isPrivateInterview(sample)).toBe(false);
  const source = "private/550e8400-e29b-41d4-a716-446655440000.md";
  const id = createHash("sha256").update(source).digest("hex").slice(0, 16);
  expect(isPrivateInterview({ ...sample, id, source })).toBe(true);
  expect(isPrivateInterview({ ...sample, id: sample.id, source })).toBe(false);
});

it("reports that original text survived an indexing failure and allows retry", async () => {
  vi.mocked(addInterview).mockRejectedValue(new ManagementError("请重新整理", "BUILD_FAILED", 502, true, "private/123.md"));
  const failed = await POST(create({ raw: "# 原文" }));
  expect(failed.status).toBe(502);
  expect(await failed.json()).toMatchObject({ code: "BUILD_FAILED", saved: true, source: "private/123.md" });
  vi.mocked(rebuildInterviews).mockResolvedValue({ build_id: "after-retry" });
  const retried = await PATCH(new Request("http://127.0.0.1/api/interviews", { method: "PATCH", headers: { Origin: "http://127.0.0.1" } }));
  expect(retried.status).toBe(200);
  expect(await retried.json()).toEqual({ build_id: "after-retry" });
});

it("validates deletion IDs and preserves protected interviews", async () => {
  const malformed = await remove("../example");
  expect(malformed.status).toBe(400);
  expect(deleteInterview).not.toHaveBeenCalled();
  vi.mocked(deleteInterview).mockRejectedValue(new ManagementError("内置示例受保护", "PROTECTED", 403));
  const protectedResponse = await remove("0123456789abcdef");
  expect(protectedResponse.status).toBe(403);
  expect((await protectedResponse.json()).code).toBe("PROTECTED");
});
