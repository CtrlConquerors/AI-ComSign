import React, { useEffect, useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import {
    FilesetResolver,
    HandLandmarker,
    type HandLandmarkerResult,
    PoseLandmarker,
    type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { initVrmScene, type VrmController } from "./vrmScene";
import "./App.css";

// Import shared types and utilities
import type { Landmark, SignSample, MatchResult } from "./utils";
import { findBestMatch, validateSign } from "./utils";


// ============================================================================
// CONSTANTS & TUNING
// ============================================================================

// Detection loop frequency (lower = less CPU/GPU, but also less responsive)
const DETECTION_INTERVAL_MS = 43; // ~20 FPS

// Sentence + prediction stability
const COMMIT_MS = 1200;      // time to hold same word to commit
const MIN_CONFIDENCE = 70;   // minimum confidence to auto-commit
const COOLDOWN_MS = 1200;    // wait before committing same word again
const HISTORY_SIZE = 10;      // frames kept in history
const HISTORY_MIN_VOTES = 7; // required votes in history to accept a stable prediction

// Pose smoothing (for body / avatar)
// Lower alpha = smoother output with less jitter (at cost of slight lag)
const POSE_SMOOTHING_ALPHA = 0.27;
// Ignore landmark movements smaller than this — filters micro-jitter
const POSE_DEADZONE = 0.003;

// Ghost limb: hold last known hand pose before returning to rest
const GHOST_LIMB_MS = 300;

// ============================================================================
// DISTANCE CALCULATION (kept here due to specific weights)
// ============================================================================

const normalizeLandmarks = (landmarks: Landmark[]): Landmark[] => {
    if (!landmarks || landmarks.length === 0) return [];
    const wrist = landmarks[0];

    const centered = landmarks.map((p) => ({
        x: p.x - wrist.x,
        y: p.y - wrist.y,
        z: p.z - wrist.z,
    }));

    const maxDist = Math.max(
        ...centered.map((p) => Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2))
    );

    return centered.map((p) => ({
        x: p.x / (maxDist || 1),
        y: p.y / (maxDist || 1),
        z: p.z / (maxDist || 1),
    }));
};

/**
 * Calculate weighted distance between user landmarks and sample landmarks
 * Includes automatic mirroring to handle left/right hand variations
 */
const calculateDistance = (
    userLandmarks: Landmark[],
    sampleLandmarks: Landmark[]
): number => {
    const normUser = normalizeLandmarks(userLandmarks);
    const normSample = normalizeLandmarks(sampleLandmarks);

    if (normUser.length === 0 || normSample.length === 0) return Infinity;

    // Weights: higher for fingertips, lower for intermediate joints
    const weights = [
        1.0,  // 0: wrist
        0.8, 0.8, 0.8, 1.2,  // 1-4: thumb
        1.0, 0.9, 0.9, 1.2,  // 5-8: index
        1.0, 0.9, 0.9, 1.2,  // 9-12: middle
        1.0, 0.9, 0.9, 1.2,  // 13-16: ring
        1.0, 0.9, 0.9, 1.2,  // 17-20: pinky
    ];

    let distDirect = 0;
    for (let i = 0; i < normUser.length; i++) {
        const dx = normUser[i].x - normSample[i].x;
        const dy = normUser[i].y - normSample[i].y;
        const dz = normUser[i].z - normSample[i].z;
        const weight = weights[i] || 1.0;
        distDirect += weight * Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    let distMirrored = 0;
    for (let i = 0; i < normUser.length; i++) {
        const dx = -normUser[i].x - normSample[i].x;
        const dy = normUser[i].y - normSample[i].y;
        const dz = normUser[i].z - normSample[i].z;
        const weight = weights[i] || 1.0;
        distMirrored += weight * Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    return Math.min(distDirect, distMirrored);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const DeepMotionDemo: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Camera facing mode state ("user" = front, "environment" = back)
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

    // 3D avatar toggle + controller
    const [showAvatar, setShowAvatar] = useState<boolean>(false);
    const [isAvatarLoaded, setIsAvatarLoaded] = useState<boolean>(false);
    const vrmControllerRef = useRef<VrmController | null>(null);

    const [isAiLoaded, setIsAiLoaded] = useState(false);
    const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
    const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);

    const [samples, setSamples] = useState<SignSample[]>([]);
    const [prediction, setPrediction] = useState<string>("");
    const [currentLandmarks, setCurrentLandmarks] = useState<Landmark[] | null>(null);
    const [debugDist, setDebugDist] = useState<number>(0);
    const [confidence, setConfidence] = useState<number>(0);

    const predictionHistoryRef = useRef<string[]>([]);
    const [stablePrediction, setStablePrediction] = useState<string>("");

    // Camera on/off state
    const [cameraEnabled, setCameraEnabled] = useState<boolean>(false);

    // Sample count for display
    const [sampleCount, setSampleCount] = useState<number>(0);

    // Sentence building state (auto dwell-to-commit)
    const [words, setWords] = useState<string[]>([]);
    const currentSentence = words.join(" ");

    const lastWordRef = useRef<string | null>(null);
    const lastWordChangeTsRef = useRef<number>(0);
    const lastCommittedAtRef = useRef<number | null>(null);

    // Smoothed pose landmarks over time (for stable body skeleton)
    const smoothedPoseRef = useRef<Landmark[] | null>(null);

    // Ghost limb: track when each hand side was last detected
    const lastHandDetectedTimeRef = useRef<Record<"Left" | "Right", number>>({ Left: 0, Right: 0 });

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    useEffect(() => {
        const loadModels = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );

                // Hand model (always used)
                const hand = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                        delegate: "GPU",
                    },
                    runningMode: "VIDEO",
                    numHands: 2,
                    minHandDetectionConfidence: 0.5,
                    minHandPresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });
                setHandLandmarker(hand);

                // Pose model (only used when avatar is shown, but cheap enough to load once)
                const pose = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                        delegate: "GPU",
                    },
                    runningMode: "VIDEO",
                    numPoses: 1,
                    minPoseDetectionConfidence: 0.5,
                    minPosePresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });
                setPoseLandmarker(pose);
            } catch (e) {
                console.error("Failed to load MediaPipe models:", e);
            } finally {
                // Unblock UI even if something failed
                setIsAiLoaded(true);
            }
        };

        const fetchSignData = async () => {
            try {
                const response = await fetch("/api/sign");
                if (response.ok) {
                    const data: SignSample[] = await response.json();
                    setSamples(data);
                    setSampleCount(data.length);
                } else {
                    console.error("Failed to fetch signs from DB");
                }
            } catch (error) {
                console.error("Error fetching signs:", error);
            }
        };

        loadModels();
        fetchSignData();
    }, []);

    // ========================================================================
    // VRM AVATAR INITIALIZATION EFFECT
    // ========================================================================

    useEffect(() => {
        if (!showAvatar) {
            if (vrmControllerRef.current) {
                vrmControllerRef.current.dispose();
                vrmControllerRef.current = null;
            }
            setIsAvatarLoaded(false);
            return;
        }

        setIsAvatarLoaded(false); // show spinner immediately on open

        const container = document.getElementById("vrm-avatar-container");
        if (!container) return;

        const load = async () => {
            try {
                const controller = await initVrmScene(container, "/Model3D.vrm");
                vrmControllerRef.current = controller;
                setIsAvatarLoaded(true);
            } catch (e) {
                console.error("Failed to init VRM scene", e);
                setIsAvatarLoaded(true); // unblock UI even on error
            }
        };

        load();

        return () => {
            if (vrmControllerRef.current) {
                vrmControllerRef.current.dispose();
                vrmControllerRef.current = null;
            }
        };
    }, [showAvatar]);

    // ========================================================================
    // TRAINING (local only)
    // ========================================================================

    const trainSign = (signName: string) => {
        if (currentLandmarks) {
            const newSample: SignSample = {
                signName,
                landmarks: currentLandmarks,
            };
            setSamples((prev) => [...prev, newSample]);
            setSampleCount((prev) => prev + 1);
            alert(`Learned sign: ${signName}`);
        } else {
            alert("No hand detected!");
        }
    };

    // ========================================================================
    // SENTENCE HELPERS (manual undo / clear as backup)
    // ========================================================================

    const manualUndo = () => {
        setWords((prev) => prev.slice(0, -1));
    };

    const manualClear = () => {
        setWords([]);
    };

    // ========================================================================
    // POSE SMOOTHING
    // ========================================================================

    const smoothPoseLandmarks = (pose: Landmark[]): Landmark[] => {
        const prev = smoothedPoseRef.current;

        if (!prev || prev.length !== pose.length) {
            const copy = pose.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }));
            smoothedPoseRef.current = copy;
            return copy;
        }

        const alpha = POSE_SMOOTHING_ALPHA;
        const next: Landmark[] = pose.map((p, i) => {
            const pr = prev[i];

            let dx = p.x - pr.x;
            let dy = p.y - pr.y;
            let dz = p.z - pr.z;

            if (Math.abs(dx) < POSE_DEADZONE) dx = 0;
            if (Math.abs(dy) < POSE_DEADZONE) dy = 0;
            if (Math.abs(dz) < POSE_DEADZONE) dz = 0;

            return {
                x: pr.x + dx * alpha,
                y: pr.y + dy * alpha,
                z: pr.z + dz * alpha,
                // Pass visibility through as-is — it's a confidence score, not a position
                visibility: p.visibility,
            };
        });

        smoothedPoseRef.current = next;
        return next;
    };

    // ========================================================================
    // DETECTION LOOP (with KNN matching + dwell commit)
    // ========================================================================

    const detectHands = useCallback(() => {
        const drawHandSkeleton = (
            canvasCtx: CanvasRenderingContext2D,
            landmarks: Landmark[][]
        ) => {
            // Standard MediaPipe hand connections:
            // Wrist (0) connects directly to ALL five MCP joints — this creates the
            // visible fan/V shape at the wrist. Missing [0,9] and [0,13] caused only
            // two lines to fan out, which collapsed into a single line from many angles.
            const connections = [
                [0, 1], [1, 2], [2, 3], [3, 4],          // thumb
                [0, 5], [5, 6], [6, 7], [7, 8],           // index
                [0, 9], [9, 10], [10, 11], [11, 12],      // middle  ← [0,9] added
                [0, 13], [13, 14], [14, 15], [15, 16],    // ring    ← [0,13] added
                [0, 17], [17, 18], [18, 19], [19, 20],    // pinky
                // Knuckle line across the palm
                [5, 9], [9, 13], [13, 17],
            ];

            if (!canvasRef.current) return;

            landmarks.forEach((hand) => {
                hand.forEach((point) => {
                    canvasCtx.beginPath();
                    canvasCtx.arc(
                        point.x * canvasRef.current!.width,
                        point.y * canvasRef.current!.height,
                        5,
                        0,
                        2 * Math.PI
                    );
                    canvasCtx.fillStyle = "#00FF00";
                    canvasCtx.fill();
                });

                canvasCtx.strokeStyle = "#FFFFFF";
                canvasCtx.lineWidth = 2;
                connections.forEach(([start, end]) => {
                    const p1 = hand[start];
                    const p2 = hand[end];
                    canvasCtx.beginPath();
                    canvasCtx.moveTo(
                        p1.x * canvasRef.current!.width,
                        p1.y * canvasRef.current!.height
                    );
                    canvasCtx.lineTo(
                        p2.x * canvasRef.current!.width,
                        p2.y * canvasRef.current!.height
                    );
                    canvasCtx.stroke();
                });
            });
        };

        const drawPoseSkeleton = (
            canvasCtx: CanvasRenderingContext2D,
            poseLandmarks: Landmark[]
        ) => {
            if (!canvasRef.current) return;

            const width = canvasRef.current.width;
            const height = canvasRef.current.height;

            const connections: [number, number][] = [
                [11, 12],
                [11, 13], [13, 15],
                [12, 14], [14, 16],
                [11, 23], [12, 24],
                [23, 24],
                [23, 25], [25, 27],
                [24, 26], [26, 28],
                // Wrist fan — pose landmarks include pinky(17/18), index(19/20), thumb(21/22)
                [15, 17], [15, 19], [15, 21],  // left wrist  → pinky / index / thumb
                [16, 18], [16, 20], [16, 22],  // right wrist → pinky / index / thumb
            ];

            // Ghost limb: bone disappears when confidence drops below MIN_VIS,
            // and fades in/out smoothly over FADE_RANGE above that threshold.
            const MIN_VIS = 0.5;
            const FADE_RANGE = 0.2;
            const getAlpha = (vis: number) =>
                vis < MIN_VIS ? 0 : Math.min(1, (vis - MIN_VIS) / FADE_RANGE);

            connections.forEach(([a, b]) => {
                const p1 = poseLandmarks[a];
                const p2 = poseLandmarks[b];
                if (!p1 || !p2) return;

                // Both endpoints must be visible — weakest one drives the fade
                const alpha = Math.min(
                    getAlpha(p1.visibility ?? 1),
                    getAlpha(p2.visibility ?? 1)
                );
                if (alpha <= 0) return;

                canvasCtx.globalAlpha = alpha;
                canvasCtx.strokeStyle = "#00BFFF";
                canvasCtx.lineWidth = 3;
                canvasCtx.beginPath();
                canvasCtx.moveTo(p1.x * width, p1.y * height);
                canvasCtx.lineTo(p2.x * width, p2.y * height);
                canvasCtx.stroke();
            });

            const jointIndices = new Set<number>();
            connections.forEach(([a, b]) => {
                jointIndices.add(a);
                jointIndices.add(b);
            });

            jointIndices.forEach((i) => {
                const p = poseLandmarks[i];
                if (!p) return;

                const alpha = getAlpha(p.visibility ?? 1);
                if (alpha <= 0) return;

                canvasCtx.globalAlpha = alpha;
                canvasCtx.fillStyle = "#FF0088";
                canvasCtx.beginPath();
                canvasCtx.arc(p.x * width, p.y * height, 5, 0, 2 * Math.PI);
                canvasCtx.fill();
            });

            // Always restore alpha so other canvas draws aren't affected
            canvasCtx.globalAlpha = 1;
        };

        if (!cameraEnabled) {
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext("2d");
                if (ctx) {
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                }
            }
            setPrediction("");
            setStablePrediction("");
            setConfidence(0);
            return;
        }

        if (
            webcamRef.current &&
            webcamRef.current.video &&
            webcamRef.current.video.readyState === 4 &&
            handLandmarker &&
            canvasRef.current
        ) {
            const video = webcamRef.current.video;
            const nowInMs = performance.now();

            // Hands are always detected
            const handResults: HandLandmarkerResult =
                handLandmarker.detectForVideo(video, nowInMs);

            // Pose only when avatar is shown and pose model is ready
            let poseResults: PoseLandmarkerResult | null = null;
            if (poseLandmarker && showAvatar) {
                poseResults = poseLandmarker.detectForVideo(video, nowInMs);
            }

            const canvasCtx = canvasRef.current.getContext("2d");
            canvasRef.current.width = video.videoWidth;
            canvasRef.current.height = video.videoHeight;

            if (!canvasCtx) return;

            canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            // ── POSE: always runs when avatar is shown, independent of hand detection ──
            let poseLm: Landmark[] | null = null;
            let worldLm: Landmark[] | null = null;
            if (poseResults && poseResults.landmarks && poseResults.landmarks.length > 0) {
                const rawPose = poseResults.landmarks[0] as unknown as Landmark[];
                poseLm = smoothPoseLandmarks(rawPose);
                drawPoseSkeleton(canvasCtx, poseLm);

                // worldLandmarks are in metres — required for accurate Kalidokit arm solving
                if (poseResults.worldLandmarks && poseResults.worldLandmarks.length > 0) {
                    worldLm = poseResults.worldLandmarks[0] as unknown as Landmark[];
                }
            }

            if (showAvatar && vrmControllerRef.current && poseLm && vrmControllerRef.current.updateFromPose) {
                vrmControllerRef.current.updateFromPose(poseLm, worldLm ?? undefined);
            }

            // ── HANDS: only runs when at least one hand is detected ──
            if (handResults.landmarks && handResults.landmarks.length > 0) {
                const handLm = handResults.landmarks as Landmark[][];
                drawHandSkeleton(canvasCtx, handLm);

                const detectedHand = handLm[0] as Landmark[];
                setCurrentLandmarks(detectedHand);

                if (showAvatar && vrmControllerRef.current) {
                    const detectedSides = new Set<"Left" | "Right">();
                    for (let i = 0; i < handLm.length; i++) {
                        const landmarks = handLm[i] as Landmark[];
                        const rawHandedness =
                            handResults.handedness?.[i]?.[0]?.categoryName ??
                            handResults.handednesses?.[i]?.[0]?.categoryName ??
                            "Right";
                        // MediaPipe reports handedness from the person's perspective directly —
                        // no flip needed. Pass it straight to Kalidokit and VRM.
                        const handednessLabel = rawHandedness as "Left" | "Right";
                        detectedSides.add(handednessLabel);
                        // Ghost limb: stamp when this side was last actively tracked
                        lastHandDetectedTimeRef.current[handednessLabel] = nowInMs;
                        vrmControllerRef.current.updateFromLandmarks(landmarks, handednessLabel);
                    }
                    // Ghost limb: only reset fingers once the hold window has expired
                    (["Left", "Right"] as const).forEach((side) => {
                        if (
                            !detectedSides.has(side) &&
                            nowInMs - lastHandDetectedTimeRef.current[side] > GHOST_LIMB_MS
                        ) {
                            vrmControllerRef.current!.resetFingers?.(side);
                        }
                    });
                }

                if (samples.length > 0) {
                    const matchResult: MatchResult | null = findBestMatch(
                        detectedHand,
                        samples,
                        calculateDistance,
                        validateSign,
                        3,
                        4.5
                    );

                    if (matchResult) {
                        setDebugDist(Number(matchResult.avgDistance.toFixed(2)));

                        predictionHistoryRef.current.push(matchResult.signName);
                        if (predictionHistoryRef.current.length > HISTORY_SIZE) {
                            predictionHistoryRef.current.shift();
                        }

                        const counts: Record<string, number> = {};
                        predictionHistoryRef.current.forEach((p) => {
                            counts[p] = (counts[p] || 0) + 1;
                        });

                        let maxCount = 0;
                        let stableMatch = "";
                        Object.entries(counts).forEach(([sign, count]) => {
                            if (count > maxCount) {
                                maxCount = count;
                                stableMatch = sign;
                            }
                        });

                        if (maxCount >= HISTORY_MIN_VOTES) {
                            setPrediction(stableMatch);
                            setStablePrediction(stableMatch);
                            const stabilityBonus = (maxCount / HISTORY_SIZE) * 20;
                            const blendedConfidence = Math.min(
                                100,
                                matchResult.confidence + stabilityBonus
                            );
                            setConfidence(blendedConfidence);

                            const now = performance.now();
                            if (lastWordRef.current !== stableMatch) {
                                lastWordRef.current = stableMatch;
                                lastWordChangeTsRef.current = now;
                            }
                            const heldMs = now - lastWordChangeTsRef.current;

                            const lastCommittedAt = lastCommittedAtRef.current;
                            const cooldownOver =
                                !lastCommittedAt ||
                                now - lastCommittedAt > COOLDOWN_MS ||
                                words[words.length - 1] !== stableMatch;

                            if (
                                heldMs >= COMMIT_MS &&
                                blendedConfidence >= MIN_CONFIDENCE &&
                                cooldownOver
                            ) {
                                setWords((prev) => [...prev, stableMatch]);
                                lastCommittedAtRef.current = now;
                            }
                        } else {
                            setPrediction("");
                            setStablePrediction("");
                            setConfidence(0);
                        }
                    } else {
                        setDebugDist(Infinity);
                        setPrediction("");
                        setStablePrediction("");
                        setConfidence(0);
                        predictionHistoryRef.current = [];
                        lastWordRef.current = null;
                    }
                }
            } else {
                setPrediction("");
                setStablePrediction("");
                // Ghost limb: only reset fingers once the hold window has expired
                if (showAvatar && vrmControllerRef.current?.resetFingers) {
                    (["Left", "Right"] as const).forEach((side) => {
                        if (nowInMs - lastHandDetectedTimeRef.current[side] > GHOST_LIMB_MS) {
                            vrmControllerRef.current!.resetFingers!(side);
                        }
                    });
                }
            }
        }
    }, [
        cameraEnabled,
        handLandmarker,
        poseLandmarker,
        samples,
        words,
        showAvatar,
    ]);

    // Throttled detection loop
    useEffect(() => {
        if (!isAiLoaded || !cameraEnabled) return;

        let cancelled = false;

        const loop = () => {
            if (cancelled) return;
            detectHands();
            setTimeout(loop, DETECTION_INTERVAL_MS);
        };

        loop();

        return () => {
            cancelled = true;
        };
    }, [isAiLoaded, cameraEnabled, detectHands]);

    // ========================================================================
    // RENDER
    // ========================================================================

    const toggleCameraFacing = () => {
        setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    };

    return (
        <div className="app-root">
            <div className="app-shell">
                <header className="app-header">
                    <h1 className="app-title">
                        AI-ComSign <span className="mode-tag">(KNN Mode)</span>
                    </h1>
                    <p className="app-subtitle">
                        Real-time hand sign recognition using MediaPipe + K-Nearest Neighbor matching.
                        <span className="sample-count"> ({sampleCount} samples loaded)</span>
                    </p>
                </header>

                <section className="status-section" aria-live="polite">
                    <div className="status-shell">
                        <div className={`status-card ${prediction ? "has-prediction" : "is-empty"}`}>
                            <div className="status-inner">
                                <div className={`status-letter-wrap ${prediction ? "visible" : "hidden"}`}>
                                    <div className="status-letter">
                                        {prediction}
                                    </div>
                                </div>

                                {prediction ? (
                                    <div className="status-metrics">
                                        <span className="metric metric-accuracy">
                                            Confidence: <strong>{confidence}%</strong>
                                        </span>
                                        <span className="metric metric-distance">
                                            Distance: <strong>{debugDist}</strong>
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        <p>Show a hand sign in the frame.</p>
                                        <small>
                                            Current distance: {debugDist === Infinity ? "N/A" : debugDist} (threshold: 4.5)
                                        </small>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Sentence builder */}
                <section className="sentence-section">
                    <div className="sentence-current">
                        <span className="label">Current word:</span>
                        <span className="value">
                            {stablePrediction || <span className="placeholder">—</span>}
                        </span>
                    </div>

                    <div className="sentence-built">
                        <span className="label">Sentence:</span>
                        <span className="value">
                            {currentSentence || (
                                <span className="placeholder">
                                    Hold a sign steady to start building a sentence…
                                </span>
                            )}
                        </span>
                    </div>

                    <div className="sentence-actions">
                        <button
                            type="button"
                            className="secondary-button small"
                            onClick={manualUndo}
                            disabled={words.length === 0}
                        >
                            Undo last
                        </button>
                        <button
                            type="button"
                            className="ghost-button small"
                            onClick={manualClear}
                            disabled={words.length === 0}
                        >
                            Clear
                        </button>
                    </div>
                </section>

                <section className="controls-section">
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => trainSign("Custom")}
                    >
                        <span className="button-emoji">✋</span>
                        <span>Train new sign</span>
                    </button>

                    <label className="camera-toggle">
                        <span className="camera-toggle-label">
                            Camera: {cameraEnabled ? "On" : "Off"}
                        </span>
                        <button
                            type="button"
                            className={`toggle-switch ${cameraEnabled ? "on" : "off"}`}
                            onClick={() => setCameraEnabled((v) => !v)}
                        >
                            <span className="toggle-knob" />
                        </button>
                    </label>

                    <button
                        type="button"
                        className="secondary-button small"
                        onClick={toggleCameraFacing}
                        disabled={!cameraEnabled}
                    >
                        {facingMode === "user" ? "Use back camera" : "Use front camera"}
                    </button>

                    {/* 3D avatar toggle */}
                    <button
                        type="button"
                        className="secondary-button small"
                        onClick={() => setShowAvatar((v) => !v)}
                    >
                        {showAvatar ? "Hide 3D avatar" : "Show 3D avatar"}
                    </button>

                    {!isAiLoaded && (
                        <p className="loading-text">Loading AI model...</p>
                    )}
                </section>

                <section className="video-section">
                    <div className="video-frame">
                        {/* ── AI model lazy-load overlay ── */}
                        {!isAiLoaded && (
                            <div className="ai-loading-overlay">
                                <div className="ai-loading-spinner" />
                                <p className="ai-loading-text">Loading AI model…</p>
                                <small className="ai-loading-sub">Usually takes 3–4 seconds</small>
                            </div>
                        )}

                        {cameraEnabled ? (
                            <>
                                <Webcam
                                    ref={webcamRef}
                                    className="video-element"
                                    videoConstraints={{ facingMode }}
                                />
                                <canvas
                                    ref={canvasRef}
                                    className="overlay-canvas"
                                />
                            </>
                        ) : (
                            <div className="camera-off-overlay">
                                <p>Camera is off</p>
                                <small>Turn on to start sign recognition.</small>
                            </div>
                        )}

                        <div className="video-overlay-top">
                            <span className="overlay-chip">
                                {stablePrediction
                                    ? `Detected: ${stablePrediction.toUpperCase()}`
                                    : cameraEnabled
                                        ? "Waiting for hand..."
                                        : "Camera is off"}
                            </span>
                            {prediction && cameraEnabled && (
                                <span className="overlay-chip secondary">
                                    Confidence: {confidence}%
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="video-footer">
                        <span className={`model-badge ${isAiLoaded ? "ready" : "loading"}`}>
                            {isAiLoaded ? "AI model loaded" : "Loading AI model..."}
                        </span>
                        <span className="hint-text">
                            Tip: Hold your hand steady for a few frames for better accuracy. Signs that stay steady
                            long enough will be added to the sentence automatically.
                        </span>
                    </div>
                </section>

                {showAvatar && (
                    <section className="avatar-section avatar-section--expand">
                        <div className="avatar-frame">
                            {/* Wrapper keeps the loading overlay positioned over the Three.js canvas */}
                            <div className="avatar-canvas-wrapper">
                                {!isAvatarLoaded && (
                                    <div className="ai-loading-overlay">
                                        <div className="ai-loading-spinner" />
                                        <p className="ai-loading-text">Loading 3D avatar…</p>
                                        <small className="ai-loading-sub">Setting up the VRM scene</small>
                                    </div>
                                )}
                                <div id="vrm-avatar-container" className="avatar-canvas-container" />
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

export default DeepMotionDemo;