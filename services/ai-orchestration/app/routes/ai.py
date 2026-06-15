from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from pydantic import BaseModel
from app.services.background_removal import remove_background
from app.services.image_classification import classify_clothing

router = APIRouter()


class ProcessResult(BaseModel):
    item_id: str
    processed_image_url: str
    category: str | None
    subcategory: str | None
    color_tags: list[str]
    season_tags: list[str]
    style_tags: list[str]


class ProcessJobRequest(BaseModel):
    item_id: str
    image_url: str
    user_id: str


@router.post("/process/image", response_model=ProcessResult)
async def process_image(
    background_tasks: BackgroundTasks,
    request: ProcessJobRequest,
):
    """
    의류 이미지 AI 처리:
    1. 배경 제거 (rembg)
    2. 카테고리/색상/스타일 분류 (CLIP)
    3. 결과를 DB에 업데이트
    """
    try:
        # 배경 제거
        processed_url = await remove_background(request.image_url, request.user_id)

        # 이미지 분류
        classification = await classify_clothing(request.image_url)

        # 비동기로 DB 업데이트
        background_tasks.add_task(
            update_item_in_db,
            request.item_id,
            processed_url,
            classification,
        )

        return ProcessResult(
            item_id=request.item_id,
            processed_image_url=processed_url,
            **classification,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def update_item_in_db(item_id: str, processed_url: str, classification: dict):
    """DB에 AI 처리 결과를 반영 (Prisma API 호출 또는 직접 DB 접근)."""
    import httpx
    async with httpx.AsyncClient() as client:
        await client.put(
            f"http://wardrobe-service:3002/api/v1/wardrobe/{item_id}",
            json={
                "processedImageUrl": processed_url,
                **classification,
            },
        )
