import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.routers.deps import require_profile_id
from app.services import expo_push, supabase_db, workout_parser

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _coerce_duration(value: Any) -> float | None:
    """Best-effort numeric coercion. Both TikWM and Apify sometimes ship
    duration as a stringified number, so we accept either as long as the
    value parses to a positive finite float."""
    if isinstance(value, bool):
        # bool is a subclass of int in Python; reject it explicitly so a
        # `True` payload doesn't masquerade as a 1-second video.
        return None
    if isinstance(value, (int, float)):
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        return number if number > 0 else None
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            number = float(stripped)
        except ValueError:
            return None
        return number if number > 0 else None
    return None


def _extract_video_duration_sec(provider_meta: Any) -> float | None:
    """Pull a video duration (seconds) out of the provider-specific metadata
    blob written by the ingestion pipeline. Returns None when the field is
    missing, malformed, or the metadata isn't a dict yet (e.g. job is still
    in `pending` before fetch resolves).

    TikTok branch (TikWM) stores everything under ``provider_meta.tikwm``,
    typically with ``data.duration`` in seconds. Apify Instagram dumps the
    raw dataset item under ``provider_meta.apify``; the duration field name
    varies by actor version, so we probe a handful of candidate keys.
    """
    if not isinstance(provider_meta, dict):
        return None

    # TikTok / TikWM
    tikwm = provider_meta.get("tikwm")
    if isinstance(tikwm, dict):
        data = tikwm.get("data")
        if isinstance(data, dict):
            duration = _coerce_duration(data.get("duration"))
            if duration is not None:
                return duration

    # Apify Instagram Reel scraper
    apify = provider_meta.get("apify")
    if isinstance(apify, dict):
        for key in ("videoDuration", "duration", "video_duration"):
            duration = _coerce_duration(apify.get(key))
            if duration is not None:
                return duration
        video = apify.get("video")
        if isinstance(video, dict):
            for key in ("duration", "videoDuration"):
                duration = _coerce_duration(video.get(key))
                if duration is not None:
                    return duration

    return None


def _first_http_url(*candidates: Any) -> str | None:
    """Return the first candidate that is a non-empty http(s) URL."""
    for value in candidates:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("http"):
                return stripped
    return None


def _extract_thumbnail_url(provider_meta: Any) -> str | None:
    """Pull a video thumbnail (cover) URL out of the provider-specific
    metadata. Returns None when the metadata is missing or no usable image
    URL is present.

    Order of preference:

    1. ``preview_poster`` — jpeg extracted from the downloaded video in the
       ingest pipeline (immune to TikTok web interstitials and flaky covers).
    2. ``tiktok_oembed.thumbnail_url`` — official oEmbed at job creation (fast
       before the pipeline uploads a poster).
    3. TikWM / Apify CDN covers as a last resort.

    Note: CDN / signed URLs may expire; previews are short-lived.
    """
    if not isinstance(provider_meta, dict):
        return None

    preview_poster = provider_meta.get("preview_poster")
    if isinstance(preview_poster, dict):
        bucket = preview_poster.get("bucket")
        path = preview_poster.get("path")
        if isinstance(bucket, str) and isinstance(path, str):
            signed = supabase_db.create_signed_download_url_for_path(
                bucket=bucket.strip(),
                path=path.strip(),
            )
            if signed and signed.startswith("http"):
                return signed

    tiktok_embed = provider_meta.get("tiktok_oembed")
    if isinstance(tiktok_embed, dict):
        url = _first_http_url(tiktok_embed.get("thumbnail_url"))
        if url is not None:
            return url

    # TikTok / TikWM (fallback when oEmbed had no thumbnail)
    tikwm = provider_meta.get("tikwm")
    if isinstance(tikwm, dict):
        data = tikwm.get("data")
        if isinstance(data, dict):
            url = _first_http_url(
                data.get("cover"),
                data.get("origin_cover"),
                data.get("dynamic_cover"),
                data.get("ai_dynamic_cover"),
            )
            if url is not None:
                return url

    # Apify Instagram Reel scraper
    apify = provider_meta.get("apify")
    if isinstance(apify, dict):
        url = _first_http_url(
            apify.get("displayUrl"),
            apify.get("display_url"),
            apify.get("thumbnailUrl"),
            apify.get("thumbnail_url"),
            apify.get("thumbnailSrc"),
            apify.get("thumbnail_src"),
        )
        if url is not None:
            return url
        image = apify.get("image")
        if isinstance(image, dict):
            url = _first_http_url(image.get("url"), image.get("src"))
            if url is not None:
                return url

    return None


