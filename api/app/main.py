import json
import logging
import shutil
import tempfile
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from app.image_pipeline import prepare_form
from app.ai import (
    extract_group,
    extract_metadata,
    get_health,
)
from app.errors import ProviderError
from app.models import EventInfo, GroupRecord, HealthStatus


JOB_TTL_SECONDS = 30 * 60
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
JOB_ROOT = Path(tempfile.gettempdir()) / "form2json-jobs"

app = FastAPI(title="終點紀錄表轉檔", version="0.1.0")
logger = logging.getLogger("form2json")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIST_ROOT = PROJECT_ROOT / "dist"


def _cleanup_jobs() -> None:
    if not JOB_ROOT.exists():
        return
    cutoff = time.time() - JOB_TTL_SECONDS
    for job_dir in JOB_ROOT.iterdir():
        try:
            if job_dir.is_dir() and job_dir.stat().st_mtime < cutoff:
                shutil.rmtree(job_dir)
        except OSError:
            continue


def _job_dir(job_id: str) -> Path:
    try:
        uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="找不到這個工作。") from exc
    path = JOB_ROOT / job_id
    if not path.is_dir():
        raise HTTPException(status_code=404, detail="找不到這個工作，可能已超過保留時間。")
    return path


@app.get("/api/health", response_model=HealthStatus)
async def health() -> HealthStatus:
    return await get_health()


@app.post("/api/jobs")
async def create_job(image: UploadFile = File(...)) -> dict:
    _cleanup_jobs()
    if image.content_type and not (
        image.content_type.startswith("image/")
        or image.content_type == "application/octet-stream"
    ):
        raise HTTPException(status_code=415, detail="請上傳圖片檔。")
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="圖片是空的。")
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="圖片不可超過 25 MB。")

    try:
        prepared = await run_in_threadpool(prepare_form, image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    job_id = str(uuid.uuid4())
    logger.info(
        "job_created id=%s upload_bytes=%d warped=%dx%d groups=%d",
        job_id,
        len(image_bytes),
        prepared.width,
        prepared.height,
        len(prepared.groups),
    )
    job_dir = JOB_ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=False)
    (job_dir / "warped.jpg").write_bytes(prepared.warped_jpeg)
    (job_dir / "metadata.jpg").write_bytes(prepared.metadata_jpeg)
    for group in prepared.groups:
        (job_dir / f"group-{group.group}.jpg").write_bytes(group.image_jpeg)
    (job_dir / "job.json").write_text(
        json.dumps(
            {
                "created_at": time.time(),
                "warnings": list(prepared.warnings),
                "table": {
                    "left": prepared.table_left,
                    "top": prepared.table_top,
                    "right": prepared.table_right,
                    "bottom": prepared.table_bottom,
                },
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    base = f"/api/jobs/{job_id}"
    return {
        "job_id": job_id,
        "width": prepared.width,
        "height": prepared.height,
        "warped_url": f"{base}/assets/warped.jpg",
        "metadata_url": f"{base}/assets/metadata.jpg",
        "groups": [
            {
                "group": group.group,
                "crop_url": f"{base}/assets/group-{group.group}.jpg",
            }
            for group in prepared.groups
        ],
        "warnings": list(prepared.warnings),
    }


@app.get("/api/jobs/{job_id}/assets/{filename}")
async def job_asset(job_id: str, filename: str) -> FileResponse:
    allowed = {"warped.jpg", "metadata.jpg"} | {
        f"group-{number}.jpg" for number in range(1, 9)
    }
    if filename not in allowed:
        raise HTTPException(status_code=404, detail="找不到這張圖片。")
    path = _job_dir(job_id) / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="找不到這張圖片。")
    return FileResponse(path, media_type="image/jpeg")


@app.post("/api/jobs/{job_id}/metadata", response_model=EventInfo)
async def recognize_metadata(job_id: str) -> EventInfo:
    path = _job_dir(job_id) / "metadata.jpg"
    try:
        return await extract_metadata(path.read_bytes())
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post(
    "/api/jobs/{job_id}/groups/{group_number}",
    response_model=GroupRecord,
)
async def recognize_group(job_id: str, group_number: int) -> GroupRecord:
    if not 1 <= group_number <= 8:
        raise HTTPException(status_code=400, detail="組別必須是 1 到 8。")
    path = _job_dir(job_id) / f"group-{group_number}.jpg"
    try:
        return await extract_group(group_number, path.read_bytes())
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


if (DIST_ROOT / "assets").is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=DIST_ROOT / "assets"),
        name="frontend-assets",
    )


@app.get("/{full_path:path}", include_in_schema=False)
async def frontend(full_path: str) -> FileResponse:
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404)

    dist_root = DIST_ROOT.resolve()
    candidate = (dist_root / full_path).resolve()
    if (
        full_path
        and candidate.is_file()
        and dist_root in candidate.parents
    ):
        return FileResponse(candidate)

    index = dist_root / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="前端尚未建置。")
