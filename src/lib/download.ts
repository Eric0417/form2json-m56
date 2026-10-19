export function downloadText(
  filename: string,
  text: string,
  mimeType: string,
): void {
  downloadBlob(filename, new Blob([text], { type: mimeType }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
