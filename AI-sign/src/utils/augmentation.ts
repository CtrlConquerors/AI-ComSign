/**
 * Data augmentation utilities for sign language samples
 * Generates variations of hand landmark data to improve model robustness
 */

import type { Landmark, SignSample, ExtractionConfig } from './types';

/**
 * Mirror landmarks by flipping X coordinate
 * Simulates using the opposite hand
 */
export const mirrorLandmarks = (landmarks: Landmark[]): Landmark[] => {
  return landmarks.map(p => ({
    x: -p.x,
    y: p.y,
    z: p.z,
    visibility: p.visibility,
  }));
};

/**
 * Rotate landmarks around wrist (2D rotation in X-Y plane)
 * Simulates slight hand rotation variations
 *
 * @param landmarks - Original landmarks (wrist is index 0)
 * @param angleDeg - Rotation angle in degrees (positive = counterclockwise)
 */
export const rotateLandmarks = (
  landmarks: Landmark[],
  angleDeg: number
): Landmark[] => {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const wrist = landmarks[0];

  return landmarks.map(p => ({
    x: (p.x - wrist.x) * cos - (p.y - wrist.y) * sin + wrist.x,
    y: (p.x - wrist.x) * sin + (p.y - wrist.y) * cos + wrist.y,
    z: p.z,
    visibility: p.visibility,
  }));
};

/**
 * Clean landmarks by rounding to 6 decimal places
 * Reduces storage size and normalizes precision
 */
export const cleanLandmarks = (landmarks: Landmark[]): Landmark[] => {
  return landmarks.map(p => ({
    x: Number(p.x.toFixed(6)),
    y: Number(p.y.toFixed(6)),
    z: Number(p.z.toFixed(6)),
    visibility: p.visibility,
  }));
};

/**
 * Generate all augmented versions of a sample
 *
 * @param sample - Original sample
 * @param config - Extraction configuration
 * @returns Array of samples: [original, mirrored?, rotated1?, rotated2?, ...]
 */
export const augmentSample = (
  sample: SignSample,
  config: ExtractionConfig
): SignSample[] => {
  const results: SignSample[] = [];

  // Original (cleaned)
  results.push({
    ...sample,
    landmarks: cleanLandmarks(sample.landmarks),
    isAugmented: false,
  });

  // Mirror augmentation
  if (config.enableMirror) {
    results.push({
      ...sample,
      landmarks: cleanLandmarks(mirrorLandmarks(sample.landmarks)),
      isAugmented: true,
      fileName: sample.fileName ? `${sample.fileName}_mirror` : undefined,
    });
  }

  // Rotation augmentations
  for (const angle of config.rotationAngles) {
    results.push({
      ...sample,
      landmarks: cleanLandmarks(rotateLandmarks(sample.landmarks, angle)),
      isAugmented: true,
      fileName: sample.fileName ? `${sample.fileName}_rot${angle}` : undefined,
    });
  }

  return results;
};

/**
 * Calculate expected number of augmented samples per original
 */
export const getAugmentationMultiplier = (config: ExtractionConfig): number => {
  let count = 1; // Original
  if (config.enableMirror) count += 1;
  count += config.rotationAngles.length;
  return count;
};
