from app.lmstudio import request_options


def test_gemma_uses_default_request_options(monkeypatch):
    monkeypatch.setenv("LM_STUDIO_MODEL", "google/gemma-4-e4b")
    assert request_options() == {}


def test_qwen_disables_thinking_and_uses_low_reasoning(monkeypatch):
    monkeypatch.setenv("LM_STUDIO_MODEL", "qwen/qwen3.8-27b")
    assert request_options() == {
        "chat_template_kwargs": {"enable_thinking": False},
        "reasoning_effort": "low",
    }
