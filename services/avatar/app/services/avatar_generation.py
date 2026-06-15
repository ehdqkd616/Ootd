import io
import os
import boto3
from uuid import uuid4
from PIL import Image

s3 = boto3.client("s3", region_name=os.getenv("AWS_REGION", "ap-northeast-2"))
BUCKET_USER = os.getenv("AWS_S3_BUCKET_USER_IMAGES", "ootd-user-images")


async def generate_avatar(image_bytes: bytes, user_id: str) -> dict:
    """
    인물 사진으로부터 아바타 기본 이미지를 생성.

    파이프라인:
    1. InsightFace로 얼굴 감지 및 인물 검출
    2. IP-Adapter + ControlNet으로 정면/측면/후면 포즈 생성
    (Phase 2에서 실제 모델 적용; 현재는 원본 이미지 저장)
    """
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # 원본 이미지 저장 (소스)
    source_buffer = io.BytesIO()
    image.save(source_buffer, format="JPEG", quality=90)
    source_buffer.seek(0)
    source_key = f"users/{user_id}/avatars/source/{uuid4()}.jpg"
    s3.put_object(
        Bucket=BUCKET_USER,
        Key=source_key,
        Body=source_buffer.getvalue(),
        ContentType="image/jpeg",
    )
    source_url = f"https://{BUCKET_USER}.s3.amazonaws.com/{source_key}"

    # TODO: Phase 2에서 IP-Adapter + ControlNet 기반 아바타 생성 구현
    # 현재는 소스 이미지를 기본 아바타로 사용
    avatar_base_url = source_url

    # 체형 파라미터 추출 (MediaPipe Pose Estimation - Phase 2)
    body_params = {
        "height": None,
        "build": None,
        "detected": False,
    }

    return {
        "source_image_url": source_url,
        "avatar_base_url": avatar_base_url,
        "body_params": body_params,
    }
