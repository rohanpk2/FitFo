from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.routers.deps import require_profile_id
from app.schemas.ingest import IngestCheckResponse, IngestRequest
from app.services import ingestion_pipeline, supabase_db, tiktok_url, url_detection

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestCheckResponse)
async def ingest_video(
    body: IngestRequest,
    background: BackgroundTasks,
    profile_id: str = Depends(require_profile_id),
) -> IngestCheckResponse:
    """
    Accept a TikTok or Instagram reel URL. Validates the URL shape, runs a
    cheap reachability probe for TikTok via oEmbed, inserts a pending
    ingestion job, and kicks off the background pipeline.
    """
    try:
        normalized, source_type = url_detection.assert_valid_source_url(body.source_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    provider_meta: dict = {"source_type": source_type}
    http_status: int | None = None

    if source_type == "tiktok":
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
        provider_meta["oembed_verified"] = True
        provider_meta["oembed_http_status"] = http_status
    else:
        # Instagram reels have no free reachability probe we can rely on.
        # The Apify scraper will surface unreachable URLs during the pipeline.
        provider_meta["instagram_reachability_check"] = "deferred_to_apify"

    try:
        row = supabase_db.create_ingestion_job(
            normalized,
            provider_meta=provider_meta,
            user_id=profile_id,
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
