const MAX_BYTES = 8 * 1024 * 1024;

export async function prepareImageUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are accepted");
  if (file.size > MAX_BYTES) throw new Error("Image must be under 8MB");
  if (file.size <= 256 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
    if (!blob || blob.size >= file.size) return file;
    const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: blob.type, lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
