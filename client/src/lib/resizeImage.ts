/**
 * Downscales an image file so its longest side is at most `maxSide` px and returns it as a JPEG data URL.
 * Phone photos are often 4-12 MB; this keeps uploads small while leaving enough detail to read labels.
 */
export async function resizeImage(file: File, maxSide = 1600, quality = 0.85): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Couldn't read that image. Try a JPEG or PNG photo.");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process the image.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}
