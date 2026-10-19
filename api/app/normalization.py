from typing import Any

from app.models import GroupRecord, LaneRecord, ResultRecord
from app.scores import normalize_result


STATUS_ALIASES = {
    "entered": "finished",
    "finished": "finished",
    "complete": "finished",
    "缺": "absent",
    "absent": "absent",
    "公假": "excused",
    "excused": "excused",
    "official_leave": "excused",
    "補賽": "makeup",
    "makeup": "makeup",
    "blank": "blank",
    "empty": "blank",
    "unreadable": "unreadable",
    "unknown": "unreadable",
}


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _clean_int(value: Any, minimum: int, maximum: int) -> int | None:
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return None
    return number if minimum <= number <= maximum else None


def _normalize_lane(raw: dict[str, Any]) -> LaneRecord | None:
    lane_number = _clean_int(raw.get("lane"), 1, 8)
    if lane_number is None:
        return None

    result_value = raw.get("result")
    result_dict = result_value if isinstance(result_value, dict) else {}
    result_raw = _clean_text(raw.get("result_raw") or raw.get("resultRaw"))
    if result_raw is None:
        result_raw = _clean_text(result_dict.get("raw"))
    if result_raw is None and isinstance(result_value, str):
        result_raw = _clean_text(result_value)
    name = _clean_text(raw.get("name"))
    bib = _clean_text(raw.get("bib"))
    place = _clean_int(raw.get("place"), 1, 8)

    milliseconds, inferred_status = normalize_result(result_raw)
    status_alias = str(raw.get("status") or "").strip().lower()
    status = STATUS_ALIASES.get(status_alias, inferred_status)
    if result_raw and inferred_status != "blank":
        status = inferred_status
    if status == "excused" and result_raw is None:
        result_raw = "公假"
    if status == "makeup" and result_raw is None:
        result_raw = "補賽"

    # Lanes without an athlete are never treated as finishers, even when a red check sits in the cell.
    if not name and not bib:
        result_raw = None
        milliseconds = None
        status = "blank"
        place = None

    return LaneRecord(
        lane=lane_number,
        name=name,
        bib=bib,
        result=ResultRecord(
            raw=result_raw,
            milliseconds=milliseconds,
            status=status,
        ),
        place=place,
    )


def normalize_group_payload(
    group_number: int,
    payload: dict[str, Any],
) -> GroupRecord:
    body = payload.get("group")
    if isinstance(body, dict):
        payload = body

    lanes_value = payload.get("lanes")
    lanes_input = lanes_value if isinstance(lanes_value, list) else []
    by_lane: dict[int, LaneRecord] = {}
    for raw_lane in lanes_input:
        if not isinstance(raw_lane, dict):
            continue
        lane = _normalize_lane(raw_lane)
        if lane and lane.lane not in by_lane:
            by_lane[lane.lane] = lane

    lanes = []
    for lane_number in range(1, 9):
        lanes.append(
            by_lane.get(
                lane_number,
                LaneRecord(
                    lane=lane_number,
                    result=ResultRecord(status="blank"),
                ),
            )
        )
    return GroupRecord(group=group_number, lanes=lanes)