def _augment_job_payload(row: dict) -> dict:
    """Add derived fields (video_duration_sec, thumbnail_url, etc.) to the
    raw job row so clients can use them without having to dig through
    `provider_meta`."""
    if not isinstance(row, dict):
        return row
    provider_meta = row.get("provider_meta")
    return {
        **row,
        "video_duration_sec": _extract_video_duration_sec(provider_meta),
        "thumbnail_url": _extract_thumbnail_url(provider_meta),
    }


@router.get("/{job_id}")
def get_job(job_id: str, profile_id: str = Depends(require_profile_id)) -> dict:
    try:
        row = supabase_db.get_ingestion_job(job_id, user_id=profile_id)
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return _augment_job_payload(row)


@router.get("/{job_id}/workout")
def get_workout(job_id: str, profile_id: str = Depends(require_profile_id)) -> dict:
    try:
        workout = supabase_db.get_workout_by_job(job_id, user_id=profile_id)
        print("DEBUG WORKOUT RESPONSE:", json.dumps(workout, default=str), flush=True)
        return workout
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{job_id}/visual-blocks")
def get_visual_blocks(job_id: str, profile_id: str = Depends(require_profile_id)) -> dict:
    """
    Return the visual analysis blocks stored in provider_meta for a job.
    Only available after the job reaches review_pending status.
    """
    try:
        row = supabase_db.get_ingestion_job(job_id, user_id=profile_id)
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if row.get("status") not in ("review_pending", "complete"):
        raise HTTPException(
            status_code=409,
            detail=f"Visual blocks are not available yet (status: {row.get('status')})",
        )

    meta = row.get("provider_meta") or {}
    analysis = meta.get("visual_analysis")
    if not analysis:
        raise HTTPException(status_code=404, detail="No visual analysis found for this job")

    return {
        "job_id": job_id,
        "status": row.get("status"),
        "visual_analysis": analysis,
    }


class ConfirmVisualBlocksRequest(BaseModel):
    confirmed_blocks: list[dict]


@router.post("/{job_id}/visual-blocks/confirm")
def confirm_visual_blocks(
    job_id: str,
    body: ConfirmVisualBlocksRequest,
    profile_id: str = Depends(require_profile_id),
) -> dict:
    """
    Accept the user-reviewed set of visual blocks, build a WorkoutPlan,
    persist it, and mark the job complete.
    """
    try:
        row = supabase_db.get_ingestion_job(job_id, user_id=profile_id)
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if row.get("status") != "review_pending":
        raise HTTPException(
            status_code=409,
            detail=f"Job is not awaiting review (status: {row.get('status')})",
        )

    user_id = str(row.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=422, detail="Job has no owning user")

    if not body.confirmed_blocks:
        raise HTTPException(status_code=422, detail="confirmed_blocks must not be empty")

    plan = workout_parser.build_workout_from_visual_blocks(body.confirmed_blocks)

    try:
        supabase_db.create_workout(
            job_id,
            user_id=user_id,
            title=plan.get("title"),
            plan=plan,
            parser_model="visual_analyzer",
        )
        supabase_db.update_ingestion_job(job_id, status="complete")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    try:
        tokens = supabase_db.list_expo_push_tokens_for_user(user_id)
        source_url = str(row.get("source_url") or "").strip() or None
        expo_push.send_ingestion_ready_to_tokens(
            expo_push_tokens=tokens,
            job_id=job_id,
            workout_title=str(plan.get("title") or "").strip(),
            source_url=source_url,
        )
    except Exception:
        pass

    return {"ok": True, "job_id": job_id}
