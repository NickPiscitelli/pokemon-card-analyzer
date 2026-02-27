/**
 * CardDetectorV2 — Multi-border color detection, perspective correction, sub-pixel edge fitting.
 *
 * Replaces the yellow-only WebGL shader approach with a color-agnostic pipeline that handles
 * black-bordered (Base Set era), white-bordered (modern), yellow/gold, and silver/holo cards.
 */

const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export type BorderColor = 'black' | 'white' | 'yellow' | 'silver' | 'unknown';

export interface CardDetectionInfo {
  borderColor: BorderColor;
  confidence: number;
  perspectiveCorrected: boolean;
  backgroundRecommendation: string | null;
  detectionMethod: string;
}

export interface V2Result {
  edges: { left: number; right: number; top: number; bottom: number };
  corners: [Point, Point, Point, Point] | null;
  correctedCanvas: HTMLCanvasElement | null;
  info: CardDetectionInfo;
}

// Standard Pokémon card aspect ratio: 2.5" × 3.5" = 5:7
const CARD_ASPECT = 5 / 7;

// ────────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ────────────────────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function getPixel(data: Uint8ClampedArray, w: number, x: number, y: number) {
  const i = (y * w + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ────────────────────────────────────────────────────────────────────────────────
// 1. Border color detection
// ────────────────────────────────────────────────────────────────────────────────

function classifyPixelColor(r: number, g: number, b: number): BorderColor {
  const lum = luminance(r, g, b);

  // Yellow: high R, high G, low B
  if (r > 170 && g > 150 && b < 120 && r > b * 1.5 && g > b * 1.3) return 'yellow';

  // Silver/gray: all channels similar, mid-range luminance
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  if (maxC - minC < 35 && lum > 120 && lum < 210) return 'silver';

  // White: all channels high
  if (lum > 210 && maxC - minC < 50) return 'white';

  // Black: all channels low
  if (lum < 60) return 'black';

  return 'unknown';
}

export function detectBorderColor(
  imageData: ImageData,
): { color: BorderColor; confidence: number } {
  const { data, width, height } = imageData;

  // Sample the expected border zone: outer 5-15% on each side
  const counts: Record<BorderColor, number> = { black: 0, white: 0, yellow: 0, silver: 0, unknown: 0 };
  let total = 0;

  const innerFrac = 0.15;
  const outerFrac = 0.05;

  const sampleStrip = (x: number, y: number) => {
    const px = getPixel(data, width, x, y);
    const c = classifyPixelColor(px.r, px.g, px.b);
    counts[c]++;
    total++;
  };

  // Sample with a stride to avoid being too slow on large images
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 200));

  // Left strip
  for (let y = Math.floor(height * outerFrac); y < height * (1 - outerFrac); y += stride) {
    for (let x = Math.floor(width * outerFrac); x < width * innerFrac; x += stride) {
      sampleStrip(x, y);
    }
  }
  // Right strip
  for (let y = Math.floor(height * outerFrac); y < height * (1 - outerFrac); y += stride) {
    for (let x = Math.floor(width * (1 - innerFrac)); x < width * (1 - outerFrac); x += stride) {
      sampleStrip(x, y);
    }
  }
  // Top strip
  for (let y = Math.floor(height * outerFrac); y < height * innerFrac; y += stride) {
    for (let x = Math.floor(width * innerFrac); x < width * (1 - innerFrac); x += stride) {
      sampleStrip(x, y);
    }
  }
  // Bottom strip
  for (let y = Math.floor(height * (1 - innerFrac)); y < height * (1 - outerFrac); y += stride) {
    for (let x = Math.floor(width * innerFrac); x < width * (1 - innerFrac); x += stride) {
      sampleStrip(x, y);
    }
  }

  if (total === 0) return { color: 'unknown', confidence: 0 };

  // Find dominant color (excluding 'unknown')
  let best: BorderColor = 'unknown';
  let bestCount = 0;
  for (const c of ['black', 'white', 'yellow', 'silver'] as BorderColor[]) {
    if (counts[c] > bestCount) {
      bestCount = counts[c];
      best = c;
    }
  }

  const confidence = bestCount / total;
  return { color: confidence > 0.2 ? best : 'unknown', confidence };
}

// ────────────────────────────────────────────────────────────────────────────────
// 2. Edge detection (Sobel + thresholding)
// ────────────────────────────────────────────────────────────────────────────────

