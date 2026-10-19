import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import ValidationError

from app import deepseek, lmstudio
from app.errors import ProviderError
from app.models import EventInfo, GroupRecord, HealthStatus
from app.normalization import normalize_group_payload


load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def provider_name() -> str:
    explicit = os.getenv("AI_PROVIDER", "").strip().lower()
    if explicit:
        return explicit
    if os.getenv("DEEPSEEK_API_KEY", "").strip():
        return "deepseek"
    return "lmstudio"


async def get_health() -> HealthStatus:
    provider = provider_name()
    if provider == "deepseek":
        return await deepseek.get_health()
    if provider == "lmstudio":
        return await lmstudio.get_health()
    return HealthStatus(
        provider=provider,
        reachable=False,
        model="",
        available=False,
        loaded=False,
        message=f"不支援 AI_PROVIDER={provider}",
    )


async def request_json(
    image_bytes: bytes,
    prompt: str,
    max_tokens: int,
) -> dict:
    provider = provider_name()
    if provider == "deepseek":
        return await deepseek.request_json(image_bytes, prompt, max_tokens)
    if provider == "lmstudio":
        return await lmstudio.request_json(image_bytes, prompt, max_tokens)
    raise ProviderError(f"不支援 AI_PROVIDER={provider}")


async def extract_metadata(image_bytes: bytes) -> EventInfo:
    prompt = (
        "這是田徑終點紀錄表的上方標題區。只根據圖片擷取印出的賽事名稱、"
        "紀錄位置與右側頁碼。不要讀取手寫邊註。只輸出單一 JSON，不要 markdown，"
        "不要解釋。格式："
        '{"title":string|null,"location":string|null,"page":number|null}。'
    )
    errors: list[str] = []
    for _ in range(2):
        try:
            payload = await request_json(image_bytes, prompt, max_tokens=700)
            page = payload.get("page")
            if isinstance(page, str) and page.isdigit():
                payload["page"] = int(page)
            return EventInfo.model_validate(payload)
        except (ValidationError, ProviderError) as exc:
            errors.append(str(exc))
    raise ProviderError(errors[-1] if errors else "標題辨識失敗。")


def group_prompt(group_number: int) -> str:
    return (
        f"這是田徑終點紀錄表的第{group_number}組。表格有8條跑道，每條跑道有上下兩列："
        "上列是預印姓名與號碼，下列左邊是手寫成績、右邊是名次。不要把號碼當成績。"
        "重要：成績可能被劃線、圈起或註銷，正確成績通常用紅筆寫在被劃掉數值的"
        "下方或旁邊。請逐一檢查每個成績格的下方。若原值被劃掉且有新值，"
        "result_raw 必須填寫下方清楚的新值，不可填被劃掉的原值。例如上方 18'90 "
        "被劃掉、下方寫 19'90，就輸出 19'90。圖片最底部可能出現下一組的姓名，"
        "不屬於本組，請忽略。"
        "成績格式像 18'10 代表 18.10 秒，可能有三位小數。寫「缺」代表 absent；"
        "寫「公假」代表 excused；寫「補賽」代表 makeup；"
        "真正空白代表 blank；無法辨識代表 unreadable。忽略單純的紅筆勾叉；"
        "紅筆新成績必須採用。"
        "只抄寫最清楚的最終內容。只輸出單一 JSON，不要 markdown，不要解釋。格式："
        '{"group_no":'
        f"{group_number}"
        ',"lanes":[{"lane":1,"name":string|null,"bib":string|null,'
        '"result_raw":string|null,"status":"finished"|"absent"|"excused"|"makeup"|'
        '"blank"|"unreadable",'
        '"place":number|null}]}。八條跑道都要有。'
    )


async def extract_group(group_number: int, image_bytes: bytes) -> GroupRecord:
    prompt = group_prompt(group_number)
    errors: list[str] = []
    for _ in range(2):
        try:
            payload = await request_json(image_bytes, prompt, max_tokens=2200)
            return normalize_group_payload(group_number, payload)
        except (ValidationError, ProviderError) as exc:
            errors.append(str(exc))
    raise ProviderError(errors[-1] if errors else "組別辨識失敗。")
