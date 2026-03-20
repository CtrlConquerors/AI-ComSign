import React, { useEffect, useRef, useState } from "react";
import {
    FilesetResolver,
    HandLandmarker,
    type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import "./AdminExtraction.css";

const API_BASE = "http://localhost:5197";

function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem("token");
    return fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...init.headers,
        },
    });
}

// Import shared types and utilities
import type { Landmark, SignSample, SignStats, ExtractionConfig } from "./utils";
import {
    DEFAULT_EXTRACTION_CONFIG,
    augmentSample,
    cleanLandmarks,
    getAugmentationMultiplier,
} from "./utils";

const AdminExtraction: React.FC = () => {
    const [handLandmarker, setHandLandmarker] =
        useState<HandLandmarker | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [extractedData, setExtractedData] = useState<SignSample[]>([]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    // Extraction configuration
    const [config, setConfig] = useState<ExtractionConfig>(DEFAULT_EXTRACTION_CONFIG);

    // Dataset statistics
    const [stats, setStats] = useState<SignStats[]>([]);
    const [showStats, setShowStats] = useState<boolean>(false);

    // Ref for hidden video
    const videoRef = useRef<HTMLVideoElement>(null);

    // Helper function to add log messages
    const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

    // Fetch dataset statistics from API (used by refresh button and initial load)
    const fetchStats = async () => {
        try {
            const response = await authFetch("/api/sign/stats");
            if (response.ok) {
                const data: SignStats[] = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        }
    };

    // 1. Initialize AI and fetch initial stats (once)
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
                numHands: 1,
            });
            setHandLandmarker(landmarker);
            addLog("✅ AI Model loaded. Ready to process videos.");
        };

        const loadInitialStats = async () => {
            try {
                const response = await authFetch("/api/sign/stats");
                if (response.ok) {
                    const data: SignStats[] = await response.json();
                    setStats(data);
                }
            } catch (error) {
                console.error("Failed to fetch stats:", error);
            }
        };

        loadHandLandmarker();
        loadInitialStats();
    }, []);

    // Extract sign name from filename.
    // Expected pattern: "{sign}_-_{id}_-_{source}.mp4"
    // Falls back gracefully for bare names like "k.mp4".
    const cleanSignName = (fileName: string): string => {
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
        const signPart = nameWithoutExt.split("_-_")[0];
        return signPart.replace(/_/g, " ").trim().toLowerCase();
    };

    // Helper to wait for video seek
    const waitForSeek = (video: HTMLVideoElement): Promise<void> => {
        return new Promise((resolve) => {
            const handler = () => {
                video.removeEventListener("seeked", handler);
                resolve();
            };
            video.addEventListener("seeked", handler);
        });
    };

    // Process single video - MULTI-FRAME extraction
    const processSingleVideo = async (file: File): Promise<SignSample[]> => {
        if (!videoRef.current || !handLandmarker) {
            return [];
        }

        const results: SignSample[] = [];
        const url = URL.createObjectURL(file);
        const video = videoRef.current;

        video.src = url;

        // Wait for video metadata
        await new Promise<void>((res) => {
            video.onloadeddata = () => res();
            video.onerror = () => {
                addLog(`❌ Error reading: ${file.name}`);
                res();
            };
        });

        if (!video.duration || video.duration === 0) {
            URL.revokeObjectURL(url);
            return [];
        }

        const signName = cleanSignName(file.name);
        let validFrames = 0;

        // Extract at multiple timestamps
        for (let i = 0; i < config.frameTimestamps.length; i++) {
            const timestamp = config.frameTimestamps[i];
            const frameNum = i + 1;

            // Seek to timestamp
            video.currentTime = video.duration * timestamp;
            await waitForSeek(video);

            // Small delay for stability
            await new Promise((r) => setTimeout(r, 50));

            // Detect hand
            const result: HandLandmarkerResult =
                handLandmarker.detectForVideo(video, Date.now());

            if (result.landmarks && result.landmarks.length > 0) {
                const rawLandmarks = result.landmarks[0] as unknown as Landmark[];

                const baseSample: SignSample = {
                    fileName: `${file.name}_frame${frameNum}`,
                    signName,
                    landmarks: cleanLandmarks(rawLandmarks),
                    frameIndex: i,
                    sourceFileName: file.name,
                    isAugmented: false,
                };

                // Generate augmented versions if enabled
                if (config.enableAugmentation) {
                    const augmented = augmentSample(baseSample, config);
                    results.push(...augmented);
                    addLog(`  ✅ Frame ${frameNum}: ${augmented.length} samples`);
                } else {
                    results.push(baseSample);
                    addLog(`  ✅ Frame ${frameNum}: 1 sample`);
                }
                validFrames++;
            } else {
                addLog(`  ⚠️ Frame ${frameNum}: No hand detected`);
            }
        }

        URL.revokeObjectURL(url);

        if (validFrames > 0) {
            addLog(`✅ ${file.name}: ${results.length} samples from ${validFrames} frames`);
        } else {
            addLog(`⚠️ ${file.name}: No valid frames`);
        }

        return results;
    };

    // Handle file selection
    const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!handLandmarker) return alert("AI not loaded yet, please wait!");
        if (!event.target.files) return;

        const files = Array.from(event.target.files);
        setIsProcessing(true);
        setExtractedData([]);
        setLogs([]);

        const multiplier = config.enableAugmentation
            ? getAugmentationMultiplier(config)
            : 1;
        const expectedMax = files.length * config.frameTimestamps.length * multiplier;

        addLog(`📂 Processing ${files.length} videos...`);
        addLog(`⚙️ Config: ${config.frameTimestamps.length} frames/video, augmentation ${config.enableAugmentation ? "ON" : "OFF"}`);
        addLog(`📊 Max expected samples: ${expectedMax}`);
        addLog("");

        const allResults: SignSample[] = [];

        for (const file of files) {
            addLog(`⏳ Processing: ${file.name}`);
            const results = await processSingleVideo(file);
            allResults.push(...results);
            await new Promise((r) => setTimeout(r, 100));
        }

        setExtractedData(allResults);
        setIsProcessing(false);
        addLog("");
        addLog(`🎉 Done! Extracted ${allResults.length} samples from ${files.length} videos.`);
    };

    // Download as JSON
    const downloadJSON = () => {
        const dataStr =
            "data:text/json;charset=utf-8," +
            encodeURIComponent(JSON.stringify(extractedData, null, 2));
        const downloadAnchorNode = document.createElement("a");
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "sign_language_data.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    // Save to DB using batch endpoint
    const saveToDb = async () => {
        if (extractedData.length === 0) return;

        setIsProcessing(true);
        addLog(`☁️ Saving ${extractedData.length} samples to database...`);

        try {
            const response = await authFetch("/api/sign/batch", {
                method: "POST",
                body: JSON.stringify(extractedData),
            });

            if (response.ok) {
                const result = await response.json();
                addLog(`✅ Saved ${result.Saved} samples to database!`);
                // Refresh stats
                await fetchStats();
            } else {
                const errText = await response.text();
                addLog(`❌ Failed to save: ${response.status} - ${errText}`);
            }
        } catch (error) {
            addLog(`❌ Error saving to DB: ${error}`);
        }

        setIsProcessing(false);
    };

    // Delete samples for a sign
    const deleteSign = async (signName: string) => {
        if (!confirm(`Delete all samples for "${signName}"?`)) return;

        try {
            const response = await authFetch(
                `/api/sign/${encodeURIComponent(signName)}`,
                { method: "DELETE" }
            );

            if (response.ok) {
                const result = await response.json();
                addLog(`🗑️ Deleted ${result.Deleted} samples for "${signName}"`);
                await fetchStats();
            } else {
                addLog(`❌ Failed to delete: ${response.status}`);
            }
        } catch (error) {
            addLog(`❌ Error deleting: ${error}`);
        }
    };

    // Calculate total samples
    const totalSamples = stats.reduce((sum, s) => sum + s.count, 0);

    return (
        <div>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Multi-frame extraction with augmentation for improved accuracy.
                Each video produces up to {config.frameTimestamps.length * getAugmentationMultiplier(config)} samples.
            </p>

            {/* Extraction Config */}
            <div className="admin-table-container" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Extraction Settings
                </h3>
                <div className="extraction-config-row">
                    <label className="extraction-config-checkbox">
                        <input
                            type="checkbox"
                            checked={config.enableAugmentation}
                            onChange={(e) =>
                                setConfig({ ...config, enableAugmentation: e.target.checked })
                            }
                            disabled={isProcessing}
                        />
                        <span>Enable augmentation (mirror + rotation)</span>
                    </label>
                    <span className="extraction-config-info">
                        Frames: {config.frameTimestamps.length} &nbsp;|&nbsp;
                        Multiplier: {config.enableAugmentation ? getAugmentationMultiplier(config) : 1}x
                    </span>
                </div>
            </div>

            {/* File Input */}
            <div className="admin-table-container" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Video Batch Input
                </h3>
                <div className="extraction-drop-zone">
                    <span className="extraction-drop-text">
                        {isProcessing
                            ? "Processing... please wait"
                            : handLandmarker
                                ? "Select video files to process"
                                : "Loading AI model..."}
                    </span>
                    <label className="admin-action-btn promote extraction-file-label">
                        Choose files
                        <input
                            type="file"
                            multiple
                            accept="video/*"
                            onChange={handleFiles}
                            disabled={isProcessing || !handLandmarker}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>
                <div className="extraction-status-bar">
                    <span className="extraction-status-dot" />
                    <span>
                        {handLandmarker
                            ? isProcessing
                                ? "Processing videos..."
                                : "AI model ready."
                            : "Loading AI model..."}
                    </span>
                </div>
            </div>

            {/* Hidden video for extraction */}
            <video ref={videoRef} style={{ display: "none" }} muted />

            {/* Log Panel */}
            <div className="admin-table-container" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Extraction Log
                </h3>
                <textarea
                    className="extraction-log-box"
                    readOnly
                    value={logs.join("\n")}
                />
            </div>

            {/* Action Buttons */}
            {extractedData.length > 0 && !isProcessing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', color: '#475569', fontWeight: 500 }}>
                        Extracted: <strong style={{ color: '#0f172a' }}>{extractedData.length}</strong> samples
                    </span>
                    <button type="button" className="admin-action-btn" onClick={downloadJSON}>
                        💾 Download JSON
                    </button>
                    <button type="button" className="admin-action-btn promote" onClick={saveToDb}>
                        ☁️ Save to DB
                    </button>
                </div>
            )}

            {/* Dataset Statistics */}
            <div className="admin-table-container" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, flex: 1, color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                        Dataset Statistics
                        <span style={{ marginLeft: '1rem', color: '#94a3b8', fontWeight: 400, textTransform: 'none', fontSize: '0.75rem' }}>
                            {totalSamples} samples &nbsp;·&nbsp; {stats.length} signs
                        </span>
                    </h3>
                    <button type="button" className="admin-action-btn" onClick={() => setShowStats(!showStats)}>
                        {showStats ? "Hide" : "Show"}
                    </button>
                    <button type="button" className="admin-action-btn" style={{ marginLeft: '0.5rem' }} onClick={fetchStats}>
                        🔄 Refresh
                    </button>
                </div>

                {showStats && (
                    stats.length > 0 ? (
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Sign</th>
                                    <th>Count</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.map((s) => (
                                    <tr key={s.signName}>
                                        <td style={{ fontWeight: 600 }}>{s.signName.toUpperCase()}</td>
                                        <td>{s.count}</td>
                                        <td>
                                            {s.count >= 10 ? (
                                                <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Good</span>
                                            ) : (
                                                <span style={{ color: '#d97706', fontSize: '0.8rem' }}>⚠ Need more</span>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="admin-action-btn delete"
                                                onClick={() => deleteSign(s.signName)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem 0' }}>No data in database yet.</p>
                    )
                )}
            </div>
        </div>
    );
};

export default AdminExtraction;