function toGrayscale(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const j = i * 4;
    gray[i] = luminance(data[j], data[j + 1], data[j + 2]);
  }
  return gray;
}

function gaussianBlur3x3(gray: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  const k = [1, 2, 1, 2, 4, 2, 1, 2, 1]; // /16
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += gray[(y + ky) * w + (x + kx)] * k[(ky + 1) * 3 + (kx + 1)];
        }
      }
      out[y * w + x] = sum / 16;
    }
  }
  return out;
}

function sobelEdges(gray: Float32Array, w: number, h: number): { mag: Float32Array; dirH: Float32Array; dirV: Float32Array } {
  const mag = new Float32Array(w * h);
  const dirH = new Float32Array(w * h); // horizontal edge strength (vertical gradient)
  const dirV = new Float32Array(w * h); // vertical edge strength (horizontal gradient)

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)] +
        -2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)] +
        -gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];
      const gy =
        -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)] +
        gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];

      const idx = y * w + x;
      mag[idx] = Math.sqrt(gx * gx + gy * gy);
      dirH[idx] = Math.abs(gy); // strong horizontal edges have large |gy|
      dirV[idx] = Math.abs(gx); // strong vertical edges have large |gx|
    }
  }
  return { mag, dirH, dirV };
}

// ────────────────────────────────────────────────────────────────────────────────
// 3. Find 4 card edges via edge scanning
// ────────────────────────────────────────────────────────────────────────────────

interface Edges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function findCardEdges(
  mag: Float32Array,
  dirH: Float32Array,
  dirV: Float32Array,
  w: number,
  h: number,
  borderColor: BorderColor,
  imageData: ImageData,
): { edges: Edges; confidence: number } {
  // Adaptive threshold: use the 90th percentile of edge magnitude
  const sorted = Array.from(mag).filter(v => v > 0).sort((a, b) => a - b);
  const threshold = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.85)] : 30;

  // For each edge, we scan from the image border inward and collect strong edge points.
  // We separate horizontal edges (top/bottom) from vertical edges (left/right).

  const leftPoints: number[] = [];
  const rightPoints: number[] = [];
  const topPoints: number[] = [];
  const bottomPoints: number[] = [];

  const marginX = Math.floor(w * 0.03);
  const marginY = Math.floor(h * 0.03);

  // For border-color aware detection, also check pixel color near detected edges
  const { data } = imageData;

  const isNearBorderColor = (x: number, y: number): boolean => {
    if (borderColor === 'unknown') return true; // accept any edge
    const px = getPixel(data, w, clamp(x, 0, w - 1), clamp(y, 0, h - 1));
    const c = classifyPixelColor(px.r, px.g, px.b);
    // Accept if the pixel matches the border color OR if it's near a transition
    return c === borderColor || c === 'unknown';
  };

  // Scan vertical lines for LEFT edge (strong vertical edges in left 40%)
  for (let y = marginY; y < h - marginY; y += 2) {
    for (let x = marginX; x < w * 0.4; x++) {
      const idx = y * w + x;
      if (dirV[idx] > threshold && isNearBorderColor(x - 2, y)) {
        leftPoints.push(x);
        break; // take first strong edge per row
      }
    }
  }

  // Scan vertical lines for RIGHT edge (strong vertical edges in right 40%)
  for (let y = marginY; y < h - marginY; y += 2) {
    for (let x = w - marginX - 1; x > w * 0.6; x--) {
      const idx = y * w + x;
      if (dirV[idx] > threshold && isNearBorderColor(x + 2, y)) {
        rightPoints.push(x);
        break;
      }
    }
  }

  // Scan horizontal lines for TOP edge
  for (let x = marginX; x < w - marginX; x += 2) {
    for (let y = marginY; y < h * 0.4; y++) {
      const idx = y * w + x;
      if (dirH[idx] > threshold && isNearBorderColor(x, y - 2)) {
        topPoints.push(y);
        break;
      }
    }
  }

  // Scan horizontal lines for BOTTOM edge
  for (let x = marginX; x < w - marginX; x += 2) {
    for (let y = h - marginY - 1; y > h * 0.6; y--) {
      const idx = y * w + x;
      if (dirH[idx] > threshold && isNearBorderColor(x, y + 2)) {
        bottomPoints.push(y);
        break;
      }
    }
  }

  // Use median for robustness against outliers
  let left = leftPoints.length > 5 ? median(leftPoints) : w * 0.05;
  let right = rightPoints.length > 5 ? median(rightPoints) : w * 0.95;
  let top = topPoints.length > 5 ? median(topPoints) : h * 0.05;
  let bottom = bottomPoints.length > 5 ? median(bottomPoints) : h * 0.95;

  // Enforce aspect ratio constraint — card should be close to 5:7
  const detectedW = right - left;
  const detectedH = bottom - top;
  const detectedAspect = detectedW / detectedH;

  if (Math.abs(detectedAspect - CARD_ASPECT) > 0.15) {
    // Aspect ratio is off — adjust the weaker axis
    if (leftPoints.length + rightPoints.length > topPoints.length + bottomPoints.length) {
      // Trust horizontal edges more, adjust vertical
      const expectedH = detectedW / CARD_ASPECT;
      const centerY = (top + bottom) / 2;
      top = centerY - expectedH / 2;
      bottom = centerY + expectedH / 2;
    } else {
      const expectedW = detectedH * CARD_ASPECT;
      const centerX = (left + right) / 2;
      left = centerX - expectedW / 2;
      right = centerX + expectedW / 2;
    }
  }

  // Clamp to image bounds
  left = clamp(Math.round(left), 0, w - 1);
  right = clamp(Math.round(right), 0, w - 1);
  top = clamp(Math.round(top), 0, h - 1);
  bottom = clamp(Math.round(bottom), 0, h - 1);

  // Confidence: based on how many edge points we found
  const totalExpected = (h / 2) + (w / 2); // rough expected points
  const totalFound = leftPoints.length + rightPoints.length + topPoints.length + bottomPoints.length;
  const confidence = clamp(totalFound / totalExpected, 0, 1);

  return { edges: { left, right, top, bottom }, confidence };
}

