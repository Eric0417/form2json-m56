import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadBlob } from "./download";

describe("downloadBlob", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the Blob URL alive after starting the download", async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadBlob(
      "女子乙組一百公尺初賽.csv",
      new Blob(["test"], { type: "text/csv;charset=utf-8" }),
    );

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
