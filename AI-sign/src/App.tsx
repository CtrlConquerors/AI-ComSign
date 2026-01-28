import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { Link } from "react-router-dom";
import "./App.css";

// --- 1. ĐỊNH NGHĨA KIỂU DỮ LIỆU ---
interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface SignSample {
  fileName?: string;
  signName: string;
  landmarks: Landmark[];
}

// --- 3. CÁC HÀM TOÁN HỌC BỔ TRỢ ---
const distance3D = (p1: Landmark, p2: Landmark) => {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
      Math.pow(p1.y - p2.y, 2) +
      Math.pow(p1.z - p2.z, 2)
  );
};

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

const calculateDistance = (
  userLandmarks: Landmark[],
  sampleLandmarks: Landmark[]
): number => {
  const normUser = normalizeLandmarks(userLandmarks);
  const normSample = normalizeLandmarks(sampleLandmarks);

  const weights = [
    1.0,
    0.8,
    0.8,
    0.8,
    1.2,
    1.0,
    0.9,
    0.9,
    1.2,
    1.0,
    0.9,
    0.9,
    1.2,
    1.0,
    0.9,
    0.9,
    1.2,
    1.0,
    0.9,
    0.9,
    1.2,
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

// --- 4. HÀM KIỂM TRA TRẠNG THÁI NGÓN TAY ---
const getFingerLinearity = (
  landmarks: Landmark[],
  mcpIdx: number,
  tipIdx: number
): number => {
  const mcp = landmarks[mcpIdx];
  const pip = landmarks[mcpIdx + 1];
  const dip = landmarks[mcpIdx + 2];
  const tip = landmarks[tipIdx];

  const totalBoneLength =
    distance3D(mcp, pip) + distance3D(pip, dip) + distance3D(dip, tip);
  const straightLine = distance3D(mcp, tip);
  return straightLine / (totalBoneLength || 1);
};

const calculateAngle = (p1: Landmark, p2: Landmark, p3: Landmark): number => {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };

  const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);

  const cosAngle = dotProduct / (mag1 * mag2 || 1);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
};

const getFingerCurlAngle = (
  landmarks: Landmark[],
  mcpIdx: number,
  tipIdx: number
): number => {
  const mcp = landmarks[mcpIdx];
  const pip = landmarks[mcpIdx + 1];
  const dip = landmarks[mcpIdx + 2];

  const angle = calculateAngle(mcp, pip, dip);
  return (angle * 180) / Math.PI;
};

const isThumbFolded = (landmarks: Landmark[]): boolean => {
  const tip = landmarks[4];
  const ip = landmarks[3];
  const mcp = landmarks[2];
  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const pinkyBase = landmarks[17];

  const distToPinky = distance3D(tip, pinkyBase);
  const distToIndex = distance3D(tip, indexMcp);

  const thumbAngle = calculateAngle(mcp, ip, tip);
  const thumbAngleDeg = (thumbAngle * 180) / Math.PI;

  const zDiff = Math.abs(tip.z - wrist.z);

  return (
    distToPinky < 0.15 ||
    distToIndex < 0.08 ||
    thumbAngleDeg < 140 ||
    zDiff < 0.015
  );
};

