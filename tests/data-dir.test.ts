import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { dataDirectory } from "../src/lib/paths";
import { getSnapshot } from "../src/lib/data";
import { freshSnapshot } from "../src/lib/management";

let directory: string | undefined;
afterEach(async () => { vi.unstubAllEnvs(); if (directory) await rm(directory, { recursive: true, force: true }); });

it("uses the selected DATA_DIR for both cached reads and management snapshots", async () => {
  directory = await mkdtemp(path.join(tmpdir(), "interview-data-"));
  vi.stubEnv("DATA_DIR", directory);
  await mkdir(path.join(directory, "generated"));
  const data = JSON.parse(await readFile("tests/fixtures/snapshot.json", "utf8"));
  data.build_id = "isolated-data-dir";
  await writeFile(path.join(directory, "generated/snapshot.json"), JSON.stringify(data));
  expect(getSnapshot().build_id).toBe("isolated-data-dir");
  expect(freshSnapshot().build_id).toBe("isolated-data-dir");
  vi.stubEnv("DATA_DIR", "relative-data");
  expect(dataDirectory()).toBe(path.resolve("relative-data"));
});
