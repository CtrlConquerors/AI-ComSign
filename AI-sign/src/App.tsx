import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { Link } from "react-router-dom";

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
// Tính khoảng cách giữa 2 điểm 3D
const distance3D = (p1: Landmark, p2: Landmark) => {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) + 
    Math.pow(p1.y - p2.y, 2) + 
    Math.pow(p1.z - p2.z, 2)
  );
};

// Hàm chuẩn hóa cải tiến - Bao gồm cả trục Z
const normalizeLandmarks = (landmarks: Landmark[]): Landmark[] => {
  if (!landmarks || landmarks.length === 0) return [];
  const wrist = landmarks[0];

  // Center around wrist
  const centered = landmarks.map(p => ({
    x: p.x - wrist.x,
    y: p.y - wrist.y,
    z: p.z - wrist.z
  }));

  // Calculate max distance in 3D space for better normalization
  const maxDist = Math.max(...centered.map(p => Math.sqrt(p.x**2 + p.y**2 + p.z**2)));

  // Normalize by max distance
  return centered.map(p => ({
    x: p.x / (maxDist || 1), 
    y: p.y / (maxDist || 1),
    z: p.z / (maxDist || 1)
  }));
};

const calculateDistance = (userLandmarks: Landmark[], sampleLandmarks: Landmark[]): number => {
  const normUser = normalizeLandmarks(userLandmarks);
  const normSample = normalizeLandmarks(sampleLandmarks);

  // Trọng số cho từng landmark - fingertips và MCP joints quan trọng hơn
  const weights = [
    1.0,  // 0: Wrist
    0.8, 0.8, 0.8, 1.2,  // 1-4: Thumb (tip gets more weight)
    1.0, 0.9, 0.9, 1.2,  // 5-8: Index finger
    1.0, 0.9, 0.9, 1.2,  // 9-12: Middle finger
    1.0, 0.9, 0.9, 1.2,  // 13-16: Ring finger
    1.0, 0.9, 0.9, 1.2   // 17-20: Pinky finger
  ];

  // Tính khoảng cách trực tiếp với trọng số
  let distDirect = 0;
  for (let i = 0; i < normUser.length; i++) {
    const dx = normUser[i].x - normSample[i].x;
    const dy = normUser[i].y - normSample[i].y;
    const dz = normUser[i].z - normSample[i].z;
    const weight = weights[i] || 1.0;
    distDirect += weight * Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // So sánh Mirror (lật ngược) để dùng được cả 2 tay
  let distMirrored = 0;
  for (let i = 0; i < normUser.length; i++) {
    const dx = (-normUser[i].x) - normSample[i].x;
    const dy = normUser[i].y - normSample[i].y;
    const dz = normUser[i].z - normSample[i].z;
    const weight = weights[i] || 1.0;
    distMirrored += weight * Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  return Math.min(distDirect, distMirrored);
};

// --- 4. HÀM KIỂM TRA TRẠNG THÁI NGÓN TAY (QUAN TRỌNG) ---
// Tính độ thẳng của ngón tay (Linearity): 1.0 = Thẳng tắp, < 0.9 = Cong
const getFingerLinearity = (landmarks: Landmark[], mcpIdx: number, tipIdx: number): number => {
  const mcp = landmarks[mcpIdx];      // Khớp gốc
  const pip = landmarks[mcpIdx + 1];  // Khớp giữa 1
  const dip = landmarks[mcpIdx + 2];  // Khớp giữa 2
  const tip = landmarks[tipIdx];      // Đỉnh ngón

  const totalBoneLength = distance3D(mcp, pip) + distance3D(pip, dip) + distance3D(dip, tip);
  const straightLine = distance3D(mcp, tip);
  return straightLine / (totalBoneLength || 1);
};

// Tính góc giữa 3 điểm (trả về radian)
const calculateAngle = (p1: Landmark, p2: Landmark, p3: Landmark): number => {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };

  const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x**2 + v1.y**2 + v1.z**2);
  const mag2 = Math.sqrt(v2.x**2 + v2.y**2 + v2.z**2);

  const cosAngle = dotProduct / (mag1 * mag2 || 1);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
};

