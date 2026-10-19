import type {
  EventKind,
  LaneRecord,
  ResultRecord,
  StageCode,
} from "../types";

const SCORE_PATTERN = /^(\d+)\s*(?:['′’]|\.)\s*(\d{1,3})$/;
const ABSENT_MARKERS = new Set(["缺", "缺賽", "DNS", "DNF"]);
const EXCUSED_MARKERS = new Set(["公假"]);
const MAKEUP_MARKERS = new Set(["補賽"]);

export function normalizeResult(
  raw: string | null,
  eventKind: EventKind = "track",
): ResultRecord {
  const value = (raw ?? "").trim();
  if (!value) {
    return {
      raw: null,
      milliseconds: null,
      centimeters: null,
      status: "blank",
    };
  }
  if (ABSENT_MARKERS.has(value)) {
    return {
      raw: value,
      milliseconds: null,
      centimeters: null,
      status: "absent",
    };
  }
  if (EXCUSED_MARKERS.has(value)) {
    return {
      raw: value,
      milliseconds: null,
      centimeters: null,
      status: "excused",
    };
  }
  if (MAKEUP_MARKERS.has(value)) {
    return {
      raw: value,
      milliseconds: null,
      centimeters: null,
      status: "makeup",
    };
  }

  if (eventKind === "jump") {
    const centimeters = parseJumpCentimeters(value);
    if (centimeters === null) {
      return {
        raw: value,
        milliseconds: null,
        centimeters: null,
        status: "unreadable",
      };
    }
    return {
      raw: value,
      milliseconds: null,
      centimeters,
      status: "finished",
    };
  }

  const match = value.replaceAll(" ", "").match(SCORE_PATTERN);
  if (!match) {
    const milliseconds = parseEncodedTime(value);
    if (milliseconds !== null) {
      return {
        raw: value,
        milliseconds,
        centimeters: null,
        status: "finished",
      };
    }
    return {
      raw: value,
      milliseconds: null,
      centimeters: null,
      status: "unreadable",
    };
  }
  const [, seconds, fraction] = match;
  return {
    raw: value,
    milliseconds: Number(seconds) * 1000 + Number(fraction.padEnd(3, "0")),
    centimeters: null,
    status: "finished",
  };
}

function parseEncodedTime(value: string): number | null {
  if (!/^\d{4,6}$/.test(value)) {
    return null;
  }
  const centiseconds = Number(value.slice(-2));
  const seconds = Number(value.slice(-4, -2));
  const minutes = Number(value.slice(0, -4) || "0");
  if (seconds >= 60) {
    return null;
  }
  return ((minutes * 60 + seconds) * 100 + centiseconds) * 10;
}

function parseJumpCentimeters(value: string): number | null {
  const normalized = value.toLowerCase().replaceAll(/\s/g, "");
  const hasCentimeters = normalized.endsWith("cm");
  const numeric = Number(
    normalized.replace(/cm$/, "").replace(/m$/, ""),
  );
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return hasCentimeters || numeric >= 10
    ? Math.round(numeric)
    : Math.round(numeric * 100);
}

export function isBlankLane(lane: LaneRecord): boolean {
  return (
    !lane.name &&
    !lane.bib &&
    !lane.result.raw &&
    lane.result.milliseconds === null &&
    lane.place === null
  );
}

export function laneNeedsReview(lane: LaneRecord): boolean {
  if (lane.result.status === "unreadable") {
    return true;
  }
  if (
    lane.result.status === "finished" &&
    lane.result.milliseconds === null &&
    lane.result.centimeters === null
  ) {
    return true;
  }
  return (
    lane.result.status === "blank" &&
    Boolean(lane.name || lane.bib || lane.place)
  );
}

export function eventKindFromTitle(title: string | null): EventKind {
  return /跳高|跳遠|三級跳|撐竿跳/.test(title ?? "") ? "jump" : "track";
}

export function stageFromTitle(title: string | null): StageCode | null {
  if (title?.includes("預賽")) {
    return "at";
  }
  if (title?.includes("初賽")) {
    return "bt";
  }
  if (title?.includes("復賽")) {
    return "ct";
  }
  if (title?.includes("決賽")) {
    return "dt";
  }
  return null;
}

export function formatMilliseconds(value: number | null): string {
  if (value === null) {
    return "";
  }
  return `${(value / 1000).toFixed(3)} 秒`;
}

export function formatResult(
  result: ResultRecord,
  eventKind: EventKind,
): string {
  if (eventKind === "jump" && result.centimeters !== null) {
    return `${(result.centimeters / 100).toFixed(2)} m`;
  }
  return formatMilliseconds(result.milliseconds);
}
