import pytest

from app.deepseek import _build_payload, get_health


def test_payload_uses_deepseek_vision_with_thinking_disabled(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-flash")

    payload = _build_payload(
        image_bytes=b"image",
        prompt="Return JSON. What is in this image?",
        max_tokens=1200,
    )

    assert payload["model"] == "deepseek-flash"
    assert payload["thinking"] == {"type": "disabled"}
    assert payload["response_format"] == {"type": "json_object"}
    image_part = payload["messages"][0]["content"][1]
    assert image_part["type"] == "image_url"
    assert image_part["image_url"]["detail"] == "original"
    assert image_part["image_url"]["url"].startswith("data:image/jpeg;base64,")


@pytest.mark.asyncio
async def test_health_reports_missing_api_key(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-flash")

    health = await get_health()

    assert health.provider == "deepseek"
    assert health.loaded is False
    assert health.message == "尚未設定 DEEPSEEK_API_KEY"
