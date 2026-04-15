from uuid import UUID

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    source_url: str = Field(
        ...,
        min_length=1,
        max_length=4096,
        description="TikTok share or video URL",
    )


class IngestCheckResponse(BaseModel):
    ok: bool
    source_url: str
    normalized_url: str | None = None
    format_ok: bool
    reachable: bool | None = None
    http_status: int | None = None
    error: str | None = None
    job_id: UUID | None = None
