import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

from .build import build


def main():
    parser = argparse.ArgumentParser(description="面经离线整理与索引构建")
    parser.add_argument("command", choices=["build", "retry", "analyze"])
    parser.add_argument("file", nargs="?", help="analyze 使用 DATA_DIR/raw 下的相对路径；只更新缓存")
    parser.add_argument("--force", action="store_true", help="强制重新调用模型")
    args = parser.parse_args()
    if args.command == "analyze" and not args.file:
        parser.error("analyze 需要指定文件")
    if args.command != "analyze" and args.file:
        parser.error("build/retry 不接受单篇文件")
    root = Path(__file__).resolve().parent.parent
    load_dotenv(root / ".env.local")
    load_dotenv(root / ".env")
    try:
        report = build(root, args.force, args.file if args.command == "analyze" else None)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1 if report["failures"] else 0
    except (ValueError, OSError, KeyError) as exc:
        print(f"构建失败：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
