import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Webcam from 'react-webcam';
import {
    FilesetResolver,
    HandLandmarker,
    type HandLandmarkerResult,
    PoseLandmarker,
    type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import CalibrationOverlay from './CalibrationOverlay';
import './api/axios';
import { findBestMatch, validateSign } from './utils';
import type { Landmark, SignSample, MatchResult, SessionSummaryDto } from './utils';
import './Practice.css';
import './Calibration.css';

// ── Tuning (same as App.tsx) ────────────────────────────────────────────────
const DETECTION_INTERVAL_MS = 43;
const HISTORY_SIZE = 10;
const HISTORY_MIN_VOTES = 7;
const CALIBRATION_DURATION_MS = 2500; // Time user must stay in box to calibrate

// ── Weighted distance (same algorithm as App.tsx) ───────────────────────────
const normalizeLandmarks = (lm: Landmark[]): Landmark[] => {
    if (!lm || lm.length === 0) return [];
    const w = lm[0];
    const centered = lm.map(p => ({ x: p.x - w.x, y: p.y - w.y, z: p.z - w.z }));
    const maxDist = Math.max(...centered.map(p => Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2)));
    return centered.map(p => ({
        x: p.x / (maxDist || 1),
        y: p.y / (maxDist || 1),
        z: p.z / (maxDist || 1),
    }));
};

const calculateDistance = (a: Landmark[], b: Landmark[]): number => {
    const na = normalizeLandmarks(a);
    const nb = normalizeLandmarks(b);
    if (na.length === 0 || nb.length === 0) return Infinity;

    const weights = [1.0, 0.8, 0.8, 0.8, 1.2, 1.0, 0.9, 0.9, 1.2,
                     1.0, 0.9, 0.9, 1.2, 1.0, 0.9, 0.9, 1.2, 1.0, 0.9, 0.9, 1.2];

    let dDirect = 0, dMirror = 0;
    for (let i = 0; i < na.length; i++) {
        const w = weights[i] || 1.0;
        const dx = na[i].x - nb[i].x, dy = na[i].y - nb[i].y, dz = na[i].z - nb[i].z;
        dDirect += w * Math.sqrt(dx * dx + dy * dy + dz * dz);
        const mdx = -na[i].x - nb[i].x;
        dMirror += w * Math.sqrt(mdx * mdx + dy * dy + dz * dz);
    }
    return Math.min(dDirect, dMirror);
};

// ── Types ───────────────────────────────────────────────────────────────────
interface LocationState {
    sessionId: number;
    signNames: string[];
    lessonTitle: string;
}

