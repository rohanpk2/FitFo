from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.schemas.ingest import IngestCheckResponse, IngestRequest
from app.services import ingestion_pipeline, supabase_db, tiktok_url

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestCheckResponse)
async def ingest_tiktok(body: IngestRequest, background: BackgroundTasks) -> IngestCheckResponse:
    """Validate TikTok URL (oEmbed); if real, insert ingestion_jobs row (pending) and start pipeline."""
    try:
        normalized = tiktok_url.assert_valid_tiktok_url(body.source_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    embed_ok, http_status, err = await tiktok_url.verify_video_via_oembed(normalized)
    if not embed_ok:
        return IngestCheckResponse(
            ok=False,
            source_url=body.source_url.strip(),
            normalized_url=normalized,
            format_ok=True,
            reachable=False,
            http_status=http_status,
            error=err,
            job_id=None,
        )

    provider_meta: dict = {
        "oembed_verified": True,
        "oembed_http_status": http_status,
    }

    try:
        row = supabase_db.create_ingestion_job(
            normalized,
            provider_meta=provider_meta,
        )
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create ingestion job: {exc}",
        ) from exc

    job_id = UUID(row["id"]) if row.get("id") else None
    if job_id is not None:
        background.add_task(ingestion_pipeline.run_ingestion_job, str(job_id), normalized)
    return IngestCheckResponse(
        ok=True,
        source_url=body.source_url.strip(),
        normalized_url=normalized,
        format_ok=True,
        reachable=True,
        http_status=http_status,
        error=None,
        job_id=job_id,
    )
