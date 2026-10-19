export async function downloadText(
  filename: string,
  text: string,
  mimeType: string,
): Promise<void> {
  await downloadBlob(filename, new Blob([text], { type: mimeType }));
}

export async function downloadBlob(
  filename: string,
  blob: Blob,
): Promise<void> {
  if (await shareFileOnIOS(filename, blob)) {
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();

  // Safari can cancel a download when its Blob URL is revoked immediately.
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

async function shareFileOnIOS(filename: string, blob: Blob): Promise<boolean> {
  const userAgent = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS || typeof File !== "function") {
    return false;
  }

  const shareNavigator = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  const file = new File([blob], filename, {
    type: blob.type || "text/csv;charset=utf-8",
  });
  const shareData: ShareData = {
    files: [file],
    title: filename,
  };
  if (
    !shareNavigator.share ||
    !shareNavigator.canShare?.(shareData)
  ) {
    return false;
  }

  try {
    await shareNavigator.share(shareData);
    return true;
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError";
  }
}
