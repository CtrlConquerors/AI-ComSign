import React, { useEffect, useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import "./App.css";

// Import shared types and utilities
import type { Landmark, SignSample, MatchResult } from "./utils";
import { findBestMatch, validateSign } from "./utils";

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

  // Calculate direct distance
  let distDirect = 0;
  for (let i = 0; i < normUser.length; i++) {
    const dx = normUser[i].x - normSample[i].x;
    const dy = normUser[i].y - normSample[i].y;
    const dz = normUser[i].z - normSample[i].z;
    const weight = weights[i] || 1.0;
    distDirect += weight * Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Calculate mirrored distance (flip X)
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
  const [isAiLoaded, setIsAiLoaded] = useState(false);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);

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

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    const loadHandLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      const landmarker = await HandLandmarker.createFromOptions(vision, {
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
      setHandLandmarker(landmarker);
      setIsAiLoaded(true);
    };
    loadHandLandmarker();

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
    fetchSignData();
  }, []);

  // ============================================================================
  // DRAWING
  // ============================================================================

  const drawHandSkeleton = (
    canvasCtx: CanvasRenderingContext2D,
    landmarks: Landmark[][]
  ) => {
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],     // thumb
      [0, 5], [5, 6], [6, 7], [7, 8],     // index
      [5, 9], [9, 10], [10, 11], [11, 12], // middle
      [9, 13], [13, 14], [14, 15], [15, 16], // ring
      [13, 17], [17, 18], [18, 19], [19, 20], // pinky
      [0, 17],  // palm base
    ];

    if (!canvasRef.current) return;
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    landmarks.forEach((hand) => {
      // Draw points
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

      // Draw connections
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

  // ============================================================================
  // TRAINING (local only)
  // ============================================================================

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

  // ============================================================================
  // DETECTION LOOP (with KNN matching)
  // ============================================================================

  const detectHands = useCallback(() => {
    // Skip if camera off
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
      const results: HandLandmarkerResult = handLandmarker.detectForVideo(video, nowInMs);

      const canvasCtx = canvasRef.current.getContext("2d");
      canvasRef.current.width = video.videoWidth;
      canvasRef.current.height = video.videoHeight;

      if (canvasCtx && results.landmarks && results.landmarks.length > 0) {
        drawHandSkeleton(canvasCtx, results.landmarks as Landmark[][]);

        const detectedHand = results.landmarks[0] as Landmark[];
        setCurrentLandmarks(detectedHand);

        if (samples.length > 0) {
          // Use KNN matcher with sign validation rules
          const matchResult: MatchResult | null = findBestMatch(
            detectedHand,
            samples,
            calculateDistance,
            validateSign,
            3,    // K = 3 nearest neighbors
            4.5   // threshold
          );

          if (matchResult) {
            setDebugDist(Number(matchResult.avgDistance.toFixed(2)));

            // Add to prediction history for stability
            predictionHistoryRef.current.push(matchResult.signName);
            if (predictionHistoryRef.current.length > 5) {
              predictionHistoryRef.current.shift();
            }

            // Count predictions in history
            const counts: Record<string, number> = {};
            predictionHistoryRef.current.forEach((p) => {
              counts[p] = (counts[p] || 0) + 1;
            });

            // Find most common prediction
            let maxCount = 0;
            let stableMatch = "";
            Object.entries(counts).forEach(([sign, count]) => {
              if (count > maxCount) {
                maxCount = count;
                stableMatch = sign;
              }
            });

            // Require at least 3/5 agreement for stable prediction
            if (maxCount >= 3) {
              setPrediction(stableMatch);
              setStablePrediction(stableMatch);
              // Blend KNN confidence with stability
              const stabilityBonus = (maxCount / 5) * 20;
              setConfidence(Math.min(100, matchResult.confidence + stabilityBonus));
            } else {
              setPrediction("");
              setConfidence(0);
            }
          } else {
            // No match found
            setDebugDist(Infinity);
            setPrediction("");
            setConfidence(0);
            predictionHistoryRef.current = [];
          }
        }
      } else if (canvasCtx) {
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setPrediction("");
      }
    }
  }, [cameraEnabled, handLandmarker, samples, drawHandSkeleton]);

  // Animation loop
  useEffect(() => {
    if (!isAiLoaded) return;

    let animationId: number;
    const loop = () => {
      detectHands();
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationId);
  }, [isAiLoaded, detectHands]);

  // ============================================================================
  // RENDER
  // ============================================================================

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
          {prediction ? (
            <div className="status-card">
              <div className="status-letter">{prediction}</div>
              <div className="status-metrics">
                <span className="metric metric-accuracy">
                  Confidence: <strong>{confidence}%</strong>
                </span>
                <span className="metric metric-distance">
                  Distance: <strong>{debugDist}</strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="status-empty">
              <p>Show a hand sign in the frame.</p>
              <small>
                Current distance: {debugDist === Infinity ? "N/A" : debugDist} (threshold: 4.5)
              </small>
            </div>
          )}
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

          {/* Camera toggle switch */}
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

          {!isAiLoaded && (
            <p className="loading-text">Loading AI model...</p>
          )}
        </section>

        <section className="video-section">
          <div className="video-frame">
            {cameraEnabled ? (
              <>
                <Webcam
                  ref={webcamRef}
                  className="video-element"
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
              Tip: Hold your hand steady for a few frames for better accuracy.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DeepMotionDemo;
