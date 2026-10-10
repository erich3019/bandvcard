// Prepares a photo for text recognition. Photos of business cards have shadows, uneven
// light and paper texture, which the OCR engine otherwise reads as garbage lines.
// The result is a grey image with the background flattened to white and the text darkened.
// Pure pixel maths without canvas, so it can be tested outside a browser.

// Mean brightness around every pixel, over a square of the given radius: the local background.
// Two separable passes with running sums, so the cost does not depend on the radius.
function boxBlur(source: Float32Array, width: number, height: number, radius: number): Float32Array {
  const horizontal = new Float32Array(source.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    let count = 0;
    for (let x = 0; x < Math.min(radius, width); x++) {
      sum += source[row + x];
      count++;
    }
    for (let x = 0; x < width; x++) {
      if (x + radius < width) {
        sum += source[row + x + radius];
        count++;
      }
      if (x - radius - 1 >= 0) {
        sum -= source[row + x - radius - 1];
        count--;
      }
      horizontal[row + x] = sum / count;
    }
  }

  const result = new Float32Array(source.length);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    let count = 0;
    for (let y = 0; y < Math.min(radius, height); y++) {
      sum += horizontal[y * width + x];
      count++;
    }
    for (let y = 0; y < height; y++) {
      if (y + radius < height) {
        sum += horizontal[(y + radius) * width + x];
        count++;
      }
      if (y - radius - 1 >= 0) {
        sum -= horizontal[(y - radius - 1) * width + x];
        count--;
      }
      result[y * width + x] = sum / count;
    }
  }
  return result;
}

// Takes and returns RGBA pixels (as from canvas ImageData); the result is grey.
export function enhanceForOcr(rgba: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const pixels = width * height;
  const grey = new Float32Array(pixels);
  for (let i = 0; i < pixels; i++) {
    grey[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }

  // The radius must be much larger than a letter, so text does not count as background.
  // Blurring twice comes close to a smooth (Gaussian) blur.
  const radius = Math.max(8, Math.round(Math.max(width, height) * 0.04));
  const background = boxBlur(boxBlur(grey, width, height, radius), width, height, radius);

  // Brightness relative to the local background: paper becomes uniformly light.
  const flat = new Float32Array(pixels);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < pixels; i++) {
    flat[i] = Math.min(255, (grey[i] * 235) / Math.max(background[i], 1));
    histogram[Math.round(flat[i])]++;
  }

  // Stretch the contrast: the darkest 1 % of pixels becomes black.
  let dark = 0;
  for (let seen = 0; dark < 255 && seen + histogram[dark] < pixels * 0.01; dark++) {
    seen += histogram[dark];
  }
  // With very little text on the photo, that 1 % already lies in the paper. Never treat
  // anything lighter than mid-grey as black, or the background itself would turn dark.
  dark = Math.min(dark, 128);
  const scale = 255 / (255 - dark);

  const result = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < pixels; i++) {
    const value = (flat[i] - dark) * scale;
    result[i * 4] = result[i * 4 + 1] = result[i * 4 + 2] = value;
    result[i * 4 + 3] = 255;
  }
  return result;
}
