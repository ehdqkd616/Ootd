import io
import httpx
import boto3
from uuid import uuid4
from PIL import Image
from rembg import remove
import os

s3 = boto3.client("s3", region_name=os.getenv("AWS_REGION", "ap-northeast-2"))
BUCKET_PROCESSED = os.getenv("AWS_S3_BUCKET_PROCESSED_IMAGES", "ootd-processed-images")


async def remove_background(image_url: str, user_id: str) -> str:
    """
    이미지 URL에서 배경을 제거하고 S3에 업로드 후 URL 반환.
    rembg(U2Net 기반)를 사용하여 의류 영역만 추출.
    """
    # 원본 이미지 다운로드
    async with httpx.AsyncClient() as client:
        response = await client.get(image_url, timeout=30)
        response.raise_for_status()
        image_data = response.content

    # 배경 제거
    input_image = Image.open(io.BytesIO(image_data)).convert("RGBA")
    output_image = remove(input_image)  # type: ignore[arg-type]

    # PNG로 변환 (투명 배경 보존)
    output_buffer = io.BytesIO()
    output_image.save(output_buffer, format="PNG")
    output_buffer.seek(0)

    # S3 업로드
    key = f"users/{user_id}/processed/{uuid4()}.png"
    s3.put_object(
        Bucket=BUCKET_PROCESSED,
        Key=key,
        Body=output_buffer.getvalue(),
        ContentType="image/png",
    )

    return f"https://{BUCKET_PROCESSED}.s3.amazonaws.com/{key}"
