import { describe, expect, it } from "vitest";

import {
  eventKindFromTitle,
  formatMilliseconds,
  formatResult,
  isBlankLane,
  laneNeedsReview,
  normalizeResult,
  stageFromTitle,
} from "./result";

describe("normalizeResult", () => {
  it("converts centiseconds to milliseconds", () => {
    expect(normalizeResult("18'10")).toEqual({
      raw: "18'10",
      milliseconds: 18100,
      centimeters: null,
      status: "finished",
    });
  });

  it("converts milliseconds", () => {
    expect(normalizeResult("18'123").milliseconds).toBe(18123);
  });

  it("pads a single fractional digit on the right", () => {
    expect(normalizeResult("18'6").milliseconds).toBe(18600);
  });

  it("recognizes absent and blank values", () => {
    expect(normalizeResult("缺").status).toBe("absent");
    expect(normalizeResult(null).status).toBe("blank");
  });

  it("recognizes public leave and makeup race", () => {
    expect(normalizeResult("公假")).toMatchObject({
      raw: "公假",
      milliseconds: null,
      status: "excused",
    });
    expect(normalizeResult("補賽")).toMatchObject({
      raw: "補賽",
      milliseconds: null,
      status: "makeup",
    });
  });

  it("keeps malformed values as unreadable", () => {
    expect(normalizeResult("1B'1O")).toEqual({
      raw: "1B'1O",
      milliseconds: null,
      centimeters: null,
      status: "unreadable",
    });
  });

  it("parses encoded track times", () => {
    expect(normalizeResult("4557").milliseconds).toBe(45570);
    expect(normalizeResult("11918").milliseconds).toBe(79180);
  });

  it("parses jump measurements in metres and centimetres", () => {
    expect(normalizeResult("170", "jump").centimeters).toBe(170);
    expect(normalizeResult("1.70m", "jump").centimeters).toBe(170);
    expect(normalizeResult("5.70", "jump").centimeters).toBe(570);
  });

  it("formats seconds for display", () => {
    expect(formatMilliseconds(18123)).toBe("18.123 秒");
  });

  it("identifies an unused lane", () => {
    expect(
      isBlankLane({
        lane: 7,
        name: null,
        bib: null,
        result: normalizeResult(null),
        place: null,
        record_mark: null,
      }),
    ).toBe(true);
  });

  it("marks a finished lane without a time as needing review", () => {
    expect(
      laneNeedsReview({
        lane: 1,
        name: "孔鈺婷",
        bib: "3101",
        result: {
          raw: null,
          milliseconds: null,
          centimeters: null,
          status: "finished",
        },
        place: null,
        record_mark: null,
      }),
    ).toBe(true);
  });

  it("does not mark a completely unused blank lane as needing review", () => {
    expect(
      laneNeedsReview({
        lane: 7,
        name: null,
        bib: null,
        result: normalizeResult(null),
        place: null,
        record_mark: null,
      }),
    ).toBe(false);
  });

  it("detects the stage and jump events from the title", () => {
    expect(stageFromTitle("女子乙組一百公尺初賽")).toBe("bt");
    expect(stageFromTitle("女子乙組跳遠決賽")).toBe("dt");
    expect(eventKindFromTitle("女子乙組跳遠決賽")).toBe("jump");
    expect(eventKindFromTitle("女子乙組一百公尺初賽")).toBe("track");
  });

  it("formats jump values in metres", () => {
    expect(
      formatResult(
        {
          raw: "170",
          milliseconds: null,
          centimeters: 170,
          status: "finished",
        },
        "jump",
      ),
    ).toBe("1.70 m");
  });
});
