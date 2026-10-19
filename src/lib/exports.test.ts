import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { sampleDocument } from "../data/sample";
import {
  encodeTrackTime,
  formatChangeTime,
  STATUS_LABELS,
  targetCsvHeaders,
  flattenRecords,
  toCsvText,
  toJsonText,
  toWorkbook,
  toXlsxArray,
} from "./exports";

describe("exports", () => {
  it("omits unused lanes from flattened records", () => {
    const records = flattenRecords(sampleDocument);
    expect(records).toHaveLength(48);
    expect(records.every(({ lane }) => lane.name)).toBe(true);
  });

  it("serializes the complete nested document to JSON", () => {
    const parsed = JSON.parse(toJsonText(sampleDocument));
    expect(parsed.stage).toBe("bt");
    expect(parsed.event.title).toBe("女子乙組一百公尺初賽");
    expect(parsed.groups).toHaveLength(8);
    expect(parsed.groups[0].lanes).toHaveLength(8);
    expect(parsed.groups[0].lanes[0].result.milliseconds).toBe(18100);
  });

  it("writes the requested tab-separated import format", () => {
    const csv = toCsvText(sampleDocument);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(targetCsvHeaders("bt").join("\t"));
    expect(csv).toContain("1\t1\t3101\t孔鈺婷\t1810\t18‘10\t3\t");
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(49);
  });

  it("encodes under-minute and over-minute running times", () => {
    expect(encodeTrackTime(45570)).toBe("4557");
    expect(encodeTrackTime(119180)).toBe("15918");
    expect(encodeTrackTime(79180)).toBe("11918");
    expect(
      formatChangeTime(
        {
          lane: 1,
          name: "甲",
          bib: "1",
          result: {
            raw: "4557",
            milliseconds: 45570,
            centimeters: null,
            status: "finished",
          },
          place: 1,
          record_mark: null,
        },
        "track",
      ),
    ).toBe("45‘57");
    expect(
      formatChangeTime(
        {
          lane: 2,
          name: "乙",
          bib: "2",
          result: {
            raw: "11918",
            milliseconds: 79180,
            centimeters: null,
            status: "finished",
          },
          place: 1,
          record_mark: null,
        },
        "track",
      ),
    ).toBe("1‘1918“");
    expect(encodeTrackTime(17684)).toBe("1768");
    expect(
      formatChangeTime(
        {
          lane: 3,
          name: "丙",
          bib: "3",
          result: {
            raw: "17'684",
            milliseconds: 17684,
            centimeters: null,
            status: "finished",
          },
          place: 1,
          record_mark: null,
        },
        "track",
      ),
    ).toBe("17‘68");
  });

  it("formats jump results in metres and supports record marks", () => {
    const jumpDocument = structuredClone(sampleDocument);
    jumpDocument.event.title = "女子乙組跳遠決賽";
    jumpDocument.stage = "dt";
    const lane = jumpDocument.groups[0].lanes[0];
    lane.result = {
      raw: "170",
      milliseconds: null,
      centimeters: 170,
      status: "finished",
    };
    lane.place = 2;
    lane.record_mark = "^";

    const csv = toCsvText(jumpDocument);
    expect(csv).toContain(
      "bg\tbl\tsport_no\tc_name\tdt\tchange_t\tdr\trec_r",
    );
    expect(csv).toContain("1\t1\t3101\t孔鈺婷\t170\t1.70m\t2\t^");
  });

  it("uses the no-result marker and status text", () => {
    const absentDocument = structuredClone(sampleDocument);
    const lane = absentDocument.groups[0].lanes[0];
    lane.result = {
      raw: "缺",
      milliseconds: null,
      centimeters: null,
      status: "absent",
    };
    lane.place = null;
    lane.record_mark = null;

    const csv = toCsvText(absentDocument);
    expect(csv).toContain("1\t1\t3101\t孔鈺婷\t888881\t缺賽\t\t");
  });

  it("creates athlete and event worksheets", () => {
    const workbook = toWorkbook(sampleDocument);
    expect(workbook.SheetNames).toEqual(["選手成績", "賽事資訊"]);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets["選手成績"])).toHaveLength(48);
  });

  it("uses Traditional Chinese labels for public leave and makeup", () => {
    expect(STATUS_LABELS.excused).toBe("公假");
    expect(STATUS_LABELS.makeup).toBe("補賽");
  });

  it("writes a readable XLSX array", () => {
    const array = toXlsxArray(sampleDocument);
    const workbook = XLSX.read(new Uint8Array(array), { type: "array" });
    expect(workbook.SheetNames).toContain("賽事資訊");
  });
});
