from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Question(StrictModel):
    text: str = Field(min_length=1)
    evidence: str = Field(min_length=1)


class Analysis(StrictModel):
    title: str = Field(min_length=1)
    company: str | None
    role: str | None
    category: str
    interview_date: str | None
    summary: str = Field(min_length=1)
    tags: list[str]
    questions: list[Question]


class Interview(Analysis):
    id: str
    source: str
    content_hash: str
    raw: str
    updated_at: str


class Chunk(StrictModel):
    id: str
    interview_id: str
    start: int
    end: int
    text: str
    vector: list[float]


class Snapshot(StrictModel):
    schema_version: Literal[1] = 1
    build_id: str
    built_at: str
    demo: bool
    llm_provider: str
    embedding_provider: str
    embedding_fingerprint: str
    dimensions: int
    interviews: list[Interview]
    chunks: list[Chunk]
