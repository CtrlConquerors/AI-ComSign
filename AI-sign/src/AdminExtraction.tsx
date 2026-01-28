import React, { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { Link } from "react-router-dom";

// --- 1. ĐỊNH NGHĨA KIỂU DỮ LIỆU (Giống hệt App.tsx) ---
interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface SignSample {
  fileName: string;
  signName: string;
  landmarks: Landmark[];
}

const AdminExtraction: React.FC = () => {
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<SignSample[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // Ref cho video ẩn
  const videoRef = useRef<HTMLVideoElement>(null);

  // 1. Khởi tạo AI (Chỉ làm 1 lần)
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
        numHands: 1, // Chỉ lấy 1 tay chuẩn nhất
      });
      setHandLandmarker(landmarker);
      addLog("✅ AI Model đã tải xong. Sẵn sàng xử lý video.");
    };
    loadHandLandmarker();
  }, []);

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  // 2. Hàm xử lý tên file thông minh
  // Ví dụ: "a_-_8851.mp4" -> signName: "a"
  // Ví dụ: "XinChao.mp4" -> signName: "xinchao"
  const cleanSignName = (fileName: string): string => {
    const nameWithoutExt = fileName.split('.')[0].toLowerCase();
    // Lấy phần đầu tiên trước dấu gạch dưới "_" hoặc gạch ngang "-"
    // Giúp loại bỏ các mã số rác phía sau
    const simpleName = nameWithoutExt.split(/[-_]/)[0];
    return simpleName;
  };

  // 3. Hàm xử lý từng file Video
  const processSingleVideo = async (file: File): Promise<SignSample | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current) return resolve(null);

      const url = URL.createObjectURL(file);
      const video = videoRef.current;
      
      video.src = url;
      video.onloadeddata = () => {
        // Mẹo: Lấy khung hình ở chính giữa video (50% thời lượng)
        // Vì clip 5-10s thường giữ dáng chuẩn nhất ở giữa.
        video.currentTime = video.duration / 2;
      };

      video.onseeked = async () => {
        if (!handLandmarker) return resolve(null);
        
        // Chạy AI nhận diện tại thời điểm này
        const result: HandLandmarkerResult = handLandmarker.detectForVideo(video, Date.now());
        
        let data: SignSample | null = null;
        
        if (result.landmarks && result.landmarks.length > 0) {
          // Ép kiểu dữ liệu về Landmark chuẩn của App.tsx
          const rawLandmarks = result.landmarks[0] as unknown as Landmark[];
          
          // Chỉ lấy x, y, z (bỏ visibility nếu không cần thiết để giảm dung lượng file JSON)
          const cleanLandmarks = rawLandmarks.map(p => ({
            x: Number(p.x.toFixed(6)), // Làm tròn số cho gọn file
            y: Number(p.y.toFixed(6)),
            z: Number(p.z.toFixed(6))
          }));

          data = {
            fileName: file.name,
            signName: cleanSignName(file.name), // Tự động làm sạch tên
            landmarks: cleanLandmarks
          };
          addLog(`✅ Đã trích xuất: ${cleanSignName(file.name)} (từ file ${file.name})`);
        } else {
          addLog(`⚠️ Không thấy tay trong file: ${file.name}`);
        }

        URL.revokeObjectURL(url); // Dọn dẹp bộ nhớ
        resolve(data);
      };
      
      video.onerror = () => {
        addLog(`❌ Lỗi đọc file: ${file.name}`);
        resolve(null);
      }
    });
  };

  // 4. Hàm chạy Batch (Xử lý hàng loạt)
  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!handLandmarker) return alert("AI chưa tải xong, vui lòng đợi!");
    if (!event.target.files) return;
    
    const files = Array.from(event.target.files);
    setIsProcessing(true);
    setExtractedData([]);
    setLogs([]);
    addLog(`📂 Bắt đầu xử lý ${files.length} videos...`);

    const results: SignSample[] = [];
    
    // Duyệt qua từng file (Tuần tự để không treo máy)
    for (const file of files) {
      addLog(`⏳ Đang xử lý: ${file.name}...`);
      const result = await processSingleVideo(file);
      if (result) results.push(result);
      // Nghỉ 100ms để UI cập nhật (tránh đơ màn hình)
      await new Promise(r => setTimeout(r, 100));
    }

    setExtractedData(results);
    setIsProcessing(false);
    addLog(`🎉 Hoàn tất! Đã trích xuất thành công ${results.length}/${files.length} videos.`);
  };

  // 5. Xuất file JSON
  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(extractedData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "sign_language_data.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // 6. Save to DB
  const saveToDb = async () => {
    if (extractedData.length === 0) return;
    
    setIsProcessing(true);
    let successCount = 0;
    
    for (const sample of extractedData) {
        try {
            const response = await fetch('http://localhost:5197/api/sign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sample),
            });
            
            if (response.ok) {
                successCount++;
                addLog(`✅ Saved to DB: ${sample.signName}`);
            } else {
                const errText = await response.text();
                addLog(`❌ Failed to save ${sample.signName}: ${response.status} - ${errText}`);
            }
        } catch (error) {
            addLog(`❌ Error saving ${sample.signName}: ${error}`);
        }
    }
    
    setIsProcessing(false);
    addLog(`🎉 Finished saving to DB. Success: ${successCount}/${extractedData.length}`);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial", maxWidth: "800px", margin: "0 auto" }}>
      <Link to="/" style={{ textDecoration: "none", color: "#007bff", fontWeight: "bold" }}>⬅ Back to Home</Link>
      <h1>🛠️ Admin Data Extractor (TypeScript)</h1>
      <p>Chọn folder chứa video (định dạng .mp4, .mov). Tool sẽ tự động lấy mẫu xương và đặt tên Label.</p>
      
      <input 
        type="file" 
        multiple 
        accept="video/*" 
        onChange={handleFiles} 
        disabled={isProcessing || !handLandmarker}
        style={{ padding: "10px", border: "2px dashed #ccc", width: "100%", cursor: "pointer" }}
      />

      {/* Video ẩn để xử lý ngầm */}
      <video ref={videoRef} style={{ display: "none" }} muted />

      <div style={{ marginTop: "20px", background: "#f4f4f4", padding: "10px", height: "200px", overflowY: "scroll", border: "1px solid #ddd" }}>
        {logs.map((log, index) => <div key={index}>{log}</div>)}
      </div>

      {extractedData.length > 0 && !isProcessing && (
        <div style={{ marginTop: "20px", textAlign: "center", display: "flex", gap: "10px", justifyContent: "center" }}>
          <h3 style={{color: "green", width: "100%"}}>Thành công: {extractedData.length} mẫu dữ liệu</h3>
        </div>
      )}
      
      {extractedData.length > 0 && !isProcessing && (
         <div style={{ textAlign: "center", marginTop: "10px" }}>
          <p>Data is ready. Click "Save to DB" to update the system.</p>
          <button 
            onClick={downloadJSON}
            style={{ padding: "15px 30px", fontSize: "16px", background: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", marginRight: "10px" }}
          >
            💾 Tải File JSON
          </button>
          <button 
            onClick={saveToDb}
            style={{ padding: "15px 30px", fontSize: "16px", background: "#28a745", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
          >
            ☁️ Lưu vào DB
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminExtraction;