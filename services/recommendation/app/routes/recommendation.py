import os
import httpx
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from app.services.claude_service import get_recommendation

router = APIRouter()

WARDROBE_SERVICE_URL = os.getenv("WARDROBE_SERVICE_URL", "http://wardrobe-service:3002")
WEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")


class RecommendationRequest(BaseModel):
    prompt: str
    use_weather: bool = False
    city: str | None = None


class RecommendationResponse(BaseModel):
    explanation: str
    suggested_item_ids: list[list[str]]


async def fetch_wardrobe(user_id: str, access_token: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{WARDROBE_SERVICE_URL}/api/v1/wardrobe",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"limit": 100},
            timeout=10,
        )
        r.raise_for_status()
        return r.json().get("data", [])


async def fetch_weather(city: str) -> dict | None:
    if not WEATHER_API_KEY or not city:
        return None
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"q": city, "appid": WEATHER_API_KEY, "units": "metric", "lang": "kr"},
            timeout=5,
        )
        if r.status_code != 200:
            return None
        data = r.json()
        return {
            "temperature": data["main"]["temp"],
            "feels_like": data["main"]["feels_like"],
            "humidity": data["main"]["humidity"],
            "description": data["weather"][0]["description"],
            "city": data["name"],
        }


@router.post("/recommendations", response_model=RecommendationResponse)
async def create_recommendation(
    body: RecommendationRequest,
    authorization: str = Header(...),
):
    token = authorization.removeprefix("Bearer ")

    # 사용자 옷장 조회
    try:
        items = await fetch_wardrobe("", token)
    except Exception:
        raise HTTPException(status_code=502, detail="옷장 서비스 연결 실패")

    if not items:
        raise HTTPException(status_code=400, detail="옷장에 아이템이 없습니다.")

    # 날씨 조회 (선택)
    weather_data = None
    if body.use_weather:
        weather_data = await fetch_weather(body.city or "Seoul")

    # Claude API 추천
    result = await get_recommendation(body.prompt, items, weather_data)

    combinations = result.get("recommended_combinations", [])
    return RecommendationResponse(
        explanation=result.get("overall_explanation", ""),
        suggested_item_ids=[combo["item_ids"] for combo in combinations],
    )
