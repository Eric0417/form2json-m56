from typing import Literal

from pydantic import BaseModel, Field


ResultStatus = Literal[
    "finished",
    "absent",
    "excused",
    "makeup",
    "blank",
    "unreadable",
]


class ResultRecord(BaseModel):
    raw: str | None = None
    milliseconds: int | None = None
    centimeters: float | None = None
    status: ResultStatus = "blank"


class LaneRecord(BaseModel):
    lane: int = Field(ge=1, le=8)
    name: str | None = None
    bib: str | None = None
    result: ResultRecord = Field(default_factory=ResultRecord)
    place: int | None = Field(default=None, ge=1, le=8)
    record_mark: str | None = None


class GroupRecord(BaseModel):
    group: int = Field(ge=1, le=8)
    lanes: list[LaneRecord]


class EventInfo(BaseModel):
    title: str | None = None
    location: str | None = None
    page: int | None = Field(default=None, ge=1)


class HealthStatus(BaseModel):
    provider: str = "lmstudio"
    reachable: bool
    model: str
    available: bool
    loaded: bool
    loaded_models: list[str] = Field(default_factory=list)
    message: str
