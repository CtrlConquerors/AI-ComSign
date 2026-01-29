import React, { useEffect, useRef, useState } from "react";
import {
    FilesetResolver,
    HandLandmarker,
    type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { Link } from "react-router-dom";
import "./AdminExtraction.css";

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
    const [handLandmarker, setHandLandmarker] =
        useState<HandLandmarker | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [extractedData, setExtractedData] = useState<SignSample[]>([]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    // Ref cho video ẩn
    const videoRef = useRef<HTMLVideoElement>(null);

    // 1. Khởi tạo AI (Chỉ làm 1 lần)
    useEffect(() => {
        const loadHandLandmarker = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm",
            );
            const landmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
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
        const nameWithoutExt = fileName.split(".")[0].toLowerCase();
        const simpleName = nameWithoutExt.split(/[-_]/)[0];
        return simpleName;
    };

    // 3. Hàm xử lý từng file Video
    const processSingleVideo = async (
        file: File,
    ): Promise<SignSample | null> => {
        return new Promise((resolve) => {
            if (!videoRef.current) return resolve(null);

            const url = URL.createObjectURL(file);
            const video = videoRef.current;

            video.src = url;
            video.onloadeddata = () => {
                // Lấy khung hình ở chính giữa video (50% thời lượng)
                video.currentTime = video.duration / 2;
            };

            video.onseeked = async () => {
                if (!handLandmarker) return resolve(null);

                const result: HandLandmarkerResult =
                    handLandmarker.detectForVideo(video, Date.now());

                let data: SignSample | null = null;

                if (result.landmarks && result.landmarks.length > 0) {
                    const rawLandmarks = result.landmarks[0] as unknown as Landmark[];

                    const cleanLandmarks = rawLandmarks.map((p) => ({
                        x: Number(p.x.toFixed(6)),
                        y: Number(p.y.toFixed(6)),
                        z: Number(p.z.toFixed(6)),
                    }));

                    data = {
                        fileName: file.name,
                        signName: cleanSignName(file.name),
                        landmarks: cleanLandmarks,
                    };
                    addLog(
                        `✅ Đã trích xuất: ${cleanSignName(file.name)} (từ file ${file.name})`,
                    );
                } else {
                    addLog(`⚠️ Không thấy tay trong file: ${file.name}`);
                }

                URL.revokeObjectURL(url);
                resolve(data);
            };

            video.onerror = () => {
                addLog(`❌ Lỗi đọc file: ${file.name}`);
                resolve(null);
            };
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

        for (const file of files) {
            addLog(`⏳ Đang xử lý: ${file.name}...`);
            const result = await processSingleVideo(file);
            if (result) results.push(result);
            await new Promise((r) => setTimeout(r, 100));
        }

        setExtractedData(results);
        setIsProcessing(false);
        addLog(
            `🎉 Hoàn tất! Đã trích xuất thành công ${results.length}/${files.length} videos.`,
        );
    };

    // 5. Xuất file JSON
    const downloadJSON = () => {
        const dataStr =
            "data:text/json;charset=utf-8," +
            encodeURIComponent(JSON.stringify(extractedData, null, 2));
        const downloadAnchorNode = document.createElement("a");
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute(
            "download",
            "sign_language_data.json",
        );
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
                const response = await fetch("http://localhost:5197/api/sign", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(sample),
                });

                if (response.ok) {
                    successCount++;
                    addLog(`✅ Saved to DB: ${sample.signName}`);
                } else {
                    const errText = await response.text();
                    addLog(
                        `❌ Failed to save ${sample.signName}: ${response.status} - ${errText}`,
                    );
                }
            } catch (error) {
                addLog(`❌ Error saving ${sample.signName}: ${error}`);
            }
        }

        setIsProcessing(false);
        addLog(
            `🎉 Finished saving to DB. Success: ${successCount}/${extractedData.length}`,
        );
    };

    return (
        <div className="admin-page">
            <div className="admin-shell">
                <Link to="/" className="admin-back">
                    <span>⬅</span>
                    <span>Back to Home</span>
                </Link>

                <div className="admin-title-row">
                    <span className="admin-icon">🛠️</span>
                    <h1 className="admin-title">Admin Data Extractor</h1>
                </div>
                <p className="admin-subtitle">
                    Chọn folder chứa video (.mp4, .mov). Tool sẽ tự động trích xuất
                    skeleton và gợi ý tên nhãn cho từng file.
                </p>

                <section className="admin-file-section">
                    <label className="admin-label">Video batch input</label>

                    <div className="file-drop-zone">
                        <div className="file-drop-text">
                            {isProcessing
                                ? "Đang xử lý... vui lòng đợi"
                                : handLandmarker
                                    ? "Kéo thả video vào đây hoặc nhấn 'Choose files'"
                                    : "Đang tải AI model..."}
                        </div>

                        {/* only this pill triggers the input */}
                        <label className="file-input-button">
                            <span>Choose files</span>
                            <input
                                type="file"
                                multiple
                                accept="video/*"
                                onChange={handleFiles}
                                disabled={isProcessing || !handLandmarker}
                            />
                        </label>
                    </div>

                    <div className="admin-status-bar">
                        <span className="status-dot" />
                        <span>
                            {handLandmarker
                                ? isProcessing
                                    ? "Processing videos..."
                                    : "AI model ready."
                                : "Loading AI model..."}
                        </span>
                    </div>
                </section>

                {/* Hidden video for extraction */}
                <video ref={videoRef} style={{ display: "none" }} muted />

                <section className="admin-log-panel">
                    <label className="admin-label">Extraction log</label>
                    <textarea
                        className="admin-log-box"
                        readOnly
                        value={logs.join("\n")}
                    />
                </section>

                <section className="admin-actions">
                    {extractedData.length > 0 && !isProcessing && (
                        <>
                            <span className="admin-chip-btn">
                                Thành công: {extractedData.length} mẫu
                            </span>
                            <button
                                type="button"
                                className="admin-chip-btn"
                                onClick={downloadJSON}
                            >
                                💾 Tải file JSON
                            </button>
                            <button
                                type="button"
                                className="admin-chip-btn"
                                onClick={saveToDb}
                            >
                                ☁️ Lưu vào DB
                            </button>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};

export default AdminExtraction;