import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("offline")),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the corrected sample and opens the editor", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "載入已校正範例" }),
    );

    expect(
      screen.getByDisplayValue("女子乙組一百公尺初賽"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("孔鈺婷")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "XLSX" }),
    ).toBeEnabled();
  });

  it("recalculates the standard time when a score is edited", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "載入已校正範例" }),
    );
    const resultInput = screen.getByLabelText("第 1 線原始成績");
    await user.clear(resultInput);
    await user.type(resultInput, "19'25");

    expect(screen.getByText("19.250 秒")).toBeInTheDocument();
  });

  it("allows selecting finished manually and requires a score", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "載入已校正範例" }),
    );
    const status = screen.getByLabelText("第 7 線狀態");
    await user.selectOptions(status, "finished");

    expect(status).toHaveValue("finished");
    expect(screen.getByRole("button", { name: "JSON" })).toBeDisabled();

    await user.type(screen.getByLabelText("第 7 線原始成績"), "20'00");

    expect(screen.getByText("20.000 秒")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "JSON" })).toBeEnabled();
  });

  it("keeps athlete identity when changing status to blank", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "載入已校正範例" }),
    );
    await user.selectOptions(screen.getByLabelText("第 1 線狀態"), "blank");

    expect(screen.getByLabelText("第 1 線姓名")).toHaveValue("孔鈺婷");
    expect(screen.getByLabelText("第 1 線號碼")).toHaveValue("3101");
    expect(screen.getByLabelText("第 1 線原始成績")).toHaveValue("");
  });

  it("explains why export is disabled when the event title is empty", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "載入已校正範例" }),
    );
    await user.clear(screen.getByLabelText("賽事名稱"));

    expect(screen.getByText("請輸入賽事名稱")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "JSON" })).toBeDisabled();
  });

  it("supports manual public leave and makeup statuses", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "載入已校正範例" }),
    );
    const status = screen.getByLabelText("第 1 線狀態");
    const result = screen.getByLabelText("第 1 線原始成績");

    await user.selectOptions(status, "excused");
    expect(result).toHaveValue("公假");
    expect(status).toHaveValue("excused");

    await user.selectOptions(status, "makeup");
    expect(result).toHaveValue("補賽");
    expect(status).toHaveValue("makeup");
    expect(screen.getByRole("button", { name: "JSON" })).toBeEnabled();
  });

  it("lets the user choose the stage and record marker", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "載入已校正範例" }),
    );
    const stage = screen.getByLabelText("賽別");
    const recordMark = screen.getByLabelText("第 1 線紀錄");

    expect(stage).toHaveValue("bt");
    await user.selectOptions(stage, "at");
    await user.selectOptions(recordMark, "^");

    expect(stage).toHaveValue("at");
    expect(recordMark).toHaveValue("^");
  });
});
