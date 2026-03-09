/**
 * Shared type definitions for AI-ComSign
 * Used by both App.tsx (recognition) and AdminExtraction.tsx (data collection)
 */

/**
 * A single hand landmark point from MediaPipe
 * 21 points per hand (wrist + 4 fingers × 5 joints each)
 */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/**
 * A sign language sample stored in the database
 */
export interface SignSample {
  id?: number;
  fileName?: string;
  signName: string;
  landmarks: Landmark[];
  isAugmented?: boolean;
  sourceFileName?: string;
  frameIndex?: number;
  createdAt?: string;
}

/**
 * Dataset statistics for a single sign
 */
export interface SignStats {
  signName: string;
  count: number;
  augmentedCount: number;
}

/**
 * Configuration for video extraction process
 */
export interface ExtractionConfig {
  /** Timestamps to extract frames at (0-1 range, e.g., 0.5 = 50% through video) */
  frameTimestamps: number[];
  /** Whether to generate augmented versions of each sample */
  enableAugmentation: boolean;
  /** Rotation angles in degrees for augmentation */
  rotationAngles: number[];
  /** Whether to generate mirrored versions */
  enableMirror: boolean;
}

/**
 * Default extraction configuration
 * - 5 frames at 20%, 35%, 50%, 65%, 80% of video duration
 * - Augmentation enabled with mirror and ±5° rotation
 */
export const DEFAULT_EXTRACTION_CONFIG: ExtractionConfig = {
  frameTimestamps: [0.2, 0.35, 0.5, 0.65, 0.8],
  enableAugmentation: true,
  rotationAngles: [-5, 5],
  enableMirror: true,
};

/**
 * Result from KNN matching
 */
export interface MatchResult {
  signName: string;
  avgDistance: number;
  sampleCount: number;
  confidence: number;
}

// ============================================================================
// Practice / Grading types
// ============================================================================

export interface SessionStartedDto {
  sessionId: number;
  signNames: string[];
}

export interface AttemptDto {
  signName: string;
  score: number;
  passed: boolean;
  isSkipped: boolean;
}

export interface AttemptSummary {
  signName: string;
  score: number;
  passed: boolean;
  isSkipped: boolean;
}

export interface SessionSummaryDto {
  sessionId: number;
  lessonTitle: string;
  totalSigns: number;
  passedSigns: number;
  passRate: number;
  startDate: string;
  endDate: string | null;
  attempts: AttemptSummary[];
}

export interface PracticeSessionDto {
  id: number;
  lessonTitle: string;
  startDate: string;
  endDate: string | null;
  totalSigns: number;
  passedSigns: number;
  passRate: number;
  attempts: AttemptSummary[];
}

export interface PerLearnerStat {
  learnerId: string;
  name: string;
  sessionCount: number;
  avgPassRate: number;
}

export interface PerLessonStat {
  lessonId: number;
  title: string;
  avgPassRate: number;
  hardestSigns: string[];
}

export interface PerSignStat {
  signName: string;
  totalAttempts: number;
  passCount: number;
  skipCount: number;
  passRate: number;
  skipRate: number;
}

export interface AdminPracticeStatsDto {
  perLearner: PerLearnerStat[];
  perLesson: PerLessonStat[];
  perSign: PerSignStat[];
}
