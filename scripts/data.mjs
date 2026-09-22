import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
const local = path.resolve(process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const python = process.env.PYTHON || (existsSync(local) ? local : "python");
const result = spawnSync(python, ["-m", "pipeline", ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, PYTHONUTF8: "1" } });
if (result.error) console.error("无法启动 Python。请先创建 .venv，或通过 PYTHON 环境变量指定解释器。");
process.exit(result.status ?? 1);
