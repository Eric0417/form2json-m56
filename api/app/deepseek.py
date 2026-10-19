import base64
import os

import httpx

from app.errors import ProviderError
from app.json_response import extract_json_object
from app.models import HealthStatus


DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-flash"


def api_key() -> str:
    return os.getenv("DEEPSEEK_API_KEY", "").strip()


def base_url() -> str:
    return os.getenv("DEEPSEEK_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def model_name() -> str:
    return os.getenv("DEEPSEEK_MODEL", DEFAULT_MODEL)


def _build_payload(
    image_bytes: bytes,
    prompt: str,
    max_tokens: int,
) -> dict:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return {
        "model": model_name(),
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{encoded}",
                            "detail": "original",
                        },
                    },
                ],
            }
        ],
        "temperature": 0,
        "max_tokens": max_tokens,
        "stream": False,
        "thinking": {"type": "disabled"},
        "response_format": {"type": "json_object"},
    }


async def get_health() -> HealthStatus:
    model = model_name()
    if not api_key():
        return HealthStatus(
            provider="deepseek",
            reachable=False,
            model=model,
            available=False,
            loaded=False,
            message="尚未設定 DEEPSEEK_API_KEY",
        )

    headers = {"Authorization": f"Bearer {api_key()}"}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(f"{base_url()}/models", headers=headers)
    except httpx.HTTPError:
        return HealthStatus(
            provider="deepseek",
            reachable=False,
            model=model,
            available=False,
            loaded=False,
            message="無法連線到 DeepSeek API",
        )

    if response.status_code == 401:
        return HealthStatus(
            provider="deepseek",
            reachable=True,
            model=model,
            available=False,
            loaded=False,
            message="DEEPSEEK_API_KEY 無效",
        )
    if response.status_code >= 400:
        return HealthStatus(
            provider="deepseek",
            reachable=True,
            model=model,
            available=False,
            loaded=False,
            message=f"DeepSeek API 錯誤 ({response.status_code})",
        )

    try:
        body = response.json()
    except ValueError:
        body = {}
    models = body.get("data", []) if isinstance(body, dict) else []
    loaded_models = [
        str(item.get("id"))
        for item in models
        if isinstance(item, dict) and item.get("id")
    ]
    return HealthStatus(
        provider="deepseek",
        reachable=True,
        model=model,
        available=True,
        loaded=True,
        loaded_models=loaded_models,
        message="DeepSeek API 已就緒",
    )


async def request_json(
    image_bytes: bytes,
    prompt: str,
    max_tokens: int,
) -> dict:
    if not api_key():
        raise ProviderError("尚未設定 DEEPSEEK_API_KEY。")
    payload = _build_payload(image_bytes, prompt, max_tokens)
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                f"{base_url()}/chat/completions",
                headers={"Authorization": f"Bearer {api_key()}"},
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise ProviderError("無法連線到 DeepSeek API。") from exc

    if response.status_code >= 400:
        detail = response.text[:280]
        raise ProviderError(f"DeepSeek API 回傳錯誤：{detail}")
    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ProviderError("DeepSeek 回應缺少模型內容。") from exc
    return extract_json_object(str(content))
