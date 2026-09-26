import path from "node:path";

// Relative DATA_DIR values have the same project-root meaning in Node and Python.
export function dataDirectory(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DATA_DIR || "data");
}

export function dataPath(...parts: string[]): string {
  return path.join(dataDirectory(), ...parts);
}
