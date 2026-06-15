import io
import httpx
import torch
import open_clip
from PIL import Image
from functools import lru_cache

CATEGORY_LABELS = [
    "a top clothing, shirt, t-shirt, blouse, sweater",
    "bottom clothing, pants, jeans, skirt, shorts",
    "outerwear, jacket, coat, hoodie, blazer",
    "shoes, sneakers, boots, heels, sandals",
    "accessory, bag, hat, scarf, jewelry, belt",
]

CATEGORY_MAP = ["top", "bottom", "outer", "shoes", "accessory"]

COLOR_LABELS = ["black", "white", "gray", "navy", "blue", "red", "pink", "green", "yellow", "brown", "beige", "purple", "orange"]
SEASON_LABELS = ["spring clothing", "summer clothing", "fall clothing", "winter clothing"]
SEASON_MAP = ["spring", "summer", "fall", "winter"]
STYLE_LABELS = ["casual style", "formal business style", "sporty athletic style", "streetwear style", "vintage retro style", "minimal clean style"]
STYLE_MAP = ["casual", "formal", "sporty", "street", "vintage", "minimal"]


@lru_cache(maxsize=1)
def _load_clip():
    model, _, preprocess = open_clip.create_model_and_transforms("ViT-B-32", pretrained="openai")
    model.eval()
    tokenizer = open_clip.get_tokenizer("ViT-B-32")
    return model, preprocess, tokenizer


async def classify_clothing(image_url: str) -> dict:
    """
    CLIP 모델로 의류 이미지를 분석하여 카테고리, 색상, 스타일, 계절을 반환.
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(image_url, timeout=30)
        r.raise_for_status()

    image = Image.open(io.BytesIO(r.content)).convert("RGB")
    model, preprocess, tokenizer = _load_clip()

    image_tensor = preprocess(image).unsqueeze(0)  # type: ignore

    with torch.no_grad():
        image_features = model.encode_image(image_tensor)
        image_features /= image_features.norm(dim=-1, keepdim=True)

        def top_labels(labels: list[str], mapping: list[str], top_k: int = 2) -> list[str]:
            text = tokenizer(labels)
            text_features = model.encode_text(text)
            text_features /= text_features.norm(dim=-1, keepdim=True)
            similarity = (image_features @ text_features.T).squeeze(0)
            top_indices = similarity.topk(top_k).indices.tolist()
            return [mapping[i] for i in top_indices]

        category_text = tokenizer(CATEGORY_LABELS)
        cat_features = model.encode_text(category_text)
        cat_features /= cat_features.norm(dim=-1, keepdim=True)
        cat_sim = (image_features @ cat_features.T).squeeze(0)
        category = CATEGORY_MAP[cat_sim.argmax().item()]

        color_tags = top_labels(COLOR_LABELS, COLOR_LABELS, top_k=3)
        season_tags = top_labels(SEASON_LABELS, SEASON_MAP, top_k=2)
        style_tags = top_labels(STYLE_LABELS, STYLE_MAP, top_k=2)

    return {
        "category": category,
        "subcategory": None,
        "color_tags": color_tags,
        "season_tags": season_tags,
        "style_tags": style_tags,
    }
