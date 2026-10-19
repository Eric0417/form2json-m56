import * as XLSX from "xlsx";

import type {
  EventKind,
  FormDocument,
  GroupRecord,
  LaneRecord,
  ResultStatus,
  StageCode,
} from "../types";
import { eventKindFromTitle, isBlankLane } from "./result";

export const STATUS_LABELS: Record<ResultStatus, string> = {
  finished: "完賽",
  absent: "缺賽",
  excused: "公假",
  makeup: "補賽",
  blank: "空白",
  unreadable: "待確認",
};

export const DATA_HEADERS = [
  "組別",
  "跑道",
  "姓名",
  "號碼",
  "原始成績",
  "成績毫秒",
  "狀態",
  "名次",
  "紀錄",
] as const;

const NO_RESULT_VALUE = "888881";

interface FlatRecord {
  group: number;
  lane: LaneRecord;
}

export function flattenRecords(document: FormDocument): FlatRecord[] {
  return document.groups.flatMap((group) =>
    group.lanes
      .filter((lane) => !isBlankLane(lane))
      .map((lane) => ({ group: group.group, lane })),
  );
}

export function toJsonText(document: FormDocument): string {
  return JSON.stringify(document, null, 2);
}

export function targetCsvHeaders(stage: StageCode): string[] {
  return [
    "bg",
    "bl",
    "sport_no",
    "c_name",
    stage,
    "change_t",
    "dr",
    "rec_r",
  ];
}

function tsvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return text.replaceAll(/\t|\r|\n/g, " ");
}

export function toCsvText(document: FormDocument): string {
  // The downstream importer expects tab-separated columns in a .csv file.
  const eventKind = eventKindFromTitle(document.event.title);
  const lines = [targetCsvHeaders(document.stage).join("\t")];
  for (const { group, lane } of flattenRecords(document)) {
    const hasResult = lane.result.status === "finished";
    const scoreValue = hasResult
      ? encodeResultValue(lane, eventKind)
      : NO_RESULT_VALUE;
    const changeTime = hasResult
      ? formatChangeTime(lane, eventKind)
      : STATUS_LABELS[lane.result.status];
    lines.push(
      [
        group,
        lane.lane,
        lane.bib,
        lane.name,
        scoreValue,
        changeTime,
        hasResult ? lane.place : null,
        hasResult ? lane.record_mark : null,
      ]
        .map(tsvCell)
        .join("\t"),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function encodeResultValue(
  lane: LaneRecord,
  eventKind: EventKind,
): string {
  if (eventKind === "jump") {
    return lane.result.centimeters === null
      ? "0"
      : String(Math.round(lane.result.centimeters));
  }
  return encodeTrackTime(lane.result.milliseconds);
}

export function encodeTrackTime(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "0";
  }
  const totalCentiseconds = Math.round(milliseconds / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  if (minutes > 0) {
    return `${minutes}${pad2(seconds)}${pad2(centiseconds)}`;
  }
  return `${seconds}${pad2(centiseconds)}`;
}

export function formatChangeTime(
  lane: LaneRecord,
  eventKind: EventKind,
): string {
  if (eventKind === "jump") {
    return lane.result.centimeters === null
      ? "0"
      : `${(lane.result.centimeters / 100).toFixed(2)}m`;
  }
  if (lane.result.milliseconds === null) {
    return "0";
  }
  const totalCentiseconds = Math.round(lane.result.milliseconds / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  if (minutes > 0) {
    return `${minutes}‘${pad2(seconds)}${pad2(centiseconds)}“`;
  }
  return `${seconds}‘${pad2(centiseconds)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function toWorkbook(document: FormDocument): XLSX.WorkBook {
  const rows = flattenRecords(document).map(({ group, lane }) => ({
    組別: group,
    跑道: lane.lane,
    姓名: lane.name ?? "",
    號碼: lane.bib ?? "",
    原始成績: lane.result.raw ?? "",
    成績毫秒: lane.result.milliseconds ?? "",
    狀態: STATUS_LABELS[lane.result.status],
    名次: lane.place ?? "",
    紀錄: lane.record_mark ?? "",
  }));
  const dataSheet = XLSX.utils.json_to_sheet(rows, {
    header: [...DATA_HEADERS],
  });
  dataSheet["!cols"] = [
    { wch: 8 },
    { wch: 8 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
  ];
  dataSheet["!autofilter"] = {
    ref: dataSheet["!ref"] ?? "A1:I1",
  };
  dataSheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  const eventSheet = XLSX.utils.json_to_sheet([
    {
      賽事名稱: document.event.title ?? "",
      賽別: document.stage,
      紀錄位置: document.event.location ?? "",
      頁碼: document.event.page ?? "",
    },
  ]);
  eventSheet["!cols"] = [
    { wch: 36 },
    { wch: 10 },
    { wch: 16 },
    { wch: 10 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, "選手成績");
  XLSX.utils.book_append_sheet(workbook, eventSheet, "賽事資訊");
  return workbook;
}

export function toXlsxArray(document: FormDocument): ArrayBuffer {
  const workbook = toWorkbook(document);
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export function emptyGroup(group: number): GroupRecord {
  return {
    group,
    lanes: Array.from({ length: 8 }, (_, index) => ({
      lane: index + 1,
      name: null,
      bib: null,
      result: {
        raw: null,
        milliseconds: null,
        centimeters: null,
        status: "blank",
      },
      place: null,
      record_mark: null,
    })),
  };
}
