import React, { useEffect, useRef, useState } from "react";
import {
    FilesetResolver,
    HandLandmarker,
    type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { Link } from "react-router-dom";
import "./AdminExtraction.css";

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

    // 1. Initialize AI (once)
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
        loadHandLandmarker();
    }, []);

    // Fetch stats on mount
    useEffect(() => {
        fetchStats();
    }, []);

    const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

    // Fetch dataset statistics from API
    const fetchStats = async () => {
        try {
            const response = await fetch("http://localhost:5197/api/sign/stats");
            if (response.ok) {
                const data: SignStats[] = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        }
    };

    // Extract sign name from filename
    const cleanSignName = (fileName: string): string => {
        const nameWithoutExt = fileName.split(".")[0].toLowerCase();
        const simpleName = nameWithoutExt.split(/[-_]/)[0];
        return simpleName;
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
        return new Promise(async (resolve) => {
            if (!videoRef.current || !handLandmarker) {
                resolve([]);
                return;
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
                resolve([]);
                return;
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

            resolve(results);
        });
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
            const response = await fetch("http://localhost:5197/api/sign/batch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
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
            const response = await fetch(
                `http://localhost:5197/api/sign/${encodeURIComponent(signName)}`,
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
                    Multi-frame extraction with augmentation for improved accuracy.
                    Each video produces up to {config.frameTimestamps.length * getAugmentationMultiplier(config)} samples.
                </p>

                {/* Extraction Config */}
                <section className="admin-config-section">
                    <label className="admin-label">Extraction Settings</label>
                    <div className="config-row">
                        <label className="config-checkbox">
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
                        <span className="config-info">
                            Frames: {config.frameTimestamps.length} |
                            Multiplier: {config.enableAugmentation ? getAugmentationMultiplier(config) : 1}x
                        </span>
                    </div>
                </section>

                {/* File Input */}
                <section className="admin-file-section">
                    <label className="admin-label">Video batch input</label>

                    <div className="file-drop-zone">
                        <div className="file-drop-text">
                            {isProcessing
                                ? "Processing... please wait"
                                : handLandmarker
                                    ? "Drag videos here or click 'Choose files'"
                                    : "Loading AI model..."}
                        </div>

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

                {/* Log Panel */}
                <section className="admin-log-panel">
                    <label className="admin-label">Extraction log</label>
                    <textarea
                        className="admin-log-box"
                        readOnly
                        value={logs.join("\n")}
                    />
                </section>

                {/* Action Buttons */}
                <section className="admin-actions">
                    {extractedData.length > 0 && !isProcessing && (
                        <>
                            <span className="admin-chip-btn">
                                Extracted: {extractedData.length} samples
                            </span>
                            <button
                                type="button"
                                className="admin-chip-btn"
                                onClick={downloadJSON}
                            >
                                💾 Download JSON
                            </button>
                            <button
                                type="button"
                                className="admin-chip-btn primary"
                                onClick={saveToDb}
                            >
                                ☁️ Save to DB
                            </button>
                        </>
                    )}
                </section>

                {/* Dataset Statistics */}
                <section className="admin-stats-section">
                    <div className="stats-header">
                        <label className="admin-label">Dataset Statistics</label>
                        <button
                            type="button"
                            className="stats-toggle"
                            onClick={() => setShowStats(!showStats)}
                        >
                            {showStats ? "Hide" : "Show"}
                        </button>
                        <button
                            type="button"
                            className="stats-refresh"
                            onClick={fetchStats}
                        >
                            🔄 Refresh
                        </button>
                    </div>

                    {showStats && (
                        <div className="stats-content">
                            <div className="stats-summary">
                                <span>Total samples: <strong>{totalSamples}</strong></span>
                                <span>Signs: <strong>{stats.length}</strong></span>
                            </div>

                            {stats.length > 0 ? (
                                <table className="stats-table">
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
                                            <tr key={s.signName} className={s.count < 10 ? "low-count" : ""}>
                                                <td className="sign-name">{s.signName.toUpperCase()}</td>
                                                <td>{s.count}</td>
                                                <td>
                                                    {s.count >= 10 ? (
                                                        <span className="status-ok">✓</span>
                                                    ) : (
                                                        <span className="status-warn">⚠ Need more</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="delete-btn"
                                                        onClick={() => deleteSign(s.signName)}
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="stats-empty">No data in database yet.</p>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default AdminExtraction;
