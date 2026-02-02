/**
 * Utility exports for AI-ComSign
 */

// Types
export type {
  Landmark,
  SignSample,
  SignStats,
  ExtractionConfig,
  MatchResult,
} from './types';

export { DEFAULT_EXTRACTION_CONFIG } from './types';

// Augmentation
export {
  mirrorLandmarks,
  rotateLandmarks,
  cleanLandmarks,
  augmentSample,
  getAugmentationMultiplier,
} from './augmentation';

// Sign validation rules
export {
  distance3D,
  calculateAngle,
  getFingerLinearity,
  isThumbFolded,
  getAverageFingerLinearity,
  validateSign,
  getSignsWithRules,
} from './signRules';

// KNN matching
export {
  groupBySgn,
  knnDistance,
  findBestMatch,
  getMatchingStats,
} from './knnMatcher';