// ────────────────────────────────────────────────────────────────────────────────
// 4. Corner refinement from edges
// ────────────────────────────────────────────────────────────────────────────────

function cornersFromEdges(edges: Edges): [Point, Point, Point, Point] {
  return [
    { x: edges.left, y: edges.top },       // top-left
    { x: edges.right, y: edges.top },      // top-right
    { x: edges.right, y: edges.bottom },   // bottom-right
    { x: edges.left, y: edges.bottom },    // bottom-left
  ];
}

// Refine corners using local edge magnitude search
function refineCorners(
  corners: [Point, Point, Point, Point],
  mag: Float32Array,
  w: number,
  h: number,
  searchRadius: number = 15,
): [Point, Point, Point, Point] {
  return corners.map(corner => {
    let bestX = corner.x;
    let bestY = corner.y;
    let bestMag = 0;

    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const nx = Math.round(corner.x + dx);
        const ny = Math.round(corner.y + dy);
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const m = mag[ny * w + nx];
        if (m > bestMag) {
          bestMag = m;
          bestX = nx;
          bestY = ny;
        }
      }
    }

    return { x: bestX, y: bestY };
  }) as [Point, Point, Point, Point];
}

// ────────────────────────────────────────────────────────────────────────────────
// 5. Perspective correction (projective warp)
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Solve for a 3×3 homography matrix H such that H * src = dst (in homogeneous coords).
 * Uses the DLT (Direct Linear Transform) algorithm with 4 point correspondences.
 * Returns the 3×3 matrix as a flat Float64Array[9].
 */
function computeHomography(
  src: [Point, Point, Point, Point],
  dst: [Point, Point, Point, Point],
): Float64Array {
  // Build 8×9 matrix A for Ah = 0
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([-sx, -sy, -1, 0, 0, 0, dx * sx, dx * sy, dx]);
    A.push([0, 0, 0, -sx, -sy, -1, dy * sx, dy * sy, dy]);
  }

  // Solve via SVD-like approach: compute A^T A, find eigenvector of smallest eigenvalue
  // For a 4-point homography this simplifies — we solve the 8×8 system directly.
  // Rewrite as: M * h8 = b where h8 = [h0..h7], h8=1.
  const M: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 8; i++) {
    M.push(A[i].slice(0, 8));
    b.push(-A[i][8]);
  }

  // Gaussian elimination with partial pivoting
  const n = 8;
  const aug = M.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / pivot;
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const h = new Float64Array(9);
  h[8] = 1;
  for (let row = n - 1; row >= 0; row--) {
    let sum = aug[row][n];
    for (let col = row + 1; col < n; col++) {
      sum -= aug[row][col] * h[col];
    }
    h[row] = Math.abs(aug[row][row]) > 1e-12 ? sum / aug[row][row] : 0;
  }

  return h;
}

