const MAX_UPLOAD_SIDE = 2800;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;

export async function prepareImageForUpload(file: File): Promise<File> {
  if (
    !file.type.startsWith("image/") ||
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined"
  ) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
  } catch {
    return file;
  }

  const longestSide = Math.max(bitmap.width, bitmap.height);
  if (
    longestSide <= MAX_UPLOAD_SIDE &&
    file.size <= MAX_UNCOMPRESSED_BYTES
  ) {
    bitmap.close();
    return file;
  }

  const scale = Math.min(1, MAX_UPLOAD_SIDE / longestSide);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });
  if (!blob) {
    return file;
  }

  const filename = file.name.replace(/\.[^.]+$/, "") || "form";
  return new File([blob], `${filename}.jpg`, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
