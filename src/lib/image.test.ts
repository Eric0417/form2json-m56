import { describe, expect, it } from "vitest";

import { prepareImageForUpload } from "./image";

describe("prepareImageForUpload", () => {
  it("keeps the original file when browser image decoding is unavailable", async () => {
    const file = new File(["image"], "form.jpg", { type: "image/jpeg" });

    await expect(prepareImageForUpload(file)).resolves.toBe(file);
  });
});
