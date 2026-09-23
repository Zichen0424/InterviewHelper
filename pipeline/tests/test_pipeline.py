import json
from pathlib import Path

import pytest

from pipeline.build import atomic_json, build, digest, split_text
from pipeline.models import Snapshot
from pipeline.providers import MockEmbedding, MockLLM, CompatibleEmbedding, CompatibleLLM, fingerprint, mock_vector

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    monkeypatch.delenv("INTERVIEW_CONFIG", raising=False)
    (tmp_path / "config.json").write_text((ROOT / "config.json").read_text(encoding="utf-8"), encoding="utf-8")
    raw = tmp_path / "data/raw"
    raw.mkdir(parents=True)
    (raw / "a.md").write_text("# Redis 面试\n公司：样例公司\n- 缓存穿透如何处理？\n", encoding="utf-8")
    return tmp_path


def test_incremental_build_and_deletion(workspace, monkeypatch):
    assert build(workspace)["published"]
    original = Snapshot.model_validate_json((workspace / "data/generated/snapshot.json").read_text(encoding="utf-8"))
    def fail(*args, **kwargs): raise AssertionError("unchanged data should not call provider")
    monkeypatch.setattr(MockLLM, "analyze", fail)
    monkeypatch.setattr(MockEmbedding, "embed", fail)
    assert build(workspace)["published"]
    assert original.build_id == json.loads((workspace / "data/generated/snapshot.json").read_text(encoding="utf-8"))["build_id"]
    (workspace / "data/raw/a.md").unlink()
    assert build(workspace)["published"]
    empty = json.loads((workspace / "data/generated/snapshot.json").read_text(encoding="utf-8"))
    assert empty["interviews"] == [] and empty["chunks"] == []


def test_failed_build_keeps_last_snapshot(workspace, monkeypatch):
    build(workspace)
    path = workspace / "data/generated/snapshot.json"
    before = path.read_bytes()
    (workspace / "data/raw/b.md").write_text("# 新资料\nRedis 缓存", encoding="utf-8")
    def fail(*args, **kwargs): raise ValueError("服务限流")
    monkeypatch.setattr(MockLLM, "analyze", fail)
    report = build(workspace)
    assert not report["published"] and len(report["failures"]) == 1
    assert path.read_bytes() == before


def test_private_article_publish_and_quarantine(workspace):
    assert build(workspace)["published"]
    source = "private/123e4567-e89b-12d3-a456-426614174000.md"
    article = workspace / "data/raw" / source
    article.parent.mkdir()
    article.write_text("# RAG 面经\n岗位：AI 开发\n标签：RAG、Milvus\n- 如何改进召回？\n", encoding="utf-8")
    assert build(workspace)["published"]
    snapshot_path = workspace / "data/generated/snapshot.json"
    snapshot = Snapshot.model_validate_json(snapshot_path.read_text(encoding="utf-8"))
    added = next(item for item in snapshot.interviews if item.source == source)
    assert added.id == digest(source)[:16]
    assert any(chunk.interview_id == added.id for chunk in snapshot.chunks)

    quarantine = workspace / "data/quarantine" / article.name
    quarantine.parent.mkdir()
    article.rename(quarantine)
    assert build(workspace)["published"]
    after = Snapshot.model_validate_json(snapshot_path.read_text(encoding="utf-8"))
    assert all(item.id != added.id for item in after.interviews)
    assert all(chunk.interview_id != added.id for chunk in after.chunks)


def test_report_error_after_snapshot_publication_is_warning(workspace, monkeypatch):
    def fail_report(path, value):
        if path.name == "latest.json":
            raise OSError("report disk error")
        return atomic_json(path, value)

    monkeypatch.setattr("pipeline.build.atomic_json", fail_report)
    report = build(workspace)
    assert report["published"]
    assert "report_warning" in report
    snapshot = Snapshot.model_validate_json((workspace / "data/generated/snapshot.json").read_text(encoding="utf-8"))
    assert len(snapshot.interviews) == 1


def test_changed_llm_reuses_vectors(workspace, monkeypatch):
    build(workspace)
    config = json.loads((workspace / "config.json").read_text(encoding="utf-8"))
    config["llm"]["model"] = "new-model"
    (workspace / "config.json").write_text(json.dumps(config), encoding="utf-8")
    def fail(*args, **kwargs): raise AssertionError("vectors should be reused")
    monkeypatch.setattr(MockEmbedding, "embed", fail)
    assert build(workspace)["published"]


def test_chunk_coverage_and_offsets():
    text = ("一段含有 emoji 🌱 的中文。\n" * 100) + "末尾"
    parts = list(split_text(text, 100, 15))
    assert parts[-1][1] == len(text)
    covered = set()
    for start, end, chunk in parts:
        assert chunk == text[start:end] and len(chunk) <= 100
        covered.update(range(start, end))
    assert len(covered) == len(text)


def test_single_file_only_updates_cache(workspace):
    report = build(workspace, single="a.md")
    assert report["processed"] == 1 and not report["published"]
    assert not (workspace / "data/generated/snapshot.json").exists()
    with pytest.raises(ValueError): build(workspace, single="../../secret.txt")


def test_provider_contract_fixture():
    contract = json.loads((ROOT / "tests/fixtures/provider.json").read_text(encoding="utf-8"))
    assert fingerprint(contract["config"]) == contract["fingerprint"]
    assert mock_vector(contract["input"]) == pytest.approx(contract["vector"])
    snapshot = Snapshot.model_validate_json((ROOT / "tests/fixtures/snapshot.json").read_text(encoding="utf-8"))
    assert snapshot.schema_version == 2
    assert len(snapshot.interviews) == 10
    assert all("category" not in item.model_dump() and "分类：" not in item.raw for item in snapshot.interviews)
    assert {"RAG", "Agent", "MCP", "vLLM"}.issubset({tag for item in snapshot.interviews for tag in item.tags})


@pytest.mark.parametrize("query, source", [
    ("RAG", "07-rag.md"),
    ("Agent", "08-agent.md"),
    ("MCP", "09-mcp.md"),
    ("vLLM", "10-serving.md"),
])
def test_demo_ai_queries_find_relevant_interview(query, source):
    snapshot = Snapshot.model_validate_json((ROOT / "tests/fixtures/snapshot.json").read_text(encoding="utf-8"))
    lookup = {item.id: item.source for item in snapshot.interviews}
    vector = mock_vector(query)
    best = max(snapshot.chunks, key=lambda chunk: sum(a * b for a, b in zip(vector, chunk.vector)))
    assert lookup[best.interview_id] == source


def test_cloud_embedding_restores_response_order(monkeypatch):
    provider = CompatibleEmbedding({"model": "vendor-model", "api_key_env": "TEST_KEY"})
    monkeypatch.setattr(provider, "post", lambda path, payload: {"data": [{"index": 1, "embedding": [0, 3]}, {"index": 0, "embedding": [2, 0]}]})
    assert provider.embed(["first", "second"], "document") == [[1, 0], [0, 1]]


def test_llm_rejects_fabricated_evidence(monkeypatch):
    provider = CompatibleLLM({"model": "test", "output_mode": "text"})
    body = {"title": "test", "company": None, "role": None, "interview_date": None, "summary": "test", "tags": [], "questions": [{"text": "编造的问题？", "evidence": "原文不存在"}]}
    calls = []
    def respond(path, payload):
        calls.append(path)
        return {"choices": [{"message": {"content": json.dumps(body)}}]}
    monkeypatch.setattr(provider, "post", respond)
    with pytest.raises(ValueError, match="校验失败"): provider.analyze("真实面经")
    assert len(calls) == 2
