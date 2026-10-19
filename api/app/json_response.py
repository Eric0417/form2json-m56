import json
import re
from typing import Any

from app.errors import ProviderError


JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)


def extract_json_object(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    match = JSON_BLOCK.search(text)
    if not match:
        raise ProviderError("模型沒有回傳 JSON。")
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise ProviderError("模型回傳的 JSON 格式不正確。") from exc
    if not isinstance(payload, dict):
        raise ProviderError("模型回傳的資料不是物件。")
    return payload
