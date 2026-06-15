from fastapi import APIRouter, UploadFile, File, HTTPException, Header
from pydantic import BaseModel
from app.services.avatar_generation import generate_avatar

router = APIRouter()


class AvatarGenerationResult(BaseModel):
    source_image_url: str
    avatar_base_url: str
    body_params: dict


@router.post("/avatars/generate", response_model=AvatarGenerationResult)
async def generate(
    photo: UploadFile = File(...),
    authorization: str = Header(...),
):
    if not photo.content_type or not photo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")

    image_bytes = await photo.read()
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="파일 크기는 20MB 이하여야 합니다.")

    # JWT에서 userId 추출 (간소화 버전 - 실제로는 미들웨어 처리)
    import jwt as pyjwt, os
    token = authorization.removeprefix("Bearer ")
    try:
        payload = pyjwt.decode(token, os.getenv("JWT_ACCESS_SECRET", ""), algorithms=["HS256"])
        user_id = payload.get("userId", "unknown")
    except Exception:
        raise HTTPException(status_code=401, detail="인증 실패")

    result = await generate_avatar(image_bytes, user_id)
    return AvatarGenerationResult(**result)
