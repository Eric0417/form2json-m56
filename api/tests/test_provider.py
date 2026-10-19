from app.ai import provider_name


def test_provider_defaults_to_lmstudio(monkeypatch):
    monkeypatch.delenv("AI_PROVIDER", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    assert provider_name() == "lmstudio"


def test_deepseek_key_automatically_selects_deepseek(monkeypatch):
    monkeypatch.delenv("AI_PROVIDER", raising=False)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    assert provider_name() == "deepseek"


def test_explicit_provider_wins(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "lmstudio")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    assert provider_name() == "lmstudio"
