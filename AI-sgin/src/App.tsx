import { useEffect, useRef, useState } from 'react'
import './App.css'

function App() {
    const [inputText, setInputText] = useState('')
    const [sourceLanguage, setSourceLanguage] = useState('english')
    const [targetLanguage, setTargetLanguage] = useState('asl')
    const [stream, setStream] = useState<MediaStream | null>(null)
    const [cameraError, setCameraError] = useState<string | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)

    const swapLanguages = () => {
        setSourceLanguage(targetLanguage)
        setTargetLanguage(sourceLanguage)
    }

    const startCamera = async () => {
        setCameraError(null)
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('getUserMedia is not supported in this browser.')
            }
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30, max: 30 },
                },
                audio: false,
            })
            setStream(mediaStream)
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream
                await videoRef.current.play()
            }
        } catch (err: unknown) {
            console.error('Camera error:', err)
            const msg =
                err instanceof DOMException
                    ? err.name === 'NotAllowedError'
                        ? 'Camera permission denied. Allow access in browser (lock icon) and OS privacy settings.'
                        : err.name === 'NotFoundError'
                            ? 'No camera found. Check if a camera is connected or in use by another app.'
                            : `Camera error: ${err.message}`
                    : 'Unable to access camera. Check permissions and device availability.'
            setCameraError(msg)
            alert(msg)
        }
    }

    const stopCamera = () => {
        stream?.getTracks().forEach((t) => t.stop())
        setStream(null)
        if (videoRef.current) videoRef.current.srcObject = null
        setCameraError(null)
    }

    useEffect(() => {
        return () => stopCamera()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="translator-container">
            <div className="background-gradient"></div>

            <header className="header">
                <div className="logo-section">
                    <div className="logo-icon"></div>
                    <h1>SignBridge</h1>
                </div>
                <p className="tagline">Breaking Communication Barriers</p>
            </header>

            <div className="main-content">
                <div className="translator-card">
                    <div className="language-bar">
                        <div className="language-pill">
                            <span className="language-icon">🗣️</span>
                            <select
                                value={sourceLanguage}
                                onChange={(e) => setSourceLanguage(e.target.value)}
                                className="language-select"
                            >
                                <option value="english">English</option>
                                <option value="spanish">Spanish</option>
                                <option value="french">French</option>
                                <option value="asl">ASL</option>
                            </select>
                        </div>

                        <button className="swap-button" onClick={swapLanguages}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>

                        <div className="language-pill">
                            <span className="language-icon">🤟</span>
                            <select
                                value={targetLanguage}
                                onChange={(e) => setTargetLanguage(e.target.value)}
                                className="language-select"
                            >
                                <option value="asl">ASL</option>
                                <option value="bsl">BSL</option>
                                <option value="english">English</option>
                                <option value="spanish">Spanish</option>
                            </select>
                        </div>
                    </div>

                    <div className="translation-area">
                        <div className="translation-panel input-panel">
                            <div className="panel-header">
                                <h3>Source</h3>
                                <div className="input-options">
                                    <button className="icon-button" title="Paste">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                            <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke="currentColor" strokeWidth="2" />
                                        </svg>
                                    </button>
                                    <button className="icon-button" title="Clear" onClick={() => setInputText('')}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                            <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <textarea
                                className="text-input"
                                placeholder="Type your message here..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                maxLength={5000}
                            />

                            <div className="panel-footer">
                                <div className="camera-controls">
                                    <button


                                        className="feature-button"
                                        onClick={stream ? stopCamera : startCamera}
                                    >
                                        {stream ? 'Stop Camera' : 'Start Camera'}
                                    </button>
                                </div>
                                <span className="char-counter">{inputText.length}/5000</span>
                            </div>

                            {cameraError && <div className="camera-error">{cameraError}</div>}

                            <div className={`camera-shell ${stream ? 'is-active' : ''}`}>
                                {!stream && <div className="camera-placeholder">Camera preview</div>}
                                <video
                                    ref={videoRef}
                                    className={`camera-preview ${stream ? 'is-active' : ''}`}
                                    playsInline
                                    muted
                                />
                            </div>
                        </div>

                        <div className="translation-panel output-panel">
                            <div className="panel-header">
                                <h3>Translation</h3>
                                <div className="output-options">
                                    <button className="icon-button" title="Copy">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                            <path d="M8 17.929H6C4.89543 17.929 4 17.0336 4 15.929V4C4 2.89543 4.89543 2 6 2H18C19.1046 2 20 2.89543 20 4V15.929C20 17.0336 19.1046 17.929 18 17.929H16M8 17.929V20.071C8 21.1756 8.89543 22.071 10 22.071H14C15.1046 22.071 16 21.1756 16 20.071V17.929M8 17.929H16" stroke="currentColor" strokeWidth="2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="translation-output">
                                {inputText ? (
                                    <div className="output-content">
                                        <div className="sign-animation">
                                            <div className="hand-icon">✋</div>
                                            <div className="sign-text">Translating...</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <div className="empty-icon">🤝</div>
                                        <p>Enter text to see translation</p>
                                    </div>
                                )}
                            </div>

                            <div className="panel-footer">
                                <button className="feature-button play-button">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <path d="M5 3L19 12L5 21V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <span>Play Animation</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="quick-actions">
                    <button className="quick-action-card">
                        <span className="action-icon">📚</span>
                    </button>
                    <button className="quick-action-card">
                        <span className="action-icon">⚙️</span>
                    </button>
                    <button className="quick-action-card">
                        <span className="action-icon">❓</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default App