// Text recognition in the browser with Tesseract.js. The photo never leaves the device for OCR;
// worker, WebAssembly and language data are served from /tesseract (see scripts/copy-tesseract.mjs).

// Must match the languages copied in scripts/copy-tesseract.mjs.
const OCR_LANGUAGES = ["deu", "eng"];

export async function recognizeText(image: Blob, onProgress: (fraction: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(OCR_LANGUAGES, 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress(message.progress);
      }
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