function applyHomography(H: Float64Array, x: number, y: number): Point {
  const w = H[6] * x + H[7] * y + H[8];
  if (Math.abs(w) < 1e-12) return { x: 0, y: 0 };
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

function perspectiveCorrect(
  sourceCanvas: HTMLCanvasElement,
  corners: [Point, Point, Point, Point],
): HTMLCanvasElement | null {
  if (!isBrowser) return null;

  // Determine if the card is actually skewed enough to warrant correction.
  // Check if the corners form a roughly rectangular shape already.
  const dx1 = corners[1].x - corners[0].x;
  const dy1 = corners[1].y - corners[0].y;
  const dx2 = corners[2].x - corners[3].x;
  const dy2 = corners[2].y - corners[3].y;
  const topAngle = Math.abs(Math.atan2(dy1, dx1));
  const bottomAngle = Math.abs(Math.atan2(dy2, dx2));
  const dx3 = corners[3].x - corners[0].x;
  const dy3 = corners[3].y - corners[0].y;
  const dx4 = corners[2].x - corners[1].x;
  const dy4 = corners[2].y - corners[1].y;
  const leftAngle = Math.abs(Math.atan2(dx3, dy3));
  const rightAngle = Math.abs(Math.atan2(dx4, dy4));

  const maxSkew = Math.max(topAngle, bottomAngle, leftAngle, rightAngle);
  // If skew < ~2 degrees, skip perspective correction (not worth the quality loss)
  if (maxSkew < 0.035) return null;

  // Output dimensions: preserve card aspect ratio, use average of detected width/height
  const topW = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
  const bottomW = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
  const leftH = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
  const rightH = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);

  const avgW = (topW + bottomW) / 2;
  const avgH = (leftH + rightH) / 2;

  // Use detected size but enforce card aspect
  let outW = Math.round(avgW);
  let outH = Math.round(outW / CARD_ASPECT);
  if (outH > avgH * 1.3) {
    outH = Math.round(avgH);
    outW = Math.round(outH * CARD_ASPECT);
  }

  const dst: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];

  // Compute INVERSE homography: from destination to source (for backward mapping)
  const Hinv = computeHomography(dst, corners);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return null;

  const srcCtx = sourceCanvas.getContext('2d');
  if (!srcCtx) return null;
  const srcData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const outData = outCtx.createImageData(outW, outH);

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  // Backward mapping with bilinear interpolation
  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      const sp = applyHomography(Hinv, dx, dy);
      const sx = sp.x;
      const sy = sp.y;

      if (sx < 0 || sx >= srcW - 1 || sy < 0 || sy >= srcH - 1) continue;

      // Bilinear interpolation
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + srcW * 4;
      const i11 = i01 + 4;

      const outIdx = (dy * outW + dx) * 4;
      for (let c = 0; c < 4; c++) {
        outData.data[outIdx + c] = Math.round(
          srcData.data[i00 + c] * (1 - fx) * (1 - fy) +
          srcData.data[i10 + c] * fx * (1 - fy) +
          srcData.data[i01 + c] * (1 - fx) * fy +
          srcData.data[i11 + c] * fx * fy,
        );
      }
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

// ────────────────────────────────────────────────────────────────────────────────
// 6. Sub-pixel edge fitting
// ────────────────────────────────────────────────────────────────────────────────

/**
 * For a strip of luminance values perpendicular to an edge, fit a sigmoid
 * y = 1 / (1 + exp(-k*(x - x0))) to find the sub-pixel edge position x0.
 *
 * Simple approach: find the pixel where the largest gradient occurs,
 * then interpolate between the two adjacent pixels.
 */
