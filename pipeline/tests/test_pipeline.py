import json
from pathlib import Path

import pytest

from pipeline.build import build, split_text
from pipeline.models import Snapshot
from pipeline.providers import MockEmbedding, MockLLM, CompatibleEmbedding, CompatibleLLM, fingerprint, mock_vector

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    monkeypatch.delenv("INTERVIEW_CONFIG", raising=False)
    (tmp_path / "config.json").write_text((ROOT / "config.json").read_text(encoding="utf-8"), encoding="utf-8")
    raw = tmp_path / "data/raw"
    raw.mkdir(parents=True)
    (raw / "a.md").write_text("# Redis 面试\n公司：样例公司\n分类：后端\n- 缓存穿透如何处理？\n", encoding="utf-8")
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
    Snapshot.model_validate_json((ROOT / "tests/fixtures/snapshot.json").read_text(encoding="utf-8"))


def test_cloud_embedding_restores_response_order(monkeypatch):
    provider = CompatibleEmbedding({"model": "vendor-model", "api_key_env": "TEST_KEY"})
    monkeypatch.setattr(provider, "post", lambda path, payload: {"data": [{"index": 1, "embedding": [0, 3]}, {"index": 0, "embedding": [2, 0]}]})
    assert provider.embed(["first", "second"], "document") == [[1, 0], [0, 1]]


def test_llm_rejects_fabricated_evidence(monkeypatch):
    provider = CompatibleLLM({"model": "test", "output_mode": "text"})
    body = {"title": "test", "company": None, "role": None, "category": "其他", "interview_date": None, "summary": "test", "tags": [], "questions": [{"text": "编造的问题？", "evidence": "原文不存在"}]}
    calls = []
    def respond(path, payload):
        calls.append(path)
        return {"choices": [{"message": {"content": json.dumps(body)}}]}
    monkeypatch.setattr(provider, "post", respond)
    with pytest.raises(ValueError, match="校验失败"): provider.analyze("真实面经", ["其他"])
    assert len(calls) == 2
