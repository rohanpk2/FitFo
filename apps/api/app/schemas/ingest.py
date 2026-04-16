from typing import Optional
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
    normalized_url: Optional[str] = None
    format_ok: bool
    reachable: Optional[bool] = None
    http_status: Optional[int] = None
    error: Optional[str] = None
    job_id: Optional[UUID] = None