// Tính góc gập của ngón tay tại PIP joint
const getFingerCurlAngle = (landmarks: Landmark[], mcpIdx: number, tipIdx: number): number => {
  const mcp = landmarks[mcpIdx];
  const pip = landmarks[mcpIdx + 1];
  const dip = landmarks[mcpIdx + 2];

  const angle = calculateAngle(mcp, pip, dip);
  return angle * (180 / Math.PI); // Chuyển sang độ
};

// Kiểm tra xem ngón cái có gập vào không - Cải tiến
const isThumbFolded = (landmarks: Landmark[]): boolean => {
  const tip = landmarks[4];
  const ip = landmarks[3];   // Khớp giữa ngón cái
  const mcp = landmarks[2];  // Gốc ngón cái
  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const pinkyBase = landmarks[17];

  // Phương pháp 1: Khoảng cách từ tip đến lòng bàn tay
  const distToPinky = distance3D(tip, pinkyBase);
  const distToIndex = distance3D(tip, indexMcp);

  // Phương pháp 2: Góc gập của ngón cái
  const thumbAngle = calculateAngle(mcp, ip, tip);
  const thumbAngleDeg = thumbAngle * (180 / Math.PI);

  // Phương pháp 3: So sánh độ sâu Z của tip vs wrist
  const zDiff = Math.abs(tip.z - wrist.z);

  // Ngón cái gập nếu: gần lòng bàn tay HOẶC góc gập nhỏ HOẶC độ sâu Z nhỏ
  return (distToPinky < 0.15 || distToIndex < 0.08 || thumbAngleDeg < 140 || zDiff < 0.015);
};

