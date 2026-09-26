import hashlib
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .paths import data_directory
from .models import Analysis, Chunk, Interview, Snapshot
from .providers import canonical, fingerprint, providers, normalize

PROMPT_VERSION = "2-tech-stacks"


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def atomic_json(path: Path, value: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def split_text(text: str, size: int = 600, overlap: int = 100):
    if size < 20 or not 0 <= overlap < size // 2:
        raise ValueError("切分长度至少 20，重叠长度须小于长度的一半")
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            candidates = [m.end() for m in re.finditer(r"[\n。！？；]", text[start:end]) if m.end() >= size // 2]
            if candidates:
                end = start + candidates[-1]
        if text[start:end].strip():
            yield start, end, text[start:end]
        if end == len(text):
            break
        start = end - overlap


def load_config(root: Path) -> dict:
    path = Path(os.environ.get("INTERVIEW_CONFIG", "config.json"))
    if not path.is_absolute():
        path = root / path
    config = json.loads(path.read_text(encoding="utf-8-sig"))
    for kind in ("llm", "embedding"):
        c = config[kind]
        if c["provider"] not in ("mock", "openai-compatible") or not c.get("model"):
            raise ValueError(f"{kind} Provider 或 model 配置无效")
        if c["provider"] == "openai-compatible" and not c.get("base_url", "").startswith(("https://", "http://localhost", "http://127.0.0.1")):
            raise ValueError(f"{kind} 请使用 HTTPS 或本机接口地址")
    if config["embedding"]["provider"] == "mock" and config["embedding"].get("dimensions") != 96:
        raise ValueError("演示 Embedding 固定使用 96 维")
    if config["llm"].get("output_mode", "text") not in ("text", "json_object", "json_schema"):
        raise ValueError("LLM output_mode 无效")
    return config


def process_file(root: Path, path: Path, config: dict, llm, embedding, force=False):
    raw_root = data_directory(root) / "raw"
    source = path.relative_to(raw_root).as_posix()
    raw = path.read_text(encoding="utf-8-sig")
    if not raw.strip():
        raise ValueError("原文为空")
    content_hash = digest(raw)
    interview_id = digest(source)[:16]
    analysis_key = digest(canonical({"content": content_hash, "llm": config["llm"], "prompt": PROMPT_VERSION}))
    cache = data_directory(root) / "cache"
    analysis_path = cache / "analysis" / f"{analysis_key}.json"
    if analysis_path.exists() and not force:
        analysis = Analysis.model_validate_json(analysis_path.read_text(encoding="utf-8"))
    else:
        analysis = llm.analyze(raw)
        if any(q.evidence not in raw for q in analysis.questions):
            raise ValueError("原文证据校验失败")
        atomic_json(analysis_path, analysis.model_dump())
    interview = Interview(**analysis.model_dump(), id=interview_id, source=source, content_hash=content_hash, raw=raw, updated_at=datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat())
    chunks = []
    missing = []
    embed_fingerprint = fingerprint(config["embedding"])
    for start, end, text in split_text(raw, config["processing"]["chunk_size"], config["processing"]["chunk_overlap"]):
        vector_path = cache / "vectors" / f"{digest(embed_fingerprint + text)}.json"
        item = {"id": f"{interview_id}-{start}", "interview_id": interview_id, "start": start, "end": end, "text": text}
        if vector_path.exists() and not force:
            item["vector"] = normalize(json.loads(vector_path.read_text(encoding="utf-8"))["vector"])
        else:
            missing.append((item, vector_path))
        chunks.append(item)
    # Conservative batches work with small cloud-provider request limits.
    for start in range(0, len(missing), 8):
        batch = missing[start:start + 8]
        vectors = embedding.embed([item["text"] for item, _ in batch], "document")
        if len(vectors) != len(batch):
            raise ValueError("Embedding 向量数量不匹配")
        for (item, vector_path), vector in zip(batch, vectors):
            item["vector"] = normalize(vector)
            atomic_json(vector_path, {"vector": item["vector"]})
    return interview, [Chunk.model_validate(c) for c in chunks]


def build(root: Path, force=False, single: str | None = None) -> dict:
    config = load_config(root)
    llm, embedding = providers(config)
    raw_root = data_directory(root) / "raw"
    paths = sorted(p for p in raw_root.rglob("*") if p.is_file() and p.suffix.lower() in (".txt", ".md"))
    if single:
        target = (raw_root / single).resolve()
        if not target.is_relative_to(raw_root.resolve()) or target not in [p.resolve() for p in paths]:
            raise ValueError("单篇文件必须位于 DATA_DIR/raw 内，且为 .md 或 .txt")
        paths = [target]
    interviews, chunks, failures, duplicates = [], [], [], []
    hashes = {}
    for path in paths:
        try:
            interview, parts = process_file(root, path, config, llm, embedding, force)
            interviews.append(interview)
            chunks.extend(parts)
            if interview.content_hash in hashes:
                duplicates.append([hashes[interview.content_hash], interview.source])
            hashes[interview.content_hash] = interview.source
        except Exception as exc:
            # Provider response bodies/keys are intentionally excluded from reports.
            message = str(exc) if isinstance(exc, ValueError) else f"处理失败：{type(exc).__name__}"
            failures.append({"source": path.relative_to(raw_root).as_posix(), "error": message[:500]})
    report = {"processed": len(interviews), "failures": failures, "duplicates": duplicates, "published": False}
    dimensions = len(chunks[0].vector) if chunks else config["embedding"].get("dimensions", 0)
    if any(len(c.vector) != dimensions for c in chunks):
        report["failures"].append({"source": "index", "error": "向量维度不一致，请强制重建"})
    if not report["failures"] and not single:
        snapshot = Snapshot(
            build_id=digest(canonical({"interviews": [i.model_dump() for i in interviews], "embedding": fingerprint(config["embedding"]), "processing": config["processing"]}))[:16],
            built_at=datetime.now(timezone.utc).isoformat(), demo=config["llm"]["provider"] == "mock" or config["embedding"]["provider"] == "mock",
            llm_provider=config["llm"]["provider"], embedding_provider=config["embedding"]["provider"],
            embedding_fingerprint=fingerprint(config["embedding"]), dimensions=dimensions, interviews=interviews, chunks=chunks,
        )
        atomic_json(data_directory(root) / "generated" / "snapshot.json", snapshot.model_dump())
        report["published"] = True
    try:
        atomic_json(data_directory(root) / "reports" / "latest.json", report)
    except OSError:
        if not report["published"]:
            raise
        # The snapshot is already visible. A diagnostic report must not make
        # callers treat the published build as failed and roll back its source.
        report["report_warning"] = "快照已发布，但最近一次构建报告未能写入"
    return report
