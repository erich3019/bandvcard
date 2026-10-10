import { enhanceForOcr } from "./enhance";

// Phone photos are far larger than OCR and storage need. This scales the photo down,
// applies the EXIF rotation and returns a JPEG.
export async function prepareImage(file: Blob, maxSide = 2000): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Das Foto konnte nicht verarbeitet werden."))),
      "image/jpeg",
      0.9,
    );
  });
}

// The version of the photo that goes to text recognition: grey, with shadows and uneven
// light removed. The stored photo stays the natural one from prepareImage().
export async function prepareOcrImage(photo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  image.data.set(enhanceForOcr(image.data, canvas.width, canvas.height));
  context.putImageData(image, 0, 0);

  return new Promise((resolve, reject) => {
    // PNG, so no compression artefacts are added around the letters.
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Das Foto konnte nicht aufbereitet werden."))),
      "image/png",
    );
  });
}
