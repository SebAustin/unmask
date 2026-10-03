const MAX_EDGE_PX = 1600;
const TARGET_BYTES = 1_500_000;
const QUALITY_STEPS = [0.85, 0.72, 0.6, 0.5];

/** Downscales a screenshot in the browser and returns a JPEG data URL small enough to upload. */
export async function resizeImage(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error("Please choose a PNG, JPEG or WebP screenshot.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser couldn't process that image.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of QUALITY_STEPS) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length * 0.75 <= TARGET_BYTES) return dataUrl;
  }
  throw new Error("That screenshot is too large even after shrinking. Try cropping it.");
}
