import os
import json
import anthropic

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """당신은 전문 패션 스타일리스트입니다.
사용자가 보유한 의류 아이템 목록과 상황 설명을 바탕으로, 최적의 코디를 추천해주세요.

규칙:
1. 반드시 사용자가 보유한 아이템 ID만 사용하세요.
2. 응답은 반드시 JSON 형식으로 반환하세요.
3. 추천 이유는 구체적이고 따뜻한 어조로 작성하세요.
4. 날씨 정보가 있다면 적극 반영하세요.

응답 형식:
{
  "recommended_combinations": [
    {
      "item_ids": ["uuid1", "uuid2", "uuid3"],
      "reason": "추천 이유"
    }
  ],
  "overall_explanation": "전반적인 코디 설명"
}"""


async def get_recommendation(
    prompt: str,
    wardrobe_items: list[dict],
    weather_data: dict | None = None,
) -> dict:
    """
    Claude API를 호출하여 코디를 추천.
    사용자의 자연어 요청과 보유 아이템 목록을 바탕으로 최적 조합 반환.
    """
    items_summary = "\n".join([
        f"- ID: {item['id']} | {item.get('name', '이름없음')} | {item.get('category', '-')} | 색상: {', '.join(item.get('colorTags', []))} | 스타일: {', '.join(item.get('styleTags', []))}"
        for item in wardrobe_items
    ])

    weather_str = ""
    if weather_data:
        weather_str = f"\n현재 날씨: {weather_data.get('city', '')} {weather_data.get('temperature', '')}°C, {weather_data.get('description', '')}, 습도 {weather_data.get('humidity', '')}%"

    user_message = f"""상황: {prompt}{weather_str}

보유 의류 아이템:
{items_summary}

위 아이템들 중에서 상황에 맞는 코디를 2-3가지 추천해주세요."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    response_text = message.content[0].text  # type: ignore[index]

    # JSON 파싱
    try:
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        result = json.loads(response_text[start:end])
    except (json.JSONDecodeError, ValueError):
        result = {
            "recommended_combinations": [],
            "overall_explanation": response_text,
        }

    return result