function subpixelEdgePosition(strip: number[]): number {
  if (strip.length < 3) return strip.length / 2;

  let maxGrad = 0;
  let maxIdx = 0;

  for (let i = 1; i < strip.length - 1; i++) {
    const grad = Math.abs(strip[i + 1] - strip[i - 1]);
    if (grad > maxGrad) {
      maxGrad = grad;
      maxIdx = i;
    }
  }

  if (maxIdx <= 0 || maxIdx >= strip.length - 1) return maxIdx;

  // Parabolic interpolation on gradient magnitude
  const gPrev = Math.abs(strip[maxIdx] - strip[maxIdx - 1]);
  const gNext = Math.abs(strip[maxIdx + 1] - strip[maxIdx]);
  const denom = gPrev + gNext;
  if (denom < 0.01) return maxIdx;

  const offset = (gNext - gPrev) / (2 * denom);
  return maxIdx + clamp(offset, -0.5, 0.5);
}

function measureEdgesSubpixel(
  gray: Float32Array,
  w: number,
  h: number,
  edges: Edges,
): Edges {
  const numSamples = 30;
  const stripLen = 20; // pixels perpendicular to edge

  // Left edge: sample horizontal strips
  const leftSubs: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    const y = Math.floor(edges.top + (edges.bottom - edges.top) * (i + 1) / (numSamples + 1));
    const strip: number[] = [];
    const startX = Math.max(0, Math.round(edges.left) - stripLen);
    const endX = Math.min(w - 1, Math.round(edges.left) + stripLen);
    for (let x = startX; x <= endX; x++) {
      strip.push(gray[y * w + x]);
    }
    const pos = subpixelEdgePosition(strip);
    leftSubs.push(startX + pos);
  }

  // Right edge
  const rightSubs: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    const y = Math.floor(edges.top + (edges.bottom - edges.top) * (i + 1) / (numSamples + 1));
    const strip: number[] = [];
    const startX = Math.max(0, Math.round(edges.right) - stripLen);
    const endX = Math.min(w - 1, Math.round(edges.right) + stripLen);
    for (let x = startX; x <= endX; x++) {
      strip.push(gray[y * w + x]);
    }
    const pos = subpixelEdgePosition(strip);
    rightSubs.push(startX + pos);
  }

  // Top edge: sample vertical strips
  const topSubs: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    const x = Math.floor(edges.left + (edges.right - edges.left) * (i + 1) / (numSamples + 1));
    const strip: number[] = [];
    const startY = Math.max(0, Math.round(edges.top) - stripLen);
    const endY = Math.min(h - 1, Math.round(edges.top) + stripLen);
    for (let y = startY; y <= endY; y++) {
      strip.push(gray[y * w + x]);
    }
    const pos = subpixelEdgePosition(strip);
    topSubs.push(startY + pos);
  }

  // Bottom edge
  const bottomSubs: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    const x = Math.floor(edges.left + (edges.right - edges.left) * (i + 1) / (numSamples + 1));
    const strip: number[] = [];
    const startY = Math.max(0, Math.round(edges.bottom) - stripLen);
    const endY = Math.min(h - 1, Math.round(edges.bottom) + stripLen);
    for (let y = startY; y <= endY; y++) {
      strip.push(gray[y * w + x]);
    }
    const pos = subpixelEdgePosition(strip);
    bottomSubs.push(startY + pos);
  }

  return {
    left: median(leftSubs),
    right: median(rightSubs),
    top: median(topSubs),
    bottom: median(bottomSubs),
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// 7. Background recommendation
// ────────────────────────────────────────────────────────────────────────────────

function analyzeBackground(
  imageData: ImageData,
  edges: Edges,
): string | null {
  const { data, width, height } = imageData;

  // Sample pixels OUTSIDE the card area
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  const stride = Math.max(2, Math.floor(Math.min(width, height) / 100));

  // Sample corners of image (outside card)
  const regions = [
    { x1: 0, y1: 0, x2: Math.floor(edges.left * 0.8), y2: Math.floor(edges.top * 0.8) },
    { x1: Math.ceil(edges.right + (width - edges.right) * 0.2), y1: 0, x2: width, y2: Math.floor(edges.top * 0.8) },
    { x1: 0, y1: Math.ceil(edges.bottom + (height - edges.bottom) * 0.2), x2: Math.floor(edges.left * 0.8), y2: height },
    { x1: Math.ceil(edges.right + (width - edges.right) * 0.2), y1: Math.ceil(edges.bottom + (height - edges.bottom) * 0.2), x2: width, y2: height },
  ];

  for (const region of regions) {
    for (let y = Math.max(0, region.y1); y < Math.min(height, region.y2); y += stride) {
      for (let x = Math.max(0, region.x1); x < Math.min(width, region.x2); x += stride) {
        const px = getPixel(data, width, x, y);
        rSum += px.r;
        gSum += px.g;
        bSum += px.b;
        count++;
      }
    }
  }

  if (count === 0) return null;

  const avgLum = luminance(rSum / count, gSum / count, bSum / count);
  const bgColor = classifyPixelColor(
    Math.round(rSum / count),
    Math.round(gSum / count),
    Math.round(bSum / count),
  );

  // Check if background contrasts well with detected border
  return `bg_lum:${Math.round(avgLum)},bg_color:${bgColor}`;
}

export function getBackgroundRecommendation(
  borderColor: BorderColor,
  bgInfo: string | null,
): string | null {
  if (!bgInfo) return null;

  const lumMatch = bgInfo.match(/bg_lum:(\d+)/);
  const bgLum = lumMatch ? parseInt(lumMatch[1]) : 128;

  switch (borderColor) {
    case 'black':
      if (bgLum < 100) return 'Use a white or light-colored background for black-bordered cards';
      return null;
    case 'white':
      if (bgLum > 180) return 'Use a dark background for white-bordered cards';
      return null;
    case 'yellow':
      if (bgLum > 140 && bgLum < 220) return 'Use a darker background for better yellow border contrast';
      return null;
    case 'silver':
      if (bgLum > 130 && bgLum < 200) return 'Use a very dark or very light background for silver-bordered cards';
      return null;
    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 8. Main pipeline
// ────────────────────────────────────────────────────────────────────────────────

export class CardDetectorV2 {
  async analyzeCard(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<V2Result> {
    // Get image data from canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // Step 1: Detect border color
    const { color: borderColor, confidence: colorConfidence } = detectBorderColor(imageData);

    // Step 2: Edge detection
    const gray = toGrayscale(imageData);
    const blurred = gaussianBlur3x3(gray, w, h);
    const { mag, dirH, dirV } = sobelEdges(blurred, w, h);

    // Step 3: Find card edges
    const { edges: rawEdges, confidence: edgeConfidence } = findCardEdges(
      mag, dirH, dirV, w, h, borderColor, imageData,
    );

    // Step 4: Sub-pixel refinement
    const edges = measureEdgesSubpixel(blurred, w, h, rawEdges);

    // Step 5: Find corners and attempt perspective correction
    let rawCorners = cornersFromEdges(edges);
    rawCorners = refineCorners(rawCorners, mag, w, h);

    let correctedCanvas: HTMLCanvasElement | null = null;
    let perspectiveCorrected = false;
    let finalEdges = edges;

    try {
      correctedCanvas = perspectiveCorrect(canvas, rawCorners);
      if (correctedCanvas) {
        perspectiveCorrected = true;
        // Re-detect edges on the corrected image
        const corrCtx = correctedCanvas.getContext('2d');
        if (corrCtx) {
          const corrData = corrCtx.getImageData(0, 0, correctedCanvas.width, correctedCanvas.height);
          const corrGray = toGrayscale(corrData);
          const corrBlurred = gaussianBlur3x3(corrGray, correctedCanvas.width, correctedCanvas.height);
          const corrSobel = sobelEdges(corrBlurred, correctedCanvas.width, correctedCanvas.height);
          const { edges: corrRawEdges } = findCardEdges(
            corrSobel.mag, corrSobel.dirH, corrSobel.dirV,
            correctedCanvas.width, correctedCanvas.height,
            borderColor, corrData,
          );
          finalEdges = measureEdgesSubpixel(
            corrBlurred, correctedCanvas.width, correctedCanvas.height, corrRawEdges,
          );
        }
      }
    } catch {
      // Perspective correction failed — use original edges
    }

    // Step 6: Background analysis
    const bgInfo = analyzeBackground(imageData, rawEdges);
    const backgroundRecommendation = getBackgroundRecommendation(borderColor, bgInfo);

    // Overall confidence
    const confidence = clamp(
      (colorConfidence * 0.3 + edgeConfidence * 0.7),
      0,
      1,
    );

    const detectionMethod = perspectiveCorrected
      ? 'V2-Perspective-Corrected'
      : 'V2-Edge-Detection';

    return {
      edges: finalEdges,
      corners: rawCorners,
      correctedCanvas,
      info: {
        borderColor,
        confidence,
        perspectiveCorrected,
        backgroundRecommendation,
        detectionMethod,
      },
    };
  }
}