// ── Component ───────────────────────────────────────────────────────────────
const PracticeSessionPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state as LocationState | null;

    // Guard: redirect if navigated directly without state
    useEffect(() => {
        if (!state?.sessionId) navigate('/practice', { replace: true });
    }, [state, navigate]);

    const { sessionId, signNames = [], lessonTitle = '' } = state ?? {};

    // MediaPipe
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isAiLoaded, setIsAiLoaded] = useState(false);
    const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
    const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);

    // Calibration state
    const [isCalibrated, setIsCalibrated] = useState(false);
    const [isCorrectPosition, setIsCorrectPosition] = useState(false);
    const [calibrationProgress, setCalibrationProgress] = useState(0);
    const [poseLandmarks, setPoseLandmarks] = useState<Landmark[] | null>(null);
    const calibrationStartTimeRef = useRef<number | null>(null);

    // Sign data (fetched from API)
    const [samples, setSamples] = useState<SignSample[]>([]);

    // Session progress
    const [currentIndex, setCurrentIndex] = useState(0);
    const [stablePrediction, setStablePrediction] = useState('');
    const [confidence, setConfidence] = useState(0);
    const predictionHistoryRef = useRef<string[]>([]);

    // Overlay state after submit/skip
    const [submitResult, setSubmitResult] = useState<'pass' | 'fail' | 'skip' | null>(null);
    const [submitConfidence, setSubmitConfidence] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    // Summary shown after session completes
    const [summary, setSummary] = useState<SessionSummaryDto | null>(null);

    const targetSign = signNames[currentIndex] ?? '';
    const isMatch = stablePrediction.toLowerCase() === targetSign.toLowerCase() && stablePrediction !== '';

    // ── Load MediaPipe models ─────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
                );
                const hand = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    numHands: 2,
                    minHandDetectionConfidence: 0.5,
                    minHandPresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });
                setHandLandmarker(hand);

                const pose = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    numPoses: 1,
                    minPoseDetectionConfidence: 0.5,
                    minPosePresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });
                setPoseLandmarker(pose);
            } catch (e) {
                console.error('Failed to load MediaPipe models:', e);
            } finally {
                setIsAiLoaded(true);
            }
        };

        const fetchSigns = async () => {
            try {
                const res = await fetch('/api/sign');
                if (res.ok) setSamples(await res.json());
            } catch (e) {
                console.error('Failed to fetch sign samples:', e);
            }
        };

        load();
        fetchSigns();
    }, []);

    // ── Detection loop ────────────────────────────────────────────────────
    const detectHands = useCallback(() => {
        // Don't update prediction while showing result overlay
        if (submitResult !== null) return;

        if (
            webcamRef.current?.video &&
            webcamRef.current.video.readyState === 4 &&
            handLandmarker &&
            poseLandmarker &&
            canvasRef.current
        ) {
            const video = webcamRef.current.video;
            const nowInMs = performance.now();
            
            // ── Canvas Setup (Always clear every frame) ──────────────────
            canvasRef.current.width = video.videoWidth;
            canvasRef.current.height = video.videoHeight;
            const ctx = canvasRef.current.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            // ── Calibration Phase ─────────────────────────────────────────
            if (!isCalibrated) {
                const poseResult: PoseLandmarkerResult = poseLandmarker.detectForVideo(video, nowInMs);
                
                if (poseResult.landmarks?.length > 0) {
                    const pose = poseResult.landmarks[0] as Landmark[];
                    setPoseLandmarks(pose);
                    
                    // Simple check: Head (0) and shoulders (11, 12) should be within the box
                    // targetBox = { x: 0.25, y: 0.15, width: 0.5, height: 0.7 }
                    const head = pose[0];
                    const leftShoulder = pose[11];
                    const rightShoulder = pose[12];
                    
                    const isHeadIn = head.x > 0.25 && head.x < 0.75 && head.y > 0.15 && head.y < 0.5;
                    const isShouldersIn = leftShoulder.x > 0.2 && leftShoulder.x < 0.8 && 
                                        rightShoulder.x > 0.2 && rightShoulder.x < 0.8;
                    
                    const correct = isHeadIn && isShouldersIn;
                    setIsCorrectPosition(correct);
                    
                    if (correct) {
                        if (calibrationStartTimeRef.current === null) {
                            calibrationStartTimeRef.current = nowInMs;
                        }
                        const elapsed = nowInMs - calibrationStartTimeRef.current;
                        const progress = Math.min(100, (elapsed / CALIBRATION_DURATION_MS) * 100);
                        setCalibrationProgress(progress);
                        
                        if (progress >= 100) {
                            setIsCalibrated(true);
                        }
                    } else {
                        calibrationStartTimeRef.current = null;
                        setCalibrationProgress(0);
                    }
                } else {
                    setIsCorrectPosition(false);
                    calibrationStartTimeRef.current = null;
                    setCalibrationProgress(0);
                }
                return; // Only do calibration until done
            }

            // ── Normal Practice Phase ─────────────────────────────────────
            const result: HandLandmarkerResult = handLandmarker.detectForVideo(video, nowInMs);

            if (result.landmarks?.length > 0) {
                const handLm = result.landmarks as Landmark[][];

                // Draw skeleton
                const connections = [
                    [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
                    [0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],
                    [0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17],
                ];
                handLm.forEach(hand => {
                    hand.forEach(p => {
                        ctx.beginPath();
                        ctx.arc(p.x * canvasRef.current!.width, p.y * canvasRef.current!.height, 5, 0, 2 * Math.PI);
                        ctx.fillStyle = '#00FF00';
                        ctx.fill();
                    });
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2;
                    connections.forEach(([s, e]) => {
                        const p1 = hand[s], p2 = hand[e];
                        ctx.beginPath();
                        ctx.moveTo(p1.x * canvasRef.current!.width, p1.y * canvasRef.current!.height);
                        ctx.lineTo(p2.x * canvasRef.current!.width, p2.y * canvasRef.current!.height);
                        ctx.stroke();
                    });
                });

                const detected = handLm[0] as Landmark[];

                if (samples.length > 0) {
                    const match: MatchResult | null = findBestMatch(detected, samples, calculateDistance, validateSign, 3, 4.5);

                    if (match) {
                        predictionHistoryRef.current.push(match.signName);
                        if (predictionHistoryRef.current.length > HISTORY_SIZE) predictionHistoryRef.current.shift();

                        const counts: Record<string, number> = {};
                        predictionHistoryRef.current.forEach(p => { counts[p] = (counts[p] || 0) + 1; });

                        let maxCount = 0, stableSign = '';
                        Object.entries(counts).forEach(([sign, count]) => {
                            if (count > maxCount) { maxCount = count; stableSign = sign; }
                        });

                        if (maxCount >= HISTORY_MIN_VOTES) {
                            const stabilityBonus = (maxCount / HISTORY_SIZE) * 20;
                            setStablePrediction(stableSign);
                            setConfidence(Math.min(100, Math.round(match.confidence + stabilityBonus)));
                        } else {
                            setStablePrediction('');
                            setConfidence(0);
                        }
                    } else {
                        setStablePrediction('');
                        setConfidence(0);
                        predictionHistoryRef.current = [];
                    }
                }
            } else {
                setStablePrediction('');
                setConfidence(0);
            }
        }
    }, [handLandmarker, poseLandmarker, samples, submitResult, isCalibrated]);

    useEffect(() => {
        if (!isAiLoaded) return;
        let cancelled = false;
        const loop = () => {
            if (cancelled) return;
            detectHands();
            setTimeout(loop, DETECTION_INTERVAL_MS);
        };
        loop();
        return () => { cancelled = true; };
    }, [isAiLoaded, detectHands]);

    // ── Submit / Skip ─────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (submitting || !sessionId) return;
        setSubmitting(true);

        const passed = stablePrediction.toLowerCase() === targetSign.toLowerCase();
        const score = passed ? confidence : 0;
        const result: 'pass' | 'fail' = passed ? 'pass' : 'fail';

        try {
            await recordAttempt(sessionId, { signName: targetSign, score, passed, isSkipped: false });
        } catch (e) {
            console.error('Failed to record attempt:', e);
        }

        setSubmitResult(result);
        setSubmitConfidence(score);
        setSubmitting(false);
    };

    const handleSkip = async () => {
        if (submitting || !sessionId) return;
        setSubmitting(true);

        try {
            await recordAttempt(sessionId, { signName: targetSign, score: 0, passed: false, isSkipped: true });
        } catch (e) {
            console.error('Failed to record skip:', e);
        }

        setSubmitResult('skip');
        setSubmitConfidence(0);
        setSubmitting(false);
    };

    const handleNext = async () => {
        const nextIndex = currentIndex + 1;

        // Reset for next sign
        setSubmitResult(null);
        setStablePrediction('');
        setConfidence(0);
        predictionHistoryRef.current = [];

        if (nextIndex >= signNames.length) {
            // Session complete — let server compute the score
            try {
                const res = await finishSession(sessionId!);
                setSummary(res.data);
            } catch (e) {
                console.error('Failed to finish session:', e);
                navigate('/practice');
            }
        } else {
            setCurrentIndex(nextIndex);
        }
    };

    // ── Summary view ──────────────────────────────────────────────────────
    if (summary) {
        return (
            <div className="practice-root">
                <div className="practice-shell">
                    <div className="summary-shell">
                        <div className="summary-score">
                            <div className="summary-score-pct">{summary.passRate}%</div>
                            <div className="summary-score-label">
                                {summary.lessonTitle} — {summary.passedSigns} / {summary.totalSigns} correct
                            </div>
                        </div>

                        <table className="summary-table">
                            <thead>
                                <tr>
                                    <th>Sign</th>
                                    <th>Result</th>
                                    <th>Confidence</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.attempts.map((a, i) => (
                                    <tr key={i}>
                                        <td>{a.signName}</td>
                                        <td>
                                            {a.isSkipped
                                                ? <span className="badge-skip">⏭ SKIP</span>
                                                : a.passed
                                                    ? <span className="badge-pass">✅ PASS</span>
                                                    : <span className="badge-fail">❌ FAIL</span>
                                            }
                                        </td>
                                        <td>{a.isSkipped ? '—' : `${a.score.toFixed(0)}%`}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="summary-actions">
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() => navigate('/practice')}
                            >
                                Try Again
                            </button>
                            <Link to="/practice" className="primary-button" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', padding: '0.65rem 1.5rem' }}>
                                Choose Another Lesson
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Session view ──────────────────────────────────────────────────────
    return (
        <div className="practice-root">
            <div className="practice-shell">
                {/* Progress */}
                <div className="session-header">
                    <Link to="/practice" className="practice-subtitle" style={{ color: '#64748b' }}>
                        ← {lessonTitle}
                    </Link>
                    <span className="session-progress">
                        <strong>{currentIndex + 1}</strong> / {signNames.length}
                    </span>
                </div>

                {/* Target sign */}
                <div className="session-prompt">
                    <div className="session-prompt-label">Sign this word</div>
                    <div className="session-target-sign">{targetSign.toUpperCase()}</div>
                </div>

                {/* Live KNN prediction */}
                <div className={`session-detected ${isMatch ? 'is-match' : ''}`}>
                    {isAiLoaded ? (
                        stablePrediction ? (
                            <>
                                <span>Detected:</span>
                                <span className="detected-sign">{stablePrediction.toUpperCase()}</span>
                                <span className="detected-confidence">({confidence}%)</span>
                            </>
                        ) : (
                            <span>Waiting for hand…</span>
                        )
                    ) : (
                        <span>Loading AI model…</span>
                    )}
                </div>

                {/* Video + canvas */}
                <div className="session-video-frame">
                    {/* Calibration Phase Overlay */}
                    {!isCalibrated && (
                        <CalibrationOverlay 
                            poseLandmarks={poseLandmarks} 
                            isCorrectPosition={isCorrectPosition}
                            calibrationProgress={calibrationProgress}
                            isAiLoaded={isAiLoaded && !!poseLandmarker}
                        />
                    )}

                    {/* AI warm-up overlay — blocks submit until camera + model ready */}
                    {isCalibrated && !isAiLoaded && (
                        <div className="practice-loading-overlay">
                            <div className="practice-loading-spinner" />
                            <p className="practice-loading-text">Loading AI model…</p>
                        </div>
                    )}

                    <Webcam
                        ref={webcamRef}
                        className="practice-video"
                        videoConstraints={{ facingMode: 'user' }}
                    />
                    <canvas ref={canvasRef} className="practice-canvas" />

                    {/* Result overlay after Submit/Skip */}
                    {submitResult && (
                        <div className="result-overlay">
                            <div className={`result-badge ${submitResult}`}>
                                {submitResult === 'pass' && '✅ PASS'}
                                {submitResult === 'fail' && '❌ FAIL'}
                                {submitResult === 'skip' && '⏭ SKIPPED'}
                            </div>
                            {submitResult !== 'skip' && (
                                <div className="result-confidence">{submitConfidence}% confidence</div>
                            )}
                            <button type="button" className="primary-button" onClick={handleNext}>
                                {currentIndex + 1 < signNames.length ? 'Next →' : 'See Results'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Submit / Skip buttons */}
                <div className="session-actions">
                    <button
                        type="button"
                        className="secondary-button small"
                        onClick={handleSkip}
                        disabled={!isAiLoaded || submitting || submitResult !== null}
                    >
                        Skip
                    </button>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={handleSubmit}
                        disabled={!isAiLoaded || submitting || submitResult !== null}
                    >
                        {submitting ? 'Saving…' : 'Submit ✋'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PracticeSessionPage;
