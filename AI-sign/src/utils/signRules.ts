/**
 * Sign-specific validation rules for Vietnamese Sign Language (VSL)
 * These rules help distinguish between similar-looking signs (e.g., C/E/M)
 */

import type { Landmark } from './types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate 3D Euclidean distance between two landmarks
 */
export const distance3D = (p1: Landmark, p2: Landmark): number => {
  return Math.sqrt(
    (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2
  );
};

/**
 * Calculate angle between three points (vertex at p2)
 * @returns Angle in degrees
 */
export const calculateAngle = (
  p1: Landmark,
  p2: Landmark,
  p3: Landmark
): number => {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);

  const cos = dot / (mag1 * mag2 || 1);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
};

/**
 * Calculate finger linearity (how straight is the finger)
 * 1.0 = perfectly straight, lower = more bent
 *
 * @param landmarks - All 21 hand landmarks
 * @param mcpIdx - Index of MCP joint (base of finger)
 * @param tipIdx - Index of fingertip
 */
export const getFingerLinearity = (
  landmarks: Landmark[],
  mcpIdx: number,
  tipIdx: number
): number => {
  const mcp = landmarks[mcpIdx];
  const pip = landmarks[mcpIdx + 1];
  const dip = landmarks[mcpIdx + 2];
  const tip = landmarks[tipIdx];

  const boneLength =
    distance3D(mcp, pip) + distance3D(pip, dip) + distance3D(dip, tip);
  const straightLine = distance3D(mcp, tip);

  return straightLine / (boneLength || 1);
};

/**
 * Check if thumb is folded/tucked into palm
 */
export const isThumbFolded = (landmarks: Landmark[]): boolean => {
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  const pinkyBase = landmarks[17];

  const distToPinky = distance3D(thumbTip, pinkyBase);
  const distToIndex = distance3D(thumbTip, indexMcp);

  // Thumb is folded if close to pinky side or index base
  return distToPinky < 0.15 || distToIndex < 0.08;
};

/**
 * Get average linearity of all four fingers (excluding thumb)
 */
export const getAverageFingerLinearity = (landmarks: Landmark[]): number => {
  const indexLin = getFingerLinearity(landmarks, 5, 8);
  const middleLin = getFingerLinearity(landmarks, 9, 12);
  const ringLin = getFingerLinearity(landmarks, 13, 16);
  const pinkyLin = getFingerLinearity(landmarks, 17, 20);
  return (indexLin + middleLin + ringLin + pinkyLin) / 4;
};

// ============================================================================
// SIGN VALIDATION RULES
// ============================================================================

/**
 * Validate if detected landmarks match the expected shape for a sign
 * Returns true if the shape PASSES validation (could be this sign)
 * Returns false if the shape FAILS validation (definitely not this sign)
 *
 * Signs without specific rules always return true
 */
export const validateSign = (
  signName: string,
  landmarks: Landmark[]
): boolean => {
  const name = signName.toLowerCase();

  // Calculate commonly used metrics
  const indexLin = getFingerLinearity(landmarks, 5, 8);
  const middleLin = getFingerLinearity(landmarks, 9, 12);
  const ringLin = getFingerLinearity(landmarks, 13, 16);
  const pinkyLin = getFingerLinearity(landmarks, 17, 20);
  const avgLinearity = (indexLin + middleLin + ringLin + pinkyLin) / 4;

  // Landmark positions
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  // =========================================================================
  // SIGN A: Fist with thumb to side
  // - Fingers should NOT be straight
  // =========================================================================
  if (name === 'a') {
    if (indexLin > 0.9 || middleLin > 0.9) return false;
  }

  // =========================================================================
  // SIGN B: Flat hand with thumb tucked
  // - Fingers should be straight
  // - Thumb should be folded
  // =========================================================================
  if (name === 'b') {
    if (indexLin < 0.9) return false;
    if (!isThumbFolded(landmarks)) return false;
  }

  // =========================================================================
  // SIGN C: Curved hand shape (like holding a cup)
  // - Fingers partially bent (not straight, not closed)
  // - Fingers should be spread apart
  // =========================================================================
  if (name === 'c') {
    // Linearity should be in mid-range (curved)
    if (avgLinearity < 0.65 || avgLinearity > 0.90) return false;

    // Fingers should be spread apart (not touching)
    const indexMiddleDist = distance3D(indexTip, middleTip);
    if (indexMiddleDist < 0.03) return false;
  }

  // =========================================================================
  // SIGN D: Index finger up, others down
  // - Index should be straight
  // - Other fingers should NOT be straight
  // =========================================================================
  if (name === 'd') {
    if (indexLin < 0.9) return false;
    if (middleLin > 0.95 || ringLin > 0.95) return false;
  }

  // =========================================================================
  // SIGN E: Fingertips curled to touch/near thumb
  // - All fingertips close to thumb tip
  // - Fingers should be curled (low linearity)
  // =========================================================================
  if (name === 'e') {
    const avgDistToThumb =
      (distance3D(indexTip, thumbTip) +
        distance3D(middleTip, thumbTip) +
        distance3D(ringTip, thumbTip) +
        distance3D(pinkyTip, thumbTip)) / 4;

    // Fingertips should be close to thumb
    if (avgDistToThumb > 0.15) return false;

    // Fingers should be curled
    if (avgLinearity > 0.75) return false;
  }

  // =========================================================================
  // SIGN F: Index and thumb form circle, other fingers up
  // - Index and thumb tips close together
  // - Other fingers straight
  // =========================================================================
  if (name === 'f') {
    const indexThumbDist = distance3D(indexTip, thumbTip);
    if (indexThumbDist > 0.12) return false;

    // Other fingers should be relatively straight
    if (middleLin < 0.80 || ringLin < 0.80 || pinkyLin < 0.80) return false;
  }

  // =========================================================================
  // SIGN M: Three fingers over thumb
  // - Index, middle, ring bent over thumb
  // - Thumb tucked
  // =========================================================================
  if (name === 'm') {
    // Fingers should be bent (not straight)
    if (indexLin > 0.85 || middleLin > 0.85 || ringLin > 0.85) return false;

    // Thumb should be tucked
    if (!isThumbFolded(landmarks)) return false;
  }

  // No rule failed - sign passes validation
  return true;
};

/**
 * Get list of signs that have specific validation rules
 */
export const getSignsWithRules = (): string[] => {
  return ['a', 'b', 'c', 'd', 'e', 'f', 'm'];
};
