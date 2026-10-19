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
