/**
 * K-Nearest Neighbor matching for sign language recognition
 * Replaces single best-match with averaged K-nearest for improved accuracy
 */

import type { Landmark, SignSample, MatchResult } from './types';

/**
 * Group samples by sign name (case-insensitive)
 */
export const groupBySign = (
  samples: SignSample[]
): Record<string, SignSample[]> => {
  return samples.reduce(
    (acc, sample) => {
      const key = sample.signName.toLowerCase();
      if (!acc[key]) acc[key] = [];
      acc[key].push(sample);
      return acc;
    },
    {} as Record<string, SignSample[]>
  );
};

/**
 * Compute K-nearest neighbor average distance for samples of one sign
 *
 * @param detected - Detected hand landmarks
 * @param signSamples - All samples for one sign
 * @param calculateDistance - Distance function
 * @param K - Number of neighbors to average (default 3)
 * @returns Average distance to K nearest samples
 */
export const knnDistance = (
  detected: Landmark[],
  signSamples: SignSample[],
  calculateDistance: (a: Landmark[], b: Landmark[]) => number,
  K: number = 3
): number => {
  if (signSamples.length === 0) return Infinity;

  // Calculate distance to all samples
  const distances = signSamples
    .map(s => calculateDistance(detected, s.landmarks))
    .sort((a, b) => a - b);

  // Average K nearest (or all if fewer than K)
  const k = Math.min(K, distances.length);
  return distances.slice(0, k).reduce((a, b) => a + b, 0) / k;
};

/**
 * Find the best matching sign using KNN across all signs
 *
 * @param detected - Detected hand landmarks
 * @param samples - All samples from database
 * @param calculateDistance - Distance function (normalized, weighted)
 * @param validateSign - Rule validation function
 * @param K - Number of neighbors for KNN
 * @param threshold - Maximum distance for valid match
 * @returns Best match result, or null if no match below threshold
 */
export const findBestMatch = (
  detected: Landmark[],
  samples: SignSample[],
  calculateDistance: (a: Landmark[], b: Landmark[]) => number,
  validateSign: (signName: string, landmarks: Landmark[]) => boolean,
  K: number = 3,
  threshold: number = 4.5
): MatchResult | null => {
  // Group samples by sign name
  const grouped = groupBySign(samples);

  // Calculate KNN distance for each sign
  const results: MatchResult[] = Object.entries(grouped)
    .filter(([signName]) => validateSign(signName, detected))
    .map(([signName, signSamples]) => {
      const avgDistance = knnDistance(
        detected,
        signSamples,
        calculateDistance,
        K
      );
      return {
        signName,
        avgDistance,
        sampleCount: signSamples.length,
        confidence: 0, // Calculated below
      };
    })
    .filter(r => r.avgDistance < Infinity)
    .sort((a, b) => a.avgDistance - b.avgDistance);

  // No valid matches
  if (results.length === 0) return null;

  const best = results[0];

  // Check threshold
  if (best.avgDistance >= threshold) return null;

  // Calculate confidence score (0-100)
  // Based on: (1) how far below threshold, (2) gap to second best
  const thresholdScore =
    Math.max(0, (threshold - best.avgDistance) / threshold) * 50;

  const gapScore =
    results.length > 1
      ? Math.min(
          50,
          ((results[1].avgDistance - best.avgDistance) / best.avgDistance) * 100
        )
      : 50;

  best.confidence = Math.round(Math.min(100, thresholdScore + gapScore));

  return best;
};

/**
 * Get statistics about matching results (for debugging)
 */
export const getMatchingStats = (
  detected: Landmark[],
  samples: SignSample[],
  calculateDistance: (a: Landmark[], b: Landmark[]) => number,
  K: number = 3
): Array<{ signName: string; avgDistance: number; sampleCount: number }> => {
  const grouped = groupBySign(samples);

  return Object.entries(grouped)
    .map(([signName, signSamples]) => ({
      signName,
      avgDistance: knnDistance(detected, signSamples, calculateDistance, K),
      sampleCount: signSamples.length,
    }))
    .sort((a, b) => a.avgDistance - b.avgDistance);
};
