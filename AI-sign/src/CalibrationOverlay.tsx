import React from 'react';
import type { Landmark } from './utils';

interface CalibrationOverlayProps {
    poseLandmarks: Landmark[] | null;
    isCorrectPosition: boolean;
    calibrationProgress: number; // 0 to 100
    isAiLoaded: boolean;
}

const CalibrationOverlay: React.FC<CalibrationOverlayProps> = ({
    poseLandmarks,
    isCorrectPosition,
    calibrationProgress,
    isAiLoaded,
}) => {
    // We define a target box in normalized coordinates (0 to 1)
    // For a 4:3 aspect ratio, we want the user to be roughly in the center-top.
    const targetBox = {
        x: 0.25,
        y: 0.15,
        width: 0.5,
        height: 0.7,
    };

    return (
        <div className="calibration-container">
            {!isAiLoaded && (
                <div className="practice-loading-overlay">
                    <div className="practice-loading-spinner" />
                    <p className="practice-loading-text">Initializing Calibration AI...</p>
                </div>
            )}

            {/* Target Alignment Box */}
            <div 
                className={`calibration-box ${isCorrectPosition ? 'is-correct' : ''}`}
                style={{
                    left: `${targetBox.x * 100}%`,
                    top: `${targetBox.y * 100}%`,
                    width: `${targetBox.width * 100}%`,
                    height: `${targetBox.height * 100}%`,
                }}
            >
                <div className="calibration-box-label">
                    {isCorrectPosition ? 'STAY HERE' : 'ALIGN YOUR BODY'}
                </div>
                
                {calibrationProgress > 0 && (
                    <div className="calibration-progress-bar">
                        <div 
                            className="calibration-progress-fill" 
                            style={{ width: `${calibrationProgress}%` }} 
                        />
                    </div>
                )}
            </div>

            {/* Instructions */}
            <div className="calibration-instructions">
                <h3 className="calibration-title">Hardware Calibration</h3>
                <p className="calibration-text">
                    {isCorrectPosition 
                        ? "Great! Hold still for a moment..." 
                        : "Please stand back so your head and shoulders are within the green box."}
                </p>
            </div>

            {/* Visual feedback for landmarks if detected */}
            {poseLandmarks && (
                <div className="calibration-hints">
                    {/* Optional: Add small icons or dots if needed, 
                        but usually the main box is enough for UX */}
                </div>
            )}
        </div>
    );
};

export default CalibrationOverlay;
