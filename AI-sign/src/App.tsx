import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";

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

// --- 2. DỮ LIỆU MẪU (A, B, C, D) ---
const PRE_TRAINED_DATA: SignSample[] = [
  {
    "signName": "a",
    "landmarks": [
      { "x": 0.373897, "y": 0.489435, "z": -1.03e-7 }, { "x": 0.396066, "y": 0.477324, "z": -0.00487 },
      { "x": 0.409668, "y": 0.444840, "z": -0.00644 }, { "x": 0.418581, "y": 0.411878, "z": -0.00889 },
      { "x": 0.428908, "y": 0.393802, "z": -0.01027 }, { "x": 0.406105, "y": 0.422958, "z": 0.00238 },
      { "x": 0.408848, "y": 0.397502, "z": -0.00777 }, { "x": 0.402909, "y": 0.420322, "z": -0.01430 },
      { "x": 0.397101, "y": 0.439514, "z": -0.01676 }, { "x": 0.394295, "y": 0.421061, "z": 0.00163 },
      { "x": 0.396876, "y": 0.397301, "z": -0.00971 }, { "x": 0.392576, "y": 0.427717, "z": -0.01400 },
      { "x": 0.388647, "y": 0.448180, "z": -0.01444 }, { "x": 0.383114, "y": 0.421530, "z": -0.00092 },
      { "x": 0.386009, "y": 0.403764, "z": -0.01247 }, { "x": 0.383949, "y": 0.432913, "z": -0.01232 },
      { "x": 0.381335, "y": 0.451454, "z": -0.00899 }, { "x": 0.371624, "y": 0.423234, "z": -0.00394 },
      { "x": 0.375402, "y": 0.410949, "z": -0.01179 }, { "x": 0.375791, "y": 0.430904, "z": -0.01165 },
      { "x": 0.375371, "y": 0.445445, "z": -0.00944 }
    ]
  },
  {
    "signName": "b",
    "landmarks": [
      { "x": 0.387869, "y": 0.540448, "z": 8.07e-8 }, { "x": 0.402559, "y": 0.520787, "z": -0.00886 },
      { "x": 0.409980, "y": 0.492708, "z": -0.01302 }, { "x": 0.395766, "y": 0.472613, "z": -0.01671 },
      { "x": 0.382245, "y": 0.471016, "z": -0.02037 }, { "x": 0.405688, "y": 0.442494, "z": -0.00603 },
      { "x": 0.406307, "y": 0.401640, "z": -0.01150 }, { "x": 0.406205, "y": 0.377497, "z": -0.01648 },
      { "x": 0.406012, "y": 0.355883, "z": -0.02028 }, { "x": 0.394151, "y": 0.437752, "z": -0.00669 },
      { "x": 0.395600, "y": 0.393651, "z": -0.01067 }, { "x": 0.396563, "y": 0.366663, "z": -0.01495 },
      { "x": 0.397557, "y": 0.344673, "z": -0.01850 }, { "x": 0.384058, "y": 0.441244, "z": -0.00863 },
      { "x": 0.384941, "y": 0.402350, "z": -0.01202 }, { "x": 0.386573, "y": 0.377910, "z": -0.01552 },
      { "x": 0.388165, "y": 0.357432, "z": -0.01827 }, { "x": 0.373634, "y": 0.452067, "z": -0.01175 },
      { "x": 0.374089, "y": 0.421625, "z": -0.01405 }, { "x": 0.375491, "y": 0.402218, "z": -0.01504 },
      { "x": 0.376911, "y": 0.384722, "z": -0.01615 }
    ]
  },
  {
    "signName": "c",
    "landmarks": [
      { "x": 0.381125, "y": 0.528297, "z": 5.30e-8 }, { "x": 0.399768, "y": 0.517270, "z": -0.00415 },
      { "x": 0.417553, "y": 0.497731, "z": -0.00548 }, { "x": 0.431175, "y": 0.486549, "z": -0.00754 },
      { "x": 0.437214, "y": 0.467627, "z": -0.00934 }, { "x": 0.407824, "y": 0.435492, "z": 0.00166 },
      { "x": 0.413865, "y": 0.399594, "z": -0.00395 }, { "x": 0.420623, "y": 0.393325, "z": -0.00914 },
      { "x": 0.427399, "y": 0.397338, "z": -0.01217 }, { "x": 0.399214, "y": 0.431649, "z": -0.00041 },
      { "x": 0.404037, "y": 0.393562, "z": -0.00561 }, { "x": 0.412117, "y": 0.387847, "z": -0.01033 },
      { "x": 0.420558, "y": 0.395884, "z": -0.01340 }, { "x": 0.390607, "y": 0.433901, "z": -0.00396 },
      { "x": 0.394597, "y": 0.396522, "z": -0.00950 }, { "x": 0.402559, "y": 0.386975, "z": -0.01318 },
      { "x": 0.410793, "y": 0.392843, "z": -0.01510 }, { "x": 0.381442, "y": 0.441068, "z": -0.00828 },
      { "x": 0.385395, "y": 0.410247, "z": -0.01311 }, { "x": 0.392342, "y": 0.394586, "z": -0.01582 },
      { "x": 0.400032, "y": 0.391087, "z": -0.01732 }
    ]
  },
  {
    "signName": "d",
    "landmarks": [
      { "x": 0.379978, "y": 0.561081, "z": 4.20e-8 }, { "x": 0.400202, "y": 0.536153, "z": 0.00090 },
      { "x": 0.410219, "y": 0.511661, "z": -0.00330 }, { "x": 0.419273, "y": 0.498829, "z": -0.00993 },
      { "x": 0.422152, "y": 0.488681, "z": -0.01643 }, { "x": 0.389403, "y": 0.460312, "z": -0.00476 },
      { "x": 0.391128, "y": 0.416847, "z": -0.01328 }, { "x": 0.392080, "y": 0.392980, "z": -0.01971 },
      { "x": 0.390091, "y": 0.372787, "z": -0.02424 }, { "x": 0.381285, "y": 0.465909, "z": -0.01136 },
      { "x": 0.399273, "y": 0.445730, "z": -0.02380 }, { "x": 0.414172, "y": 0.465487, "z": -0.02963 },
      { "x": 0.420239, "y": 0.485303, "z": -0.03188 }, { "x": 0.377245, "y": 0.478877, "z": -0.01803 },
      { "x": 0.395843, "y": 0.457274, "z": -0.02860 }, { "x": 0.411426, "y": 0.473365, "z": -0.03023 },
      { "x": 0.418961, "y": 0.490497, "z": -0.02936 }, { "x": 0.377282, "y": 0.495652, "z": -0.02480 },
      { "x": 0.392353, "y": 0.478459, "z": -0.03172 }, { "x": 0.405910, "y": 0.482689, "z": -0.03237 },
      { "x": 0.414997, "y": 0.490366, "z": -0.03172 }
    ]
  }
];

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

  const [samples, setSamples] = useState<SignSample[]>(PRE_TRAINED_DATA); 
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