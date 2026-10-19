import base64
import os
from typing import Any

import httpx

from app.errors import ProviderError
from app.json_response import extract_json_object
from app.models import HealthStatus


DEFAULT_BASE_URL = "http://127.0.0.1:1234"
DEFAULT_MODEL = "google/gemma-4-e4b"
def base_url() -> str:
    return os.getenv("LM_STUDIO_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def model_name() -> str:
    return os.getenv("LM_STUDIO_MODEL", DEFAULT_MODEL)


def request_options() -> dict[str, Any]:
    if "qwen" not in model_name().lower():
        return {}
    return {
        "chat_template_kwargs": {"enable_thinking": False},
        "reasoning_effort": "low",
    }


async def get_health() -> HealthStatus:
    model = model_name()
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{base_url()}/api/v0/models")
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError):
        return HealthStatus(
            provider="lmstudio",
            reachable=False,
            model=model,
            available=False,
            loaded=False,
            message="LM Studio 本機伺服器未連線",
        )

    models = data.get("data", []) if isinstance(data, dict) else []
    loaded = [
        str(item.get("id"))
        for item in models
        if isinstance(item, dict) and item.get("state") == "loaded"
    ]
    available = any(
        isinstance(item, dict) and item.get("id") == model for item in models
    )
    loaded_model = model in loaded
    if loaded_model:
        message = "本機模型已就緒"
    elif available:
        message = "模型已安裝但尚未載入"
    else:
        message = "找不到指定模型"
    return HealthStatus(
        provider="lmstudio",
        reachable=True,
        model=model,
        available=available,
        loaded=loaded_model,
        loaded_models=loaded,
        message=message,
    )


async def request_json(
    image_bytes: bytes,
    prompt: str,
    max_tokens: int,
) -> dict[str, Any]:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "model": model_name(),
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{encoded}"},
                    },
                ],
            }
        ],
        "temperature": 0,
        "max_tokens": max_tokens,
        "stream": False,
    }
    payload.update(request_options())
    try:
        async with httpx.AsyncClient(timeout=240.0) as client:
            response = await client.post(
                f"{base_url()}/v1/chat/completions",
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise ProviderError("無法連線到 LM Studio。") from exc

    if response.status_code >= 400:
        detail = response.text[:240]
        raise ProviderError(f"LM Studio 回傳錯誤：{detail}")
    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ProviderError("LM Studio 回應缺少模型內容。") from exc
    return extract_json_object(str(content))