const DeepMotionDemo: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAiLoaded, setIsAiLoaded] = useState(false);
  const [handLandmarker, setHandLandmarker] =
    useState<HandLandmarker | null>(null);

  const [samples, setSamples] = useState<SignSample[]>([]);
  const [prediction, setPrediction] = useState<string>("");
  const [currentLandmarks, setCurrentLandmarks] =
    useState<Landmark[] | null>(null);
  const [debugDist, setDebugDist] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);

  const predictionHistoryRef = useRef<string[]>([]);
  const [stablePrediction, setStablePrediction] = useState<string>("");

  // NEW: camera on/off state
  const [cameraEnabled, setCameraEnabled] = useState<boolean>(false);

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
        const response = await fetch("http://localhost:5197/api/sign");
        if (response.ok) {
          const data: SignSample[] = await response.json();
          setSamples(data);
        } else {
          console.error("Failed to fetch signs from DB");
        }
      } catch (error) {
        console.error("Error fetching signs:", error);
      }
    };
    fetchSignData();
  }, []);

  const drawHandSkeleton = (
    canvasCtx: CanvasRenderingContext2D,
    landmarks: Landmark[][]
  ) => {
    const connections = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [5, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [9, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      [13, 17],
      [17, 18],
      [18, 19],
      [19, 20],
      [0, 17],
    ];

    if (!canvasRef.current) return;
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

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

  const trainSign = (signName: string) => {
    if (currentLandmarks) {
      const newSample: SignSample = {
        signName,
        landmarks: currentLandmarks,
      };
      setSamples((prev) => [...prev, newSample]);
      alert(`Đã học xong dáng: ${signName}`);
    } else {
      alert("Không tìm thấy tay!");
    }
  };

  const detectHands = () => {
    // Respect camera toggle
    if (!cameraEnabled) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
        }
      }
      setPrediction("");
      setStablePrediction("");
      setConfidence(0);
      requestAnimationFrame(detectHands);
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
      const nowInMs = Date.now();
      const results: HandLandmarkerResult =
        handLandmarker.detectForVideo(video, nowInMs);

      const canvasCtx = canvasRef.current.getContext("2d");
      canvasRef.current.width = video.videoWidth;
      canvasRef.current.height = video.videoHeight;

      if (canvasCtx && results.landmarks && results.landmarks.length > 0) {
        drawHandSkeleton(canvasCtx, results.landmarks as Landmark[][]);

        const detectedHand = results.landmarks[0] as Landmark[];
        setCurrentLandmarks(detectedHand);

        if (samples.length > 0) {
          let bestMatch = "";
          let minDistance = Infinity;

          samples.forEach((sample) => {
            const dist = calculateDistance(detectedHand, sample.landmarks);
            const name = sample.signName.toLowerCase();
            let isRulePassed = true;

            const indexLin = getFingerLinearity(detectedHand, 5, 8);
            const middleLin = getFingerLinearity(detectedHand, 9, 12);
            const ringLin = getFingerLinearity(detectedHand, 13, 16);
            const pinkyLin = getFingerLinearity(detectedHand, 17, 20);

            const isAllFingersStraight =
              indexLin > 0.95 &&
              middleLin > 0.95 &&
              ringLin > 0.95 &&
              pinkyLin > 0.95;

            if (isAllFingersStraight && !isThumbFolded(detectedHand)) {
              isRulePassed = false;
            }

            if (name === "a") {
              if (indexLin > 0.9 || middleLin > 0.9) isRulePassed = false;
            }

            if (name === "b") {
              if (indexLin < 0.9) isRulePassed = false;
              if (!isThumbFolded(detectedHand)) isRulePassed = false;
            }

            if (name === "c") {
              if (indexLin > 0.96) isRulePassed = false;
              if (indexLin < 0.7) isRulePassed = false;
            }

            if (name === "d") {
              if (indexLin < 0.9) isRulePassed = false;
              if (middleLin > 0.95 || ringLin > 0.95) isRulePassed = false;
            }

            if (isRulePassed && dist < minDistance) {
              minDistance = dist;
              bestMatch = sample.signName;
            }
          });

          setDebugDist(Number(minDistance.toFixed(2)));
          const THRESHOLD = 4.5;

          if (minDistance < THRESHOLD) {
            predictionHistoryRef.current.push(bestMatch);
            if (predictionHistoryRef.current.length > 5) {
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

            if (maxCount >= 3) {
              setPrediction(stableMatch);
              setStablePrediction(stableMatch);
              const confidenceScore = Math.round(
                (1 - minDistance / THRESHOLD) * (maxCount / 5) * 100
              );
              setConfidence(
                Math.min(100, Math.max(0, confidenceScore))
              );
            } else {
              setPrediction("");
              setConfidence(0);
            }
          } else {
            setPrediction("");
            setConfidence(0);
            predictionHistoryRef.current = [];
          }
        }
      } else if (canvasCtx) {
        canvasCtx.clearRect(
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );
        setPrediction("");
      }
    }
    requestAnimationFrame(detectHands);
  };

  useEffect(() => {
    if (isAiLoaded) {
      detectHands();
    }
  }, [isAiLoaded, samples, cameraEnabled]); // react when cameraEnabled changes

  return (
    <div className="app-root">
      <div className="app-shell">
        <header className="app-header">
          <h1 className="app-title">
            AI-ComSign <span className="mode-tag">(Strict Mode)</span>
          </h1>
          <p className="app-subtitle">
            Real‑time hand sign classifier using MediaPipe. Show a sign to see
            the prediction.
          </p>
        </header>

        <section className="status-section" aria-live="polite">
          {prediction ? (
            <div className="status-card">
              <div className="status-letter">{prediction}</div>
              <div className="status-metrics">
                <span className="metric metric-accuracy">
                  Độ chính xác: <strong>{confidence}%</strong>
                </span>
                <span className="metric metric-distance">
                  Độ lệch: <strong>{debugDist}</strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="status-empty">
              <p>Hãy thực hiện hành động với tay trong khung hình.</p>
              <small>
                Độ lệch hiện tại: {debugDist} (Yêu cầu &lt; 4.5)
              </small>
            </div>
          )}
        </section>

        <section className="controls-section">
          <button
            type="button"
            className="primary-button"
            onClick={() => trainSign("Tùy chỉnh")}
          >
            <span className="button-emoji">✋</span>
            <span>Dạy thêm dáng mới</span>
          </button>

          {/* NEW camera toggle switch */}
          <label className="camera-toggle">
            <span className="camera-toggle-label">
              Camera: {cameraEnabled ? "On" : "Off"}
            </span>
            <button
              type="button"
              className={`toggle-switch ${
                cameraEnabled ? "on" : "off"
              }`}
              onClick={() => setCameraEnabled((v) => !v)}
            >
              <span className="toggle-knob" />
            </button>
          </label>

          {!isAiLoaded && (
            <p className="loading-text">Đang tải mô hình AI...</p>
          )}
        </section>

        <section className="video-section">
          <div className="video-frame">
            {cameraEnabled ? (
              <>
                <Webcam
                  ref={webcamRef}
                  mirrored
                  className="video-element"
                />
                <canvas
                  ref={canvasRef}
                  className="overlay-canvas"
                />
              </>
            ) : (
              <div className="camera-off-overlay">
                <p>Camera đã tắt</p>
                <small>Bật lại để tiếp tục nhận diện ký hiệu.</small>
              </div>
            )}

            <div className="video-overlay-top">
              <span className="overlay-chip">
                {stablePrediction
                  ? `Phát hiện: ${stablePrediction.toUpperCase()}`
                  : cameraEnabled
                  ? "Đang chờ nhận diện tay..."
                  : "Camera đang tắt"}
              </span>
              {prediction && cameraEnabled && (
                <span className="overlay-chip secondary">
                  Confidence: {confidence}%
                </span>
              )}
            </div>
          </div>

          <div className="video-footer">
            <span
              className={`model-badge ${isAiLoaded ? "ready" : "loading"}`}
            >
              {isAiLoaded ? "AI model loaded" : "Loading AI model..."}
            </span>
            <span className="hint-text">
              Mẹo: Giữ tay ổn định trong vài khung hình để có kết quả chính xác
              hơn.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DeepMotionDemo;