import { expect, test } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";

test("loads the corrected sample, edits a result and exports all formats", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "照片轉成可校正資料" })).toBeVisible();

  await page.getByRole("button", { name: "載入已校正範例" }).click();
  await expect(page.getByLabel("賽事名稱")).toHaveValue(
    "女子乙組一百公尺初賽",
  );
  await expect(page.getByRole("button", { name: "XLSX" })).toBeEnabled();

  const resultInput = page.getByLabel("第 1 線原始成績");
  await resultInput.fill("19'25");
  await expect(page.getByText("19.250 秒")).toBeVisible();

  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON" }).click();
  expect((await jsonDownload).suggestedFilename()).toBe(
    "女子乙組一百公尺初賽.json",
  );

  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV" }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toBe(
    "女子乙組一百公尺初賽.csv",
  );
  const csvPath = await csv.path();
  expect(csvPath).not.toBeNull();
  const csvContent = await readFile(csvPath!, "utf8");
  expect(csvContent.replace(/^\uFEFF/, "")).toContain(
    "bg\tbl\tsport_no\tc_name\tbt\tchange_t\tdr\trec_r\r\n" +
      "1\t1\t3101\t孔鈺婷\t1925\t19‘25\t3\t",
  );

  const xlsxDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "XLSX" }).click();
  const xlsx = await xlsxDownload;
  expect(xlsx.suggestedFilename()).toBe("女子乙組一百公尺初賽.xlsx");
  const xlsxPath = await xlsx.path();
  expect(xlsxPath).not.toBeNull();
  expect((await stat(xlsxPath!)).size).toBeGreaterThan(1_000);
});

test("keeps the page within the viewport and exposes group navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "載入已校正範例" }).click();

  await expect(page.getByRole("button", { name: "第 8 組" })).toBeVisible();
  await page.getByRole("button", { name: "第 3 組" }).click();
  await expect(page.getByRole("heading", { name: "第 3 組" })).toBeVisible();
  await expect(page.getByLabel("第 2 線姓名")).toHaveValue("麥僖彤");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
