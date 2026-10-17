const MAX_DATA_URL_LENGTH = 2_100_000;
const MAX_DIMENSION = 1600;

/** Resize and recompress a cooking photo before placing it in an API request. */
export async function compressFoodPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (typeof createImageBitmap !== "function") throw new Error("This browser can't prepare photos. Try a recent version of Chrome, Edge, Safari, or Firefox.");

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Couldn't prepare this photo.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.7, 0.58]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= MAX_DATA_URL_LENGTH) return dataUrl;
    }
    throw new Error("That photo is too large. Try a smaller image.");
  } finally {
    bitmap.close();
  }
}
