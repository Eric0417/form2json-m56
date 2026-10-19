import re

from app.models import ResultStatus


SCORE_PATTERN = re.compile(r"^(\d+)\s*(?:['′’]|\.)\s*(\d{1,3})$")
ABSENT_MARKERS = {"缺", "缺賽", "DNS", "DNF"}
EXCUSED_MARKERS = {"公假"}
MAKEUP_MARKERS = {"補賽"}


def normalize_result(raw: str | None) -> tuple[int | None, ResultStatus]:
    value = str(raw or "").strip()
    if not value:
        return None, "blank"
    if value in ABSENT_MARKERS:
        return None, "absent"
    if value in EXCUSED_MARKERS:
        return None, "excused"
    if value in MAKEUP_MARKERS:
        return None, "makeup"

    compact = value.replace(" ", "")
    match = SCORE_PATTERN.fullmatch(compact)
    if not match:
        if compact.isdigit() and 4 <= len(compact) <= 6:
            centiseconds = int(compact[-2:])
            seconds = int(compact[-4:-2])
            minutes = int(compact[:-4] or "0")
            if seconds < 60:
                return ((minutes * 60 + seconds) * 100 + centiseconds) * 10, "finished"
        return None, "unreadable"

    seconds, fraction = match.groups()
    milliseconds = int(seconds) * 1000 + int(fraction.ljust(3, "0"))
    return milliseconds, "finished"