const DeepMotionDemo: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAiLoaded, setIsAiLoaded] = useState<boolean>(false);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);

  const [samples, setSamples] = useState<SignSample[]>([]); 
  const [prediction, setPrediction] = useState<string>(""); 
  const [currentLandmarks, setCurrentLandmarks] = useState<Landmark[] | null>(null); 
  const [debugDist, setDebugDist] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);

  // Temporal smoothing - Lưu lại các prediction gần đây
  const predictionHistoryRef = useRef<string[]>([]);
  const [stablePrediction, setStablePrediction] = useState<string>("");

  useEffect(() => {
    const loadHandLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
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

    // Fetch data from DB
    const fetchSignData = async () => {
        try {
            const response = await fetch('http://localhost:5197/api/sign');
            if (response.ok) {
                const data: SignSample[] = await response.json();
                console.log("Fetched signs from DB:", data);
                // Use fetched data directly
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

  const drawHandSkeleton = (canvasCtx: CanvasRenderingContext2D, landmarks: Landmark[][]) => {
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], 
      [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], 
      [13, 17], [17, 18], [18, 19], [19, 20], [0, 17] 
    ];

    if (!canvasRef.current) return;
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    landmarks.forEach((hand) => {
      hand.forEach((point) => {
        canvasCtx.beginPath();
        canvasCtx.arc(point.x * canvasRef.current!.width, point.y * canvasRef.current!.height, 5, 0, 2 * Math.PI);
        canvasCtx.fillStyle = "#00FF00";
        canvasCtx.fill();
      });

      canvasCtx.strokeStyle = "#FFFFFF";
      canvasCtx.lineWidth = 2;
      connections.forEach(([start, end]) => {
        const p1 = hand[start];
        const p2 = hand[end];
        canvasCtx.beginPath();
        canvasCtx.moveTo(p1.x * canvasRef.current!.width, p1.y * canvasRef.current!.height);
        canvasCtx.lineTo(p2.x * canvasRef.current!.width, p2.y * canvasRef.current!.height);
        canvasCtx.stroke();
      });
    });
  };

  const trainSign = (signName: string) => {
    if (currentLandmarks) {
      const newSample: SignSample = {
        signName: signName,
        landmarks: currentLandmarks 
      };
      setSamples((prev) => [...prev, newSample]);
      alert(`Đã học xong dáng: ${signName}`);
    } else {
      alert("Không tìm thấy tay!");
    }
  };

  const detectHands = () => {
    if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4 && handLandmarker && canvasRef.current) {
      const video = webcamRef.current.video;
      const nowInMs = Date.now();
      const results: HandLandmarkerResult = handLandmarker.detectForVideo(video, nowInMs);

      const canvasCtx = canvasRef.current.getContext("2d");
      canvasRef.current.width = video.videoWidth;
      canvasRef.current.height = video.videoHeight;

      if (canvasCtx && results.landmarks && results.landmarks.length > 0) {
        drawHandSkeleton(canvasCtx, results.landmarks);
        
        const detectedHand = results.landmarks[0];
        setCurrentLandmarks(detectedHand);

        if (samples.length > 0) {
          let bestMatch = "";
          let minDistance = Infinity;

          samples.forEach((sample) => {
            // Tính khoảng cách tọa độ
            const dist = calculateDistance(detectedHand, sample.landmarks);
            const name = sample.signName.toLowerCase();
            let isRulePassed = true;

            // --- LUẬT KIỂM TRA (HARD RULES) ---
            
            // Lấy độ thẳng của các ngón (Index, Middle, Ring, Pinky)
            const indexLin = getFingerLinearity(detectedHand, 5, 8);
            const middleLin = getFingerLinearity(detectedHand, 9, 12);
            const ringLin = getFingerLinearity(detectedHand, 13, 16);
            const pinkyLin = getFingerLinearity(detectedHand, 17, 20);

            // 1. CHẶN "OPEN HAND" (Tay xòe 5 ngón) -> Không được nhận là B, C
            // Nếu cả 4 ngón đều thẳng tưng (> 0.95) và ngón cái duỗi -> KHÔNG PHẢI B, C, A
            const isAllFingersStraight = indexLin > 0.95 && middleLin > 0.95 && ringLin > 0.95 && pinkyLin > 0.95;
            
            if (isAllFingersStraight) {
               // Nếu tay xòe thẳng tưng, chỉ có thể là số 5 (hoặc Nothing), không thể là A, B, C, D
               // Trừ khi ngón cái gập (chữ B), ta kiểm tra sau
               if (!isThumbFolded(detectedHand)) {
                   isRulePassed = false; // Tay xòe -> Loại hết
               }
            }

            // 2. LUẬT CHỮ "A": Tất cả các ngón phải GẬP
            if (name === "a") {
               // Nếu ngón trỏ hoặc giữa thẳng -> Sai
               if (indexLin > 0.9 || middleLin > 0.9) isRulePassed = false; 
            }

            // 3. LUẬT CHỮ "B": 4 Ngón thẳng + Ngón cái GẬP
            if (name === "b") {
               // Nếu ngón trỏ bị cong -> Sai
               if (indexLin < 0.9) isRulePassed = false;
               // QUAN TRỌNG: Ngón cái phải Gập
               if (!isThumbFolded(detectedHand)) isRulePassed = false;
            }

            // 4. LUẬT CHỮ "C": Các ngón phải CONG (Không thẳng tưng, không gập hẳn)
            if (name === "c") {
              // Nếu ngón trỏ thẳng tưng (> 0.96) -> Sai (đây là tay duỗi)
              if (indexLin > 0.96) isRulePassed = false;
              // Nếu ngón trỏ gập hẳn (< 0.7) -> Sai (đây là nắm tay)
              if (indexLin < 0.7) isRulePassed = false;
            }
            
            // 5. LUẬT CHỮ "D": Ngón trỏ THẲNG + Các ngón khác CONG/GẬP
            if (name === "d") {
               // Ngón trỏ phải thẳng
               if (indexLin < 0.9) isRulePassed = false;
               // Ngón giữa, nhẫn, út phải cong hoặc gập (không được thẳng)
               if (middleLin > 0.95 || ringLin > 0.95) isRulePassed = false;
            }

            // ----------------------------------------

            // Chỉ chấp nhận nếu thỏa mãn luật VÀ khoảng cách đủ nhỏ
            if (isRulePassed && dist < minDistance) {
              minDistance = dist;
              bestMatch = sample.signName;
            }
          });

          setDebugDist(Number(minDistance.toFixed(2)));

          // Ngưỡng sai số (Threshold): 4.5 (Giảm từ 5.0 để chặt chẽ hơn)
          const THRESHOLD = 4.5;

          if (minDistance < THRESHOLD) {
            // Temporal smoothing - Chỉ chấp nhận prediction nếu xuất hiện ổn định
            predictionHistoryRef.current.push(bestMatch);
            if (predictionHistoryRef.current.length > 5) {
              predictionHistoryRef.current.shift();
            }

            // Đếm số lần xuất hiện của mỗi prediction
            const counts: Record<string, number> = {};
            predictionHistoryRef.current.forEach(p => {
              counts[p] = (counts[p] || 0) + 1;
            });

            // Lấy prediction xuất hiện nhiều nhất
            let maxCount = 0;
            let stableMatch = "";
            Object.entries(counts).forEach(([sign, count]) => {
              if (count > maxCount) {
                maxCount = count;
                stableMatch = sign;
              }
            });

            // Chỉ hiển thị nếu xuất hiện ít nhất 3/5 lần gần đây
            if (maxCount >= 3) {
              setPrediction(stableMatch);
              setStablePrediction(stableMatch);
              // Tính confidence dựa trên độ ổn định và khoảng cách
              const confidenceScore = Math.round((1 - minDistance / THRESHOLD) * (maxCount / 5) * 100);
              setConfidence(Math.min(100, Math.max(0, confidenceScore)));
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
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setPrediction("");
      }
    }
    requestAnimationFrame(detectHands);
  };

  useEffect(() => {
    if (isAiLoaded) {
      detectHands();
    }
  }, [isAiLoaded, samples]);

  return (
    <div style={{ position: "relative", width: "640px", margin: "0 auto", textAlign: "center" }}>
      <div style={{ position: "fixed", top: "20px", left: "20px", zIndex: 100 }}>
        <Link to="/" style={{ marginRight: "15px", textDecoration: "none", color: "#666" }}>Home</Link>
        <Link to="/admin/extraction" style={{ textDecoration: "none", color: "#007bff", fontWeight: "bold" }}>Admin Data</Link>
      </div>
      <h1>AI-ComSign (Strict Mode)</h1>
      <div style={{ minHeight: "60px", marginBottom: "10px" }}>
        {prediction ? (
          <div>
            <h2 style={{ color: "#007bff", fontSize: "50px", margin: 0, fontWeight: "bold" }}>{prediction}</h2>
            <div style={{ marginTop: "5px" }}>
              <small style={{ color: "#28a745", fontWeight: "bold" }}>
                Độ chính xác: {confidence}%
              </small>
              <small style={{ color: "#888", marginLeft: "15px" }}>
                Độ lệch: {debugDist}
              </small>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ color: "#ccc", margin: 0 }}>Hãy thực hiện hành động...</p>
            <small style={{ color: "#888" }}>Độ lệch: {debugDist} (Yêu cầu &lt; 4.5)</small>
          </div>
        )}
      </div>
      <div style={{ marginBottom: "15px" }}>
        <button 
            onClick={() => trainSign("Tùy chỉnh")} 
            style={{ padding: "10px 20px", background: "#28a745", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>
            ✋ Dạy thêm
        </button>
      </div>
      {!isAiLoaded && <p>Đang tải AI...</p>}
      <div style={{ position: "relative" }}>
        <Webcam
          ref={webcamRef}
          mirrored={true} 
          style={{ position: "absolute", left: 0, right: 0, margin: "auto", zIndex: 9, width: 640, height: 480 }}
        />
        <canvas
          ref={canvasRef}
          style={{ 
            position: "absolute", left: 0, right: 0, margin: "auto", zIndex: 10, width: 640, height: 480,
            transform: "scaleX(-1)" 
          }}
        />
      </div>
    </div>
  );
};



export default DeepMotionDemo;