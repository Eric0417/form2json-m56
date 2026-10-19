import type { FormDocument, GroupRecord, LaneRecord } from "../types";
import { normalizeResult } from "../lib/result";

function makeLane(
  lane: number,
  name: string | null = null,
  bib: string | null = null,
  raw: string | null = null,
  place: number | null = null,
): LaneRecord {
  return {
    lane,
    name,
    bib,
    result: normalizeResult(raw),
    place,
    record_mark: null,
  };
}

function makeGroup(group: number, lanes: readonly LaneRecord[]): GroupRecord {
  const byLane = new Map(lanes.map((lane) => [lane.lane, lane]));
  return {
    group,
    lanes: Array.from(
      { length: 8 },
      (_, index) => byLane.get(index + 1) ?? makeLane(index + 1),
    ),
  };
}

export const sampleDocument: FormDocument = {
  stage: "bt",
  event: {
    title: "女子乙組一百公尺初賽",
    location: "終點",
    page: 1,
  },
  groups: [
    makeGroup(1, [
      makeLane(1, "孔鈺婷", "3101", "18'10", 3),
      makeLane(2, "趙玥潼", "3434", "19'00", 5),
      makeLane(3, "邱語嫣", "3515", "18'64", 4),
      makeLane(4, "陳靜美", "4321", "19'21", 6),
      makeLane(5, "陳誠恩", "4427", "17'69", 2),
      makeLane(6, "陳悅涵", "3807", "16'77", 1),
    ]),
    makeGroup(2, [
      makeLane(1, "丁韻霖", "3201", "缺"),
      makeLane(2, "洪芷沂", "4115", "缺"),
      makeLane(3, "蔣梓圻", "4134", "19'01", 2),
      makeLane(4, "陳昀琳", "4421", "19'96", 3),
      makeLane(5, "晏子馨", "2727", "22'57", 4),
      makeLane(6, "楊芷晴", "3807", "16'81", 1),
    ]),
    makeGroup(3, [
      makeLane(1, "王子淇", "3301", "缺"),
      makeLane(2, "麥僖彤", "3328", "16'77", 2),
      makeLane(3, "蔣子晴", "4234", "18'62", 4),
      makeLane(4, "張晴", "4315", "17'58", 3),
      makeLane(5, "郭鎧汶", "4621", "20'282", 5),
      makeLane(6, "程頌恩", "3907", "15'90", 1),
    ]),
    makeGroup(4, [
      makeLane(1, "古倩瞳", "3401", "18'76", 3),
      makeLane(2, "馮筠貽", "3428", "17'64", 1),
      makeLane(3, "沙祐霖", "4308", "缺"),
      makeLane(4, "殷曉彤", "4415", "18'84", 4),
      makeLane(5, "陸雅程", "3821", "17'989", 2),
      makeLane(6, "胡曉柔", "3834", "20'29", 5),
    ]),
    makeGroup(5, [
      makeLane(1, "曾芷悠", "3222", "17'27", 3),
      makeLane(2, "戴瑗", "3235", "21'29", 6),
      makeLane(3, "王心悅", "3501", "18'42", 4),
      makeLane(4, "黃雅瑄", "3528", "20'28", 5),
      makeLane(5, "官愷澄", "4515", "16'691", 2),
      makeLane(6, "鄭悅瞳", "3708", "16'34", 1),
    ]),
    makeGroup(6, [
      makeLane(1, "梁錠欣", "3322", "19'40", 5),
      makeLane(2, "趙晞彤", "3435", "17'12", 1),
      makeLane(3, "傅靖芝", "3628", "20'07", 6),
      makeLane(4, "毛凱萱", "4301", "19'09", 4),
      makeLane(5, "楊希兒", "3808", "18'74", 3),
      makeLane(6, "李芷喬", "3815", "17'57", 2),
    ]),
    makeGroup(7, [
      makeLane(1, "徐樂津", "3209", "18'60", 6),
      makeLane(2, "許雅妍", "3522", "18'09", 5),
      makeLane(3, "鄧希妍", "3635", "18'08", 4),
      makeLane(4, "高珮嘉", "4416", "18'07", 3),
      makeLane(5, "朱玥盈", "4501", "17'593", 1),
      makeLane(6, "黃晴禧", "4528", "17'75", 2),
    ]),
    makeGroup(8, [
      makeLane(1, "王玥晴", "2402", "19'90", 5),
      makeLane(2, "陳盈晞", "3622", "16'55", 2),
      makeLane(3, "李卓欣", "4209", "16'71", 3),
      makeLane(4, "鄧雨菲", "4235", "19'83", 6),
      makeLane(5, "邵安喬", "4516", "17'684", 4),
      makeLane(6, "馮梓晴", "4628", "14'54", 1),
    ]),
  ],
};

export const sampleGroupImages = Array.from(
  { length: 8 },
  (_, index) => `/sample/group-${index + 1}.jpg`,
);

export const sampleFormImage = "/sample/form.jpg";
